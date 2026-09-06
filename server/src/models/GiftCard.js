const mongoose = require("mongoose");

function oneYearFromNow() {
  const value = new Date();
  value.setUTCFullYear(value.getUTCFullYear() + 1);
  return value;
}

const giftCardTransactionSchema = new mongoose.Schema(
  {
    receipt_number: { type: String, trim: true, uppercase: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount_cents: { type: Number, required: true, min: 1 },
    balance_after_cents: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, maxlength: 500 },
    created_by: { type: String, trim: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const giftCardSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, index: true },
    customer_name: { type: String, required: true, trim: true, maxlength: 120 },
    customer_email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    customer_phone: { type: String, trim: true, maxlength: 40 },
    notes: { type: String, trim: true, maxlength: 1000 },
    receipt_number: { type: String, unique: true, sparse: true, trim: true, uppercase: true, index: true },
    issued_amount_cents: { type: Number, required: true, min: 0, default: 0 },
    balance_cents: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: ["active", "inactive", "expired"], default: "active", index: true },
    expires_at: { type: Date, required: true, default: oneYearFromNow, index: true },
    transactions: { type: [giftCardTransactionSchema], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("GiftCard", giftCardSchema);
