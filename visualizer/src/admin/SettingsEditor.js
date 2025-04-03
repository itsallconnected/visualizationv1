import React, { useState, useEffect, useMemo } from 'react';
import registry from '../ModuleRegistry';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * SettingsEditor Component
 * 
 * A comprehensive administration interface for modifying application settings.
 * This component provides the ability to view, edit, import, and export application
 * settings across various categories. It includes permission checks, validation,
 * and history tracking for setting changes.
 */
const SettingsEditor = () => {
  // Get required modules
  const appSettings = registry.get('config.app-settings');
  const authService = registry.get('auth.AuthService');
  const permissionManager = registry.get('auth.PermissionManager');
  const storageManager = registry.get('utils.StorageManager');
  const validationHelper = registry.get('utils.ValidationHelpers');
  const eventBus = registry.get('utils.EventBus');
  
  // State
  const [settings, setSettings] = useState({});
  const [originalSettings, setOriginalSettings] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('visualization');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState({});
  const [changeHistory, setChangeHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  
  // User role and permissions
  const user = authService?.getCurrentUser();
  
  // Check if user has permission to edit settings
  useEffect(() => {
    const checkPermission = async () => {
      if (!permissionManager) {
        setHasPermission(false);
        return;
      }
      
      const hasEditPermission = await permissionManager.hasPermission('admin:systemSettings');
      setHasPermission(hasEditPermission);
    };
    
    checkPermission();
  }, [permissionManager, user]);
  
  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      
      try {
        // Clone settings to avoid direct reference
        const settingsData = appSettings ? JSON.parse(JSON.stringify(appSettings)) : {};
        
        // Store settings in state
        setSettings(settingsData);
        setOriginalSettings(settingsData);
        
        // Load change history if available
        if (storageManager) {
          const history = await storageManager.getItem('admin.settingsChangeHistory') || [];
          setChangeHistory(history);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setErrors({ global: 'Failed to load settings. Please try again.' });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, [appSettings, storageManager]);
  
  // Detect changes
  useEffect(() => {
    if (!originalSettings || Object.keys(originalSettings).length === 0) {
      setHasChanges(false);
      return;
    }
    
    // Deep comparison to detect changes
    const hasUpdates = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(hasUpdates);
  }, [settings, originalSettings]);
  
  // Get categories from settings
  const categories = useMemo(() => {
    if (!settings) return [];
    return Object.keys(settings).filter(key => 
      typeof settings[key] === 'object' && 
      !Array.isArray(settings[key])
    );
  }, [settings]);
  
  // Filter settings based on search term
  const filteredSettings = useMemo(() => {
    if (!searchTerm.trim() || !settings) {
      return settings;
    }
    
    const searchFilter = (obj, path = '') => {
      const result = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check if key or value matches search term
        const keyMatches = key.toLowerCase().includes(searchTerm.toLowerCase());
        const valueMatches = typeof value === 'string' && 
                            value.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (keyMatches || valueMatches) {
          result[key] = value;
        } else if (typeof value === 'object' && value !== null) {
          // Recursively search nested objects
          const nestedResult = searchFilter(value, currentPath);
          if (Object.keys(nestedResult).length > 0) {
            result[key] = nestedResult;
          }
        }
      }
      
      return result;
    };
    
    return searchFilter(settings);
  }, [settings, searchTerm]);
  
  /**
   * Handle setting value change
   * 
   * @param {string} category - Setting category
   * @param {string} key - Setting key
   * @param {any} value - New setting value
   * @param {string} path - Full path to the setting
   */
  const handleSettingChange = (category, key, value, path = '') => {
    // Update setting
    setSettings(prevSettings => {
      const newSettings = { ...prevSettings };
      
      if (!path) {
        // Direct category setting
        if (!newSettings[category]) {
          newSettings[category] = {};
        }
        newSettings[category][key] = value;
      } else {
        // Nested setting - use path to update
        const pathParts = path.split('.');
        let current = newSettings;
        
        // Navigate to the correct nesting level
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        
        // Set the value
        current[pathParts[pathParts.length - 1]] = value;
      }
      
      return newSettings;
    });
    
    // Validate the setting
    validateSetting(category, key, value, path);
  };
  
  /**
   * Validate a setting value
   * 
   * @param {string} category - Setting category
   * @param {string} key - Setting key
   * @param {any} value - Setting value to validate
   * @param {string} path - Full path to the setting
   */
  const validateSetting = (category, key, value, path) => {
    if (!validationHelper) return;
    
    const fullPath = path || `${category}.${key}`;
    let error = null;
    
    try {
      // Type-specific validation
      if (typeof value === 'boolean') {
        // No validation needed for booleans
      } else if (typeof value === 'number') {
        if (isNaN(value)) {
          error = 'Must be a valid number';
        }
      } else if (typeof value === 'string') {
        if (key.includes('url') && value && !validationHelper.isValidUrl(value)) {
          error = 'Must be a valid URL';
        }
      }
      
      // Update errors state
      setErrors(prev => ({
        ...prev,
        [fullPath]: error
      }));
      
    } catch (validationError) {
      console.error('Validation error:', validationError);
      setErrors(prev => ({
        ...prev,
        [fullPath]: 'Validation error'
      }));
    }
  };
  
  /**
   * Save changes to settings
   */
  const handleSave = async () => {
    if (!hasPermission) {
      setErrors({ global: 'You do not have permission to save settings' });
      return;
    }
    
    if (!hasChanges) return;
    
    setIsSaving(true);
    
    try {
      // Record changes for history
      const changes = getChanges(originalSettings, settings);
      
      // Add to change history
      const historyEntry = {
        timestamp: new Date().toISOString(),
        userId: user?.id || 'unknown',
        username: user?.displayName || user?.username || 'Unknown User',
        changes
      };
      
      const updatedHistory = [historyEntry, ...changeHistory].slice(0, 50);
      setChangeHistory(updatedHistory);
      
      // Save to storage if available
      if (storageManager) {
        await storageManager.setItem('admin.settingsChangeHistory', updatedHistory);
      }
      
      // Notify success
      if (eventBus) {
        eventBus.publish('settings:updated', {
          changes,
          user: user?.id || 'unknown'
        });
      }
      
      // Update original settings to reflect saved state
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      
      setErrors({});
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors({ global: 'Failed to save settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };
  
  /**
   * Get changes between two settings objects
   * 
   * @param {Object} original - Original settings
   * @param {Object} updated - Updated settings
   * @returns {Array<Object>} Array of change objects
   */
  const getChanges = (original, updated, path = '') => {
    const changes = [];
    
    // Compare all keys in updated settings
    Object.keys(updated).forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof updated[key] === 'object' && 
          updated[key] !== null && 
          !Array.isArray(updated[key]) && 
          typeof original[key] === 'object' && 
          original[key] !== null) {
        // Recursively check nested objects
        const nestedChanges = getChanges(original[key], updated[key], currentPath);
        changes.push(...nestedChanges);
      } else if (JSON.stringify(updated[key]) !== JSON.stringify(original[key])) {
        // Value has changed
        changes.push({
          path: currentPath,
          oldValue: original[key],
          newValue: updated[key]
        });
      }
    });
    
    return changes;
  };
  
  /**
   * Reset changes back to original settings
   */
  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(originalSettings)));
    setErrors({});
  };
  
  /**
   * Handle exporting settings to a file
   */
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(settings, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
      
      const exportFileDefaultName = `ai-alignment-visualization-settings-${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Failed to export settings:', error);
      setErrors({ global: 'Failed to export settings. Please try again.' });
    }
  };
  
  /**
   * Handle importing settings from a file
   */
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target.result);
        setSettings(importedSettings);
        
        // Clear input
        event.target.value = null;
      } catch (error) {
        console.error('Failed to import settings:', error);
        setErrors({ global: 'Failed to import settings. The file format is invalid.' });
      }
    };
    reader.readAsText(file);
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="settings-editor-loading">
        <h2>Loading Settings...</h2>
      </div>
    );
  }
  
  // Render permission denied
  if (!hasPermission) {
    return (
      <div className="settings-editor-permission-denied">
        <h2>Access Denied</h2>
        <p>You do not have permission to view or edit application settings.</p>
        <p>Please contact an administrator if you believe you should have access.</p>
      </div>
    );
  }
  
  return (
    <ErrorBoundary componentName="SettingsEditor">
      <div className="settings-editor">
        <div className="settings-editor-header">
          <h1>Application Settings</h1>
          
          <div className="settings-editor-search">
            <input
              type="text"
              placeholder="Search settings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="settings-editor-actions">
            <button 
              onClick={handleReset} 
              disabled={!hasChanges || isSaving}
              className="reset-button"
            >
              Reset Changes
            </button>
            
            <button 
              onClick={handleSave} 
              disabled={!hasChanges || isSaving || Object.values(errors).some(e => e)}
              className="save-button"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            
            <button 
              onClick={handleExport}
              className="export-button"
            >
              Export Settings
            </button>
            
            <label className="import-button">
              Import Settings
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        
        {errors.global && (
          <div className="settings-editor-error">
            {errors.global}
          </div>
        )}
        
        <div className="settings-editor-content">
          <div className="settings-editor-sidebar">
            {categories.map(category => (
              <div 
                key={category}
                className={`settings-category ${selectedCategory === category ? 'selected' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </div>
            ))}
          </div>
          
          <div className="settings-editor-main">
            {selectedCategory && settings[selectedCategory] && (
              <div className="settings-category-content">
                <h2>{selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}</h2>
                
                <div className="settings-items">
                  {renderSettingsGroup(settings[selectedCategory], selectedCategory)}
                </div>
              </div>
            )}
            
            {searchTerm && (
              <div className="settings-search-results">
                <h2>Search Results for "{searchTerm}"</h2>
                
                {Object.keys(filteredSettings).length === 0 ? (
                  <p>No settings found matching your search.</p>
                ) : (
                  Object.keys(filteredSettings).map(category => (
                    <div key={category} className="search-result-category">
                      <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                      {renderSettingsGroup(filteredSettings[category], category)}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        
        {changeHistory.length > 0 && (
          <div className="settings-history">
            <h2>Change History</h2>
            
            <div className="history-items">
              {changeHistory.map((entry, index) => (
                <div key={index} className="history-item">
                  <div className="history-item-header">
                    <span className="history-time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    <span className="history-user">
                      {entry.username}
                    </span>
                  </div>
                  
                  <div className="history-changes">
                    {entry.changes.map((change, changeIndex) => (
                      <div key={changeIndex} className="change-item">
                        <span className="change-path">{change.path}</span>
                        <div className="change-values">
                          <span className="old-value">
                            {renderValue(change.oldValue)}
                          </span>
                          <span className="arrow">→</span>
                          <span className="new-value">
                            {renderValue(change.newValue)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
  
  /**
   * Render a settings group recursively
   * 
   * @param {Object} group - Settings group to render
   * @param {string} category - Category name
   * @param {string} path - Current path for nested settings
   * @returns {JSX.Element} Rendered settings group
   */
  function renderSettingsGroup(group, category, path = '') {
    if (!group) return null;
    
    return Object.entries(group).map(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      const fullPath = path ? `${category}.${path}.${key}` : `${category}.${key}`;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Render nested group
        return (
          <div key={key} className="settings-group">
            <h3>{key.charAt(0).toUpperCase() + key.slice(1)}</h3>
            <div className="nested-settings">
              {renderSettingsGroup(value, category, currentPath)}
            </div>
          </div>
        );
      } else {
        // Render individual setting
        return (
          <div key={key} className="settings-item">
            <div className="setting-header">
              <label htmlFor={fullPath}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              {errors[fullPath] && (
                <div className="setting-error">{errors[fullPath]}</div>
              )}
            </div>
            
            <div className="setting-input">
              {renderSettingInput(key, value, category, currentPath, fullPath)}
            </div>
          </div>
        );
      }
    });
  }
  
  /**
   * Render appropriate input for a setting based on its type
   * 
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @param {string} category - Category name
   * @param {string} path - Current path for nested settings
   * @param {string} fullPath - Full path including category
   * @returns {JSX.Element} Rendered input element
   */
  function renderSettingInput(key, value, category, path, fullPath) {
    if (typeof value === 'boolean') {
      // Boolean toggle
      return (
        <input
          id={fullPath}
          type="checkbox"
          checked={value}
          onChange={(e) => handleSettingChange(category, key, e.target.checked, path)}
        />
      );
    } else if (typeof value === 'number') {
      // Number input
      return (
        <input
          id={fullPath}
          type="number"
          value={value}
          onChange={(e) => handleSettingChange(
            category, 
            key, 
            parseFloat(e.target.value) || 0,
            path
          )}
        />
      );
    } else if (typeof value === 'string') {
      // Check if it's a color value
      if (key.includes('color') && value.startsWith('#')) {
        // Color picker
        return (
          <div className="color-input-container">
            <input
              id={fullPath}
              type="color"
              value={value}
              onChange={(e) => handleSettingChange(category, key, e.target.value, path)}
            />
            <input
              type="text"
              value={value}
              onChange={(e) => handleSettingChange(category, key, e.target.value, path)}
              placeholder="#RRGGBB"
            />
          </div>
        );
      } else {
        // Regular text input
        return (
          <input
            id={fullPath}
            type="text"
            value={value}
            onChange={(e) => handleSettingChange(category, key, e.target.value, path)}
          />
        );
      }
    } else if (Array.isArray(value)) {
      // Array input
      return (
        <textarea
          id={fullPath}
          value={value.join(',')}
          onChange={(e) => handleSettingChange(
            category,
            key,
            e.target.value.split(',').map(item => item.trim()),
            path
          )}
          placeholder="Comma-separated values"
        />
      );
    } else {
      // Fallback for other types
      return (
        <div className="uneditable-value">
          {renderValue(value)}
        </div>
      );
    }
  }
  
  /**
   * Render a value for display
   * 
   * @param {any} value - Value to render
   * @returns {string} String representation of the value
   */
  function renderValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    } else if (typeof value === 'object') {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  }
};

export default registry.register(
  'admin.SettingsEditor',
  SettingsEditor,
  [
    'config.app-settings',
    'auth.AuthService',
    'auth.PermissionManager',
    'utils.ValidationHelpers',
    'utils.StorageManager',
    'utils.EventBus',
    'components.ErrorBoundary'
  ],
  {
    description: 'Administration interface for viewing and modifying application settings',
    usage: 'Used in the admin panel for system configuration'
  }
); 