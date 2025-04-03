/**
 * Authentication Events
 * 
 * Defines authentication-related events and provides an event management system
 * for authentication state changes throughout the application.
 */

import registry from '../../ModuleRegistry';
import EventBus from '../EventBus';

/**
 * Authentication event types
 * 
 * These constants define all authentication-related events used throughout the application.
 * Using constants ensures consistent event naming and helps prevent typos.
 */
export const AUTH_EVENTS = {
  // Authentication state events
  SIGN_IN: 'auth:signIn',
  SIGN_OUT: 'auth:signOut',
  SESSION_EXPIRED: 'auth:sessionExpired',
  SESSION_RESTORED: 'auth:restored',
  
  // Authentication workflow events
  LOGIN_INITIATED: 'auth:loginInitiated',
  LOGIN_CANCELED: 'auth:loginCanceled',
  MFA_REQUIRED: 'auth:mfaRequired',
  MFA_COMPLETED: 'auth:mfaCompleted',
  PASSWORD_RESET_INITIATED: 'auth:passwordResetInitiated',
  PASSWORD_RESET_COMPLETED: 'auth:passwordResetCompleted',
  
  // Token events
  TOKEN_REFRESHED: 'auth:tokenRefreshed',
  TOKEN_INVALID: 'auth:tokenInvalid',
  TOKEN_REVOKED: 'auth:tokenRevoked',
  
  // Permission events
  PERMISSIONS_CHANGED: 'auth:permissionsChanged',
  ROLE_ASSIGNED: 'auth:roleAssigned',
  ROLE_REMOVED: 'auth:roleRemoved',
  
  // User profile events
  PROFILE_UPDATED: 'auth:profileUpdated',
  EMAIL_VERIFIED: 'auth:emailVerified',
  
  // Error events
  ERROR: 'auth:error',
  
  // Admin events
  USER_CREATED: 'auth:userCreated',
  USER_UPDATED: 'auth:userUpdated',
  USER_DELETED: 'auth:userDeleted',
  
  // Cross-tab/device events
  STATE_CHANGED: 'auth:stateChanged',
  DEVICE_ADDED: 'auth:deviceAdded',
  DEVICE_REMOVED: 'auth:deviceRemoved'
};

/**
 * AuthEvents provides a wrapper around EventBus for authentication-specific events,
 * with typed event definitions and additional context for auth events.
 */
class AuthEvents {
  constructor() {
    this.eventBus = null;
    this.subscriptions = new Map();
    this.eventHistory = [];
    this.maxHistorySize = 50;
    this.debugMode = false;
  }
  
  /**
   * Initialize the auth events system
   * @param {Object} [options] - Initialization options
   * @param {boolean} [options.debug] - Enable debug mode with verbose logging
   * @param {number} [options.historySize] - Maximum number of events to keep in history
   */
  initialize(options = {}) {
    // Get event bus from registry or use the default
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    // Configure options
    this.debugMode = options.debug === true;
    if (options.historySize && typeof options.historySize === 'number') {
      this.maxHistorySize = options.historySize;
    }
    
    if (this.debugMode) {
      console.log('AuthEvents initialized with options:', options);
    }
  }
  
  /**
   * Enable debug mode for verbose event logging
   * @param {boolean} [enabled=true] - Whether to enable debug mode
   */
  setDebugMode(enabled = true) {
    this.debugMode = enabled;
  }
  
  /**
   * Emit an authentication event
   * @param {string} eventType - Event type from AUTH_EVENTS
   * @param {Object} [data={}] - Event data
   * @param {Object} [options] - Event options
   * @param {boolean} [options.throttle] - Whether to throttle duplicate events
   * @param {number} [options.throttleTime] - Throttle duration in milliseconds
   */
  emit(eventType, data = {}, options = {}) {
    // Validate event type
    if (!Object.values(AUTH_EVENTS).includes(eventType)) {
      console.warn(`AuthEvents: Unknown event type "${eventType}"`);
    }
    
    // Add timestamp and metadata to event
    const eventData = {
      ...data,
      timestamp: Date.now(),
      eventId: this._generateEventId()
    };
    
    // Apply throttling if configured
    if (options.throttle && options.throttleTime) {
      const throttled = this._throttleEvent(eventType, eventData, options.throttleTime);
      if (throttled) return;
    }
    
    // Add to history
    this._addToHistory(eventType, eventData);
    
    // Debug logging
    if (this.debugMode) {
      console.debug(`AuthEvents: Emitting "${eventType}"`, eventData);
    }
    
    // Publish to event bus
    this.eventBus.publish(eventType, eventData);
  }
  
