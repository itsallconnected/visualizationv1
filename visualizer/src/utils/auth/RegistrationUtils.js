/**
 * Registration Utilities
 * 
 * Provides utility functions for registration data management, validation,
 * duplicate detection, and other registration-related functionality.
 */

import registry from '../../ModuleRegistry';
import EventBus from '../EventBus';

/**
 * Local storage keys for registration-related data
 */
const STORAGE_KEYS = {
  REGISTRATION_HISTORY: 'registration:history',
  REGISTRATION_IP_MAP: 'registration:ip_map',
  LAST_REGISTRATION_ATTEMPT: 'registration:last_attempt'
};

/**
 * Min wait period between registration attempts in milliseconds (10 minutes)
 */
const MIN_REGISTRATION_WAIT = 10 * 60 * 1000;

/**
 * Registration utilities for registration-related functionality
 */
const RegistrationUtils = {
  /**
   * Check if a registration is a potential duplicate based on IP and device
   * @param {Object} userData - User data to check 
   * @returns {boolean} Whether registration is likely a duplicate
   */
  isPotentialDuplicate(userData = {}) {
    if (!userData || !userData.email) return false;
    
    try {
      // Check registration history
      const history = this.getRegistrationHistory();
      
      // Look for same email in history
      const sameEmail = history.find(entry => 
        entry.email?.toLowerCase() === userData.email.toLowerCase());
      
      if (sameEmail) {
        return true;
      }
      
      // Check additional signals if available
      if (userData.ip) {
        const ipMap = this._getStoredItem(STORAGE_KEYS.REGISTRATION_IP_MAP) || {};
        if (ipMap[userData.ip] && ipMap[userData.ip].length > 2) {
          return true; // More than 2 accounts from same IP is suspicious
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for duplicate registration:', error);
      return false; // Fail open if error occurs
    }
  },
  
  /**
   * Track a successful registration for duplicate detection
   * @param {Object} userData - User data to track
   */
  trackSuccessfulRegistration(userData = {}) {
    if (!userData || !userData.email) return;
    
    try {
      // Add to registration history
      const history = this.getRegistrationHistory();
      const timestamp = new Date().toISOString();
      
      history.push({
        email: userData.email,
        username: userData.username,
        timestamp,
        userAgent: navigator.userAgent,
        ip: userData.ip
      });
      
      // Keep history limited to last 100 entries
      const trimmedHistory = history.slice(-100);
      this._setStoredItem(STORAGE_KEYS.REGISTRATION_HISTORY, trimmedHistory);
      
      // Update IP mapping if available
      if (userData.ip) {
        const ipMap = this._getStoredItem(STORAGE_KEYS.REGISTRATION_IP_MAP) || {};
        ipMap[userData.ip] = ipMap[userData.ip] || [];
        ipMap[userData.ip].push({
          email: userData.email,
          timestamp
        });
        
        this._setStoredItem(STORAGE_KEYS.REGISTRATION_IP_MAP, ipMap);
      }
      
      // Publish tracking event
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.publish('registration:tracked', {
        timestamp,
        email: userData.email
      });
    } catch (error) {
      console.error('Error tracking registration:', error);
    }
  },
  
  /**
   * Get registration history entries
   * @returns {Array} Registration history entries
   */
  getRegistrationHistory() {
    return this._getStoredItem(STORAGE_KEYS.REGISTRATION_HISTORY) || [];
  },
  
  /**
   * Check if registration rate limit is exceeded
   * @returns {Object} Rate limit status
   */
  checkRateLimits() {
    try {
      const lastAttempt = this._getStoredItem(STORAGE_KEYS.LAST_REGISTRATION_ATTEMPT);
      
      if (!lastAttempt) {
        return { limited: false };
      }
      
      const now = Date.now();
      const timeSinceLastAttempt = now - lastAttempt.timestamp;
      
      if (timeSinceLastAttempt < MIN_REGISTRATION_WAIT) {
        const remainingTime = MIN_REGISTRATION_WAIT - timeSinceLastAttempt;
        const minutes = Math.ceil(remainingTime / (60 * 1000));
        
        return {
          limited: true,
          remainingTime,
          message: `Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before attempting to register again.`
        };
      }
      
      return { limited: false };
    } catch (error) {
      console.error('Error checking rate limits:', error);
      return { limited: false }; // Fail open if error
    }
  },
  
  /**
   * Track a registration attempt for rate limiting
   */
  trackRegistrationAttempt() {
    const now = Date.now();
    
    this._setStoredItem(STORAGE_KEYS.LAST_REGISTRATION_ATTEMPT, {
      timestamp: now,
      userAgent: navigator.userAgent
    });
  },
  
  /**
   * Parse GitHub OAuth data for registration
   * @param {Object} githubData - Raw GitHub user data 
   * @returns {Object} Parsed registration data
   */
  parseGitHubData(githubData) {
    if (!githubData) return {};
    
    return {
      githubId: githubData.id,
      username: githubData.login,
      name: githubData.name || githubData.login,
      email: githubData.email || '',
      avatar: githubData.avatar_url,
      profileUrl: githubData.html_url,
      location: githubData.location,
      company: githubData.company,
      bio: githubData.bio
    };
  },
  
  /**
   * Extract and normalize registration data from profile form
   * @param {Object} formData - Raw form data
   * @returns {Object} Normalized registration data
   */
  normalizeProfileData(formData) {
    if (!formData) return {};
    
    return {
      name: (formData.name || '').trim(),
      email: (formData.email || '').trim().toLowerCase(),
      company: (formData.company || '').trim(),
      phone: (formData.phone || '').trim(),
      role: formData.role || '',
      interests: formData.interests || [],
      terms: !!formData.terms,
      allowContactByEmail: !!formData.allowContactByEmail,
      privacyPolicyAccepted: !!formData.terms,
      registrationDate: new Date().toISOString()
    };
  },
  
  /**
   * Validate that required registration data is present
   * @param {Object} userData - User data to validate
   * @returns {Object} Validation result
   */
  validateRegistrationData(userData) {
    const errors = {};
    
    // Check required GitHub data
    if (!userData.githubId) {
      errors.githubId = 'GitHub authentication is required';
    }
    
    if (!userData.username) {
      errors.username = 'Username is required';
    }
    
    // Check required profile data
    if (!userData.name) {
      errors.name = 'Name is required';
    }
    
    if (!userData.email) {
      errors.email = 'Email address is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userData.email)) {
        errors.email = 'Invalid email format';
      }
    }
    
    if (!userData.terms) {
      errors.terms = 'You must accept the terms and conditions';
    }
    
    // Validation result
    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  },
  
  /**
   * Generate a unique registration code
   * @returns {string} Unique registration code
   */
  generateRegistrationCode() {
    return 'REG-' + 
      Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
      Math.random().toString(36).substring(2, 6).toUpperCase();
  },
  
  /**
   * Clear all registration-related storage data
   */
  clearRegistrationStorage() {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Publish event
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.publish('registration:storage:cleared', {
      timestamp: new Date().toISOString()
    });
  },
  
  /**
   * Get item from storage with error handling
   * @private
   * @param {string} key - Storage key 
   * @returns {*} Stored value or null if not found/error
   */
  _getStoredItem(key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error retrieving ${key} from storage:`, error);
      return null;
    }
  },
  
  /**
   * Set item in storage with error handling
   * @private
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   */
  _setStoredItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error storing ${key} in storage:`, error);
      
      // If storage quota exceeded, try to clear some space
      if (error.name === 'QuotaExceededError') {
        // Clear older registration history entries
        if (key !== STORAGE_KEYS.REGISTRATION_HISTORY) {
          const history = this._getStoredItem(STORAGE_KEYS.REGISTRATION_HISTORY) || [];
          if (history.length > 20) {
            this._setStoredItem(STORAGE_KEYS.REGISTRATION_HISTORY, history.slice(-20));
            
            // Try again
            try {
              localStorage.setItem(key, JSON.stringify(value));
            } catch (retryError) {
              console.error('Failed to store after cleanup:', retryError);
            }
          }
        }
      }
    }
  }
};

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.RegistrationUtils',
  RegistrationUtils,
  ['utils.EventBus'],
  {
    description: 'Utilities for user registration management and validation',
    usage: `
      // Check if registration is a duplicate
      const isDuplicate = RegistrationUtils.isPotentialDuplicate(userData);
      
      // Track successful registration
      RegistrationUtils.trackSuccessfulRegistration(userData);
      
      // Check rate limits
      const { limited, message } = RegistrationUtils.checkRateLimits();
      if (limited) {
        // Show rate limit message to user
      }
      
      // Validate registration data
      const { valid, errors } = RegistrationUtils.validateRegistrationData(userData);
    `
  }
); 