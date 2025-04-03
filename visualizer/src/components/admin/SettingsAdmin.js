import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import registry from '../../ModuleRegistry';
import useAppSettings from '../../hooks/useAppSettings';

/**
 * Settings Administration Interface
 * 
 * This component provides an administrative interface for viewing and modifying
 * application settings. It includes:
 * - Settings editor with validation
 * - Permission checks for settings modification
 * - Settings export/import functionality
 * - Setting change history tracking
 * - Settings documentation viewer
 */
const SettingsAdmin = () => {
  // Get dependencies
  const { getSetting, isFeatureEnabled } = useAppSettings();
  const eventBus = registry.get('utils.EventBus');
  const authService = registry.get('auth.AuthService');
  const settingsValidator = registry.get('utils.settings.SettingsValidator');
  const navigate = useNavigate();
  
  // Local state
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);
  const [sectionSettings, setSectionSettings] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [changeHistory, setChangeHistory] = useState([]);
  const [showDocs, setShowDocs] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  
  // Get required permissions from settings
  const requiredPermissions = useMemo(() => {
    return getSetting('auth.requiredRolesForEditing', ['admin']);
  }, [getSetting]);
  
  // Check if user has permission to edit settings
  useEffect(() => {
    if (!authService) {
      setHasPermission(false);
      return;
    }
    
    const checkPermissions = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        
        if (!currentUser) {
          setHasPermission(false);
          return;
        }
        
        // Check if user has any of the required roles
        const hasRequiredRole = requiredPermissions.some(role => 
          currentUser.roles && currentUser.roles.includes(role)
        );
        
        setHasPermission(hasRequiredRole);
        
        // Redirect if no permission
        if (!hasRequiredRole) {
          navigate('/unauthorized', { 
            replace: true,
            state: { message: 'You do not have permission to access settings administration' } 
          });
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setHasPermission(false);
      }
    };
    
    checkPermissions();
  }, [authService, requiredPermissions, navigate]);
  
  // Load available settings sections
  useEffect(() => {
    const appSettings = registry.get('config.app-settings');
    
    if (!appSettings) {
      console.error('App settings not available');
      return;
    }
    
    // Extract sections from app settings
    const sectionNames = Object.keys(appSettings).filter(key => 
      typeof appSettings[key] === 'object' && appSettings[key] !== null
    );
    
    setSections(sectionNames);
    
    // Set first section as active if none selected
    if (sectionNames.length > 0 && !activeSection) {
      setActiveSection(sectionNames[0]);
    }
  }, [activeSection]);
  
  // Load settings for active section
  useEffect(() => {
    if (!activeSection) return;
    
    const appSettings = registry.get('config.app-settings');
    if (!appSettings || !appSettings[activeSection]) return;
    
    setSectionSettings(appSettings[activeSection]);
    
    // Load validation errors for this section
    if (settingsValidator) {
      const validationResult = settingsValidator.getValidationResult(activeSection);
      setValidationErrors(validationResult?.errors || []);
    }
  }, [activeSection, settingsValidator]);
  
  // Subscribe to settings changes
  useEffect(() => {
    if (!eventBus) return;
    
    const handleSettingsChange = (data) => {
      // Update local state if the active section changed
      if (data.section === activeSection) {
        const appSettings = registry.get('config.app-settings');
        if (appSettings && appSettings[activeSection]) {
          setSectionSettings(appSettings[activeSection]);
        }
        
        // Add to change history
        setChangeHistory(prev => [
          {
            timestamp: new Date().toISOString(),
            section: data.section,
            changes: data.changes || 'Settings updated',
            user: data.user || 'Unknown'
          },
          ...prev.slice(0, 19) // Keep last 20 entries
        ]);
      }
    };
    
    // Subscribe to settings changes
    eventBus.subscribe('settings:updated', handleSettingsChange);
    
    // Clean up subscription
    return () => {
      eventBus.unsubscribe('settings:updated', handleSettingsChange);
    };
  }, [eventBus, activeSection]);
  
  // Change section handler
  const handleSectionChange = (section) => {
    if (isEditing) {
      // Show confirmation dialog if there are unsaved changes
      if (window.confirm('You have unsaved changes. Discard changes?')) {
        setIsEditing(false);
        setActiveSection(section);
      }
    } else {
      setActiveSection(section);
    }
  };
  
  // Start editing handler
  const handleStartEditing = () => {
    if (!hasPermission) {
      alert('You do not have permission to edit settings');
      return;
    }
    
    setIsEditing(true);
  };
  
  // Cancel editing handler
  const handleCancelEditing = () => {
    if (window.confirm('Discard changes?')) {
      setIsEditing(false);
      
      // Reset to original settings
      const appSettings = registry.get('config.app-settings');
      if (appSettings && appSettings[activeSection]) {
        setSectionSettings(appSettings[activeSection]);
      }
    }
  };
  
  // Save settings handler
  const handleSaveSettings = () => {
    if (!hasPermission) {
      alert('You do not have permission to save settings');
      return;
    }
    
    // Validate settings before saving
    let isValid = true;
    let errors = {};
    
    if (settingsValidator) {
      const validationResult = settingsValidator.validate(activeSection, sectionSettings, { force: true });
      
      if (!validationResult.valid) {
        isValid = false;
        errors = validationResult.errors;
        setValidationErrors(errors);
        
        if (!window.confirm('Settings have validation errors. Save anyway?')) {
          return;
        }
      }
    }
    
    // Get the settings service
    const settingsService = registry.get('services.SettingsService');
    
    if (!settingsService) {
      console.error('Settings service not available');
      alert('Unable to save settings: Settings service not available');
      return;
    }
    
    // Get current user for change tracking
    let username = 'Unknown';
    if (authService) {
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        username = currentUser.username || currentUser.email || 'Unknown';
      }
    }
    
    // Save the settings
    try {
      settingsService.updateSettings(activeSection, sectionSettings, {
        bypassValidation: !isValid,
        user: username
      });
      
      setIsEditing(false);
      alert('Settings saved successfully');
      
      // Update validation errors
      if (settingsValidator) {
        const validationResult = settingsValidator.validate(activeSection, sectionSettings);
        setValidationErrors(validationResult?.errors || []);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(`Error saving settings: ${error.message}`);
    }
  };
  
  // Setting change handler
  const handleSettingChange = (key, value) => {
    setSectionSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Export settings handler
  const handleExportSettings = () => {
    const appSettings = registry.get('config.app-settings');
    
    if (!appSettings) {
      alert('No settings available to export');
      return;
    }
    
    // Create export object
    const exportData = {
      version: appSettings.app?.version || '1.0.0',
      timestamp: new Date().toISOString(),
      environment: appSettings.app?.environment || 'unknown',
      settings: activeSection ? { [activeSection]: appSettings[activeSection] } : appSettings
    };
    
    // Convert to JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = `settings-export-${activeSection || 'all'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // Import settings handler
  const handleImportSettings = (event) => {
    if (!hasPermission) {
      alert('You do not have permission to import settings');
      return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate import data
        if (!importData.settings) {
          throw new Error('Invalid import file: No settings found');
        }
        
        // If we're in a specific section, only import that section
        if (activeSection) {
          if (!importData.settings[activeSection]) {
            throw new Error(`Import file does not contain settings for ${activeSection}`);
          }
          
          // Update section settings
          setSectionSettings(importData.settings[activeSection]);
          setIsEditing(true);
        } else {
          // Handle full settings import through the settings service
          const settingsService = registry.get('services.SettingsService');
          
          if (!settingsService) {
            throw new Error('Settings service not available');
          }
          
          // Confirm full import
          if (window.confirm('Import all settings? This will replace all current settings.')) {
            settingsService.importSettings(importData.settings);
            alert('Settings imported successfully');
          }
        }
      } catch (error) {
        console.error('Error importing settings:', error);
        alert(`Error importing settings: ${error.message}`);
      }
      
      // Reset the file input
      event.target.value = null;
    };
    
    reader.onerror = () => {
      alert('Error reading import file');
      // Reset the file input
      event.target.value = null;
    };
    
    reader.readAsText(file);
  };
  
  // Toggle documentation display
  const handleToggleDocs = () => {
    setShowDocs(prev => !prev);
  };
  
  // Generate section documentation
  const renderSectionDocs = () => {
    if (!settingsValidator || !activeSection) return null;
    
    const docs = settingsValidator.generateSchemaDocumentation(activeSection);
    
    if (!docs) {
      return (
        <div className="settings-docs">
          <p>No documentation available for this section.</p>
        </div>
      );
    }
    
    return (
      <div className="settings-docs">
        <h3>{docs.section} Settings Documentation</h3>
        <p>{docs.description}</p>
        
        <table className="docs-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>Type</th>
              <th>Description</th>
              <th>Required</th>
              <th>Default</th>
              <th>Constraints</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(docs.properties).map(([name, prop]) => (
              <tr key={name} className={prop.deprecated ? 'deprecated' : ''}>
                <td>{name}</td>
                <td>{prop.type}</td>
                <td>
                  {prop.description}
                  {prop.deprecated && <div className="deprecated-notice">Deprecated: {prop.deprecationMessage}</div>}
                </td>
                <td>{prop.required ? 'Yes' : 'No'}</td>
                <td>{prop.default !== undefined ? String(prop.default) : '-'}</td>
                <td>
                  {prop.enum && <div>Values: {prop.enum.join(', ')}</div>}
                  {prop.minimum !== undefined && <div>Min: {prop.minimum}</div>}
                  {prop.maximum !== undefined && <div>Max: {prop.maximum}</div>}
                  {prop.pattern && <div>Pattern: {prop.pattern}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Render settings editor
  const renderSettingsEditor = () => {
    if (!activeSection || !sectionSettings) {
      return <div className="no-settings">No settings available</div>;
    }
    
    return (
      <div className="settings-editor">
        {Object.entries(sectionSettings).map(([key, value]) => {
          // Find validation error for this key
          const error = validationErrors.find(err => err.field === key);
          
          return (
            <div key={key} className={`setting-item ${error ? 'has-error' : ''}`}>
              <label htmlFor={`setting-${key}`}>{key}</label>
              
              {/* Render appropriate input based on value type */}
              {typeof value === 'boolean' ? (
                <input
                  id={`setting-${key}`}
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleSettingChange(key, e.target.checked)}
                  disabled={!isEditing}
                />
              ) : typeof value === 'number' ? (
                <input
                  id={`setting-${key}`}
                  type="number"
                  value={value}
                  onChange={(e) => handleSettingChange(key, Number(e.target.value))}
                  disabled={!isEditing}
                />
              ) : typeof value === 'string' ? (
                <input
                  id={`setting-${key}`}
                  type="text"
                  value={value}
                  onChange={(e) => handleSettingChange(key, e.target.value)}
                  disabled={!isEditing}
                />
              ) : (
                <div className="complex-value">
                  <code>{JSON.stringify(value)}</code>
                  <button 
                    disabled={!isEditing} 
                    onClick={() => {
                      const newValue = prompt('Edit JSON value:', JSON.stringify(value));
                      if (newValue) {
                        try {
                          handleSettingChange(key, JSON.parse(newValue));
                        } catch (e) {
                          alert('Invalid JSON. Value not updated.');
                        }
                      }
                    }}
                  >
                    Edit
                  </button>
                </div>
              )}
              
              {/* Display validation error */}
              {error && <div className="error-message">{error.message}</div>}
            </div>
          );
        })}
      </div>
    );
  };
  
  // Render change history
  const renderChangeHistory = () => {
    if (changeHistory.length === 0) {
      return <div className="no-history">No changes recorded</div>;
    }
    
    return (
      <div className="change-history">
        <h3>Recent Changes</h3>
        <table className="history-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Section</th>
              <th>Changes</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {changeHistory.map((change, index) => (
              <tr key={index}>
                <td>{new Date(change.timestamp).toLocaleString()}</td>
                <td>{change.section}</td>
                <td>{change.changes}</td>
                <td>{change.user}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Check if admin features are enabled
  if (!isFeatureEnabled('adminPanel.enabled') || !isFeatureEnabled('adminPanel.systemConfigEnabled')) {
    return (
      <div className="settings-admin-disabled">
        <h2>Settings Administration</h2>
        <p>Settings administration is not enabled in this environment.</p>
      </div>
    );
  }
  
  // Render main component
  return (
    <div className="settings-admin">
      <h2>Settings Administration</h2>
      
      {/* Main content container */}
      <div className="settings-container">
        {/* Section sidebar */}
        <div className="settings-sidebar">
          <h3>Sections</h3>
          <ul className="section-list">
            {sections.map(section => (
              <li key={section} className={section === activeSection ? 'active' : ''}>
                <button onClick={() => handleSectionChange(section)}>
                  {section}
                </button>
              </li>
            ))}
          </ul>
          
          {/* Control buttons */}
          <div className="sidebar-controls">
            <button 
              className="export-button" 
              onClick={handleExportSettings}
              title="Export settings as JSON"
            >
              Export
            </button>
            
            {hasPermission && (
              <div className="import-container">
                <label htmlFor="import-file" className="import-button">
                  Import
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  style={{ display: 'none' }}
                />
              </div>
            )}
            
            <button 
              className="docs-button" 
              onClick={handleToggleDocs}
              title={showDocs ? 'Hide documentation' : 'Show documentation'}
            >
              {showDocs ? 'Hide Docs' : 'Show Docs'}
            </button>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="settings-content">
          {activeSection && (
            <div className="settings-header">
              <h3>{activeSection} Settings</h3>
              
              {hasPermission && (
                <div className="settings-actions">
                  {!isEditing ? (
                    <button 
                      className="edit-button" 
                      onClick={handleStartEditing}
                      disabled={!hasPermission}
                    >
                      Edit Settings
                    </button>
                  ) : (
                    <>
                      <button 
                        className="save-button" 
                        onClick={handleSaveSettings}
                      >
                        Save
                      </button>
                      <button 
                        className="cancel-button" 
                        onClick={handleCancelEditing}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Show docs or settings */}
          {showDocs ? renderSectionDocs() : renderSettingsEditor()}
          
          {/* Change history */}
          {activeSection && !showDocs && <hr />}
          {activeSection && !showDocs && renderChangeHistory()}
        </div>
      </div>
    </div>
  );
};

// Register component with ModuleRegistry
registry.register(
  'components.admin.SettingsAdmin',
  SettingsAdmin,
  ['hooks.useAppSettings', 'utils.settings.SettingsValidator', 'auth.AuthService'],
  {
    description: 'Settings administration interface',
    provides: ['settingsAdmin', 'settingsEditor', 'settingsHistory']
  }
);

export default SettingsAdmin; 