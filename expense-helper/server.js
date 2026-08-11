const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const store = require("./store");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123"; // change in Railway Variables

const DEMO_ANSWER =
  "This claim is valid. The hotel cost fits a normal 3 night trip. " +
  "The receipt is present and the claim is on time. Click Approve to finalize.";

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

app.use(express.json({ limit: "6mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve uploaded preset/participant images
app.use("/files", express.static(store.UPLOAD_DIR));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// ---- AI helpers ---------------------------------------------------------
function buildSystemPrompt() {
  return [
    "You are ExpenseHelper, an AI audit assistant that helps a human auditor review",
    "employee expense claims. You do NOT make the final decision. You surface facts,",
    "flag anything that may violate the company expense guide, and give a clear",
    "recommendation. Always remind the auditor that the final Approve/Reject decision",
    "is theirs and that your check may not cover every rule in the manual.",
    "Be concise. When a claim genuinely looks fine, say so plainly and note that they",
    "may click Approve to finalize. When something looks off, call it out specifically.",
  ].join(" ");
}

function buildClaimContext(claim) {
  if (!claim) return "No claim data.";
  return Object.keys(claim).map(function (k) { return k + ": " + claim[k]; }).join("\n");
}

// ---- Participant login (just an ID) ------------------------------------
app.post("/api/login", function (req, res) {
  const pid = (req.body && req.body.pid ? String(req.body.pid) : "").trim();
  if (!pid) return res.status(400).json({ error: "Participant ID required" });
  store.logEvent({ type: "login", pid: pid });
  res.json({ ok: true, pid: pid });
});

// ---- Get preset invoices (for participant view) ------------------------
app.get("/api/presets", function (_req, res) {
  res.json({ presets: store.loadPresets(), aiConfigured: Boolean(genAI) });
});

// ---- Log a participant event -------------------------------------------
app.post("/api/event", function (req, res) {
  const b = req.body || {};
  if (!b.pid || !b.type) return res.status(400).json({ error: "pid and type required" });
  store.logEvent(b);
  res.json({ ok: true });
});

// ---- Extract invoice (participant self-upload) -------------------------
app.post("/api/extract", upload.single("receipt"), async function (req, res) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const mime = req.file.mimetype;
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    return res.status(400).json({ error: "Upload an image or PDF." });
  }
  if (!genAI) {
    return res.json({
      ok: true, demo: true,
      note: "No GEMINI_API_KEY set - placeholder extraction, not a real read.",
      fields: {
        vendor: "Sample Vendor", destination: "Boston, USA", category: "Hotel",
        description: "Hotel stay, 3 nights", startDate: "Aug 1, 2026", endDate: "Aug 4, 2026",
        invoiceDate: "Aug 5, 2026", invoiceNumber: "INV-0001", currency: "USD", amount: "795.00",
      },
    });
  }
  const instruction =
    "You are an invoice data extractor. Return ONLY a JSON object (no markdown) with keys: " +
    "vendor, destination, category, description, startDate, endDate, invoiceDate, " +
    "invoiceNumber, currency, amount. Use 'N/A' if not found. Dates like 'Aug 1, 2026'. " +
    "amount is the grand total as a plain number string with no symbol.";
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    const result = await model.generateContent([
      { text: instruction },
      { inlineData: { mimeType: mime, data: req.file.buffer.toString("base64") } },
    ]);
    let raw = (result.response.text() || "{}").trim();
    let fields;
    try { fields = JSON.parse(raw); }
    catch { fields = JSON.parse(raw.replace(/^```json?/i, "").replace(/```$/, "").trim() || "{}"); }
    res.json({ ok: true, demo: false, fields: fields });
  } catch (err) {
    console.error("Extract error:", err.message);
    res.status(500).json({ ok: false, error: "Extraction failed: " + err.message });
  }
});

// ---- Chat / audit -------------------------------------------------------
app.post("/api/chat", async function (req, res) {
  const b = req.body || {};
  if (b.pid) store.logEvent({ type: "chat_user", pid: b.pid, invoiceId: b.invoiceId, message: b.message });
  if (!genAI) {
    if (b.pid) store.logEvent({ type: "chat_ai", pid: b.pid, invoiceId: b.invoiceId, reply: DEMO_ANSWER, demo: true });
    return res.json({ reply: DEMO_ANSWER, demo: true, note: "No GEMINI_API_KEY set - placeholder answer." });
  }
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: buildSystemPrompt() + "\n\nClaim under review:\n" + buildClaimContext(b.claim),
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    });
    const contents = [];
    if (Array.isArray(b.history)) {
      b.history.forEach(function (h) {
        if (h && h.content) contents.push({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: String(h.content) }] });
      });
    }
    contents.push({ role: "user", parts: [{ text: b.message || "Please review this claim and give your assessment." }] });
    const result = await model.generateContent({ contents: contents });
    const reply = (result.response.text() || "").trim() || DEMO_ANSWER;
    if (b.pid) store.logEvent({ type: "chat_ai", pid: b.pid, invoiceId: b.invoiceId, reply: reply });
    res.json({ reply: reply, demo: false });
  } catch (err) {
    console.error("Gemini error:", err.message);
    res.json({ reply: DEMO_ANSWER, demo: true, note: "Model call failed - placeholder answer." });
  }
});

// ================= ADMIN =================================================
function checkAdmin(req, res, next) {
  const key = req.headers["x-admin-key"] || (req.query && req.query.key) || (req.body && req.body.adminKey);
  if (key !== ADMIN_KEY) return res.status(401).json({ error: "Unauthorized. Wrong admin key." });
  next();
}

// Upload/replace a preset invoice image + optionally edit fields
app.post("/api/admin/preset/:id", checkAdmin, upload.single("image"), function (req, res) {
  const id = req.params.id;
  const patch = {};
  if (req.file) {
    const ext = (req.file.originalname.match(/\.[a-z0-9]+$/i) || [".png"])[0];
    const fname = "preset_" + id + "_" + Date.now() + ext;
    fs.writeFileSync(path.join(store.UPLOAD_DIR, fname), req.file.buffer);
    patch.imageFile = fname;
  }
  if (req.body && req.body.fields) {
    try { patch.fields = JSON.parse(req.body.fields); } catch (e) {}
  }
  if (req.body && req.body.title) patch.title = req.body.title;
  const updated = store.updatePreset(id, patch);
  if (!updated) return res.status(404).json({ error: "Preset not found" });
  res.json({ ok: true, preset: updated });
});

// View all participant events
app.get("/api/admin/events", checkAdmin, function (_req, res) {
  res.json({ events: store.readEvents() });
});

// Export events as JSONL download
app.get("/api/admin/export", checkAdmin, function (_req, res) {
  if (!fs.existsSync(store.EVENTS_FILE)) return res.status(404).send("No data yet.");
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Content-Disposition", "attachment; filename=events.jsonl");
  fs.createReadStream(store.EVENTS_FILE).pipe(res);
});

app.get("/api/health", function (_req, res) { res.json({ ok: true, aiConfigured: Boolean(genAI) }); });

// Page routes
app.get("/experiment", function (_req, res) { res.sendFile(path.join(__dirname, "public", "experiment.html")); });
app.get("/admin", function (_req, res) { res.sendFile(path.join(__dirname, "public", "admin.html")); });

app.listen(PORT, function () {
  console.log("ExpenseHelper (experiment) on port " + PORT);
  console.log("AI configured: " + Boolean(genAI));
});
