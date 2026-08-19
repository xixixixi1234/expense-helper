// Company expense guide - the 10 rules the auditor checks against.
const GUIDE_RULES = [
  "Employees must submit a claim within 30 days of the trip.",
  "Each claim must include a receipt.",
  "Hotel cost cannot go over $200 per night.",
  "Meals cannot go over $76 per day.",
  "Employees must use economy class for flights under 6 hours one way. Travel meal expenses in flight must not exceed $100.",
  "Rental cars must be a standard model, not luxury.",
  "Personal expenses cannot be claimed.",
  "Taxi and rideshare are allowed for airport trips.",
  "Alcohol cannot be claimed as a meal expense.",
  "Claims over $2,000 need manager approval before the trip.",
];

function guideText() {
  return GUIDE_RULES.map(function (r, i) { return (i + 1) + ". " + r; }).join("\n");
}

module.exports = { GUIDE_RULES, guideText };
