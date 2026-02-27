require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const { connectDb } = require("./db");
const {
  sendBookingEmails,
  sendAdminOtpEmail,
  sendBookingConfirmedEmail,
  sendAdminInboundMessageEmail,
} = require("./email");
const { requireAdmin } = require("./middleware/auth");
const Appointment = require("./models/Appointment");
const AdminOtp = require("./models/AdminOtp");
const Message = require("./models/Message");

const app = express();
app.set("trust proxy", true);

const port = process.env.PORT || 4000;
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const clientOrigins = Array.from(
  new Set(
    [clientOrigin, "http://localhost:3000", "http://127.0.0.1:3000"]
      .join(",")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  )
);
const adminEmail = process.env.ADMIN_EMAIL;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const defaultAppointmentMinutes = Number(process.env.DEFAULT_APPOINTMENT_MINUTES || 60);
const admin2faEnabled = String(process.env.ADMIN_2FA_ENABLED || "false").toLowerCase() === "true";
const businessTimeZone = process.env.BUSINESS_TIMEZONE || "America/Chicago";
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioWebhookBaseUrl = process.env.TWILIO_WEBHOOK_BASE_URL;
const adminNotifyPhone = process.env.ADMIN_NOTIFY_PHONE;
const adminChatPresenceTtlMs = Number(process.env.ADMIN_CHAT_PRESENCE_TTL_MS || 60000);
const activeAdminChats = new Map();
const validateTwilioWebhook = String(process.env.TWILIO_VALIDATE_WEBHOOK || "true").toLowerCase() !== "false";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required");
}

if (!adminEmail || !adminPasswordHash) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD_HASH are required");
}

function normalizePhoneNumber(input) {
  if (!input) {
    return "";
  }

  const trimmed = String(input).trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return digits ? `+${digits}` : "";
}

function buildTwilioSignature(url, params, authToken) {
  const sortedKeys = Object.keys(params || {}).sort();
  const data = sortedKeys.reduce((acc, key) => `${acc}${key}${params[key] ?? ""}`, url);

  return crypto.createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

function getTwilioValidationUrls(req) {
  const urls = [];
  const base = (twilioWebhookBaseUrl || "").trim().replace(/\/+$/, "");
  const path = req.path || "";

  if (base) {
    // Support either:
    // 1) TWILIO_WEBHOOK_BASE_URL as origin/base (e.g. https://api.example.com)
    // 2) TWILIO_WEBHOOK_BASE_URL as full webhook URL (e.g. https://api.example.com/api/twilio/webhook)
    if (base.endsWith(path)) {
      urls.push(base);
    } else {
      urls.push(`${base}${path.startsWith("/") ? "" : "/"}${path}`);
    }

    if (base.startsWith("http://")) {
      const httpsBase = `https://${base.slice("http://".length)}`;
      if (httpsBase.endsWith(path)) {
        urls.push(httpsBase);
      } else {
        urls.push(`${httpsBase}${path.startsWith("/") ? "" : "/"}${path}`);
      }
    } else if (base.startsWith("https://")) {
      const httpBase = `http://${base.slice("https://".length)}`;
      if (httpBase.endsWith(path)) {
        urls.push(httpBase);
      } else {
        urls.push(`${httpBase}${path.startsWith("/") ? "" : "/"}${path}`);
      }
    }
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocolCandidates = Array.from(
    new Set([forwardedProto, req.protocol, "https", "http"].filter(Boolean))
  );
  const host = req.get("host");

  if (host) {
    for (const proto of protocolCandidates) {
      urls.push(`${proto}://${host}${req.originalUrl || req.path || ""}`);
      urls.push(`${proto}://${host}${req.path || ""}`);
    }
  }

  return Array.from(new Set(urls.filter(Boolean)));
}

function isValidTwilioWebhook(req) {
  if (!validateTwilioWebhook) {
    return true;
  }

  if (!twilioAuthToken || !twilioWebhookBaseUrl) {
    return true;
  }

  const signature = req.headers["x-twilio-signature"];
  if (!signature) {
    return false;
  }

  const receivedBuffer = Buffer.from(String(signature), "utf8");
  const candidateUrls = getTwilioValidationUrls(req);

  for (const url of candidateUrls) {
    const expected = buildTwilioSignature(url, req.body || {}, twilioAuthToken);
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (expectedBuffer.length !== receivedBuffer.length) {
      continue;
    }
    if (crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return true;
    }
  }

  return false;
}

function sendTwilioEmptyResponse(res) {
  return res.status(200).type("text/xml").send("<Response></Response>");
}

function requireTwilioCredentials() {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required");
  }
}

async function sendSmsWithTwilio({ to, body }) {
  requireTwilioCredentials();

  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) {
    throw new Error("Invalid recipient phone number");
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: normalizedTo,
    From: twilioFromNumber,
    Body: body,
  });

  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error_message || "Twilio send failed";
    throw new Error(message);
  }

  return payload;
}

