import { useState, useEffect, useCallback, useMemo } from 'react';
import registry from '../ModuleRegistry';
import appSettings from '../config/app-settings';

/**
 * Hook for accessing and using application settings.
 * 
 * This hook provides a convenient way to:
 * - Access application settings from anywhere in the component tree
 * - Reactively update components when settings change
 * - Subscribe to specific settings changes
 * - Get settings with proper typing and defaults
 * 
 * @param {string} [section] - Optional section of settings to access
 * @param {string} [key] - Optional specific key within section to access
 * @param {*} [defaultValue] - Default value if the setting doesn't exist
 * @returns {Object} - Object containing settings and utility functions
 */
const useAppSettings = (section, key, defaultValue) => {
  // Get needed modules
  const featureFlags = registry.get('config.feature-flags');
  const eventBus = registry.get('utils.EventBus');
  
  // Local state for the setting value
  const [value, setValue] = useState(() => {
    if (section && key) {
      // Get specific setting
      return appSettings[section]?.[key] ?? defaultValue;
    } else if (section) {
      // Get entire section
      return appSettings[section] ?? defaultValue;
    } else {
      // Get all settings
      return appSettings;
    }
  });
  
  // Keep track of updates to avoid unnecessary re-renders
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  
  // Subscribe to settings changes if EventBus is available
  useEffect(() => {
    if (!eventBus) return;
    
    const handleSettingsUpdate = (data) => {
      // Only update if the relevant section changed
      if (!section || data.section === section) {
        if (section && key) {
          // Update specific setting
          setValue(appSettings[section]?.[key] ?? defaultValue);
        } else if (section) {
          // Update entire section
          setValue(appSettings[section] ?? defaultValue);
        } else {
          // Update all settings
          setValue(appSettings);
        }
        
        // Update timestamp to trigger subscribers
        setLastUpdate(Date.now());
      }
    };
    
    // Subscribe to settings updates
    eventBus.subscribe('settings:updated', handleSettingsUpdate);
    
    // Clean up subscription
    return () => {
      eventBus.unsubscribe('settings:updated', handleSettingsUpdate);
    };
  }, [eventBus, section, key, defaultValue]);
  
  /**
   * Get a specific setting by path
   * @param {string} path - Dot-separated path to the setting
   * @param {*} defaultValue - Default value if setting doesn't exist
   * @returns {*} - Setting value or default
   */
  const getSetting = useCallback((path, settingDefaultValue) => {
    if (!path) return appSettings;
    
    const parts = path.split('.');
    let current = appSettings;
    
    for (const part of parts) {
      if (current == null || typeof current !== 'object') {
        return settingDefaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : settingDefaultValue;
  }, []);
  
  /**
   * Check if a feature is enabled
   * @param {string} featureName - Name of the feature to check
   * @param {Object} [options] - Additional options for feature check
   * @returns {boolean} - Whether the feature is enabled
   */
  const isFeatureEnabled = useCallback((featureName, options = {}) => {
    // Use feature flags system if available
    if (featureFlags) {
      return featureFlags.isEnabled(featureName, options);
    }
    
    // Fall back to direct check in settings
    const parts = featureName.split('.');
    
    if (parts.length === 1) {
      // Simple feature check
      return getSetting(`features.${featureName}.enabled`, false);
    } else if (parts.length >= 2) {
      // Nested feature check
      const category = parts[0];
      const feature = parts[1];
      
      // Check if the parent category is enabled first
      const categoryEnabled = getSetting(`features.${category}.enabled`, false);
      if (!categoryEnabled) return false;
      
      // If this is just a category check, return the category enabled state
      if (parts.length === 2 && feature === 'enabled') return categoryEnabled;
      
      // Otherwise check the specific feature
      if (parts.length === 2) {
        return getSetting(`features.${category}.${feature}`, false);
      } else if (parts.length >= 3) {
        const subFeature = parts[2];
        return getSetting(`features.${category}.${feature}.${subFeature}`, false);
      }
    }
    
    // Default to disabled if path is invalid
    return false;
  }, [featureFlags, getSetting]);
  
  /**
   * Get all settings for a visualization property
   * @param {string} property - Visualization property to get settings for
   * @returns {Object} - Visualization settings for the property
   */
  const getVisualizationSettings = useCallback((property) => {
    return getSetting(`visualization.${property}`, {});
  }, [getSetting]);
  
  /**
   * Get the current environment
   * @returns {string} - Current environment ('development', 'test', 'production')
   */
  const getEnvironment = useCallback(() => {
    return getSetting('app.environment', 'development');
  }, [getSetting]);
  
  /**
   * Check if we're in development mode
   * @returns {boolean} - Whether we're in development mode
   */
  const isDevelopment = useMemo(() => {
    return getEnvironment() === 'development';
  }, [getEnvironment]);
  
  /**
   * Check if we're in production mode
   * @returns {boolean} - Whether we're in production mode
   */
  const isProduction = useMemo(() => {
    return getEnvironment() === 'production';
  }, [getEnvironment]);
  
  /**
   * Check if we're in test mode
   * @returns {boolean} - Whether we're in test mode
   */
  const isTest = useMemo(() => {
    return getEnvironment() === 'test';
  }, [getEnvironment]);
  
  // Return the hook API
  return {
    // Main value determined by the parameters
    value,
    
    // Access to all settings
    settings: appSettings,
    
    // Timestamp of last update for cache invalidation
    lastUpdate,
    
    // Utility functions
    getSetting,
    isFeatureEnabled,
    getEnvironment,
    isDevelopment,
    isProduction,
    isTest,
    getVisualizationSettings,
  };
};

// Register the hook with ModuleRegistry
registry.register(
  'hooks.useAppSettings',
  useAppSettings,
  ['config.app-settings', 'config.feature-flags', 'utils.EventBus'],
  {
    description: 'React hook for accessing application settings',
    provides: ['settingsAccess', 'featureFlags', 'environmentDetection']
  }
);

export default useAppSettings; 