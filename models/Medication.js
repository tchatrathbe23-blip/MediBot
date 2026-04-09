const mongoose = require("mongoose");

const medicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  schedule: { type: [String], default: [] }, // e.g. ["Morning", "Evening"]
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Medication", medicationSchema);
