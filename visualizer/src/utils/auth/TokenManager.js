/**
 * Token Manager
 * 
 * Manages authentication tokens including storage, retrieval, validation, and refresh operations.
 * Supports multiple storage strategies and secure token handling.
 */

import registry from '../../ModuleRegistry';
import AUTH_CONFIG from '../../config/auth-config';
import EventBus from '../EventBus';

/**
 * TokenManager provides secure handling of authentication tokens
 * with support for different storage strategies, token validation,
 * and token refresh scheduling.
 */
class TokenManager {
  constructor() {
    this.tokenKey = 'auth_token';
    this.refreshKey = 'auth_refresh_token';
    this.expiryKey = 'auth_token_expiry';
    this.stateKey = 'auth_state';
    this.tokenType = 'Bearer';
    this.storageStrategy = AUTH_CONFIG.security.tokenStorage || 'localStorage';
    this.refreshTimer = null;
    this.refreshThreshold = 5 * 60 * 1000; // 5 minutes before expiry
    this.eventBus = null;
    this.initialized = false;
    
    // Map to track tokens across devices/tabs
    this.tokenMap = new Map();
  }

  /**
   * Initialize the token manager
   */
  initialize() {
    if (this.initialized) return;
    
    // Get EventBus instance
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    // Set up cross-tab synchronization if using browser storage
    if (typeof window !== 'undefined' && 
        (this.storageStrategy === 'localStorage' || this.storageStrategy === 'sessionStorage')) {
      window.addEventListener('storage', this._handleStorageEvent);
      
      // Initialize token map from storage if available
      this._syncFromStorage();
    }
    
    this.initialized = true;
  }

  /**
   * Set authentication tokens
   * 
   * @param {Object} tokenData - Token data to store
   * @param {string} tokenData.accessToken - Access token
   * @param {string} [tokenData.refreshToken] - Refresh token
   * @param {number} [tokenData.expiresIn] - Token lifetime in seconds
   * @param {string} [tokenData.tokenType] - Token type (e.g., 'Bearer')
   * @param {string} [tokenData.scope] - Token scopes
   * @param {string} [deviceId] - Optional device identifier for multi-device tracking
   * @returns {Object} Stored token data with expiry timestamp
   */
  setTokens(tokenData, deviceId = 'default') {
    if (!tokenData || !tokenData.accessToken) {
      throw new Error('Invalid token data');
    }

    // Calculate expiry timestamp if expiresIn is provided
    const expiresAt = tokenData.expiresIn 
      ? Date.now() + (tokenData.expiresIn * 1000)
      : null;
    
    // Prepare token data for storage
    const tokenToStore = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || null,
      tokenType: tokenData.tokenType || this.tokenType,
      scope: tokenData.scope || '',
      expiresAt,
      createdAt: Date.now(),
      deviceId
    };
    
    // Store in memory map
    this.tokenMap.set(deviceId, tokenToStore);
    
    // Store in configured storage
    this._saveToStorage(tokenToStore);
    
    // Schedule token refresh if expiry is known
    if (expiresAt) {
      this._scheduleTokenRefresh(expiresAt);
    }
    
    // Publish token update event
    this._publishTokenEvent('token:updated', tokenToStore);
    
