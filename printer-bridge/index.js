const fs = require("fs");
const net = require("net");
const path = require("path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const apiUrl = String(process.env.BRIDGE_API_URL || "").replace(/\/+$/, "");
const bridgeToken = String(process.env.PRINT_BRIDGE_TOKEN || "");
const printerIp = String(process.env.PRINTER_IP || "10.0.0.101");
const printerPort = Number(process.env.PRINTER_PORT || 9100);
const paperWidth = Number(process.env.PRINTER_PAPER_WIDTH_MM || 80);
const charactersPerLine = Number(process.env.PRINTER_CHARACTERS_PER_LINE || (paperWidth <= 58 ? 32 : 42));
const pollIntervalMs = Math.max(1000, Number(process.env.BRIDGE_POLL_INTERVAL_MS || 3000));
const socketTimeoutMs = Math.max(1000, Number(process.env.PRINTER_TIMEOUT_MS || 7000));
const autoCut = String(process.env.PRINTER_AUTO_CUT || "true").toLowerCase() !== "false";
const businessTimeZone = process.env.BUSINESS_TIMEZONE || "America/Chicago";

if (!apiUrl || !bridgeToken) {
  console.error("BRIDGE_API_URL and PRINT_BRIDGE_TOKEN are required in printer-bridge/.env");
  process.exit(1);
}
if (!Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) {
  console.error("PRINTER_PORT must be a valid TCP port");
  process.exit(1);
}

function cleanText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
}

function center(value) {
  const text = cleanText(value).slice(0, charactersPerLine);
  return `${" ".repeat(Math.max(0, Math.floor((charactersPerLine - text.length) / 2)))}${text}\n`;
}

function wrap(value) {
  const words = cleanText(value).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (word.length > charactersPerLine) {
      if (line) lines.push(line);
      for (let index = 0; index < word.length; index += charactersPerLine) {
        lines.push(word.slice(index, index + charactersPerLine));
      }
      line = "";
    } else if (!line || line.length + word.length + 1 <= charactersPerLine) {
      line = line ? `${line} ${word}` : word;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function labeledLines(label, value) {
  const safeLabel = cleanText(label);
  const valueLines = wrap(value);
  const firstPrefix = `${safeLabel}: `;
  const firstValue = valueLines.shift() || "";
  if (firstPrefix.length + firstValue.length <= charactersPerLine) {
    return [`${firstPrefix}${firstValue}`, ...valueLines];
  }
  return [safeLabel, firstValue, ...valueLines].filter(Boolean);
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: businessTimeZone,
  });
}

function buildGiftCardReceipt(payload) {
  const isTransactionReceipt = payload.receipt_kind === "transaction";
  const chunks = [
    Buffer.from([0x1b, 0x40]),
    Buffer.from([0x1b, 0x61, 0x01]),
    Buffer.from([0x1b, 0x45, 0x01]),
    Buffer.from([0x1d, 0x21, 0x11]),
    Buffer.from(center("NAIL TIMES"), "ascii"),
    Buffer.from([0x1d, 0x21, 0x00]),
    Buffer.from(center(isTransactionReceipt ? "TRANSACTION RECEIPT" : "GIFT CARD RECEIPT"), "ascii"),
    Buffer.from(center(payload.receipt_number), "ascii"),
    Buffer.from([0x1b, 0x45, 0x00]),
    Buffer.from([0x1b, 0x61, 0x00]),
    Buffer.from(`${"-".repeat(charactersPerLine)}\n`, "ascii"),
  ];

  const rows = isTransactionReceipt
    ? [
        ...labeledLines("Customer", payload.customer_name),
        ...labeledLines("Gift Card", payload.code),
        ...labeledLines("Transaction", payload.transaction_type === "debit" ? "Redeemed" : "Added"),
        ...labeledLines("Amount", formatMoney(payload.transaction_amount_cents)),
        ...labeledLines("Previous Balance", formatMoney(payload.balance_before_cents)),
        ...labeledLines("New Balance", formatMoney(payload.balance_after_cents)),
        ...labeledLines("Date", formatDate(payload.transaction_created_at)),
        ...labeledLines("Note", payload.transaction_note || "N/A"),
      ]
    : [
        ...labeledLines("Customer", payload.customer_name),
        ...labeledLines("Gift Card", payload.code),
        ...labeledLines("Amount", formatMoney(payload.issued_amount_cents)),
        ...labeledLines("Issued", formatDate(payload.created_at)),
        ...labeledLines("Expires", formatDate(payload.expires_at)),
      ];
  chunks.push(Buffer.from(`${rows.join("\n")}\n${"-".repeat(charactersPerLine)}\n`, "ascii"));
  chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
  chunks.push(Buffer.from(`${wrap("Present the gift card code when redeeming.").join("\n")}\n\n\n`, "ascii"));
  if (autoCut) chunks.push(Buffer.from([0x1d, 0x56, 0x00]));
  return Buffer.concat(chunks);
}

function sendToPrinter(data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: printerIp, port: printerPort });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(socketTimeoutMs);
    socket.once("timeout", () => finish(new Error(`Printer timed out at ${printerIp}:${printerPort}`)));
    socket.once("error", finish);
    socket.once("connect", () => {
      socket.end(data, () => finish());
    });
  });
}

async function apiRequest(pathname, options = {}) {
  const response = await fetch(`${apiUrl}${pathname}`, {
    ...options,
    headers: {
      "X-Print-Bridge-Token": bridgeToken,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Bridge API returned ${response.status}`);
  return payload;
}

async function completeJob(job, success, error) {
  await apiRequest(`/api/print-bridge/jobs/${job.id}/complete`, {
    method: "POST",
    body: JSON.stringify({
      lease_token: job.lease_token,
      success,
      error: error ? String(error.message || error).slice(0, 1000) : undefined,
    }),
  });
}

let stopped = false;
let processing = false;

async function poll() {
  if (stopped || processing) return;
  processing = true;
  try {
    const job = await apiRequest("/api/print-bridge/jobs/next");
    if (!job) return;
    try {
      await sendToPrinter(buildGiftCardReceipt(job.payload));
      await completeJob(job, true);
      console.log(`Printed receipt ${job.payload.receipt_number}`);
    } catch (error) {
      console.error(`Print failed for ${job.payload.receipt_number}:`, error.message || error);
      await completeJob(job, false, error);
    }
  } catch (error) {
    console.error("Bridge poll failed:", error.message || error);
  } finally {
    processing = false;
  }
}

console.log(`Printer bridge started: ${apiUrl} -> ${printerIp}:${printerPort} (${paperWidth}mm)`);
poll();
const pollTimer = setInterval(poll, pollIntervalMs);

function shutdown() {
  stopped = true;
  clearInterval(pollTimer);
  console.log("Printer bridge stopped");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
