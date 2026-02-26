const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    customer_phone: { type: String, required: true, index: true },
    customer_name: { type: String, trim: true, maxlength: 120 },
    direction: { type: String, enum: ["inbound", "outbound"], required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    twilio_message_sid: { type: String, trim: true, sparse: true, index: true },
    twilio_status: { type: String, trim: true },
    read_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

messageSchema.index({ customer_phone: 1, created_at: -1 });

module.exports = mongoose.model("Message", messageSchema);
