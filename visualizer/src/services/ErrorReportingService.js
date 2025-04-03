import registry from '../ModuleRegistry';

/**
 * Error Reporting Service
 * 
 * This service handles error reporting, logging, and analytics.
 * It provides a centralized way to report errors to different destinations
 * including console, remote services, and analytics platforms.
 * 
 * Features:
 * - Formatted error logging to console
 * - Remote error reporting to logging services
 * - User feedback collection
 * - Privacy-conscious reporting with PII filtering
 * - Error analytics for trend detection
 * - Rate limiting for error reporting
 */
class ErrorReportingService {
  constructor() {
    // Configuration settings
    this.config = {
      enabled: true,
      consoleEnabled: true,
      remoteEnabled: false,
      analyticsEnabled: true,
      privacyFiltering: true,
      rateLimit: 10, // Max reports per minute
      maxStackFrames: 50,
      logLevel: 'error', // 'debug', 'info', 'warn', 'error', 'fatal'
      groupSimilarErrors: true,
      includeContext: true
    };
    
    // Remote reporting endpoint
    this.remoteEndpoint = null;
    
    // Rate limiting state
    this.reportCount = 0;
    this.reportCountResetTime = Date.now() + 60000;
    
    // Error grouping
    this.reportedErrors = new Map();
    
    // Event bus for notifications
    this.eventBus = null;
  }
  
  /**
   * Initialize the error reporting service
   */
  initialize() {
    // Register with ModuleRegistry
    registry.register(
      'services.ErrorReportingService',
      this,
      ['utils.errors.ErrorTypes', 'utils.EventBus', 'config.app-settings'],
      {
        description: 'Service for error reporting, logging, and analytics',
        provides: ['errorReporting', 'errorLogging', 'errorAnalytics']
      }
    );
    
    // Get dependencies
    this.eventBus = registry.get('utils.EventBus');
    this.errorTypes = registry.get('utils.errors.ErrorTypes');
    const appSettings = registry.get('config.app-settings');
    
    // Apply configuration from app settings if available
    if (appSettings && appSettings.errorReporting) {
      this.configure(appSettings.errorReporting);
    }
    
    // Set up event listeners
    if (this.eventBus) {
      this.eventBus.subscribe('error:captured', this.handleErrorCaptured.bind(this));
    }
    
    // Log initialization
    this.logDebug('ErrorReportingService initialized');
  }
  
  /**
   * Configure the error reporting service
   * @param {Object} config - Configuration settings
   */
  configure(config = {}) {
    this.config = {
      ...this.config,
      ...config
    };
    
    // Update remote endpoint if provided
    if (config.remoteEndpoint) {
      this.remoteEndpoint = config.remoteEndpoint;
    }
    
    // Log configuration
    this.logDebug('ErrorReportingService configured', { config: this.config });
  }
  
  /**
   * Report an error to configured destinations
   * @param {Error} error - Error object to report
   * @param {Object} context - Additional context for the error
   * @returns {boolean} Whether the error was reported successfully
   */
  reportError(error, context = {}) {
    // Skip if reporting is disabled
    if (!this.config.enabled) {
      return false;
    }
    
    // Apply rate limiting
    if (!this.checkRateLimit()) {
      this.logWarn('Error reporting rate limit exceeded');
      return false;
    }
    
    // Process error and context
    const processedError = this.processError(error, context);
    
    // Check for similar previously reported errors
    if (this.config.groupSimilarErrors && this.isSimilarErrorReported(processedError)) {
      this.updateSimilarErrorCount(processedError);
      return true;
    }
    
    // Report to console
    if (this.config.consoleEnabled) {
      this.reportToConsole(processedError);
    }
    
    // Report to remote endpoint
    if (this.config.remoteEnabled && this.remoteEndpoint) {
      this.reportToRemote(processedError);
    }
    
    // Track for analytics
    if (this.config.analyticsEnabled) {
      this.trackForAnalytics(processedError);
    }
    
    // Remember this error for grouping similar errors
    this.rememberReportedError(processedError);
    
    // Notify through event bus
    if (this.eventBus) {
      this.eventBus.publish('errorReporting:errorReported', {
        error: processedError.publicData
      });
    }
    
    return true;
  }
  
  /**
   * Process an error for reporting
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Object} Processed error data
   * @private
   */
  processError(error, context = {}) {
    // Extract data from error
    const errorData = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: error.code,
      ...(error.toJSON ? error.toJSON() : {})
    } : {
      message: String(error),
      name: 'UnknownError'
    };
    
    // Get error fingerprint for grouping
    const fingerprint = this.getErrorFingerprint(errorData, context);
    
