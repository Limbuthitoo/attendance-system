// ─────────────────────────────────────────────────────────────────────────────
// Event Bus — Redis pub/sub backed, with in-process fallback
//
// Transport layer: Redis pub/sub (survives process restarts, enables future
// multi-process / microservice extraction).
// Handlers still run in-process — Redis acts as the message broker.
// Functions (callbacks) in event data are extracted, held locally, and
// re-attached after deserialization so cross-module callbacks work.
// ─────────────────────────────────────────────────────────────────────────────
const EventEmitter = require('events');
const crypto = require('crypto');

class EventBus {
  constructor() {
    this._handlers = new Map();        // event → [{ module, handler }]
    this._pendingCallbacks = new Map(); // correlationId → { callbacks }
    this._fallback = new EventEmitter();
    this._fallback.setMaxListeners(50);
    this._redisReady = false;
    this._subscriber = null;
    this._publisher = null;
    this._channel = 'eventbus';        // single Redis channel for all events
  }

  // ── Redis bootstrap ─────────────────────────────────────────────────────
  /**
   * Connect to Redis for pub/sub transport.
   * Call once at startup after Redis is available.
   */
  async connectRedis() {
    try {
      const { getRedis, getSubscriber } = require('../config/redis');
      this._publisher = getRedis();
      this._subscriber = getSubscriber();

      await this._subscriber.subscribe(this._channel);
      this._subscriber.on('message', (ch, raw) => {
        if (ch !== this._channel) return;
        this._onMessage(raw);
      });

      this._redisReady = true;
      console.log('✓ EventBus connected to Redis pub/sub');
    } catch (err) {
      console.warn(`⚠ EventBus Redis unavailable, using in-process fallback: ${err.message}`);
      this._redisReady = false;
    }
  }

  // ── Subscribe ───────────────────────────────────────────────────────────
  /**
   * Register a module's event handler.
   * @param {string} event  - e.g. 'invoice.issued'
   * @param {string} module - e.g. 'accounting'
   * @param {Function} handler - async (data) => {}
   */
  subscribe(event, module, handler) {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event).push({ module, handler });

    // Also register on fallback emitter for non-Redis mode
    const wrappedHandler = async (data) => {
      try { await handler(data); }
      catch (err) { console.error(`[EventBus] Error in ${module} handler for ${event}:`, err.message); }
    };
    this._fallback.on(event, wrappedHandler);
  }

  // ── Publish ─────────────────────────────────────────────────────────────
  /**
   * Publish an event. Serialises to Redis if connected, else in-process.
   * Functions in `data` (e.g. onJournalCreated) are extracted and held
   * locally so they survive JSON serialisation.
   */
  publish(event, data) {
    if (!this._redisReady) {
      // Fallback: in-process emit (same as Phase 6 behaviour)
      this._fallback.emit(event, data);
      return;
    }

    // Extract any function properties from data (they can't be JSON-serialised)
    const correlationId = crypto.randomUUID();
    const callbacks = {};
    const serialisableData = {};
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === 'function') {
        callbacks[key] = val;
      } else {
        serialisableData[key] = val;
      }
    }

    // Store callbacks locally so the handler can call them after processing
    if (Object.keys(callbacks).length > 0) {
      this._pendingCallbacks.set(correlationId, callbacks);
      // Auto-cleanup after 30s to prevent memory leaks
      setTimeout(() => this._pendingCallbacks.delete(correlationId), 30_000);
    }

    const envelope = JSON.stringify({
      event,
      correlationId,
      data: serialisableData,
      hasCallbacks: Object.keys(callbacks).length > 0,
      callbackKeys: Object.keys(callbacks),
      publishedAt: new Date().toISOString(),
    });

    this._publisher.publish(this._channel, envelope).catch((err) => {
      console.error(`[EventBus] Redis publish error for ${event}:`, err.message);
      // Fallback to in-process if Redis publish fails
      this._fallback.emit(event, data);
    });
  }

  // ── Message handler (Redis subscriber) ──────────────────────────────────
  async _onMessage(raw) {
    let envelope;
    try { envelope = JSON.parse(raw); }
    catch { return; }

    const { event, correlationId, data, callbackKeys } = envelope;
    const handlers = this._handlers.get(event) || [];

    // Re-attach locally stored callbacks to the data object
    const pendingCbs = this._pendingCallbacks.get(correlationId);
    if (pendingCbs && callbackKeys) {
      for (const key of callbackKeys) {
        if (pendingCbs[key]) data[key] = pendingCbs[key];
      }
      this._pendingCallbacks.delete(correlationId);
    }

    for (const { module, handler } of handlers) {
      try {
        await handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in ${module} handler for ${event}:`, err.message);
      }
    }
  }

  // ── Introspection ───────────────────────────────────────────────────────
  listSubscriptions() {
    const result = {};
    for (const [event, handlers] of this._handlers) {
      result[event] = handlers.map(h => h.module);
    }
    return result;
  }

  /** Transport status for health checks */
  status() {
    return {
      transport: this._redisReady ? 'redis' : 'in-process',
      subscriptions: this.listSubscriptions(),
    };
  }
}

// Singleton
const eventBus = new EventBus();

module.exports = { eventBus };
