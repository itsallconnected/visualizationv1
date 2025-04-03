import registry from '../ModuleRegistry';
import appSettings from './app-settings';

/**
 * Feature Flags System
 * 
 * This module provides a centralized feature flag system for the application,
 * allowing for runtime toggling of features based on environment, user roles,
 * and gradual rollout strategies.
 * 
 * Features:
 * - Environment-aware feature flags
 * - User-specific feature flags based on roles or IDs
 * - Percentage-based gradual rollout
 * - Override mechanism for testing
 * - Subscription to feature flag changes
 */
class FeatureFlags {
  constructor() {
    // Initialize feature flag storage
    this.flags = new Map();
    
    // Overrides for testing or debugging
    this.overrides = new Map();
    
    // Subscribers for flag changes
    this.subscribers = new Map();
    
    // User context for user-specific flags
    this.userContext = null;
    
    // Flag definitions from app settings
    this.flagDefinitions = {};
    
    // Hash function for percentage-based rollouts
    this.hashFunction = this.simpleHash;
  }
  
  /**
   * Initialize the feature flags system
   */
  initialize() {
    // Register with ModuleRegistry
    registry.register(
      'config.feature-flags',
      this,
      ['config.app-settings', 'utils.EventBus'],
      {
        description: 'Feature flag system for toggling application features',
        provides: ['featureFlags', 'gradualRollout', 'featureOverrides']
      }
    );
    
    // Try to get EventBus
    this.eventBus = registry.get('utils.EventBus');
    
    // Initialize flags from app settings
    this.initializeFromSettings();
    
    // Subscribe to user context changes if EventBus is available
    if (this.eventBus) {
      this.eventBus.subscribe('auth:userChanged', this.handleUserChanged.bind(this));
      this.eventBus.subscribe('settings:updated', this.handleSettingsUpdated.bind(this));
    }
  }
  
  /**
   * Initialize feature flags from application settings
   */
  initializeFromSettings() {
    if (!appSettings || !appSettings.features) {
      console.warn('App settings not available for feature flag initialization');
      return;
    }
    
    // Extract feature flag definitions from app settings
    const { features } = appSettings;
    
    // Store flag definitions
    this.flagDefinitions = features;
    
    // Process each feature category
    for (const [category, categoryFlags] of Object.entries(features)) {
      // Handle features with nested structure
      if (categoryFlags && typeof categoryFlags === 'object') {
        for (const [flagName, flagValue] of Object.entries(categoryFlags)) {
          if (flagName === 'enabled') {
            // Set the main category toggle
            this.setFlag(`${category}`, flagValue);
          } else if (typeof flagValue !== 'object') {
            // Set individual flags within the category
            this.setFlag(`${category}.${flagName}`, flagValue);
          }
        }
      }
    }
    
    // Notify initialization complete
    if (this.eventBus) {
      this.eventBus.publish('featureFlags:initialized', { 
        flagCount: this.flags.size 
      });
    }
  }
  
  /**
   * Set a feature flag value
   * @param {string} flagName - Name of the feature flag
   * @param {boolean|object} value - Flag value or configuration object
   */
  setFlag(flagName, value) {
    // Handle boolean values directly
    if (typeof value === 'boolean') {
      this.flags.set(flagName, { enabled: value });
      return;
    }
    
    // Handle configuration objects
    if (typeof value === 'object' && value !== null) {
      // If it has an 'enabled' property, use that configuration
      if ('enabled' in value) {
        this.flags.set(flagName, { ...value });
        return;
      }
    }
    
    // Default to disabled if value is not recognized
    this.flags.set(flagName, { enabled: false });
  }
  
