/**
 * Authentication State Storage
 * 
 * This utility provides secure storage mechanisms for authentication state,
 * including encrypted storage, cross-tab synchronization, and version migration.
 */

import { AuthEventTypes } from '../../types/auth/AuthTypes';
import CryptoJS from 'crypto-js';

// Storage keys
const STORAGE_KEYS = {
  AUTH_STATE: 'ai_align_viz_auth_state',
  AUTH_TOKEN: 'ai_align_viz_auth_token',
  LOGIN_HISTORY: 'ai_align_viz_login_history',
  STORAGE_VERSION: 'ai_align_viz_storage_version',
  STATE_MIGRATION: 'ai_align_viz_migration_status'
};

// Current storage version - increment when making breaking changes
const CURRENT_STORAGE_VERSION = 1;

/**
 * Class providing secure storage and synchronization for auth state
 */
class AuthStateStorage {
  constructor() {
    this.listeners = new Set();
    this.encryptionKey = null;
    this.storagePrefix = 'ai_align_viz_';
    
    // Initialize storage version check
    this._initStorageVersion();
    
    // Set up event listeners for cross-tab synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this._handleStorageEvent);
    }
  }
  
  /**
   * Initialize or verify storage version
   * Handles migration of data between versions if needed
   * @private
   */
  _initStorageVersion() {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
    
    if (!storedVersion) {
      // First time setup
      localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, CURRENT_STORAGE_VERSION.toString());
      return;
    }
    
    const parsedVersion = parseInt(storedVersion, 10);
    if (parsedVersion < CURRENT_STORAGE_VERSION) {
      // Migration needed
      this._migrateStorage(parsedVersion, CURRENT_STORAGE_VERSION);
      localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, CURRENT_STORAGE_VERSION.toString());
    }
  }
  
  /**
   * Migrate storage data between versions
   * @private
   * @param {number} fromVersion - Starting version
   * @param {number} toVersion - Target version
   */
  _migrateStorage(fromVersion, toVersion) {
    console.log(`Migrating auth storage from v${fromVersion} to v${toVersion}`);
    
    // Record migration status
    localStorage.setItem(STORAGE_KEYS.STATE_MIGRATION, JSON.stringify({
      from: fromVersion,
      to: toVersion,
      date: new Date().toISOString(),
      status: 'in_progress'
    }));
    
    try {
      // Handle migrations based on version
      switch (fromVersion) {
        case 0:
          // Migration from v0 to v1
          this._migrateFromV0ToV1();
          break;
          
        // Add future migrations here
      }
      
      // Record successful migration
      localStorage.setItem(STORAGE_KEYS.STATE_MIGRATION, JSON.stringify({
        from: fromVersion,
        to: toVersion,
        date: new Date().toISOString(),
        status: 'complete'
      }));
    } catch (error) {
      // Record failed migration
      localStorage.setItem(STORAGE_KEYS.STATE_MIGRATION, JSON.stringify({
        from: fromVersion,
        to: toVersion,
        date: new Date().toISOString(),
        status: 'failed',
        error: error.message
      }));
      
      console.error('Auth storage migration failed:', error);
    }
  }
  
  /**
   * Example migration method
   * @private
   */
  _migrateFromV0ToV1() {
    // Example: In v0, tokens were stored directly, in v1 they're encrypted
    const oldToken = localStorage.getItem('auth_token');
    if (oldToken) {
      try {
        const parsedToken = JSON.parse(oldToken);
        this.setAuthToken(parsedToken);
        localStorage.removeItem('auth_token');
      } catch (e) {
        console.error('Failed to migrate old token format', e);
      }
    }
  }
  
  /**
   * Handle storage events for cross-tab synchronization
   * @private
   * @param {StorageEvent} event - Storage event object
   */
  _handleStorageEvent = (event) => {
    // Only process our own storage keys
    if (!event.key || !event.key.startsWith(this.storagePrefix)) {
      return;
    }
    
    // Notify listeners about the change
    this.listeners.forEach(listener => {
      try {
        let data = null;
        
        switch (event.key) {
          case STORAGE_KEYS.AUTH_STATE:
            data = this.getAuthState();
            listener({ type: AuthEventTypes.STATE_CHANGED, payload: data });
            break;
            
          case STORAGE_KEYS.AUTH_TOKEN:
            // Someone signed in or out in another tab
            if (event.newValue && !event.oldValue) {
              listener({ type: AuthEventTypes.SIGN_IN, payload: this.getAuthState() });
            } else if (!event.newValue && event.oldValue) {
              listener({ type: AuthEventTypes.SIGN_OUT });
            } else if (event.newValue !== event.oldValue) {
              listener({ type: AuthEventTypes.TOKEN_REFRESHED });
            }
            break;
        }
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });
  }
  
  /**
   * Set the encryption key for sensitive data
   * @param {string} key - Encryption key
   */
  setEncryptionKey(key) {
    this.encryptionKey = key;
  }
  
  /**
   * Encrypt sensitive data if encryption key is available
   * @private
   * @param {*} data - Data to encrypt
   * @returns {string} - Encrypted data
   */
  _encrypt(data) {
    if (!data) return null;
    
    const serialized = JSON.stringify(data);
    
    if (this.encryptionKey) {
      return CryptoJS.AES.encrypt(serialized, this.encryptionKey).toString();
    }
    
    return serialized;
  }
  
  /**
   * Decrypt data if it was encrypted
   * @private
   * @param {string} encryptedData - Data to decrypt
   * @returns {*} - Decrypted data
   */
  _decrypt(encryptedData) {
    if (!encryptedData) return null;
    
    try {
      // First try to decrypt with key if available
      if (this.encryptionKey) {
        try {
          const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
          return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) {
          // If decryption fails, try parsing as unencrypted JSON
          return JSON.parse(encryptedData);
        }
      }
      
      // No encryption key, just parse JSON
      return JSON.parse(encryptedData);
    } catch (error) {
      console.error('Error decrypting auth data:', error);
      return null;
    }
  }
  
  /**
   * Store authentication state
   * @param {Object} state - Authentication state to store
   */
  setAuthState(state) {
    if (!state) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
      return;
    }
    
    // Don't store sensitive data in auth state
    // Tokens are stored separately
    const { user, isAuthenticated, status, permissionLevel, provider, mfaRequired } = state;
    
    const stateToStore = {
      user: user ? {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isAdmin: user.isAdmin,
        roles: user.roles,
        // Don't store full permissions object in main state
        provider: user.provider
      } : null,
      isAuthenticated,
      status,
      permissionLevel,
      provider,
      mfaRequired,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.AUTH_STATE, this._encrypt(stateToStore));
    
    // Dispatch event for other tabs
    this._dispatchChangeEvent();
  }
  
  /**
   * Retrieve authentication state
   * @returns {Object|null} - Current authentication state or null if not found
   */
  getAuthState() {
    const encrypted = localStorage.getItem(STORAGE_KEYS.AUTH_STATE);
    return this._decrypt(encrypted);
  }
  
  /**
   * Store authentication token
   * @param {Object} token - Token object to store
   */
  setAuthToken(token) {
    if (!token) {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      return;
    }
    
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, this._encrypt(token));
  }
  
  /**
   * Retrieve authentication token
   * @returns {Object|null} - Current token or null if not found
   */
  getAuthToken() {
    const encrypted = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return this._decrypt(encrypted);
  }
  
  /**
   * Add login to history
   * @param {Object} loginInfo - Information about the login
   */
  addLoginToHistory(loginInfo) {
    if (!loginInfo) return;
    
    const history = this.getLoginHistory() || [];
    
    // Add new login with timestamp
    const newLogin = {
      ...loginInfo,
      timestamp: new Date().toISOString()
    };
    
    // Keep only the last 10 logins
    const updatedHistory = [newLogin, ...history].slice(0, 10);
    
    localStorage.setItem(STORAGE_KEYS.LOGIN_HISTORY, this._encrypt(updatedHistory));
  }
  
  /**
   * Get login history
   * @returns {Array} - Array of login history entries
   */
  getLoginHistory() {
    const encrypted = localStorage.getItem(STORAGE_KEYS.LOGIN_HISTORY);
    return this._decrypt(encrypted) || [];
  }
  
  /**
   * Clear all authentication data
   */
  clearAuthData() {
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATE);
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    // Don't clear login history or storage version
    
    // Dispatch event for other tabs
    this._dispatchChangeEvent();
  }
  
  /**
   * Dispatch change event for cross-tab synchronization
   * @private
   */
  _dispatchChangeEvent() {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new Event('ai_align_viz_auth_changed'));
    }
  }
  
  /**
   * Add listener for storage events
   * @param {Function} listener - Callback function for storage events
   * @returns {Function} - Function to remove the listener
   */
  addListener(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Remove all listeners
   */
  clearListeners() {
    this.listeners.clear();
  }
  
  /**
   * Clean up resources when the storage is no longer needed
   */
  cleanup() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this._handleStorageEvent);
    }
    this.clearListeners();
  }
}

// Create singleton instance
const authStorage = new AuthStateStorage();

export default authStorage; 