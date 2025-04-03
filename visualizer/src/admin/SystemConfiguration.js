// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';
import SettingsEditor from './SettingsEditor';

/**
 * System Configuration component for managing application settings
 * Allows administrators to configure global parameters and feature toggles
 */
const SystemConfiguration = ({ onBack }) => {
  // Configuration categories
  const configCategories = [
    { id: 'general', label: 'General Settings' },
    { id: 'security', label: 'Security & Privacy' },
    { id: 'visualization', label: 'Visualization' },
    { id: 'moderation', label: 'Content Moderation' },
    { id: 'api', label: 'API & Integrations' },
    { id: 'backup', label: 'Backup & Recovery' }
  ];

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [config, setConfig] = useState({
    general: {
      appName: 'AI Alignment Visualization Tool',
      appDescription: 'Interactive visualization of AI alignment components and relationships',
      defaultLanguage: 'en',
      pageSize: 20,
      dateFormat: 'YYYY-MM-DD',
      timeZone: 'UTC'
    },
    security: {
      sessionTimeout: 30,
      passwordMinLength: 8,
      requirePasswordComplexity: true,
      mfaEnabled: false,
      encryptionEnabled: true,
      defaultEncryptionLevel: 'medium',
      autoLockTimeout: 15
    },
    visualization: {
      defaultNodeSize: 1.0,
      defaultFontSize: 1.0,
      animationSpeed: 0.8,
      showLabels: true,
      labelDistance: 1.5,
      defaultColorScheme: 'standard',
      enablePhysics: true,
      performanceMode: 'balanced'
    },
    moderation: {
      enableContentModeration: true,
      requireApprovalForNewContent: true,
      requireApprovalForContentEdits: true,
      notifyAdminsOnContentSubmission: true,
      moderationThreshold: 0.7,
      contentExpiryDays: 90
    },
    api: {
      enablePublicApi: false,
      apiRateLimit: 100,
      apiRequestTimeout: 30,
      webhooksEnabled: false,
      allowExternalIntegrations: false,
      enableExport: true,
      enableImport: true
    },
    backup: {
      autoBackupEnabled: true,
      backupFrequency: 'daily',
      backupTime: '03:00',
      backupRetentionDays: 30,
      includeUserAccounts: true,
      includeContentHistory: true,
      compressionLevel: 'medium'
    }
  });
  const [originalConfig, setOriginalConfig] = useState({});

  // Validation state
  const [validationErrors, setValidationErrors] = useState({});

  // Load configuration on component mount
  useEffect(() => {
    const loadConfiguration = async () => {
      setIsLoading(true);
      try {
        // In a real app, this would fetch from an API
        // const response = await adminApi.getSystemConfiguration();
        // const loadedConfig = response.data;

        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Use the default config for now
        const loadedConfig = { ...config };
        
        setConfig(loadedConfig);
        setOriginalConfig(JSON.parse(JSON.stringify(loadedConfig)));
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading system configuration:', error);
        EventBus.publish('notification:show', {
          type: 'error',
          message: 'Failed to load system configuration'
        });
        setIsLoading(false);
      }
    };

    loadConfiguration();
  }, []);

  /**
   * Check if configuration has unsaved changes
   * @returns {boolean} - True if there are unsaved changes
   */
  const checkForChanges = () => {
    return JSON.stringify(config) !== JSON.stringify(originalConfig);
  };

  /**
   * Handle input change for text and number fields
   * @param {string} category - Configuration category
   * @param {string} key - Configuration key
   * @param {Event} e - Change event
   */
  const handleInputChange = (category, key, e) => {
    const { value, type } = e.target;
    
    // Convert to appropriate type
    let parsedValue = value;
    if (type === 'number') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) {
        parsedValue = 0;
      }
    }
    
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: parsedValue
      }
    }));
    
    // Clear validation error for this field if it exists
    if (validationErrors[`${category}.${key}`]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${category}.${key}`];
        return newErrors;
      });
    }
    
    setHasChanges(true);
  };

  /**
   * Handle toggle/checkbox change
   * @param {string} category - Configuration category
   * @param {string} key - Configuration key
   * @param {boolean} checked - New checked state
   */
  const handleToggleChange = (category, key, checked) => {
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: checked
      }
    }));
    
    setHasChanges(true);
  };

  /**
   * Handle select change
   * @param {string} category - Configuration category
   * @param {string} key - Configuration key
   * @param {Event} e - Change event
   */
  const handleSelectChange = (category, key, e) => {
    const { value } = e.target;
    
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
    
    setHasChanges(true);
  };

  /**
   * Validate configuration before saving
   * @returns {boolean} - True if configuration is valid
   */
  const validateConfiguration = () => {
    const errors = {};
    
    // General settings validation
    if (!config.general.appName) {
      errors['general.appName'] = 'Application name is required';
    }
    
    if (config.general.pageSize < 1 || config.general.pageSize > 100) {
      errors['general.pageSize'] = 'Page size must be between 1 and 100';
    }
    
    // Security settings validation
    if (config.security.sessionTimeout < 5 || config.security.sessionTimeout > 1440) {
      errors['security.sessionTimeout'] = 'Session timeout must be between 5 and 1440 minutes';
    }
    
    if (config.security.passwordMinLength < 6 || config.security.passwordMinLength > 32) {
      errors['security.passwordMinLength'] = 'Password minimum length must be between 6 and 32 characters';
    }

    if (config.security.autoLockTimeout < 1 || config.security.autoLockTimeout > 120) {
      errors['security.autoLockTimeout'] = 'Auto-lock timeout must be between 1 and 120 minutes';
    }
    
    // Visualization settings validation
    if (config.visualization.defaultNodeSize < 0.1 || config.visualization.defaultNodeSize > 3.0) {
      errors['visualization.defaultNodeSize'] = 'Node size must be between 0.1 and 3.0';
    }
    
    if (config.visualization.defaultFontSize < 0.1 || config.visualization.defaultFontSize > 3.0) {
      errors['visualization.defaultFontSize'] = 'Font size must be between 0.1 and 3.0';
    }
    
    if (config.visualization.animationSpeed < 0.1 || config.visualization.animationSpeed > 2.0) {
      errors['visualization.animationSpeed'] = 'Animation speed must be between 0.1 and 2.0';
    }
    
    // Moderation settings validation
    if (config.moderation.moderationThreshold < 0 || config.moderation.moderationThreshold > 1) {
      errors['moderation.moderationThreshold'] = 'Moderation threshold must be between 0 and 1';
    }
    
    if (config.moderation.contentExpiryDays < 1 || config.moderation.contentExpiryDays > 365) {
      errors['moderation.contentExpiryDays'] = 'Content expiry must be between 1 and 365 days';
    }
    
    // API settings validation
    if (config.api.apiRateLimit < 1 || config.api.apiRateLimit > 10000) {
      errors['api.apiRateLimit'] = 'API rate limit must be between 1 and 10000 requests per hour';
    }
    
    if (config.api.apiRequestTimeout < 1 || config.api.apiRequestTimeout > 120) {
      errors['api.apiRequestTimeout'] = 'API request timeout must be between 1 and 120 seconds';
    }
    
    // Backup settings validation
    if (config.backup.backupRetentionDays < 1 || config.backup.backupRetentionDays > 365) {
      errors['backup.backupRetentionDays'] = 'Backup retention must be between 1 and 365 days';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle save configuration
   */
  const handleSave = async () => {
    if (!validateConfiguration()) {
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Please fix the validation errors before saving'
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // In a real app, this would call an API
      // await adminApi.updateSystemConfiguration(config);
      
      // Mock API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update original config to reflect saved state
      setOriginalConfig(JSON.parse(JSON.stringify(config)));
      setHasChanges(false);
      
      // Publish event to notify other components of configuration changes
      EventBus.publish('system:configUpdated', config);
      
      // Show success message
      EventBus.publish('notification:show', {
        type: 'success',
        message: 'System configuration saved successfully'
      });
      
      // Log the activity
      EventBus.publish('activity:log', {
        type: 'system:config:update',
        details: 'System configuration updated'
      });
    } catch (error) {
      console.error('Error saving system configuration:', error);
      EventBus.publish('notification:show', {
        type: 'error',
        message: 'Failed to save system configuration'
      });
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle reset to defaults
   */
  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      // In a real app, this would call an API to get default settings
      // For now, just use our initial state
      setConfig({
        general: {
          appName: 'AI Alignment Visualization Tool',
          appDescription: 'Interactive visualization of AI alignment components and relationships',
          defaultLanguage: 'en',
          pageSize: 20,
          dateFormat: 'YYYY-MM-DD',
          timeZone: 'UTC'
        },
        security: {
          sessionTimeout: 30,
          passwordMinLength: 8,
          requirePasswordComplexity: true,
          mfaEnabled: false,
          encryptionEnabled: true,
          defaultEncryptionLevel: 'medium',
          autoLockTimeout: 15
        },
        visualization: {
          defaultNodeSize: 1.0,
          defaultFontSize: 1.0,
          animationSpeed: 0.8,
          showLabels: true,
          labelDistance: 1.5,
          defaultColorScheme: 'standard',
          enablePhysics: true,
          performanceMode: 'balanced'
        },
        moderation: {
          enableContentModeration: true,
          requireApprovalForNewContent: true,
          requireApprovalForContentEdits: true,
          notifyAdminsOnContentSubmission: true,
          moderationThreshold: 0.7,
          contentExpiryDays: 90
        },
        api: {
          enablePublicApi: false,
          apiRateLimit: 100,
          apiRequestTimeout: 30,
          webhooksEnabled: false,
          allowExternalIntegrations: false,
          enableExport: true,
          enableImport: true
        },
        backup: {
          autoBackupEnabled: true,
          backupFrequency: 'daily',
          backupTime: '03:00',
          backupRetentionDays: 30,
          includeUserAccounts: true,
          includeContentHistory: true,
          compressionLevel: 'medium'
        }
      });
      
      setHasChanges(true);
      setValidationErrors({});
      
      EventBus.publish('notification:show', {
        type: 'info',
        message: 'Settings reset to defaults. Click Save to apply changes.'
      });
    }
  };

  /**
   * Handle cancel/discard changes
   */
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        setConfig(JSON.parse(JSON.stringify(originalConfig)));
        setHasChanges(false);
        setValidationErrors({});
      }
    }
  };

  /**
   * Render the configuration form for a category
   * @param {string} category - Category ID
   * @returns {JSX.Element} - Form element
   */
  const renderCategoryForm = (category) => {
    const categoryConfig = config[category] || {};
    
    switch (category) {
      case 'general':
        return (
          <div className="config-form">
            <div className={`form-group ${validationErrors['general.appName'] ? 'has-error' : ''}`}>
              <label htmlFor="appName">Application Name</label>
              <input
                id="appName"
                type="text"
                value={categoryConfig.appName || ''}
                onChange={(e) => handleInputChange('general', 'appName', e)}
              />
              {validationErrors['general.appName'] && (
                <div className="error-message">{validationErrors['general.appName']}</div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="appDescription">Application Description</label>
              <textarea
                id="appDescription"
                value={categoryConfig.appDescription || ''}
                onChange={(e) => handleInputChange('general', 'appDescription', e)}
                rows={3}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="defaultLanguage">Default Language</label>
              <select
                id="defaultLanguage"
                value={categoryConfig.defaultLanguage || 'en'}
                onChange={(e) => handleSelectChange('general', 'defaultLanguage', e)}
              >
                <option value="en">English</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            
            <div className={`form-group ${validationErrors['general.pageSize'] ? 'has-error' : ''}`}>
              <label htmlFor="pageSize">Default Page Size</label>
              <input
                id="pageSize"
                type="number"
                min="1"
                max="100"
                value={categoryConfig.pageSize || 20}
                onChange={(e) => handleInputChange('general', 'pageSize', e)}
              />
              {validationErrors['general.pageSize'] && (
                <div className="error-message">{validationErrors['general.pageSize']}</div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="dateFormat">Date Format</label>
              <select
                id="dateFormat"
                value={categoryConfig.dateFormat || 'YYYY-MM-DD'}
                onChange={(e) => handleSelectChange('general', 'dateFormat', e)}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MMM D, YYYY">MMM D, YYYY</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="timeZone">Time Zone</label>
              <select
                id="timeZone"
                value={categoryConfig.timeZone || 'UTC'}
                onChange={(e) => handleSelectChange('general', 'timeZone', e)}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Berlin">Central European Time (CET)</option>
                <option value="Asia/Tokyo">Japan (JST)</option>
              </select>
            </div>
          </div>
        );
        
      case 'security':
        return (
          <div className="config-form">
            <div className={`form-group ${validationErrors['security.sessionTimeout'] ? 'has-error' : ''}`}>
              <label htmlFor="sessionTimeout">Session Timeout (minutes)</label>
              <input
                id="sessionTimeout"
                type="number"
                min="5"
                max="1440"
                value={categoryConfig.sessionTimeout || 30}
                onChange={(e) => handleInputChange('security', 'sessionTimeout', e)}
              />
              {validationErrors['security.sessionTimeout'] && (
                <div className="error-message">{validationErrors['security.sessionTimeout']}</div>
              )}
            </div>
            
            <div className={`form-group ${validationErrors['security.passwordMinLength'] ? 'has-error' : ''}`}>
              <label htmlFor="passwordMinLength">Minimum Password Length</label>
              <input
                id="passwordMinLength"
                type="number"
                min="6"
                max="32"
                value={categoryConfig.passwordMinLength || 8}
                onChange={(e) => handleInputChange('security', 'passwordMinLength', e)}
              />
              {validationErrors['security.passwordMinLength'] && (
                <div className="error-message">{validationErrors['security.passwordMinLength']}</div>
              )}
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.requirePasswordComplexity || false}
                  onChange={(e) => handleToggleChange('security', 'requirePasswordComplexity', e.target.checked)}
                />
                Require Password Complexity
              </label>
              <div className="help-text">
                Passwords must include uppercase, lowercase, number, and special character
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.mfaEnabled || false}
                  onChange={(e) => handleToggleChange('security', 'mfaEnabled', e.target.checked)}
                />
                Enable Multi-Factor Authentication
              </label>
              <div className="help-text">
                Users will be required to set up MFA during account registration
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.encryptionEnabled || false}
                  onChange={(e) => handleToggleChange('security', 'encryptionEnabled', e.target.checked)}
                />
                Enable Content Encryption
              </label>
            </div>
            
            <div className="form-group">
              <label htmlFor="defaultEncryptionLevel">Default Encryption Level</label>
              <select
                id="defaultEncryptionLevel"
                value={categoryConfig.defaultEncryptionLevel || 'medium'}
                onChange={(e) => handleSelectChange('security', 'defaultEncryptionLevel', e)}
                disabled={!categoryConfig.encryptionEnabled}
              >
                <option value="low">Low (Fast, Less Secure)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Slow, Most Secure)</option>
              </select>
            </div>
            
            <div className={`form-group ${validationErrors['security.autoLockTimeout'] ? 'has-error' : ''}`}>
              <label htmlFor="autoLockTimeout">Auto-Lock Timeout (minutes)</label>
              <input
                id="autoLockTimeout"
                type="number"
                min="1"
                max="120"
                value={categoryConfig.autoLockTimeout || 15}
                onChange={(e) => handleInputChange('security', 'autoLockTimeout', e)}
              />
              {validationErrors['security.autoLockTimeout'] && (
                <div className="error-message">{validationErrors['security.autoLockTimeout']}</div>
              )}
              <div className="help-text">
                Time of inactivity before encrypted nodes are automatically locked
              </div>
            </div>
          </div>
        );
        
      case 'visualization':
        return (
          <div className="config-form">
            <div className={`form-group ${validationErrors['visualization.defaultNodeSize'] ? 'has-error' : ''}`}>
              <label htmlFor="defaultNodeSize">Default Node Size</label>
              <input
                id="defaultNodeSize"
                type="number"
                min="0.1"
                max="3.0"
                step="0.1"
                value={categoryConfig.defaultNodeSize || 1.0}
                onChange={(e) => handleInputChange('visualization', 'defaultNodeSize', e)}
              />
              {validationErrors['visualization.defaultNodeSize'] && (
                <div className="error-message">{validationErrors['visualization.defaultNodeSize']}</div>
              )}
            </div>
            
            <div className={`form-group ${validationErrors['visualization.defaultFontSize'] ? 'has-error' : ''}`}>
              <label htmlFor="defaultFontSize">Default Font Size</label>
              <input
                id="defaultFontSize"
                type="number"
                min="0.1"
                max="3.0"
                step="0.1"
                value={categoryConfig.defaultFontSize || 1.0}
                onChange={(e) => handleInputChange('visualization', 'defaultFontSize', e)}
              />
              {validationErrors['visualization.defaultFontSize'] && (
                <div className="error-message">{validationErrors['visualization.defaultFontSize']}</div>
              )}
            </div>
            
            <div className={`form-group ${validationErrors['visualization.animationSpeed'] ? 'has-error' : ''}`}>
              <label htmlFor="animationSpeed">Animation Speed</label>
              <input
                id="animationSpeed"
                type="number"
                min="0.1"
                max="2.0"
                step="0.1"
                value={categoryConfig.animationSpeed || 0.8}
                onChange={(e) => handleInputChange('visualization', 'animationSpeed', e)}
              />
              {validationErrors['visualization.animationSpeed'] && (
                <div className="error-message">{validationErrors['visualization.animationSpeed']}</div>
              )}
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.showLabels || false}
                  onChange={(e) => handleToggleChange('visualization', 'showLabels', e.target.checked)}
                />
                Show Node Labels by Default
              </label>
            </div>
            
            <div className="form-group">
              <label htmlFor="labelDistance">Label Distance</label>
              <input
                id="labelDistance"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={categoryConfig.labelDistance || 1.5}
                onChange={(e) => handleInputChange('visualization', 'labelDistance', e)}
                disabled={!categoryConfig.showLabels}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="defaultColorScheme">Default Color Scheme</label>
              <select
                id="defaultColorScheme"
                value={categoryConfig.defaultColorScheme || 'standard'}
                onChange={(e) => handleSelectChange('visualization', 'defaultColorScheme', e)}
              >
                <option value="standard">Standard</option>
                <option value="pastel">Pastel</option>
                <option value="vibrant">Vibrant</option>
                <option value="monochrome">Monochrome</option>
                <option value="colorblind">Colorblind Friendly</option>
              </select>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.enablePhysics || false}
                  onChange={(e) => handleToggleChange('visualization', 'enablePhysics', e.target.checked)}
                />
                Enable Physics Simulation
              </label>
              <div className="help-text">
                Nodes will move dynamically based on forces between them
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="performanceMode">Performance Mode</label>
              <select
                id="performanceMode"
                value={categoryConfig.performanceMode || 'balanced'}
                onChange={(e) => handleSelectChange('visualization', 'performanceMode', e)}
              >
                <option value="quality">Quality (High GPU/CPU usage)</option>
                <option value="balanced">Balanced</option>
                <option value="performance">Performance (Lower quality, faster)</option>
              </select>
            </div>
          </div>
        );
        
      case 'moderation':
        return (
          <div className="config-form">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.enableContentModeration || false}
                  onChange={(e) => handleToggleChange('moderation', 'enableContentModeration', e.target.checked)}
                />
                Enable Content Moderation
              </label>
              <div className="help-text">
                Content changes will require approval before publishing
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.requireApprovalForNewContent || false}
                  onChange={(e) => handleToggleChange('moderation', 'requireApprovalForNewContent', e.target.checked)}
                  disabled={!categoryConfig.enableContentModeration}
                />
                Require Approval for New Content
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.requireApprovalForContentEdits || false}
                  onChange={(e) => handleToggleChange('moderation', 'requireApprovalForContentEdits', e.target.checked)}
                  disabled={!categoryConfig.enableContentModeration}
                />
                Require Approval for Content Edits
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.notifyAdminsOnContentSubmission || false}
                  onChange={(e) => handleToggleChange('moderation', 'notifyAdminsOnContentSubmission', e.target.checked)}
                  disabled={!categoryConfig.enableContentModeration}
                />
                Notify Administrators on Content Submission
              </label>
            </div>
            
            <div className={`form-group ${validationErrors['moderation.moderationThreshold'] ? 'has-error' : ''}`}>
              <label htmlFor="moderationThreshold">Moderation Threshold</label>
              <input
                id="moderationThreshold"
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={categoryConfig.moderationThreshold || 0.7}
                onChange={(e) => handleInputChange('moderation', 'moderationThreshold', e)}
                disabled={!categoryConfig.enableContentModeration}
              />
              {validationErrors['moderation.moderationThreshold'] && (
                <div className="error-message">{validationErrors['moderation.moderationThreshold']}</div>
              )}
              <div className="help-text">
                Confidence threshold for automatic content approval (0-1)
              </div>
            </div>
            
            <div className={`form-group ${validationErrors['moderation.contentExpiryDays'] ? 'has-error' : ''}`}>
              <label htmlFor="contentExpiryDays">Content Expiry (days)</label>
              <input
                id="contentExpiryDays"
                type="number"
                min="1"
                max="365"
                value={categoryConfig.contentExpiryDays || 90}
                onChange={(e) => handleInputChange('moderation', 'contentExpiryDays', e)}
              />
              {validationErrors['moderation.contentExpiryDays'] && (
                <div className="error-message">{validationErrors['moderation.contentExpiryDays']}</div>
              )}
              <div className="help-text">
                Days after which unmoderated content is automatically deleted
              </div>
            </div>
          </div>
        );
        
      case 'api':
        return (
          <div className="config-form">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.enablePublicApi || false}
                  onChange={(e) => handleToggleChange('api', 'enablePublicApi', e.target.checked)}
                />
                Enable Public API
              </label>
              <div className="help-text">
                Allow external applications to access data via API
              </div>
            </div>
            
            <div className={`form-group ${validationErrors['api.apiRateLimit'] ? 'has-error' : ''}`}>
              <label htmlFor="apiRateLimit">API Rate Limit (requests per hour)</label>
              <input
                id="apiRateLimit"
                type="number"
                min="1"
                max="10000"
                value={categoryConfig.apiRateLimit || 100}
                onChange={(e) => handleInputChange('api', 'apiRateLimit', e)}
                disabled={!categoryConfig.enablePublicApi}
              />
              {validationErrors['api.apiRateLimit'] && (
                <div className="error-message">{validationErrors['api.apiRateLimit']}</div>
              )}
            </div>
            
            <div className={`form-group ${validationErrors['api.apiRequestTimeout'] ? 'has-error' : ''}`}>
              <label htmlFor="apiRequestTimeout">API Request Timeout (seconds)</label>
              <input
                id="apiRequestTimeout"
                type="number"
                min="1"
                max="120"
                value={categoryConfig.apiRequestTimeout || 30}
                onChange={(e) => handleInputChange('api', 'apiRequestTimeout', e)}
                disabled={!categoryConfig.enablePublicApi}
              />
              {validationErrors['api.apiRequestTimeout'] && (
                <div className="error-message">{validationErrors['api.apiRequestTimeout']}</div>
              )}
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.webhooksEnabled || false}
                  onChange={(e) => handleToggleChange('api', 'webhooksEnabled', e.target.checked)}
                />
                Enable Webhooks
              </label>
              <div className="help-text">
                Allow system events to trigger external webhooks
              </div>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.allowExternalIntegrations || false}
                  onChange={(e) => handleToggleChange('api', 'allowExternalIntegrations', e.target.checked)}
                />
                Allow External Integrations
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.enableExport || false}
                  onChange={(e) => handleToggleChange('api', 'enableExport', e.target.checked)}
                />
                Enable Data Export
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.enableImport || false}
                  onChange={(e) => handleToggleChange('api', 'enableImport', e.target.checked)}
                />
                Enable Data Import
              </label>
            </div>
          </div>
        );
        
      case 'backup':
        return (
          <div className="config-form">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.autoBackupEnabled || false}
                  onChange={(e) => handleToggleChange('backup', 'autoBackupEnabled', e.target.checked)}
                />
                Enable Automatic Backups
              </label>
            </div>
            
            <div className="form-group">
              <label htmlFor="backupFrequency">Backup Frequency</label>
              <select
                id="backupFrequency"
                value={categoryConfig.backupFrequency || 'daily'}
                onChange={(e) => handleSelectChange('backup', 'backupFrequency', e)}
                disabled={!categoryConfig.autoBackupEnabled}
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="backupTime">Backup Time</label>
              <input
                id="backupTime"
                type="time"
                value={categoryConfig.backupTime || '03:00'}
                onChange={(e) => handleInputChange('backup', 'backupTime', e)}
                disabled={!categoryConfig.autoBackupEnabled || categoryConfig.backupFrequency === 'hourly'}
              />
            </div>
            
            <div className={`form-group ${validationErrors['backup.backupRetentionDays'] ? 'has-error' : ''}`}>
              <label htmlFor="backupRetentionDays">Backup Retention (days)</label>
              <input
                id="backupRetentionDays"
                type="number"
                min="1"
                max="365"
                value={categoryConfig.backupRetentionDays || 30}
                onChange={(e) => handleInputChange('backup', 'backupRetentionDays', e)}
                disabled={!categoryConfig.autoBackupEnabled}
              />
              {validationErrors['backup.backupRetentionDays'] && (
                <div className="error-message">{validationErrors['backup.backupRetentionDays']}</div>
              )}
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.includeUserAccounts || false}
                  onChange={(e) => handleToggleChange('backup', 'includeUserAccounts', e.target.checked)}
                  disabled={!categoryConfig.autoBackupEnabled}
                />
                Include User Accounts
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={categoryConfig.includeContentHistory || false}
                  onChange={(e) => handleToggleChange('backup', 'includeContentHistory', e.target.checked)}
                  disabled={!categoryConfig.autoBackupEnabled}
                />
                Include Content History
              </label>
              <div className="help-text">
                Includes version history for all content
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="compressionLevel">Compression Level</label>
              <select
                id="compressionLevel"
                value={categoryConfig.compressionLevel || 'medium'}
                onChange={(e) => handleSelectChange('backup', 'compressionLevel', e)}
                disabled={!categoryConfig.autoBackupEnabled}
              >
                <option value="none">None (Fastest, Largest Size)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High (Slowest, Smallest Size)</option>
              </select>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="config-form">
            <p>Select a category to configure settings.</p>
          </div>
        );
    }
  };

  return (
    <div className="system-configuration">
      <div className="section-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>System Configuration</h1>
      </div>
      
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-indicator">Loading system configuration...</div>
        </div>
      ) : (
        <div className="configuration-container">
          <div className="config-sidebar">
            <ul className="config-categories">
              {configCategories.map(category => (
                <li 
                  key={category.id}
                  className={`config-category ${activeCategory === category.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.label}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="config-content">
            <div className="config-category-header">
              <h2>{configCategories.find(c => c.id === activeCategory)?.label || 'Configuration'}</h2>
            </div>
            
            {renderCategoryForm(activeCategory)}
            
            <div className="config-actions">
              <button 
                className="reset-button" 
                onClick={handleResetToDefaults}
              >
                Reset to Defaults
              </button>
              <div className="primary-actions">
                <button 
                  className="cancel-button" 
                  onClick={handleCancel}
                  disabled={!hasChanges}
                >
                  Cancel
                </button>
                <button 
                  className="save-button" 
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

SystemConfiguration.propTypes = {
  onBack: PropTypes.func.isRequired
};

export default SystemConfiguration;

