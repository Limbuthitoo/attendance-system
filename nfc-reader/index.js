require('dotenv').config();
const { NFC } = require('nfc-pcsc');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const NFC_API_KEY = process.env.NFC_API_KEY;
const DEVICE_ID = process.env.DEVICE_ID || 'reader-01';
const DEBOUNCE_SECONDS = parseInt(process.env.DEBOUNCE_SECONDS) || 5;
const RETRY_QUEUE_MAX = parseInt(process.env.RETRY_QUEUE_MAX) || 100;
const WRITE_POLL_SECONDS = parseInt(process.env.WRITE_POLL_SECONDS) || 3;

if (!NFC_API_KEY) {
  console.error('ERROR: NFC_API_KEY is required in .env');
  process.exit(1);
}

const apiHeaders = {
  'Content-Type': 'application/json',
  'X-Api-Key': NFC_API_KEY,
};

// ─── Debounce: prevent rapid duplicate taps ────────────────────────────────

const recentTaps = new Map();

function isDuplicate(cardUid) {
  const now = Date.now();
  const last = recentTaps.get(cardUid);
  if (last && (now - last) < DEBOUNCE_SECONDS * 1000) return true;
  recentTaps.set(cardUid, now);
  return false;
}

setInterval(() => {
  const cutoff = Date.now() - DEBOUNCE_SECONDS * 1000;
  for (const [uid, ts] of recentTaps) {
    if (ts < cutoff) recentTaps.delete(uid);
  }
}, 60000);

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

// ─── Pending Write Job ─────────────────────────────────────────────────────

let pendingWriteJob = null; // { id, data_to_write, emp_code, name }

async function pollForWriteJobs() {
  try {
    const res = await fetch(
      `${API_URL}/api/nfc/write-jobs/pending?device_id=${encodeURIComponent(DEVICE_ID)}`,
      { headers: apiHeaders }
    );
    if (!res.ok) return;
    const { job } = await res.json();

    if (job && (!pendingWriteJob || pendingWriteJob.id !== job.id)) {
      pendingWriteJob = job;
      console.log(`\n✏️  WRITE MODE: Place a card on the reader to write employee "${job.name}" (${job.emp_code})`);
      console.log(`   Data: "${job.data_to_write}"  |  Job #${job.id}`);
    } else if (!job && pendingWriteJob) {
      pendingWriteJob = null;
      console.log('[WRITE] Write job cleared (cancelled or completed elsewhere)');
    }
  } catch {
    // Backend unreachable — silently ignore
  }
}

setInterval(pollForWriteJobs, WRITE_POLL_SECONDS * 1000);

async function reportWriteResult(jobId, cardUid, success, errorMessage) {
  try {
    const res = await fetch(`${API_URL}/api/nfc/write-jobs/${jobId}/complete`, {
      method: 'PUT',
      headers: apiHeaders,
      body: JSON.stringify({
        card_uid: cardUid,
        success,
        error_message: errorMessage || undefined,
      }),
    });
    const data = await res.json();
    console.log(`  📡 Backend: ${data.message || data.status}`);
  } catch (err) {
    console.error(`  ⚠️  Failed to report write result: ${err.message}`);
  }
}

// ─── Send tap to backend ───────────────────────────────────────────────────

async function sendTap(payload, enqueueOnFail = true) {
  const res = await fetch(`${API_URL}/api/nfc/tap`, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'No body');
    throw new Error(`Backend responded ${res.status}: ${text}`);
  }

  return res.json();
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
  } catch (err) {
    console.error(`  ⚠️  Backend unreachable: ${err.message}`);
    if (retryQueue.length < RETRY_QUEUE_MAX) {
      retryQueue.push(payload);
      console.log(`  📦 Queued for retry (${retryQueue.length}/${RETRY_QUEUE_MAX})`);
    } else {
      console.error(`  ❌ Retry queue full — tap DROPPED`);
    }
  }
}

// ─── Write to NFC Card (NDEF text record) ──────────────────────────────────

async function writeToCard(reader, cardUid, dataString) {
  // Write as raw bytes to block 4+ (MIFARE Classic/Ultralight compatible)
  // Format: length byte + UTF-8 string, padded to 16 bytes
  const textBuf = Buffer.from(dataString, 'utf8');
  const payload = Buffer.alloc(16, 0); // 16-byte block
  payload[0] = textBuf.length;
  textBuf.copy(payload, 1, 0, Math.min(textBuf.length, 15));

  // Write to block 4 (first data block on MIFARE Classic 1K)
  // For MIFARE Ultralight, this maps to pages 4-7
  await reader.write(4, payload, 16);
}

// ─── NFC Reader (PC/SC via nfc-pcsc) ───────────────────────────────────────

const nfc = new NFC();

nfc.on('reader', (reader) => {
  console.log(`\n📖 Reader connected: ${reader.name}`);

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
        await writeToCard(reader, cardUid, job.data_to_write);
        console.log(`  ✅ Write successful!`);
        console.log(`  Card UID: ${cardUid} → Employee: ${job.name} (${job.emp_code})`);
        await reportWriteResult(job.id, cardUid, true);
      } catch (err) {
        console.error(`  ❌ Write failed: ${err.message}`);
        await reportWriteResult(job.id, cardUid, false, err.message);
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
    console.log(`📖 Reader disconnected: ${reader.name}`);
  });
});

nfc.on('error', (err) => {
  console.error('[NFC ERROR]', err.message);
});

// ─── Startup ───────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════');
console.log(' Archisys NFC Reader Service');
console.log(`  Backend:  ${API_URL}`);
console.log(`  Device:   ${DEVICE_ID}`);
console.log(`  Debounce: ${DEBOUNCE_SECONDS}s`);
console.log(`  Write poll: ${WRITE_POLL_SECONDS}s`);
console.log('═══════════════════════════════════════════════');
console.log('Waiting for NFC reader...');
console.log('Mode: READ (tap attendance) + WRITE (polls for jobs)\n');

// Do initial poll immediately
pollForWriteJobs();
