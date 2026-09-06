const mongoose = require("mongoose");

const printJobSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["gift_card_receipt"], required: true, index: true },
    status: { type: String, enum: ["queued", "printing", "printed", "failed"], default: "queued", index: true },
    payload: {
      receipt_number: { type: String, required: true },
      customer_name: { type: String, required: true },
      code: { type: String, required: true },
      issued_amount_cents: { type: Number, required: true, min: 0 },
      created_at: { type: Date, required: true },
      expires_at: { type: Date, required: true },
    },
    requested_by: { type: String, trim: true },
    attempts: { type: Number, default: 0, min: 0 },
    lease_token: { type: String },
    lease_until: { type: Date },
    printed_at: { type: Date },
    error: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

printJobSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = mongoose.model("PrintJob", printJobSchema);