    // Create error report with both public and private data
    const processed = {
      originalError: error,
      timestamp: Date.now(),
      fingerprint,
      context: this.config.includeContext ? context : {},
      data: errorData,
      // Public data excludes potentially sensitive information
      publicData: {
        message: errorData.message,
        name: errorData.name,
        code: errorData.code,
        category: errorData.category || 'unknown',
        timestamp: Date.now(),
        fingerprint
      }
    };
    
    // Apply privacy filtering if enabled
    if (this.config.privacyFiltering) {
      processed.publicData = this.filterSensitiveData(processed.publicData);
      processed.data = this.filterSensitiveData(processed.data);
      if (processed.context) {
        processed.context = this.filterSensitiveData(processed.context);
      }
    }
    
    // Limit stack trace length
    if (processed.data.stack) {
      processed.data.stack = this.limitStackTraceLength(processed.data.stack);
    }
    
    return processed;
  }
  
  /**
   * Generate an error fingerprint for grouping similar errors
   * @param {Object} errorData - Error data
   * @param {Object} context - Error context
   * @returns {string} Error fingerprint
   * @private
   */
  getErrorFingerprint(errorData, context) {
    // Extract the first file/line from stack trace if available
    let location = 'unknown';
    if (errorData.stack) {
      const stackLines = errorData.stack.split('\n');
      if (stackLines.length > 1) {
        const match = stackLines[1].match(/at\s+.*\((.*):([0-9]+):([0-9]+)\)/i);
        if (match) {
          location = match[1];
        }
      }
    }
    
    // Create fingerprint from error properties
    return `${errorData.name}:${location}:${errorData.code || 'nocode'}`;
  }
  
  /**
   * Limit stack trace length to configured maximum
   * @param {string} stack - Stack trace
   * @returns {string} Truncated stack trace
   * @private
   */
  limitStackTraceLength(stack) {
    if (!stack) return '';
    
    const stackLines = stack.split('\n');
    if (stackLines.length <= this.config.maxStackFrames) {
      return stack;
    }
    
    return [
      ...stackLines.slice(0, this.config.maxStackFrames),
      `... ${stackLines.length - this.config.maxStackFrames} more frames truncated ...`
    ].join('\n');
  }
  
  /**
   * Apply rate limiting to error reporting
   * @returns {boolean} Whether rate limit allows reporting
   * @private
   */
  checkRateLimit() {
    const now = Date.now();
    
    // Reset counter if time period elapsed
    if (now > this.reportCountResetTime) {
      this.reportCount = 0;
      this.reportCountResetTime = now + 60000; // Reset every minute
    }
    
    // Check if limit reached
    if (this.reportCount >= this.config.rateLimit) {
      return false;
    }
    
    // Increment counter
    this.reportCount++;
    return true;
  }
  
  /**
   * Check if a similar error has been reported recently
   * @param {Object} processedError - Processed error data
   * @returns {boolean} Whether similar error exists
   * @private
   */
  isSimilarErrorReported(processedError) {
    return this.reportedErrors.has(processedError.fingerprint);
  }
  
  /**
   * Update count for a similar error
   * @param {Object} processedError - Processed error data
   * @private
   */
  updateSimilarErrorCount(processedError) {
    const existing = this.reportedErrors.get(processedError.fingerprint);
    if (existing) {
      existing.count += 1;
      existing.lastOccurrence = processedError.timestamp;
      this.reportedErrors.set(processedError.fingerprint, existing);
      
      // Log update if console enabled
      if (this.config.consoleEnabled) {
        console.warn(`Repeated error (${existing.count}x): ${processedError.data.message}`);
      }
    }
  }
  
  /**
   * Remember a reported error for future similarity checking
   * @param {Object} processedError - Processed error data
   * @private
   */
  rememberReportedError(processedError) {
    this.reportedErrors.set(processedError.fingerprint, {
      error: processedError,
      firstOccurrence: processedError.timestamp,
      lastOccurrence: processedError.timestamp,
      count: 1
    });
    
    // Limit the size of remembered errors
    if (this.reportedErrors.size > 100) {
      // Remove oldest entry
      const oldest = Array.from(this.reportedErrors.entries())
        .sort(([, a], [, b]) => a.lastOccurrence - b.lastOccurrence)[0];
      if (oldest) {
        this.reportedErrors.delete(oldest[0]);
      }
    }
  }
  
  /**
   * Report error to console with formatting
   * @param {Object} processedError - Processed error data
   * @private
   */
  reportToConsole(processedError) {
    const { data, context } = processedError;
    
    // Style based on error type
    const styles = {
      error: 'background: #ffebee; color: #b71c1c; padding: 2px 5px;',
      warn: 'background: #fff8e1; color: #ff6f00; padding: 2px 5px;',
      info: 'background: #e3f2fd; color: #0d47a1; padding: 2px 5px;',
      debug: 'background: #e8f5e9; color: #1b5e20; padding: 2px 5px;'
    };
    
    // Determine log level style
    const severity = data.severity || 'error';
    const style = styles[severity] || styles.error;
    
    // Create error message
    console.groupCollapsed(
      `%c${data.name || 'Error'}: ${data.message}`, 
      style
    );
    
    console.log('Error details:', data);
    
    if (context && Object.keys(context).length > 0) {
      console.log('Context:', context);
    }
    
    if (data.stack) {
      console.log('Stack trace:');
      console.log(data.stack);
    }
    
    console.groupEnd();
  }
  
  /**
   * Report error to remote endpoint
   * @param {Object} processedError - Processed error data
   * @private
   */
  reportToRemote(processedError) {
    // Skip if no endpoint configured
    if (!this.remoteEndpoint) return;
    
    // Create report payload
    const payload = {
      ...processedError.publicData,
      environment: process.env.NODE_ENV || 'development',
      timestamp: processedError.timestamp,
      application: 'AI-Alignment-Visualization',
      version: process.env.REACT_APP_VERSION || 'unknown'
    };
    
    // Only include filtered context in remote reports
    if (this.config.includeContext && processedError.context) {
      payload.context = processedError.context;
    }
    
    // Send report asynchronously
    fetch(this.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      // Don't wait for response
      keepalive: true
    }).catch(err => {
      // Log failure but don't report it (would cause recursion)
      if (this.config.consoleEnabled) {
        console.warn('Failed to send error report:', err.message);
      }
    });
  }
  
  /**
   * Track error for analytics
   * @param {Object} processedError - Processed error data
   * @private
   */
  trackForAnalytics(processedError) {
    // Skip if analytics disabled
    if (!this.config.analyticsEnabled) return;
    
    // Get analytics service if available
    const analyticsService = registry.get('services.AnalyticsService');
    if (!analyticsService) return;
    
    // Track event
    analyticsService.trackEvent('error', {
      error_type: processedError.data.name,
      error_code: processedError.data.code || 'unknown',
      error_message: processedError.data.message,
      error_category: processedError.data.category || 'unknown'
    });
  }
  
  /**
   * Filter sensitive data from error reports
   * @param {Object} data - Data to filter
   * @returns {Object} Filtered data
   * @private
   */
  filterSensitiveData(data) {
    if (!data || typeof data !== 'object') return data;
    
    // Create a copy to avoid modifying the original
    const filtered = Array.isArray(data) ? [...data] : { ...data };
    
    // Sensitive key patterns
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i,
      /private/i,
      /session/i
    ];
    
    // Replace sensitive values
    for (const key in filtered) {
      // Skip if not own property
      if (!Object.prototype.hasOwnProperty.call(filtered, key)) continue;
      
      // Check if key matches sensitive pattern
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitive) {
        // Redact sensitive value
        filtered[key] = '[REDACTED]';
      } else if (filtered[key] && typeof filtered[key] === 'object') {
        // Recursively filter nested objects
        filtered[key] = this.filterSensitiveData(filtered[key]);
      }
    }
    
    return filtered;
  }
  
  /**
   * Handle error captured event from ErrorHandler
   * @param {Object} data - Event data
   * @private
   */
  handleErrorCaptured(data) {
    const { id, message, context, stack } = data;
    
    // Create error object
    const error = new Error(message);
    error.id = id;
    error.stack = stack;
    
    // Report error
    this.reportError(error, context);
  }
  
  /**
   * Log a debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   * @private
   */
  logDebug(message, data = {}) {
    if (this.config.logLevel === 'debug' && this.config.consoleEnabled) {
      console.debug(`[ErrorReportingService] ${message}`, data);
    }
  }
  
  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   * @private
   */
  logWarn(message, data = {}) {
    if (['debug', 'info', 'warn'].includes(this.config.logLevel) && this.config.consoleEnabled) {
      console.warn(`[ErrorReportingService] ${message}`, data);
    }
  }
  
  /**
   * Get error reporting statistics
   * @returns {Object} Error statistics
   */
  getStatistics() {
    return {
      totalReportedErrors: this.reportedErrors.size,
      uniqueErrors: this.reportedErrors.size,
      rateLimit: this.config.rateLimit,
      currentRate: this.reportCount,
      enabled: this.config.enabled,
      remoteEnabled: this.config.remoteEnabled,
      analyticsEnabled: this.config.analyticsEnabled
    };
  }
  
  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.reportedErrors.clear();
    this.logDebug('Error history cleared');
  }
}

// Create singleton instance
const errorReportingService = new ErrorReportingService();

// Initialize the service
errorReportingService.initialize();

export default errorReportingService; 