import React, { useState } from 'react';
import registry from '../ModuleRegistry';

/**
 * ErrorDisplay component renders error information in a user-friendly format.
 * It provides options to show technical details, retry operations, and report errors.
 * 
 * This component is designed to work with the application's ErrorBoundary
 * and central error handling system.
 */
const ErrorDisplay = ({ 
  error, 
  componentName = 'Component', 
  onRetry, 
  showDetails = true,
  errorId,
  isFullPage = false
}) => {
  const [detailsVisible, setDetailsVisible] = useState(false);
  
  // Get app settings and color manager if available
  const settings = registry.get('config.app-settings') || {};
  const colorManager = registry.get('visualization.ColorManager');
  
  // Extract error information
  const errorMessage = error?.message || 'An unexpected error occurred';
  const errorStack = error?.stack || '';
  const errorName = error?.name || 'Error';
  
  // Only show stack trace in development or if explicitly enabled
  const showStack = (process.env.NODE_ENV === 'development' || settings.debug) && showDetails;
  
  // Get colors from theme or use defaults
  const themeColors = {
    errorBackground: colorManager ? colorManager.toCssColor(0xFF3333) : '#FF3333',
    errorText: colorManager ? colorManager.toCssColor(0xFFFFFF) : '#FFFFFF',
    buttonBackground: colorManager ? colorManager.toCssColor(0x3333FF) : '#3333FF',
    buttonText: colorManager ? colorManager.toCssColor(0xFFFFFF) : '#FFFFFF'
  };

  // Determine container style based on isFullPage prop
  const containerStyle = {
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 51, 51, 0.1)',
    border: `1px solid ${themeColors.errorBackground}`,
    color: '#333',
    margin: '10px 0',
    maxWidth: isFullPage ? '800px' : '100%',
    width: isFullPage ? '100%' : 'auto',
    position: isFullPage ? 'absolute' : 'relative',
    top: isFullPage ? '50%' : 'auto',
    left: isFullPage ? '50%' : 'auto',
    transform: isFullPage ? 'translate(-50%, -50%)' : 'none',
    boxShadow: isFullPage ? '0 4px 20px rgba(0, 0, 0, 0.15)' : 'none',
    zIndex: isFullPage ? 1000 : 1
  };
  
  // Header with error information
  const headerStyle = {
    backgroundColor: themeColors.errorBackground,
    color: themeColors.errorText,
    padding: '12px 20px',
    borderRadius: '6px 6px 0 0',
    marginBottom: '15px',
    marginTop: '-20px',
    marginLeft: '-20px',
    marginRight: '-20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };
  
  // Button styles
  const buttonStyle = {
    backgroundColor: themeColors.buttonBackground,
    color: themeColors.buttonText,
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    margin: '0 8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s ease-in-out'
  };
  
  // Details toggle style
  const detailsToggleStyle = {
    backgroundColor: 'transparent',
    color: '#555',
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '6px 12px',
    margin: '0 8px',
    cursor: 'pointer',
    fontSize: '14px'
  };
  
  // Error stack display
  const stackStyle = {
    backgroundColor: '#f8f8f8',
    padding: '15px',
    borderRadius: '4px',
    color: '#666',
    fontSize: '13px',
    fontFamily: 'monospace',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    maxHeight: '300px',
    overflowY: 'auto',
    marginTop: '10px',
    border: '1px solid #ddd'
  };

  /**
   * Handle error reporting
   */
  const handleReportError = () => {
    const errorHandler = registry.get('utils.ErrorHandler');
    
    if (errorHandler) {
      // Use error handler's reporting mechanism if available
      try {
        errorHandler.reportError(error, {
          component: componentName,
          userTriggered: true,
          errorId
        });
        
        alert('Error report submitted. Thank you for helping improve the application.');
      } catch (reportingError) {
        console.error('Failed to report error:', reportingError);
        alert('Unable to submit error report. Please try again later.');
      }
    } else {
      // Fallback reporting mechanism
      console.error('Error reported by user:', error);
      alert('Error reporting is not fully configured. Please contact support.');
    }
  };

  return (
    <div style={containerStyle} role="alert" aria-live="assertive">
      <div style={headerStyle}>
        <h3 style={{ margin: 0 }}>
          {errorName} in {componentName}
        </h3>
        {errorId && (
          <span style={{ fontSize: '12px', opacity: 0.8 }}>
            ID: {errorId}
          </span>
        )}
      </div>
      
      <div style={{ padding: '0 0 15px 0' }}>
        <p style={{ fontSize: '16px', lineHeight: 1.5 }}>{errorMessage}</p>
        
        {showDetails && (
          <button 
            style={detailsToggleStyle}
            onClick={() => setDetailsVisible(!detailsVisible)}
            aria-expanded={detailsVisible}
          >
            {detailsVisible ? 'Hide Technical Details' : 'Show Technical Details'}
          </button>
        )}
        
        {detailsVisible && showStack && (
          <div style={stackStyle} aria-label="Error stack trace">
            {errorStack}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
        {onRetry && (
          <button 
            style={buttonStyle} 
            onClick={onRetry}
          >
            Try Again
          </button>
        )}
        
        <button 
          style={{
            ...buttonStyle,
            backgroundColor: 'rgba(51, 51, 255, 0.7)'
          }} 
          onClick={handleReportError}
        >
          Report Issue
        </button>
      </div>
    </div>
  );
};

// Register with ModuleRegistry
export default registry.register(
  'components.ErrorDisplay',
  ErrorDisplay,
  ['utils.ErrorHandler', 'visualization.ColorManager', 'config.app-settings'],
  {
    description: 'Component for displaying error information in a user-friendly format',
    usage: 'Used by ErrorBoundary to render error details and provide user actions'
  }
); 