function formatBookingDateTime(dateInput) {
  return new Date(dateInput).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: businessTimeZone,
  });
}

function toServiceSummary(booking) {
  if (Array.isArray(booking.selected_services) && booking.selected_services.length > 0) {
    return booking.selected_services.map((item) => item.name).join(", ");
  }
  return booking.service || "your service";
}

async function logOutboundSms({ booking, body, twilioSid, twilioStatus }) {
  const to = normalizePhoneNumber(booking.customer_phone);
  if (!to) {
    return;
  }

  await Message.create({
    customer_phone: to,
    customer_name: booking.customer_name || undefined,
    direction: "outbound",
    body,
    twilio_message_sid: twilioSid || undefined,
    twilio_status: twilioStatus || undefined,
    read_at: new Date(),
  });
}

async function sendBookingSmsNotification({ booking, body }) {
  const to = normalizePhoneNumber(booking.customer_phone);
  if (!to || !body) {
    return;
  }

  try {
    const sent = await sendSmsWithTwilio({ to, body });
    await logOutboundSms({
      booking,
      body,
      twilioSid: sent.sid,
      twilioStatus: sent.status,
    });
  } catch (error) {
    console.error("Failed to send booking SMS notification", error.message || error);
  }
}

async function sendAdminBookingSmsNotification({ booking }) {
  const to = normalizePhoneNumber(adminNotifyPhone);
  if (!to) {
    return;
  }

  const body =
    `New booking request: ${booking.customer_name} ` +
    `(${booking.customer_phone || booking.customer_email}) ` +
    `for ${formatBookingDateTime(booking.start_time)}. ` +
    `Services: ${toServiceSummary(booking)}.`;

  try {
    await sendSmsWithTwilio({ to, body });
  } catch (error) {
    console.error("Failed to send admin booking SMS notification", error.message || error);
  }
}

function clearExpiredAdminChatPresence() {
  const now = Date.now();
  for (const [phone, updatedAt] of activeAdminChats.entries()) {
    if (now - updatedAt > adminChatPresenceTtlMs) {
      activeAdminChats.delete(phone);
    }
  }
}

function setAdminActiveChat(phone) {
  clearExpiredAdminChatPresence();
  for (const key of activeAdminChats.keys()) {
    if (key !== phone) {
      activeAdminChats.delete(key);
    }
  }

  if (phone) {
    activeAdminChats.set(phone, Date.now());
  }
}

function clearAdminActiveChat(phone) {
  clearExpiredAdminChatPresence();
  if (phone) {
    activeAdminChats.delete(phone);
  }
}

function isAdminViewingChat(phone) {
  clearExpiredAdminChatPresence();
  return Boolean(phone && activeAdminChats.has(phone));
}