    return tokenToStore;
  }

  /**
   * Get the current tokens
   * 
   * @param {string} [deviceId] - Optional device identifier
   * @returns {Object|null} Current tokens or null if not found
   */
  getTokens(deviceId = 'default') {
    // First check memory map
    if (this.tokenMap.has(deviceId)) {
      return this.tokenMap.get(deviceId);
    }
    
    // Then check storage
    return this._loadFromStorage();
  }

  /**
   * Get the current access token
   * 
   * @returns {string|null} Access token or null if not available
   */
  getAccessToken() {
    const tokens = this.getTokens();
    return tokens ? tokens.accessToken : null;
  }

  /**
   * Check if tokens are valid and not expired
   * 
   * @returns {boolean} Whether tokens are valid
   */
  isTokenValid() {
    const tokens = this.getTokens();
    
    if (!tokens || !tokens.accessToken) {
      return false;
    }
    
    // If no expiry, token is valid until revoked
    if (!tokens.expiresAt) {
      return true;
    }
    
    // Check expiration with 5 second buffer
    return Date.now() < tokens.expiresAt - 5000;
  }

  /**
   * Check if token needs refreshing soon
   * 
   * @param {number} [thresholdMs] - Threshold in milliseconds
   * @returns {boolean} Whether token needs refreshing
   */
  isTokenExpiringSoon(thresholdMs = this.refreshThreshold) {
    const tokens = this.getTokens();
    
    if (!tokens || !tokens.accessToken || !tokens.expiresAt) {
      return false;
    }
    
    return tokens.expiresAt - Date.now() < thresholdMs;
  }

  /**
   * Clear all tokens from storage
   */
  clearTokens() {
    // Clear memory map
    this.tokenMap.clear();
    
    // Clear storage
    this._clearStorage();
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Publish token removed event
    this._publishTokenEvent('token:removed');
  }

  /**
   * Rotate tokens for security
   * 
   * @param {Object} newTokenData - New token data
   * @returns {Object} Updated token data
   */
  rotateTokens(newTokenData) {
    // Clear old tokens but maintain device ID
    const oldTokens = this.getTokens();
    const deviceId = oldTokens?.deviceId || 'default';
    
    // Store new tokens with same device ID
    return this.setTokens(newTokenData, deviceId);
  }

  /**
   * Revoke the specified token
   * 
   * @param {string} [deviceId] - Device identifier to revoke
   * @returns {boolean} Whether token was revoked
   */
  revokeToken(deviceId = 'default') {
    // Check if token exists
    if (!this.tokenMap.has(deviceId)) {
      return false;
    }
    
    // Remove from map
    this.tokenMap.delete(deviceId);
    
    // Update storage if revoking current device
    if (deviceId === 'default') {
      this._clearStorage();
    }
    
    // Publish revocation event
    this._publishTokenEvent('token:revoked', { deviceId });
    
    return true;
  }

  /**
   * Get authentication header for API requests
   * 
   * @returns {Object|null} Authentication header or null if not authenticated
   */
  getAuthHeader() {
    const tokens = this.getTokens();
    
    if (!tokens || !tokens.accessToken) {
      return null;
    }
    
    return {
      'Authorization': `${tokens.tokenType} ${tokens.accessToken}`
    };
  }

  /**
   * Save token data to storage based on configured strategy
   * 
   * @private
   * @param {Object} tokenData - Token data to store
   */
  _saveToStorage(tokenData) {
    if (typeof window === 'undefined') return;
    
    try {
      const tokenString = JSON.stringify(tokenData);
      
      switch (this.storageStrategy) {
        case 'localStorage':
          localStorage.setItem(this.tokenKey, tokenString);
          break;
        case 'sessionStorage':
          sessionStorage.setItem(this.tokenKey, tokenString);
          break;
        case 'memory':
          // Already stored in tokenMap
          break;
        default:
          console.warn('Unknown storage strategy:', this.storageStrategy);
      }
    } catch (error) {
      console.error('Error saving token to storage:', error);
    }
  }

  /**
   * Load token data from storage
   * 
   * @private
   * @returns {Object|null} Stored token data or null if not found
   */
  _loadFromStorage() {
    if (typeof window === 'undefined') return null;
    
    try {
      let tokenString = null;
      
      switch (this.storageStrategy) {
        case 'localStorage':
          tokenString = localStorage.getItem(this.tokenKey);
          break;
        case 'sessionStorage':
          tokenString = sessionStorage.getItem(this.tokenKey);
          break;
        case 'memory':
          // Already checked tokenMap
          return null;
      }
      
      if (!tokenString) return null;
      
      const tokenData = JSON.parse(tokenString);
      
      // Add to memory map
      if (tokenData.deviceId) {
        this.tokenMap.set(tokenData.deviceId, tokenData);
      } else {
        this.tokenMap.set('default', tokenData);
      }
      
      return tokenData;
    } catch (error) {
      console.error('Error loading token from storage:', error);
      return null;
    }
  }

  /**
   * Clear tokens from storage
   * 
   * @private
   */
  _clearStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      switch (this.storageStrategy) {
        case 'localStorage':
          localStorage.removeItem(this.tokenKey);
          localStorage.removeItem(this.refreshKey);
          localStorage.removeItem(this.expiryKey);
          localStorage.removeItem(this.stateKey);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(this.tokenKey);
          sessionStorage.removeItem(this.refreshKey);
          sessionStorage.removeItem(this.expiryKey);
          sessionStorage.removeItem(this.stateKey);
          break;
        case 'memory':
          // Already cleared tokenMap
          break;
      }
    } catch (error) {
      console.error('Error clearing tokens from storage:', error);
    }
  }

  /**
   * Synchronize token map from storage
   * 
   * @private
   */
  _syncFromStorage() {
    const tokenData = this._loadFromStorage();
    
    if (tokenData) {
      const deviceId = tokenData.deviceId || 'default';
      this.tokenMap.set(deviceId, tokenData);
      
      // Schedule refresh if needed
      if (tokenData.expiresAt) {
        this._scheduleTokenRefresh(tokenData.expiresAt);
      }
    }
  }

  /**
   * Handle storage events for cross-tab synchronization
   * 
   * @private
   * @param {StorageEvent} event - Storage event
   */
  _handleStorageEvent = (event) => {
    // Only process our token key
    if (event.key !== this.tokenKey) return;
    
    // Token was changed in another tab/window
    if (event.newValue && event.newValue !== event.oldValue) {
      try {
        // Parse and update local token map
        const tokenData = JSON.parse(event.newValue);
        const deviceId = tokenData.deviceId || 'default';
        this.tokenMap.set(deviceId, tokenData);
        
        // Publish token updated event
        this._publishTokenEvent('token:updated', tokenData);
        
        // Reschedule token refresh if needed
        if (tokenData.expiresAt) {
          this._scheduleTokenRefresh(tokenData.expiresAt);
        }
      } catch (error) {
        console.error('Error processing token storage event:', error);
      }
    } 
    // Token was removed in another tab/window
    else if (!event.newValue && event.oldValue) {
      // Clear local token map
      this.tokenMap.clear();
      
      // Clear refresh timer
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      
      // Publish token removed event
      this._publishTokenEvent('token:removed');
    }
  }

  /**
   * Schedule a token refresh before expiry
   * 
   * @private
   * @param {number} expiresAt - Expiration timestamp
   */
  _scheduleTokenRefresh(expiresAt) {
    // Clear existing timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Calculate time to refresh (threshold before expiry)
    const now = Date.now();
    const timeToExpiry = expiresAt - now;
    const timeToRefresh = Math.max(0, timeToExpiry - this.refreshThreshold);
    
    // Schedule refresh if token expires in the future
    if (timeToExpiry > 0) {
      this.refreshTimer = setTimeout(() => {
        // Publish token refresh needed event
        this._publishTokenEvent('token:refresh_needed', {
          expiresAt,
          timeRemaining: expiresAt - Date.now()
        });
      }, timeToRefresh);
    }
  }

  /**
   * Publish a token-related event
   * 
   * @private
   * @param {string} eventType - Event type
   * @param {Object} [data] - Event data
   */
  _publishTokenEvent(eventType, data = {}) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        ...data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Clean up resources when token manager is no longer needed
   */
  cleanup() {
    // Clear refresh timer
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    // Remove storage event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this._handleStorageEvent);
    }
    
    // Clear memory
    this.tokenMap.clear();
  }
}

// Create singleton instance
const tokenManager = new TokenManager();

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.TokenManager',
  tokenManager,
  ['utils.EventBus'],
  {
    description: 'Manages authentication tokens with secure storage and rotation',
    singleton: true
  }
); 