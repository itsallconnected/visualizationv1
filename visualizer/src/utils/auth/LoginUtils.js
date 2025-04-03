/**
 * Login Utilities
 * 
 * Provides utility functions for login state management, login attempt tracking,
 * security measures, and other authentication-related functionality.
 */

import registry from '../../ModuleRegistry';
import EventBus from '../EventBus';

/**
 * Maximum number of failed login attempts before temporary lockout
 */
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Lockout duration in milliseconds (10 minutes)
 */
const LOCKOUT_DURATION = 10 * 60 * 1000;

/**
 * Local storage keys
 */
const STORAGE_KEYS = {
  FAILED_ATTEMPTS: 'auth:failed_attempts',
  LOCKOUT_TIME: 'auth:lockout_time',
  LAST_ATTEMPT: 'auth:last_attempt',
  REDIRECT_PATH: 'auth:redirect_path',
  LOGIN_STATE: 'auth:login_state'
};

/**
 * Login utilities for authentication-related functionality
 */
const LoginUtils = {
  /**
   * Check if login is currently locked out due to too many failed attempts
   * @returns {boolean} Whether login is currently locked out
   */
  isLockedOut() {
    const lockoutTime = this.getLockedOutTime();
    if (!lockoutTime) return false;
    
    // Check if lockout period has expired
    const now = Date.now();
    return now < lockoutTime;
  },
  
  /**
   * Get remaining lockout time in milliseconds
   * @returns {number} Remaining lockout time in ms, or 0 if not locked out
   */
  getLockoutRemaining() {
    const lockoutTime = this.getLockedOutTime();
    if (!lockoutTime) return 0;
    
    const now = Date.now();
    return Math.max(0, lockoutTime - now);
  },
  
  /**
   * Get lockout expiration timestamp
   * @returns {number|null} Timestamp when lockout expires, or null if not locked
   */
  getLockedOutTime() {
    const lockoutTime = localStorage.getItem(STORAGE_KEYS.LOCKOUT_TIME);
    return lockoutTime ? parseInt(lockoutTime, 10) : null;
  },
  
  /**
   * Track a failed login attempt and apply lockout if threshold reached
   * @param {string} [providerId='github'] - Authentication provider ID
   * @returns {Object} Lockout status
   */
  trackFailedAttempt(providerId = 'github') {
    // Get current attempts count
    let attempts = this.getFailedAttempts();
    
    // Increment attempts counter
    attempts += 1;
    localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, attempts);
    localStorage.setItem(STORAGE_KEYS.LAST_ATTEMPT, Date.now());
    
    // Apply lockout if max attempts reached
    const isLocked = attempts >= MAX_FAILED_ATTEMPTS;
    if (isLocked) {
      const lockoutTime = Date.now() + LOCKOUT_DURATION;
      localStorage.setItem(STORAGE_KEYS.LOCKOUT_TIME, lockoutTime);
      
      // Publish lockout event
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      if (eventBus) {
        eventBus.publish('auth:lockout', {
          providerId,
          attempts,
          expiration: new Date(lockoutTime)
        });
      }
    }
    
    return {
      attempts,
      isLocked,
      attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - attempts),
      lockoutTime: isLocked ? this.getLockedOutTime() : null
    };
  },
  
  /**
   * Get the number of current failed login attempts
   * @returns {number} Number of failed attempts
   */
  getFailedAttempts() {
    const attempts = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    return attempts ? parseInt(attempts, 10) : 0;
  },
  
  /**
   * Reset failed login attempts counter
   */
  resetFailedAttempts() {
    localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEYS.LOCKOUT_TIME);
  },
  
  /**
   * Save the redirect path to use after successful login
   * @param {string} path - Redirect path to save
   */
  saveRedirectPath(path) {
    if (!path) return;
    localStorage.setItem(STORAGE_KEYS.REDIRECT_PATH, path);
  },
  
  /**
   * Get saved redirect path for post-login navigation
   * @returns {string|null} Saved redirect path or null if none
   */
  getRedirectPath() {
    return localStorage.getItem(STORAGE_KEYS.REDIRECT_PATH);
  },
  
  /**
   * Clear saved redirect path
   */
  clearRedirectPath() {
    localStorage.removeItem(STORAGE_KEYS.REDIRECT_PATH);
  },
  
  /**
   * Save temporary login state for cross-tab authentication
   * @param {Object} state - Login state to save
   */
  saveLoginState(state) {
    if (!state) return;
    localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, JSON.stringify(state));
  },
  
  /**
   * Get saved login state
   * @returns {Object|null} Parsed login state or null if none
   */
  getLoginState() {
    const state = localStorage.getItem(STORAGE_KEYS.LOGIN_STATE);
    try {
      return state ? JSON.parse(state) : null;
    } catch (e) {
      console.error('Failed to parse login state:', e);
      return null;
    }
  },
  
  /**
   * Clear saved login state
   */
  clearLoginState() {
    localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
  },
  
  /**
   * Extract and validate redirect parameter from URL
   * @param {string} url - URL string to parse
   * @param {string} [paramName='redirect'] - Name of redirect parameter
   * @returns {string|null} Validated redirect path or null if invalid
   */
  extractRedirectParam(url, paramName = 'redirect') {
    try {
      const urlObj = new URL(url, window.location.origin);
      const redirect = urlObj.searchParams.get(paramName);
      
      // Validate redirect URL (must be relative path for security)
      if (redirect && this.isValidRedirectPath(redirect)) {
        return redirect;
      }
    } catch (e) {
      console.error('Failed to parse URL for redirect:', e);
    }
    
    return null;
  },
  
  /**
   * Check if a redirect path is valid and safe
   * @param {string} path - Redirect path to validate
   * @returns {boolean} Whether path is valid and safe for redirect
   */
  isValidRedirectPath(path) {
    // Must be a string
    if (typeof path !== 'string') return false;
    
    // Prevent protocol-relative URLs
    if (path.startsWith('//')) return false;
    
    // Prevent absolute URLs (security risk)
    if (/^[a-z]+:/i.test(path)) return false;
    
    // Path should start with / for application routes
    if (!path.startsWith('/')) return false;
    
    // Block paths with suspicious patterns
    if (path.includes('javascript:') || path.includes('data:')) return false;
    
    return true;
  },
  
  /**
   * Clear all authentication-related storage
   */
  clearAllAuthStorage() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },
  
  /**
   * Validate a token is properly formatted (without revealing token)
   * @param {string} token - Token to validate
   * @returns {boolean} Whether token has valid format
   */
  isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') return false;
    
    // Check for expected bearer token format
    // This is a simple check and should be enhanced based on actual token format
    return /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(token);
  }
};

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.LoginUtils',
  LoginUtils,
  ['utils.EventBus'],
  {
    description: 'Utilities for login state management and security',
    usage: `
      // Check if login is locked due to too many attempts
      if (LoginUtils.isLockedOut()) {
        const remainingTime = LoginUtils.getLockoutRemaining();
        // Show user lockout message with remaining time
      }
      
      // Handle failed login attempt
      const status = LoginUtils.trackFailedAttempt();
      if (status.isLocked) {
        // Show lockout message
      }
      
      // Save redirect path for post-login navigation
      LoginUtils.saveRedirectPath('/dashboard');
    `
  }
); 