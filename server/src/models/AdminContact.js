const mongoose = require("mongoose");

const adminContactSchema = new mongoose.Schema(
  {
    customer_phone: { type: String, required: true, unique: true, index: true },
    customer_name: { type: String, trim: true, maxlength: 120 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("AdminContact", adminContactSchema);
