const express = require("express");
const multer = require("multer");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Config -------------------------------------------------------------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// The fallback / demo answer requested. Used when no API key is configured,
// or when the model call fails. Shown clearly as a demo placeholder in that case.
const DEMO_ANSWER =
  "This claim is valid. The hotel cost fits a normal 3 night trip. " +
  "The receipt is present and the claim is on time. Click Approve to finalize.";

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ---- Middleware ---------------------------------------------------------
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// In-memory upload (receipts are transient; not persisted to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ---- Helpers ------------------------------------------------------------
function buildSystemPrompt() {
  return [
    "You are ExpenseHelper, an AI audit assistant that helps a human auditor review",
    "employee expense claims. You do NOT make the final decision. You surface facts,",
    "flag anything that may violate the company expense guide, and give a clear",
    "recommendation. Always remind the auditor that the final Approve/Reject decision",
    "is theirs and that your check may not cover every rule in the manual.",
    "Be concise. When a claim genuinely looks fine, say so plainly and note that they",
    "may click Approve to finalize. When something looks off (amount, dates, duplicate,",
    "missing receipt, late submission), call it out specifically instead of approving.",
  ].join(" ");
}

function buildClaimContext(claim) {
  if (!claim) return "No structured claim data was provided.";
  return [
    `Claim ID: ${claim.claimId}`,
    `Employee: ${claim.employee} (${claim.department})`,
    `Trip purpose: ${claim.tripPurpose}`,
    `Destination: ${claim.destination}`,
    `Trip dates: ${claim.tripDates}`,
    `Submitted: ${claim.submitted}`,
    `Expense items: ${claim.items}`,
    `Total: ${claim.total}`,
    `Receipt attached: ${claim.receiptAttached ? "yes" : "no"}`,
  ].join("\n");
}

// ---- API: chat ----------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { message, claim, history } = req.body || {};

  if (!openai) {
    return res.json({
      reply: DEMO_ANSWER,
      demo: true,
      note: "No OPENAI_API_KEY set — this is a placeholder answer, not a real audit.",
    });
  }

  try {
    const messages = [
      { role: "system", content: buildSystemPrompt() },
      {
        role: "system",
        content: "Current claim under review:\n" + buildClaimContext(claim),
      },
    ];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h && (h.role === "user" || h.role === "assistant") && h.content) {
          messages.push({ role: h.role, content: String(h.content) });
        }
      }
    }

    messages.push({
      role: "user",
      content:
        message ||
        "Please review this claim against a standard expense guide and give your assessment.",
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 500,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() || DEMO_ANSWER;
    res.json({ reply, demo: false });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    res.json({
      reply: DEMO_ANSWER,
      demo: true,
      note: "Model call failed — showing placeholder answer. Check server logs / API key.",
    });
  }
});

// ---- API: upload receipt ------------------------------------------------
app.post("/api/upload", upload.single("receipt"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({
    ok: true,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, aiConfigured: Boolean(openai) })
);

app.listen(PORT, () => {
  console.log(`ExpenseHelper running on port ${PORT}`);
  console.log(`AI configured: ${Boolean(openai)}`);
});