async function sendAdminIncomingMessageNotification({ from, customerName, body }) {
  const to = normalizePhoneNumber(adminNotifyPhone);
  if (!to) {
    return;
  }

  const preview = String(body || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const label = customerName || from;
  const text = `New customer text from ${label} (${from}): ${preview}`;

  try {
    await sendSmsWithTwilio({ to, body: text });
  } catch (error) {
    console.error("Failed to send admin inbound SMS notification", error.message || error);
  }
}

async function getMessageThreadName(phone) {
  const latestNamedMessage = await Message.findOne({
    customer_phone: phone,
    customer_name: { $exists: true, $ne: "" },
  })
    .sort({ created_at: -1 })
    .lean();

  return latestNamedMessage?.customer_name || "";
}

async function getBookingCustomerName(phone) {
  const target = normalizePhoneNumber(phone);
  if (!target) {
    return "";
  }

  const appointments = await Appointment.find({
    customer_phone: { $exists: true, $ne: "" },
    customer_name: { $exists: true, $ne: "" },
  })
    .sort({ created_at: -1 })
    .select({ customer_name: 1, customer_phone: 1 })
    .lean();

  const matched = appointments.find((appointment) => {
    const normalized = normalizePhoneNumber(appointment.customer_phone);
    return normalized && normalized === target;
  });

  return matched?.customer_name || "";
}

async function getThreadName(phone) {
  const messageName = await getMessageThreadName(phone);
  if (messageName) {
    return messageName;
  }

  return getBookingCustomerName(phone);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      const isLanOrigin = /^http:\/\/(?:10|192\.168|172\.(?:1[6-9]|2\d|3[0-1]))(?:\.\d{1,3}){2}:\d+$/.test(origin);
      if (isLanOrigin) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

async function ensureAppointmentIndexes() {
  try {
    const indexes = await Appointment.collection.indexes();
    const startTimeIndex = indexes.find((index) => index.name === "start_time_1");

    if (startTimeIndex?.unique) {
      await Appointment.collection.dropIndex("start_time_1");
      await Appointment.collection.createIndex({ start_time: 1 });
      console.log("Updated appointments.start_time index to non-unique");
    }
  } catch (error) {
    console.error("Failed to verify appointment indexes:", error.message || error);
  }
}

connectDb()
  .then(() => ensureAppointmentIndexes())
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/twilio/webhook", async (req, res) => {
  if (!isValidTwilioWebhook(req)) {
    console.warn("Rejected Twilio webhook due to signature mismatch", {
      configuredBase: twilioWebhookBaseUrl || "(not set)",
      path: req.path,
      host: req.get("host"),
    });
    return res.status(401).type("text/plain").send("Unauthorized");
  }

  try {
    const from = normalizePhoneNumber(req.body.From);
    const body = String(req.body.Body || "").trim();
    const incomingName = String(req.body.ProfileName || req.body.FromCity || "").trim();
    const existingName = from ? await getThreadName(from) : "";
    const customerName = existingName || incomingName || undefined;

    if (!from || !body) {
      return sendTwilioEmptyResponse(res);
    }

    await Message.create({
      customer_phone: from,
      customer_name: customerName,
      direction: "inbound",
      body,
      twilio_message_sid: req.body.MessageSid || undefined,
      twilio_status: req.body.MessageStatus || undefined,
    });

    if (!isAdminViewingChat(from)) {
      await sendAdminIncomingMessageNotification({ from, customerName, body });
      try {
        await sendAdminInboundMessageEmail({ from, customerName, body });
      } catch (error) {
        console.error("Failed to send admin inbound email notification", error.message || error);
      }
    }

    console.log("Twilio inbound message saved", {
      from,
      sid: req.body.MessageSid || undefined,
      notified_admin: !isAdminViewingChat(from),
    });

    return sendTwilioEmptyResponse(res);
  } catch (error) {
    console.error("Twilio webhook processing failed", error);
    return res.status(500).type("text/plain").send("Server error");
  }
});

app.post("/api/admin/login/init", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { email, password } = parsed.data;

  if (email !== adminEmail) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, adminPasswordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  if (!admin2faEnabled) {
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "12h" });
    return res.json({ token, requires_2fa: false });
  }

  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const codeHash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await AdminOtp.create({
    email,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  await sendAdminOtpEmail({ email, code });

  return res.json({ ok: true, requires_2fa: true });
});

app.post("/api/admin/login/verify", async (req, res) => {
  if (!admin2faEnabled) {
    return res.status(400).json({ error: "2FA is disabled" });
  }

  const schema = z.object({
    email: z.string().email(),
    code: z.string().min(6).max(6),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const { email, code } = parsed.data;
  if (email !== adminEmail) {
    return res.status(401).json({ error: "Invalid code" });
  }

  const otp = await AdminOtp.findOne({
    email,
    used_at: { $exists: false },
    expires_at: { $gt: new Date() },
  })
    .sort({ created_at: -1 })
    .lean();

  if (!otp) {
    return res.status(401).json({ error: "Invalid code" });
  }

  const ok = await bcrypt.compare(code, otp.code_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid code" });
  }

  await AdminOtp.updateOne({ _id: otp._id }, { $set: { used_at: new Date() } });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "12h" });
  return res.json({ token });
});

