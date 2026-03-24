const EventEmitter = require('events');

// Central event bus for real-time notifications
const eventBus = new EventEmitter();
eventBus.setMaxListeners(50); // Allow up to 50 concurrent SSE connections

module.exports = { eventBus };