  /**
   * Subscribe to authentication events
   * @param {string} eventType - Event type from AUTH_EVENTS
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  on(eventType, handler) {
    // Validate event type
    if (!Object.values(AUTH_EVENTS).includes(eventType)) {
      console.warn(`AuthEvents: Unknown event type "${eventType}"`);
    }
    
    // Subscribe to event bus
    const unsubscribe = this.eventBus.on(eventType, handler);
    
    // Track subscription for cleanup
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType).add(handler);
    
    // Debug logging
    if (this.debugMode) {
      console.debug(`AuthEvents: Subscribed to "${eventType}"`);
    }
    
    // Return unsubscribe function that also removes from our tracking
    return () => {
      unsubscribe();
      if (this.subscriptions.has(eventType)) {
        this.subscriptions.get(eventType).delete(handler);
      }
      
      if (this.debugMode) {
        console.debug(`AuthEvents: Unsubscribed from "${eventType}"`);
      }
    };
  }
  
  /**
   * Subscribe to multiple authentication events
   * @param {Object} handlers - Map of event types to handlers
   * @returns {Function} Unsubscribe function for all handlers
   */
  onMultiple(handlers) {
    if (!handlers || typeof handlers !== 'object') {
      throw new Error('Handlers must be an object mapping event types to handler functions');
    }
    
    const unsubscribeFunctions = [];
    
    // Subscribe to each event
    for (const [eventType, handler] of Object.entries(handlers)) {
      unsubscribeFunctions.push(this.on(eventType, handler));
    }
    
    // Return function to unsubscribe from all
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }
  
  /**
   * Listen for any authentication event
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  onAny(handler) {
    const unsubscribeFunctions = Object.values(AUTH_EVENTS).map(eventType => 
      this.on(eventType, handler)
    );
    
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }
  
  /**
   * Listen for authentication event once
   * @param {string} eventType - Event type from AUTH_EVENTS
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  once(eventType, handler) {
    // Create wrapper that will unsubscribe after first invocation
    let unsubscribe = null;
    
    const wrapperHandler = (...args) => {
      // Call original handler
      handler(...args);
      
      // Unsubscribe after called once
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
    
    // Subscribe with wrapper
    unsubscribe = this.on(eventType, wrapperHandler);
    
    return unsubscribe;
  }
  
  /**
   * Get event history for debugging and auditing
   * @returns {Array} Event history
   */
  getHistory() {
    return [...this.eventHistory];
  }
  
  /**
   * Clear event history
   */
  clearHistory() {
    this.eventHistory = [];
    
    if (this.debugMode) {
      console.debug('AuthEvents: Event history cleared');
    }
  }
  
  /**
   * Add event to history
   * @private
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   */
  _addToHistory(eventType, data) {
    // Add to history
    this.eventHistory.unshift({ type: eventType, data });
    
    // Trim history if needed
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }
  }
  
  /**
   * Generate unique event ID
   * @private
   * @returns {string} Unique event ID
   */
  _generateEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 11);
  }
  
  /**
   * Throttle duplicate events
   * @private
   * @param {string} eventType - Event type
   * @param {Object} data - Event data
   * @param {number} throttleTime - Throttle time in milliseconds
   * @returns {boolean} Whether the event was throttled
   */
  _throttleEvent(eventType, data, throttleTime) {
    // Look for recent identical events
    const now = Date.now();
    const recentSameEvent = this.eventHistory.find(event => 
      event.type === eventType && 
      now - event.data.timestamp < throttleTime &&
      this._eventsHaveSameData(event.data, data)
    );
    
    return !!recentSameEvent;
  }
  
  /**
   * Compare event data for throttling
   * @private
   * @param {Object} data1 - First event data
   * @param {Object} data2 - Second event data
   * @returns {boolean} Whether the events have the same data
   */
  _eventsHaveSameData(data1, data2) {
    // Skip timestamp and eventId when comparing
    const { timestamp: t1, eventId: id1, ...rest1 } = data1;
    const { timestamp: t2, eventId: id2, ...rest2 } = data2;
    
    // Simple shallow comparison for basic objects
    return JSON.stringify(rest1) === JSON.stringify(rest2);
  }
  
  /**
   * Clean up resources when auth events are no longer needed
   */
  cleanup() {
    // Unsubscribe from all events
    for (const [eventType, handlers] of this.subscriptions.entries()) {
      for (const handler of handlers) {
        this.eventBus.off(eventType, handler);
      }
    }
    
    // Clear all tracked subscriptions
    this.subscriptions.clear();
    
    // Clear history
    this.eventHistory = [];
    
    if (this.debugMode) {
      console.debug('AuthEvents: Cleaned up all subscriptions and history');
    }
  }
}

// Create singleton instance
const authEvents = new AuthEvents();

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.AuthEvents',
  authEvents,
  ['utils.EventBus'],
  {
    description: 'Provides authentication event management with typed events and subscription capabilities',
    singleton: true
  }
); 