  /**
   * Check if a feature flag is enabled
   * @param {string} flagName - Name of the feature flag
   * @param {Object} [options] - Additional options for flag checking
   * @param {Object} [options.user] - User context for user-specific flags
   * @param {string} [options.userId] - User ID for percentage-based rollout
   * @param {boolean} [options.default=false] - Default value if flag not found
   * @returns {boolean} - Whether the feature is enabled
   */
  isEnabled(flagName, options = {}) {
    const { 
      user = this.userContext,
      userId,
      default: defaultValue = false 
    } = options;
    
    // Check for test override first
    if (this.overrides.has(flagName)) {
      return this.overrides.get(flagName);
    }
    
    // Get flag configuration
    const flag = this.getFlag(flagName);
    
    // Flag not found, return default
    if (!flag) {
      return defaultValue;
    }
    
    // Main enabled flag is false, short-circuit
    if (flag.enabled === false) {
      return false;
    }
    
    // Check permission-based flags
    if (flag.requiredPermissions && user) {
      // If user doesn't have any of the required permissions, return false
      const hasPermission = flag.requiredPermissions.some(perm => 
        user.permissions && user.permissions.includes(perm)
      );
      
      if (!hasPermission) {
        return false;
      }
    }
    
    // Check role-based flags
    if (flag.requiredRoles && user) {
      // If user doesn't have any of the required roles, return false
      const hasRole = flag.requiredRoles.some(role => 
        user.roles && user.roles.includes(role)
      );
      
      if (!hasRole) {
        return false;
      }
    }
    
    // Check user inclusion/exclusion lists
    if (flag.includeUsers && user) {
      const userIdToCheck = user.id || userId;
      
      if (userIdToCheck && !flag.includeUsers.includes(userIdToCheck)) {
        return false;
      }
    }
    
    if (flag.excludeUsers && user) {
      const userIdToCheck = user.id || userId;
      
      if (userIdToCheck && flag.excludeUsers.includes(userIdToCheck)) {
        return false;
      }
    }
    
    // Check percentage-based rollout
    if (flag.percentage !== undefined && flag.percentage < 100) {
      const userIdToCheck = (user && user.id) || userId || 'anonymous';
      const hash = this.hashFunction(`${flagName}:${userIdToCheck}`);
      const normalizedHash = hash % 100;
      
      if (normalizedHash >= flag.percentage) {
        return false;
      }
    }
    
    // If all checks pass, feature is enabled
    return flag.enabled !== false;
  }
  
  /**
   * Get a feature flag configuration
   * @param {string} flagName - Name of the feature flag
   * @returns {Object|null} - Flag configuration or null if not found
   */
  getFlag(flagName) {
    // Check if the flag exists directly
    if (this.flags.has(flagName)) {
      return this.flags.get(flagName);
    }
    
    // Check for nested flags using dot notation
    const parts = flagName.split('.');
    
    if (parts.length >= 2) {
      // Try to find the parent category
      const categoryName = parts[0];
      const category = this.flags.get(categoryName);
      
      // If the category exists and is enabled
      if (category && category.enabled) {
        // Check for exact nested flag
        if (this.flags.has(flagName)) {
          return this.flags.get(flagName);
        }
        
        // Default to enabled if category is enabled and specific flag is not found
        return { enabled: true };
      }
    }
    
    // Flag not found
    return null;
  }
  
  /**
   * Set a user context for user-specific feature flags
   * @param {Object} user - User context object
   */
  setUserContext(user) {
    this.userContext = user;
    
    // Notify user context change
    if (this.eventBus) {
      this.eventBus.publish('featureFlags:userContextChanged', { 
        userId: user?.id || 'anonymous'
      });
    }
  }
  
  /**
   * Set an override for testing or debugging
   * @param {string} flagName - Name of the feature flag
   * @param {boolean} enabled - Override value
   */
  setOverride(flagName, enabled) {
    this.overrides.set(flagName, enabled);
    
    // Notify override change
    if (this.eventBus) {
      this.eventBus.publish('featureFlags:overrideSet', { 
        flagName,
        enabled
      });
    }
    
    // Trigger subscribers
    this.notifySubscribers(flagName);
  }
  
