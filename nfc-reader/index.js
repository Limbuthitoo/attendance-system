require('dotenv').config();
const { spawnSync } = require('child_process');
const { NFC } = require('nfc-pcsc');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeDeviceId(value) {
  return String(value || 'reader-01').replace(/[^a-zA-Z0-9._-]/g, '-');
}

const API_URL = process.env.API_URL || 'http://localhost:3001';
const NFC_API_KEY = process.env.NFC_API_KEY;
const DEVICE_SERIAL = process.env.DEVICE_SERIAL;
const DEVICE_ID = sanitizeDeviceId(process.env.DEVICE_ID || DEVICE_SERIAL);
const DEBOUNCE_SECONDS = parsePositiveInt(process.env.DEBOUNCE_SECONDS, 10);
const RETRY_QUEUE_MAX = parsePositiveInt(process.env.RETRY_QUEUE_MAX, 100);
const WRITE_POLL_SECONDS = parsePositiveInt(process.env.WRITE_POLL_SECONDS, 3);
const ACTION_COOLDOWN_SECONDS = parsePositiveInt(process.env.ACTION_COOLDOWN_SECONDS, 30);
const STARTUP_DIAGNOSTIC_MS = parsePositiveInt(process.env.STARTUP_DIAGNOSTIC_MS, 8000);
const API_TIMEOUT_MS = parsePositiveInt(process.env.API_TIMEOUT_MS, 10000);

if (!NFC_API_KEY) {
  console.error('ERROR: NFC_API_KEY is required in .env');
  process.exit(1);
}

if (!DEVICE_SERIAL) {
  console.error('ERROR: DEVICE_SERIAL is required in .env (the serial from platform device registration)');
  process.exit(1);
}

try {
  const parsedApiUrl = new URL(API_URL);
  if (!['http:', 'https:'].includes(parsedApiUrl.protocol)) {
    throw new Error(`Unsupported protocol: ${parsedApiUrl.protocol}`);
  }
} catch (err) {
  console.error(`ERROR: API_URL is invalid: ${err.message}`);
  process.exit(1);
}

const apiHeaders = {
  'Content-Type': 'application/json',
  'X-Api-Key': NFC_API_KEY,
  'X-Device-Serial': DEVICE_SERIAL,
};

function formatError(err) {
  return err instanceof Error ? err.message : String(err);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${API_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(res, contextLabel) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await res.text().catch(() => 'Unreadable body');
    throw new Error(`${contextLabel} returned non-JSON response (${res.status}): ${text}`);
  }

  try {
    return await res.json();
  } catch (err) {
    throw new Error(`${contextLabel} returned invalid JSON: ${formatError(err)}`);
  }
}

function logProcessError(label, err) {
  console.error(`[PROCESS] ${label}: ${formatError(err)}`);
}

let shuttingDown = false;

function exitForSupervisor(reason, err) {
  if (shuttingDown) return;
  shuttingDown = true;
  logProcessError(reason, err);
  setTimeout(() => process.exit(1), 50);
}

process.on('unhandledRejection', (reason) => {
  exitForSupervisor('Unhandled promise rejection', reason);
});

process.on('uncaughtException', (err) => {
  exitForSupervisor('Uncaught exception', err);
});

process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// ─── Debounce: prevent rapid duplicate taps ────────────────────────────────

const recentTaps = new Map();
const actionCooldowns = new Map(); // Longer cooldown after successful check-in/out

function isDuplicate(cardUid) {
  const now = Date.now();

  // Check action cooldown first (longer, after successful check-in/out)
  const cooldownUntil = actionCooldowns.get(cardUid);
  if (cooldownUntil && now < cooldownUntil) {
    return true;
  }

  // Then check rapid tap debounce
  const last = recentTaps.get(cardUid);
  if (last && (now - last) < DEBOUNCE_SECONDS * 1000) return true;
  recentTaps.set(cardUid, now);
  return false;
}

function setActionCooldown(cardUid) {
  actionCooldowns.set(cardUid, Date.now() + ACTION_COOLDOWN_SECONDS * 1000);
}

setInterval(() => {
  const now = Date.now();
  const debounceCutoff = now - DEBOUNCE_SECONDS * 1000;
  for (const [uid, ts] of recentTaps) {
    if (ts < debounceCutoff) recentTaps.delete(uid);
  }
  for (const [uid, until] of actionCooldowns) {
    if (now > until) actionCooldowns.delete(uid);
  }
}, 30000);

