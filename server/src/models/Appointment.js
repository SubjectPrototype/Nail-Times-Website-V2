const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    customer_name: { type: String, required: true, trim: true },
    customer_email: { type: String, required: true, trim: true, lowercase: true },
    customer_phone: { type: String, trim: true },
    service: { type: String, required: true, trim: true },
    selected_services: [
      {
        name: { type: String, required: true },
        category: { type: String },
        category_values: [{ type: Number, enum: [0, 1, 2, 3] }],
        technician: { type: String },
        price: { type: Number },
        duration_minutes: { type: Number, min: 1 },
      },
    ],
    start_time: { type: Date, required: true, index: true },
    end_time: { type: Date, required: true, index: true },
    duration_minutes: { type: Number, required: true, min: 1, default: 60 },
    notes: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },
    confirmed_at: { type: Date },
    cancelled_at: { type: Date },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// Automatically remove appointment documents 6 months after they are created.
appointmentSchema.index({ created_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 * 6 });

module.exports = mongoose.model("Appointment", appointmentSchema);
