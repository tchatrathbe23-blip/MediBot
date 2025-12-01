const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetOtp: String,
  resetOtpExpire: Date
});

module.exports = mongoose.model("User", userSchema);