// ─── Retry Queue ───────────────────────────────────────────────────────────

const retryQueue = [];
let retryRunning = false;

async function processRetryQueue() {
  if (retryRunning || retryQueue.length === 0) return;
  retryRunning = true;
  while (retryQueue.length > 0) {
    try {
      await sendTap(retryQueue[0], false);
      retryQueue.shift();
      console.log(`[RETRY] Flushed queued tap (${retryQueue.length} remaining)`);
    } catch {
      break;
    }
  }
  retryRunning = false;
}

setInterval(processRetryQueue, 15000);

// ─── Heartbeat: report reader connection status to backend ─────────────────

let readerConnected = false;

function runCommand(command, args) {
  try {
    const result = spawnSync(command, args, { encoding: 'utf8' });
    if (result.error) return '';
    return result.stdout || '';
  } catch {
    return '';
  }
}

function logLinuxStartupHints() {
  if (process.platform !== 'linux' || readerConnected) return;

  const lsmodOutput = runCommand('lsmod', []);
  const loadedKernelNfcModules = ['pn533_usb', 'pn533', 'nfc']
    .filter((moduleName) => lsmodOutput.includes(moduleName));

  console.error('\n[STARTUP] No NFC reader detected yet.');

  if (loadedKernelNfcModules.length > 0) {
    console.error(
      `[STARTUP] Ubuntu likely bound the ACR122U to the kernel NFC driver: ${loadedKernelNfcModules.join(', ')}`
    );
    console.error('[STARTUP] This blocks PC/SC and prevents nfc-pcsc from receiving the reader event.');
    console.error('[STARTUP] Fix once: sudo modprobe -r pn533_usb pn533 nfc');
    console.error('[STARTUP] Then restart pcscd: sudo systemctl restart pcscd.socket pcscd.service');
    return;
  }

  console.error('[STARTUP] Check that pcscd can see the reader with: pcsc_scan');
  console.error('[STARTUP] If pcsc_scan does not list the ACR122U, this is a PC/SC or USB access issue, not an app issue.');
}

async function sendHeartbeat() {
  try {
    await fetchWithTimeout(`${API_URL}/api/nfc/heartbeat`, {
      method: 'POST',
      headers: apiHeaders,
      body: JSON.stringify({ device_id: DEVICE_ID, reader_connected: readerConnected }),
    });
  } catch (err) {
    console.error(`[HEARTBEAT] ${formatError(err)}`);
  }
}

setInterval(sendHeartbeat, 10000);

// ─── Pending Write Job ─────────────────────────────────────────────────────

let pendingWriteJob = null; // { id, data_to_write, emp_code, name }
let writeRetryCount = 0;
const MAX_WRITE_RETRIES = 3;

async function pollForWriteJobs() {
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/nfc/write-jobs/pending?device_id=${encodeURIComponent(DEVICE_ID)}`,
      { headers: apiHeaders }
    );
    if (!res.ok) {
      console.error(`[WRITE] Pending jobs request failed with status ${res.status}`);
      return;
    }
    const { job } = await readJsonResponse(res, 'Pending write jobs API');

    if (job && (!pendingWriteJob || pendingWriteJob.id !== job.id)) {
      pendingWriteJob = job;
      console.log(`\n✏️  WRITE MODE: Place a card on the reader to write employee "${job.name}" (${job.emp_code})`);
      console.log(`   Data: "${job.data_to_write}"  |  Job #${job.id}`);
    } else if (!job && pendingWriteJob) {
      pendingWriteJob = null;
      console.log('[WRITE] Write job cleared (cancelled or completed elsewhere)');
    }
  } catch (err) {
    console.error(`[WRITE] Poll failed: ${formatError(err)}`);
  }
}

setInterval(pollForWriteJobs, WRITE_POLL_SECONDS * 1000);