  /**
   * Clear an override
   * @param {string} flagName - Name of the feature flag to clear override for
   */
  clearOverride(flagName) {
    if (this.overrides.has(flagName)) {
      this.overrides.delete(flagName);
      
      // Notify override cleared
      if (this.eventBus) {
        this.eventBus.publish('featureFlags:overrideCleared', { 
          flagName 
        });
      }
      
      // Trigger subscribers
      this.notifySubscribers(flagName);
    }
  }
  
  /**
   * Clear all overrides
   */
  clearAllOverrides() {
    const affectedFlags = Array.from(this.overrides.keys());
    this.overrides.clear();
    
    // Notify all overrides cleared
    if (this.eventBus) {
      this.eventBus.publish('featureFlags:allOverridesCleared', { 
        count: affectedFlags.length 
      });
    }
    
    // Trigger subscribers for each affected flag
    affectedFlags.forEach(flagName => {
      this.notifySubscribers(flagName);
    });
  }
  
  /**
   * Subscribe to changes for a specific feature flag
   * @param {string} flagName - Name of the feature flag
   * @param {Function} callback - Callback function when flag changes
   * @returns {Function} - Unsubscribe function
   */
  subscribe(flagName, callback) {
    if (!this.subscribers.has(flagName)) {
      this.subscribers.set(flagName, new Set());
    }
    
    this.subscribers.get(flagName).add(callback);
    
    // Return unsubscribe function
    return () => {
      if (this.subscribers.has(flagName)) {
        this.subscribers.get(flagName).delete(callback);
      }
    };
  }
  
  /**
   * Notify subscribers of a flag change
   * @param {string} flagName - Name of the feature flag that changed
   */
  notifySubscribers(flagName) {
    if (this.subscribers.has(flagName)) {
      const isEnabled = this.isEnabled(flagName);
      const subscribers = this.subscribers.get(flagName);
      
      subscribers.forEach(callback => {
        try {
          callback(isEnabled);
        } catch (error) {
          console.error(`Error in feature flag subscriber for ${flagName}:`, error);
        }
      });
    }
  }
  
  /**
   * Handle user change event from authentication system
   * @param {Object} data - Event data containing user information
   */
  handleUserChanged(data) {
    if (data.user) {
      this.setUserContext(data.user);
    } else {
      this.setUserContext(null);
    }
  }
  
  /**
   * Handle settings updated event
   * @param {Object} data - Event data containing updated settings
   */
  handleSettingsUpdated(data) {
    // Re-initialize flags from settings if app settings were updated
    if (data.section === 'features') {
      this.initializeFromSettings();
    }
  }
  
  /**
   * Simple hash function for percentage-based rollouts
   * @param {string} str - String to hash
   * @returns {number} - Hash value between 0-99
   */
  simpleHash(str) {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      // Simple hash formula: multiply by 31 and add character code
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Make sure the hash is positive and between 0-99
    return Math.abs(hash) % 100;
  }
  
  /**
   * Get all feature flags
   * @returns {Object} - Map of all feature flags
   */
  getAllFlags() {
    const result = {};
    
    for (const [flagName, flagConfig] of this.flags.entries()) {
      result[flagName] = {
        ...flagConfig,
        currentValue: this.isEnabled(flagName),
        hasOverride: this.overrides.has(flagName)
      };
    }
    
    return result;
  }
  
  /**
   * Get feature flags matching a prefix
   * @param {string} prefix - Prefix to match
   * @returns {Object} - Map of matching feature flags
   */
  getFlagsByPrefix(prefix) {
    const result = {};
    
    for (const [flagName, flagConfig] of this.flags.entries()) {
      if (flagName.startsWith(prefix)) {
        result[flagName] = {
          ...flagConfig,
          currentValue: this.isEnabled(flagName),
          hasOverride: this.overrides.has(flagName)
        };
      }
    }
    
    return result;
  }
}

// Create singleton instance
const featureFlags = new FeatureFlags();

// Export the singleton
export default featureFlags; 