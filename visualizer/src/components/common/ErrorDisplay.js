import React from 'react';
import registry from '../../ModuleRegistry';

/**
 * Error Display Component
 * 
 * Renders error messages with appropriate styling based on error type and severity.
 * Supports different display variants for different contexts (toast, inline, modal, etc.)
 * 
 * Features:
 * - Error message display with optional details
 * - Severity-based styling (error, warning, info)
 * - Expandable details section
 * - Retry and dismiss actions
 * - Animated entry and exit
 */
const ErrorDisplay = ({
  error,
  variant = 'inline',
  showDetails = false,
  showStack = false,
  onRetry,
  onDismiss,
  className = '',
  timeout,
}) => {
  const [expanded, setExpanded] = React.useState(showDetails);
  const [visible, setVisible] = React.useState(true);
  
  // Initialize from error handler registry
  const errorHandler = registry.get('utils.ErrorHandler');
  const errorTypes = registry.get('utils.errors.ErrorTypes');
  
  // Extract error properties with defaults
  const {
    message = 'An error occurred',
    devMessage,
    severity = 'error',
    category = 'app',
    code = 'UNKNOWN_ERROR',
    stack
  } = error || {};
  
  // Get severity from error types if available
  const errorSeverity = (errorTypes?.ErrorSeverity && severity) ? 
    severity : 
    (error?.severity || 'error');
  
  // Determine icon based on severity
  const getIcon = () => {
    switch (errorSeverity) {
      case 'fatal':
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '❌';
    }
  };
  
  // Auto-dismiss after timeout if provided
  React.useEffect(() => {
    if (timeout && timeout > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        if (onDismiss) {
          setTimeout(onDismiss, 300); // Allow animation to complete
        }
      }, timeout);
      
      return () => clearTimeout(timer);
    }
  }, [timeout, onDismiss]);
  
  // Handle retry action
  const handleRetry = (e) => {
    e.preventDefault();
    if (onRetry && typeof onRetry === 'function') {
      onRetry(error);
    }
  };
  
  // Handle dismiss action
  const handleDismiss = (e) => {
    e.preventDefault();
    setVisible(false);
    if (onDismiss && typeof onDismiss === 'function') {
      setTimeout(onDismiss, 300); // Allow animation to complete
    }
  };
  
  // Toggle details visibility
  const toggleDetails = (e) => {
    e.preventDefault();
    setExpanded(!expanded);
  };
  
  // Report error to error handler if not already reported
  React.useEffect(() => {
    if (error && !error.reported && errorHandler && variant === 'modal') {
      errorHandler.handleError(error, {
        source: 'ErrorDisplay',
        reportedVia: 'ui'
      });
      error.reported = true;
    }
  }, [error, errorHandler, variant]);
  
  // Base class for styling
  const baseClass = `error-display error-display--${variant} error-display--${errorSeverity} ${className}`;
  const visibilityClass = visible ? 'error-display--visible' : 'error-display--hidden';
  
  // Render appropriate variant
  switch (variant) {
    case 'toast':
      return (
        <div className={`${baseClass} ${visibilityClass}`}>
          <div className="error-display__icon">{getIcon()}</div>
          <div className="error-display__content">
            <div className="error-display__message">{message}</div>
            {expanded && devMessage && devMessage !== message && (
              <div className="error-display__details">{devMessage}</div>
            )}
          </div>
          <div className="error-display__actions">
            {devMessage && devMessage !== message && (
              <button 
                onClick={toggleDetails} 
                className="error-display__expand-btn"
                aria-expanded={expanded}
              >
                {expanded ? 'Less' : 'More'}
              </button>
            )}
            {onRetry && (
              <button onClick={handleRetry} className="error-display__retry-btn">
                Retry
              </button>
            )}
            <button onClick={handleDismiss} className="error-display__dismiss-btn">
              ✕
            </button>
          </div>
        </div>
      );
      
    case 'modal':
      return (
        <div className={`${baseClass} ${visibilityClass}`}>
          <div className="error-display__modal-header">
            <div className="error-display__icon">{getIcon()}</div>
            <h3 className="error-display__title">
              {errorSeverity === 'fatal' ? 'Fatal Error' : 
               errorSeverity === 'error' ? 'Error' : 
               errorSeverity === 'warning' ? 'Warning' : 'Notice'}
            </h3>
            {onDismiss && (
              <button onClick={handleDismiss} className="error-display__dismiss-btn">
                ✕
              </button>
            )}
          </div>
          
          <div className="error-display__modal-body">
            <div className="error-display__message">{message}</div>
            
            {expanded && (
              <div className="error-display__details-section">
                {devMessage && devMessage !== message && (
                  <div className="error-display__dev-message">
                    <h4>Technical Details</h4>
                    <p>{devMessage}</p>
                  </div>
                )}
                
                {code && (
                  <div className="error-display__error-code">
                    <span className="error-display__label">Error Code:</span> {code}
                  </div>
                )}
                
                {category && (
                  <div className="error-display__category">
                    <span className="error-display__label">Category:</span> {category}
                  </div>
                )}
                
                {showStack && stack && (
                  <div className="error-display__stack">
                    <h4>Stack Trace</h4>
                    <pre>{stack}</pre>
                  </div>
                )}
                
                {error && error.data && Object.keys(error.data).length > 0 && (
                  <div className="error-display__data">
                    <h4>Additional Data</h4>
                    <pre>{JSON.stringify(error.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="error-display__modal-footer">
            <button 
              onClick={toggleDetails} 
              className="error-display__expand-btn"
              aria-expanded={expanded}
            >
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
            
            {onRetry && (
              <button onClick={handleRetry} className="error-display__retry-btn">
                Try Again
              </button>
            )}
            
            {onDismiss && (
              <button onClick={handleDismiss} className="error-display__close-btn">
                Close
              </button>
            )}
          </div>
        </div>
      );
      
    case 'inline':
    default:
      return (
        <div className={`${baseClass} ${visibilityClass}`}>
          <div className="error-display__icon">{getIcon()}</div>
          <div className="error-display__content">
            <div className="error-display__message">{message}</div>
            
            {expanded && (
              <div className="error-display__details">
                {devMessage && devMessage !== message && (
                  <p className="error-display__dev-message">{devMessage}</p>
                )}
                
                {code && (
                  <div className="error-display__error-code">
                    <span className="error-display__label">Code:</span> {code}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="error-display__actions">
            {(devMessage || code || showStack) && (
              <button 
                onClick={toggleDetails} 
                className="error-display__expand-btn"
                aria-expanded={expanded}
              >
                {expanded ? 'Less' : 'More'}
              </button>
            )}
            
            {onRetry && (
              <button onClick={handleRetry} className="error-display__retry-btn">
                Retry
              </button>
            )}
            
            {onDismiss && (
              <button onClick={handleDismiss} className="error-display__dismiss-btn">
                Dismiss
              </button>
            )}
          </div>
        </div>
      );
  }
};

// Register component with ModuleRegistry
registry.register(
  'components.common.ErrorDisplay',
  ErrorDisplay,
  ['utils.ErrorHandler', 'utils.errors.ErrorTypes'],
  {
    description: 'Component for displaying error messages with appropriate styling',
    provides: ['errorDisplay', 'userNotification']
  }
);

export default ErrorDisplay; 