async function reportWriteResult(jobId, cardUid, success, errorMessage) {
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/nfc/write-jobs/${jobId}/complete`, {
      method: 'PUT',
      headers: apiHeaders,
      body: JSON.stringify({
        card_uid: cardUid,
        success,
        error_message: errorMessage || undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => 'No body');
      throw new Error(`Backend responded ${res.status}: ${text}`);
    }
    const data = await readJsonResponse(res, 'Write result API');
    console.log(`  📡 Backend: ${data.message || data.status}`);
  } catch (err) {
    console.error(`  ⚠️  Failed to report write result: ${formatError(err)}`);
  }
}

// ─── Send tap to backend ───────────────────────────────────────────────────

async function sendTap(payload, enqueueOnFail = true) {
  const res = await fetchWithTimeout(`${API_URL}/api/nfc/tap`, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'No body');
    throw new Error(`Backend responded ${res.status}: ${text}`);
  }

  return readJsonResponse(res, 'Tap API');
}

async function handleTap(cardUid) {
  if (isDuplicate(cardUid)) {
    console.log(`[DEBOUNCE] Ignoring rapid tap: ${cardUid}`);
    return;
  }

  const payload = { cardUid, deviceId: DEVICE_ID, timestamp: new Date().toISOString() };
  console.log(`[TAP] Card: ${cardUid}`);

  try {
    const result = await sendTap(payload);
    const icon = {
      CHECKED_IN: '✅', CHECKED_OUT: '🔴', DUPLICATE_IGNORED: '⏭️',
      UNKNOWN_CARD: '❓', INACTIVE_CARD: '🚫', ERROR: '⚠️',
    }[result.status] || '❔';

    console.log(`  ${icon} ${result.status}: ${result.message || ''}`);
    if (result.employee) console.log(`  Employee: ${result.employee}`);

    // After a successful check-in or check-out, apply a longer cooldown
    // to prevent accidental re-tap from toggling the state
    if (result.status === 'CHECKED_IN' || result.status === 'CHECKED_OUT') {
      setActionCooldown(payload.cardUid);
      console.log(`  🕐 Cooldown: ${ACTION_COOLDOWN_SECONDS}s before next tap accepted`);
    }
  } catch (err) {
    console.error(`  ⚠️  Backend unreachable: ${formatError(err)}`);
    if (retryQueue.length < RETRY_QUEUE_MAX) {
      retryQueue.push(payload);
      console.log(`  📦 Queued for retry (${retryQueue.length}/${RETRY_QUEUE_MAX})`);
    } else {
      console.error(`  ❌ Retry queue full — tap DROPPED`);
    }
  }
}

// ─── Write to NFC Card (NDEF text record) ──────────────────────────────────

async function writeToCard(reader, card, cardUid, dataString) {
  const textBuf = Buffer.from(dataString, 'utf8');
  const payload = Buffer.alloc(16, 0); // 16-byte block
  payload[0] = textBuf.length;
  textBuf.copy(payload, 1, 0, Math.min(textBuf.length, 15));

  const blockNumber = 4; // First data block

  // Detect card type from ATR
  const atr = card.atr || Buffer.alloc(0);
  const isUltralight = atr.length >= 2 && atr[atr.length - 1] === 0x03;

  if (isUltralight) {
    // MIFARE Ultralight — no authentication needed, 4-byte pages
    // Block 4 in nfc-pcsc maps to page 4 for Ultralight
    // We write 4 pages (16 bytes) starting at page 4
    for (let page = 0; page < 4; page++) {
      const pageData = payload.subarray(page * 4, (page + 1) * 4);
      await reader.write(blockNumber + page, pageData, 4);
    }
    console.log(`  [WRITE] Ultralight: wrote ${textBuf.length} bytes to pages 4-7`);
  } else {
    // MIFARE Classic — authenticate first with default key
    const KEY_A = 0x60;
    const DEFAULT_KEY = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);

    try {
      await reader.authenticate(blockNumber, KEY_A, DEFAULT_KEY);
    } catch (authErr) {
      // Try Key B
      const KEY_B = 0x61;
      try {
        await reader.authenticate(blockNumber, KEY_B, DEFAULT_KEY);
      } catch {
        throw new Error(`Authentication failed for block ${blockNumber}: ${authErr.message}`);
      }
    }

    await reader.write(blockNumber, payload, 16);
    console.log(`  [WRITE] Classic: wrote ${textBuf.length} bytes to block ${blockNumber}`);
  }
}

// ─── NFC Reader (PC/SC via nfc-pcsc) ───────────────────────────────────────

const nfc = new NFC();
let startupDiagnosticTimer = null;

function renderBanner(statusMessage) {
  if (process.stdout.isTTY) {
    console.clear();
  }

  console.log('═══════════════════════════════════════════════');
  console.log(' Archisys NFC Reader Service');
  console.log(`  Backend:    ${API_URL}`);
  console.log(`  Serial:     ${DEVICE_SERIAL}`);
  console.log(`  Device:     ${DEVICE_ID}`);
  console.log(`  Debounce:   ${DEBOUNCE_SECONDS}s`);
  console.log(`  Cooldown:   ${ACTION_COOLDOWN_SECONDS}s after check-in/out`);
  console.log(`  Write poll: ${WRITE_POLL_SECONDS}s`);
  console.log(`  Write retries: ${MAX_WRITE_RETRIES}`);
  console.log('═══════════════════════════════════════════════');
  console.log(`Status: ${statusMessage}`);
  console.log('Mode: READ (tap attendance) + WRITE (polls for jobs)');
}

nfc.on('reader', (reader) => {
  if (startupDiagnosticTimer) {
    clearTimeout(startupDiagnosticTimer);
    startupDiagnosticTimer = null;
  }

  renderBanner('NFC reader connected');
  readerConnected = true;
  sendHeartbeat();

  reader.on('card', async (card) => {
    const uid = card.uid;
    if (!uid) {
      console.log('[WARN] Card detected but no UID read');
      return;
    }

    const cardUid = uid.toUpperCase();

    // If there's a pending write job, write to this card instead of tapping
    if (pendingWriteJob) {
      const job = pendingWriteJob;
      pendingWriteJob = null; // clear immediately to prevent double-write

      console.log(`\n✏️  Writing "${job.data_to_write}" to card ${cardUid}...`);
      try {
        // Check if card is already assigned to another employee
        const checkRes = await fetchWithTimeout(`${API_URL}/api/nfc/check-card/${cardUid}`, { headers: apiHeaders });
        if (checkRes.ok) {
          const checkData = await readJsonResponse(checkRes, 'Card check API');
          if (checkData.assigned && checkData.employee_id !== job.employee_id) {
            console.error(`  🚫 Card ${cardUid} is already assigned to ${checkData.employee} (${checkData.emp_code})`);
            console.error(`  ❌ Write BLOCKED — unassign the card first, then retry.`);
            await reportWriteResult(job.id, cardUid, false, `Card already assigned to ${checkData.employee}`);
            writeRetryCount = 0;
            return;
          }
        }

        await writeToCard(reader, card, cardUid, job.data_to_write);
        console.log(`  ✅ Write successful!`);
        console.log(`  Card UID: ${cardUid} → Employee: ${job.name} (${job.emp_code})`);
        await reportWriteResult(job.id, cardUid, true);
        writeRetryCount = 0;
      } catch (err) {
        console.error(`  ❌ Write failed: ${formatError(err)}`);
        writeRetryCount++;
        if (writeRetryCount < MAX_WRITE_RETRIES) {
          // Restore the job so next card placement retries
          pendingWriteJob = job;
          console.log(`  🔄 Will retry on next card placement (${writeRetryCount}/${MAX_WRITE_RETRIES})`);
          console.log(`  Hold the card steady on the reader and try again.`);
        } else {
          console.error(`  ❌ Max retries reached — reporting failure to backend`);
          await reportWriteResult(job.id, cardUid, false, formatError(err));
          writeRetryCount = 0;
        }
      }
      return;
    }

    // Normal tap mode
    handleTap(cardUid);
  });

  reader.on('card.off', () => {});

  reader.on('error', (err) => {
    console.error(`[READER ERROR] ${reader.name}:`, err.message);
  });

  reader.on('end', () => {
    renderBanner('Waiting for NFC reader...');
    readerConnected = false;
    sendHeartbeat();
  });
});

nfc.on('error', (err) => {
  console.error('[NFC ERROR]', err.message);
});

// ─── Startup ───────────────────────────────────────────────────────────────

renderBanner('Waiting for NFC reader...');

startupDiagnosticTimer = setTimeout(logLinuxStartupHints, STARTUP_DIAGNOSTIC_MS);

// Do initial poll immediately
pollForWriteJobs();
