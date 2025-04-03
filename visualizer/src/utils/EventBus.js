import registry from '../ModuleRegistry';

/**
 * EventBus provides a centralized event handling system for the application.
 * Components can subscribe to and publish events without direct dependencies on each other.
 */
class EventBus {
  /**
   * Initialize the event bus
   */
  constructor() {
    this._events = new Map();
    this._eventHistory = new Map();
    this._maxHistoryLength = 50;
    this._debugMode = false;
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this._debugMode = !!enabled;
  }

  /**
   * Set the maximum history length for each event type
   * @param {number} length - Maximum history length
   */
  setMaxHistoryLength(length) {
    if (typeof length === 'number' && length >= 0) {
      this._maxHistoryLength = length;
    }
  }

  /**
   * Subscribe to an event
   * 
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this._events.has(eventName)) {
      this._events.set(eventName, new Set());
      this._eventHistory.set(eventName, []);
    }

    this._events.get(eventName).add(callback);

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Alias for on() - Subscribe to an event
   * 
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, callback) {
    return this.on(eventName, callback);
  }

  /**
   * Subscribe to an event once
   * 
   * @param {string} eventName - Name of the event to subscribe to
   * @param {Function} callback - Function to call when event is emitted
   * @returns {Function} Unsubscribe function
   */
  once(eventName, callback) {
    // Create a wrapper that will call the callback and unsubscribe
    const wrappedCallback = (data) => {
      this.off(eventName, wrappedCallback);
      callback(data);
    };

    return this.on(eventName, wrappedCallback);
  }

  /**
   * Unsubscribe from an event
   * 
   * @param {string} eventName - Name of the event to unsubscribe from
   * @param {Function} callback - Callback to remove
   * @returns {boolean} Whether the callback was removed
   */
  off(eventName, callback) {
    if (!this._events.has(eventName)) {
      return false;
    }

    return this._events.get(eventName).delete(callback);
  }

  /**
   * Alias for off() - Unsubscribe from an event
   * 
   * @param {string} eventName - Name of the event to unsubscribe from
   * @param {Function} callback - Callback to remove
   * @returns {boolean} Whether the callback was removed
   */
  unsubscribe(eventName, callback) {
    return this.off(eventName, callback);
  }

  /**
   * Unsubscribe all listeners from an event
   * 
   * @param {string} eventName - Name of the event to clear listeners for
   * @returns {boolean} Whether the event existed and was cleared
   */
  clearListeners(eventName) {
    if (!this._events.has(eventName)) {
      return false;
    }

    this._events.get(eventName).clear();
    return true;
  }

  /**
   * Emit an event
   * 
   * @param {string} eventName - Name of the event to emit
   * @param {*} data - Data to pass to event handlers
   * @returns {boolean} Whether the event had subscribers
   */
  emit(eventName, data = {}) {
    // Create event entry in maps if it doesn't exist
    if (!this._events.has(eventName)) {
      this._events.set(eventName, new Set());
      this._eventHistory.set(eventName, []);
    }

    // Add to event history
    const eventData = {
      timestamp: new Date(),
      data
    };
    
    const history = this._eventHistory.get(eventName);
    history.push(eventData);
    
    // Trim history if it exceeds max length
    if (history.length > this._maxHistoryLength) {
      history.splice(0, history.length - this._maxHistoryLength);
    }

    // Get subscribers
    const subscribers = this._events.get(eventName);
    
    // Debug logging
    if (this._debugMode) {
      console.log(`EventBus: '${eventName}' emitted with ${subscribers.size} subscribers`, data);
    }

    // Call all subscribers
    for (const callback of subscribers) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for '${eventName}':`, error);
      }
    }

    return subscribers.size > 0;
  }

  /**
   * Alias for emit() - Publish an event
   * 
   * @param {string} eventName - Name of the event to publish
   * @param {*} data - Data to pass to event handlers
   * @returns {boolean} Whether the event had subscribers
   */
  publish(eventName, data = {}) {
    return this.emit(eventName, data);
  }

  /**
   * Get event history
   * 
   * @param {string} eventName - Name of the event to get history for
   * @returns {Array} Event history
   */
  getHistory(eventName) {
    return this._eventHistory.has(eventName) 
      ? [...this._eventHistory.get(eventName)] 
      : [];
  }

  /**
   * Check if an event has subscribers
   * 
   * @param {string} eventName - Name of the event to check
   * @returns {boolean} Whether the event has subscribers
   */
  hasSubscribers(eventName) {
    return this._events.has(eventName) && this._events.get(eventName).size > 0;
  }

  /**
   * Get list of all registered event types
   * 
   * @returns {Array<string>} List of event names
   */
  getEventTypes() {
    return Array.from(this._events.keys());
  }

  /**
   * Clear all event history
   */
  clearHistory() {
    for (const eventName of this._eventHistory.keys()) {
      this._eventHistory.set(eventName, []);
    }
  }
}

// Create singleton instance
const eventBus = new EventBus();

export default registry.register(
  'utils.EventBus',
  eventBus,
  [],
  {
    description: 'Centralized event handling system for the application',
    singleton: true
  }
);

// Also export as named export for easier importing
export { eventBus as EventBus }; 