const bookingSchema = z.object({
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().min(7).optional(),
  service: z.string().min(1),
  selected_services: z
    .array(
      z.object({
        name: z.string().min(1),
        category: z.string().optional(),
        category_values: z.array(z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])).optional(),
        technician: z.string().optional(),
        price: z.number().optional(),
        duration_minutes: z.number().int().positive().optional(),
      })
    )
    .optional(),
  duration_minutes: z.number().int().positive().optional(),
  start_time: z.string().min(10),
  notes: z.string().max(1000).optional(),
});

app.post("/api/bookings", async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const booking = parsed.data;

  try {
    const startTime = new Date(booking.start_time);
    if (Number.isNaN(startTime.getTime())) {
      return res.status(400).json({ error: "Invalid start time" });
    }

    const requestedDurationMinutes = Number(booking.duration_minutes || defaultAppointmentMinutes);
    const endTime = new Date(startTime.getTime() + requestedDurationMinutes * 60 * 1000);

    // Block any overlap where existing.start < requested.end and existing.end > requested.start.
    const overlap = await Appointment.aggregate([
      {
        $addFields: {
          effective_end_time: {
            $ifNull: [
              "$end_time",
              {
                $dateAdd: {
                  startDate: "$start_time",
                  unit: "minute",
                  amount: { $ifNull: ["$duration_minutes", defaultAppointmentMinutes] },
                },
              },
            ],
          },
        },
      },
      {
        $match: {
          status: { $ne: "cancelled" },
          start_time: { $lt: endTime },
          effective_end_time: { $gt: startTime },
        },
      },
      { $limit: 1 },
      { $project: { _id: 1 } },
    ]);

    if (overlap.length > 0) {
      return res.status(409).json({ error: "Time slot overlaps with another appointment" });
    }

    const created = await Appointment.create({
      ...booking,
      start_time: startTime,
      end_time: endTime,
      duration_minutes: requestedDurationMinutes,
    });

    await sendBookingEmails({ booking: created.toObject(), adminEmail });
    await sendBookingSmsNotification({
      booking: created.toObject(),
      body: `Nail Times: Hi ${created.customer_name}, we received your booking request for ${formatBookingDateTime(
        created.start_time
      )}. Services: ${toServiceSummary(created)}. We'll text you once it is confirmed.`,
    });
    await sendAdminBookingSmsNotification({ booking: created.toObject() });

    return res.status(201).json(created);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "Time slot unavailable" });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bookings/availability", async (req, res) => {
  const date = req.query.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD" });
  }

  try {
    const dayStart = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dayStart.getTime())) {
      return res.status(400).json({ error: "Invalid date. Use YYYY-MM-DD" });
    }

    const dayEnd = new Date(`${date}T23:59:59.999`);

    const appointments = await Appointment.aggregate([
      {
        $addFields: {
          effective_end_time: {
            $ifNull: [
              "$end_time",
              {
                $dateAdd: {
                  startDate: "$start_time",
                  unit: "minute",
                  amount: { $ifNull: ["$duration_minutes", defaultAppointmentMinutes] },
                },
              },
            ],
          },
        },
      },
      {
        $match: {
          status: { $ne: "cancelled" },
          start_time: { $lt: dayEnd },
          effective_end_time: { $gt: dayStart },
        },
      },
      {
        $project: {
          _id: 0,
          start_time: 1,
          end_time: "$effective_end_time",
          duration_minutes: { $ifNull: ["$duration_minutes", defaultAppointmentMinutes] },
          status: 1,
        },
      },
      { $sort: { start_time: 1 } },
    ]);

    return res.json({ date, appointments });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/bookings", requireAdmin, async (req, res) => {
  try {
    const bookings = await Appointment.find({})
      .sort({ start_time: -1 })
      .lean();
    return res.json(bookings);
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/messages/groups", requireAdmin, async (req, res) => {
  try {
    const groups = await Message.aggregate([
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$customer_phone",
          customer_name: { $first: "$customer_name" },
          latest_message_at: { $max: "$created_at" },
          last_message_body: { $first: "$body" },
          last_direction: { $first: "$direction" },
          unread_count: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$direction", "inbound"] },
                    {
                      $or: [{ $eq: ["$read_at", null] }, { $not: ["$read_at"] }],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { latest_message_at: -1 } },
    ]);

    const response = await Promise.all(
      groups.map(async (item) => ({
        customer_phone: item._id,
        customer_name: item.customer_name || (await getBookingCustomerName(item._id)),
        latest_message_at: item.latest_message_at,
        last_message_body: item.last_message_body,
        last_direction: item.last_direction,
        unread_count: item.unread_count,
      }))
    );

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/admin/messages/:phone", requireAdmin, async (req, res) => {
  const phone = normalizePhoneNumber(req.params.phone);
  if (!phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    // Treat loading a conversation as active chat presence.
    setAdminActiveChat(phone);

    const messages = await Message.find({ customer_phone: phone })
      .sort({ created_at: 1 })
      .lean();
    const customerName = await getThreadName(phone);

    await Message.updateMany(
      {
        customer_phone: phone,
        direction: "inbound",
        read_at: { $exists: false },
      },
      { $set: { read_at: new Date() } }
    );

    return res.json({ customer_phone: phone, customer_name: customerName, messages });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/admin/messages/:phone/name", requireAdmin, async (req, res) => {
  const schema = z.object({
    customer_name: z.string().trim().max(120).optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const phone = normalizePhoneNumber(req.params.phone);
  if (!phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  const nextName = String(parsed.data.customer_name || "").trim();

  try {
    const update = nextName ? { $set: { customer_name: nextName } } : { $unset: { customer_name: "" } };
    await Message.updateMany({ customer_phone: phone }, update);

    return res.json({ ok: true, customer_phone: phone, customer_name: nextName });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/messages/:phone/reply", requireAdmin, async (req, res) => {
  const schema = z.object({
    body: z.string().trim().min(1).max(1600),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const phone = normalizePhoneNumber(req.params.phone);
  if (!phone) {
    return res.status(400).json({ error: "Invalid phone number" });
  }

  try {
    // Replying also means admin is actively in this chat.
    setAdminActiveChat(phone);

    const customerName = await getThreadName(phone);
    const twilioMessage = await sendSmsWithTwilio({
      to: phone,
      body: parsed.data.body,
    });

    const saved = await Message.create({
      customer_phone: phone,
      customer_name: customerName || undefined,
      direction: "outbound",
      body: parsed.data.body,
      twilio_message_sid: twilioMessage.sid || undefined,
      twilio_status: twilioMessage.status || undefined,
      read_at: new Date(),
    });

    return res.status(201).json({ ok: true, message: saved });
  } catch (error) {
    return res.status(502).json({ error: error.message || "Failed to send message" });
  }
});

app.post("/api/admin/bookings/:id/confirm", requireAdmin, async (req, res) => {
  try {
    const booking = await Appointment.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === "confirmed") {
      return res.json({ ok: true, booking });
    }
    if (booking.status === "cancelled") {
      return res.status(409).json({ error: "Cancelled booking cannot be confirmed" });
    }

    booking.status = "confirmed";
    booking.confirmed_at = new Date();
    await booking.save();

    await sendBookingConfirmedEmail({ booking: booking.toObject() });
    await sendBookingSmsNotification({
      booking: booking.toObject(),
      body: `Nail Times: Hi ${booking.customer_name}, your appointment is confirmed for ${formatBookingDateTime(
        booking.start_time
      )}. See you soon!`,
    });

    return res.json({ ok: true, booking });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/admin/bookings/:id", requireAdmin, async (req, res) => {
  try {
    const booking = await Appointment.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.status === "cancelled") {
      return res.json({ ok: true, booking });
    }

    booking.status = "cancelled";
    booking.cancelled_at = new Date();
    await booking.save();

    await sendBookingSmsNotification({
      booking: booking.toObject(),
      body: `Nail Times: Hi ${booking.customer_name}, your appointment for ${formatBookingDateTime(
        booking.start_time
      )} has been cancelled. Please text us or rebook online if you need another time.`,
    });

    return res.json({ ok: true, booking });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/admin/bookings/:id/hard-delete", requireAdmin, async (req, res) => {
  try {
    const booking = await Appointment.findByIdAndDelete(req.params.id).lean();
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json({ ok: true, deleted_id: booking._id });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/admin/messages/presence", requireAdmin, async (req, res) => {
  const schema = z.object({
    customer_phone: z.string().optional().nullable(),
    is_active: z.boolean().optional().default(true),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const phone = normalizePhoneNumber(parsed.data.customer_phone);
  if (!phone) {
    return res.json({ ok: true });
  }

  if (parsed.data.is_active) {
    setAdminActiveChat(phone);
  } else {
    clearAdminActiveChat(phone);
  }

  return res.json({ ok: true });
});
app.listen(port, () => {
  console.log(`Backend listening on ${port}`);
});

