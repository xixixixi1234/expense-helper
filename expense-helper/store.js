const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads_store");
const PRESETS_FILE = path.join(DATA_DIR, "presets.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.jsonl");

for (const d of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

// ---- Preset invoices ----------------------------------------------------
// Three fixed invoices shown to every participant. Admin can replace the
// image and edit the extracted fields for each slot (id: 1,2,3).
const DEFAULT_PRESETS = [
  {
    id: 1,
    title: "Invoice 1",
    imageFile: null, // set when admin uploads an image
    fields: {
      employee: "Linda", department: "Finance", claimId: "EH-2026-0801-017",
      tripPurpose: "Business Meeting", destination: "Boston, USA",
      tripDates: "Aug 1 - Aug 4, 2026", invoiceDate: "Aug 5, 2026",
      submitted: "Aug 5, 2026", category: "Hotel",
      description: "Hotel stay in Boston, 3 nights",
      amount: "795.00", currency: "USD", total: "$795.00",
    },
  },
  {
    id: 2,
    title: "Invoice 2",
    imageFile: null,
    fields: {
      employee: "Mark", department: "Sales", claimId: "EH-2026-0802-004",
      tripPurpose: "Client Visit", destination: "Chicago, USA",
      tripDates: "Aug 2 - Aug 3, 2026", invoiceDate: "Aug 4, 2026",
      submitted: "Aug 4, 2026", category: "Flight",
      description: "Round-trip flight to Chicago",
      amount: "430.00", currency: "USD", total: "$430.00",
    },
  },
  {
    id: 3,
    title: "Invoice 3",
    imageFile: null,
    fields: {
      employee: "Sara", department: "Marketing", claimId: "EH-2026-0803-011",
      tripPurpose: "Conference", destination: "New York, USA",
      tripDates: "Aug 5 - Aug 7, 2026", invoiceDate: "Aug 8, 2026",
      submitted: "Aug 8, 2026", category: "Meals",
      description: "Team dinner, 6 guests",
      amount: "612.00", currency: "USD", total: "$612.00",
    },
  },
];

function loadPresets() {
  try {
    if (fs.existsSync(PRESETS_FILE)) {
      return JSON.parse(fs.readFileSync(PRESETS_FILE, "utf8"));
    }
  } catch (e) {
    console.error("loadPresets error:", e.message);
  }
  savePresets(DEFAULT_PRESETS);
  return DEFAULT_PRESETS;
}

function savePresets(presets) {
  fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));
}

function updatePreset(id, patch) {
  const presets = loadPresets();
  const idx = presets.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return null;
  presets[idx] = Object.assign({}, presets[idx], patch);
  if (patch.fields) {
    presets[idx].fields = Object.assign({}, presets[idx].fields, patch.fields);
  }
  savePresets(presets);
  return presets[idx];
}

// ---- Event log (participant actions) -----------------------------------
function logEvent(evt) {
  const line = JSON.stringify(Object.assign({ ts: new Date().toISOString() }, evt));
  fs.appendFileSync(EVENTS_FILE, line + "\n");
}

function readEvents() {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  return fs
    .readFileSync(EVENTS_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try { return JSON.parse(l); } catch { return { raw: l }; }
    });
}

module.exports = {
  DATA_DIR, UPLOAD_DIR, EVENTS_FILE,
  loadPresets, savePresets, updatePreset,
  logEvent, readEvents,
};
