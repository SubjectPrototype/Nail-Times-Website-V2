const mongoose = require("mongoose");

const adminOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, index: true },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true, index: true },
    used_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("AdminOtp", adminOtpSchema);
