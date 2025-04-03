// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import React from 'react';
import registry from '../ModuleRegistry';
import APP_SETTINGS from '../config/app-settings';

/**
 * ErrorHandler provides centralized error handling, logging, reporting,
 * and recovery mechanisms for the application.
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrorCount = 100;
    this.recoveryStrategies = new Map();
    this.errorListeners = new Set();
    this.fatalErrorListeners = new Set();
    this.isDebugMode = process.env.NODE_ENV === 'development';
    this.enableStackTraces = true;
    this.sentryEnabled = false;
    this.eventBus = null;
    
    // Default recovery strategies
    this.initializeRecoveryStrategies();
  }
  
  /**
   * Initialize the error handler
   */
  initialize() {
    this.eventBus = registry.getModule('utils.EventBus');
    
    // Register for global error events
    this.attachGlobalErrorHandlers();
    
    // Log initialization
    console.log('ErrorHandler initialized');
    
    if (this.eventBus) {
      this.eventBus.publish('system:errorHandlerInitialized');
    }
  }
  
  /**
   * Initialize default recovery strategies
   * @private
   */
  initializeRecoveryStrategies() {
    // WebGL context loss recovery
    this.registerRecoveryStrategy('webglcontextlost', async (error, context) => {
      const { renderer } = context;
      console.warn('WebGL context lost, attempting to restore...');
      
      // Wait for context restoration
      if (renderer && renderer.domElement) {
        return new Promise((resolve) => {
          const handleContextRestored = () => {
            renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
            console.log('WebGL context restored');
            resolve(true);
          };
          
          renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
            console.error('WebGL context restoration timed out');
            resolve(false);
          }, 5000);
        });
      }
      
      return false;
    });
    
    // Scene rendering failure recovery
    this.registerRecoveryStrategy('renderingFailure', async (error, context) => {
      const { sceneManager, visualizationManager } = context;
      
      console.warn('Rendering failure, attempting to recover by rebuilding the scene...');
      
      try {
        // Stop rendering loop
        if (sceneManager) sceneManager.stopRenderLoop();
        
        // Clear the scene
        if (sceneManager) sceneManager.clearScene();
        
        // Reload visualization if possible
        if (visualizationManager) {
          await visualizationManager.reloadVisualization();
          return true;
        }
        
        return false;
      } catch (recoveryError) {
        console.error('Failed to recover from rendering failure:', recoveryError);
        return false;
      }
    });
    
    // Data loading failure recovery
    this.registerRecoveryStrategy('dataLoadingFailure', async (error, context) => {
      const { dataService, retryCount = 0 } = context;
      
      // Only retry a few times
      if (retryCount >= 3) {
        console.error('Data loading failed after 3 retries');
        return false;
      }
      
      console.warn(`Data loading failure, retry attempt ${retryCount + 1}...`);
      
      try {
        // Retry with a slight delay
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        
        if (dataService) {
          await dataService.loadData({
            forceRefresh: true,
            ignoreCache: true
          });
          return true;
        }
        
        return false;
      } catch (retryError) {
        // Try one more time with updated context
        return this.applyRecoveryStrategy('dataLoadingFailure', retryError, {
          ...context,
          retryCount: retryCount + 1
        });
      }
    });
    
    // Memory pressure recovery
    this.registerRecoveryStrategy('memoryPressure', async (error, context) => {
      const { renderer, sceneManager } = context;
      
      console.warn('Memory pressure detected, cleaning up resources...');
      
      try {
        // Force garbage collection if possible (only works in some environments)
        if (window.gc) window.gc();
        
        // Clear texture and geometry caches
        if (renderer) {
          // THREE.js-specific memory cleanup for textures
          renderer.renderLists.dispose();
          
          // Dispose of any info.memory references
          if (renderer.info && renderer.info.memory) {
            const memory = renderer.info.memory;
            for (const texture of memory.textures || []) {
              if (texture && texture.dispose) texture.dispose();
            }
            
            for (const geometry of memory.geometries || []) {
              if (geometry && geometry.dispose) geometry.dispose();
            }
          }
        }
        
        // Clear the scene and rebuild
        if (sceneManager) {
          sceneManager.clearScene();
        }
        
        // Request a more aggressive GC run in a few seconds
        setTimeout(() => {
          if (window.gc) window.gc();
        }, 3000);
        
        return true;
      } catch (cleanupError) {
        console.error('Failed to recover from memory pressure:', cleanupError);
        return false;
      }
    });
  }
  
  /**
   * Attach global error handlers
   * @private
   */
  attachGlobalErrorHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(event.reason, {
        type: 'unhandledRejection',
        message: event.reason?.message || 'Unhandled Promise Rejection'
      });
    });
    
    // Global errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error, {
        type: 'globalError',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    // Listen for WebGL context loss
    document.addEventListener('webglcontextlost', (event) => {
      // Prevent the default behavior of automatically resuming on context lost
      event.preventDefault();
      
      this.handleError(new Error('WebGL context lost'), {
        type: 'webglcontextlost',
        originalEvent: event
      });
    });
  }
  
  /**
   * Capture and log an error
   * @param {Error} error - Error object
   * @param {Object} context - Additional context for the error
   * @returns {string} Error ID
   */
  captureError(error, context = {}) {
    // Create error object with metadata
    const errorObject = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      message: error?.message || String(error),
      stack: this.enableStackTraces ? (error?.stack || new Error().stack) : null,
      context: { ...context },
      handled: false,
      recoveryStatus: null
    };
    
    // Log the error
    this.logError(errorObject);
    
    // Store the error
    this.errors.unshift(errorObject);
    
    // Trim error list if needed
    if (this.errors.length > this.maxErrorCount) {
      this.errors = this.errors.slice(0, this.maxErrorCount);
    }
    
    // Attempt recovery based on error type
    this.attemptRecovery(errorObject);
    
    // Notify error listeners
    this.notifyErrorListeners(errorObject);
    
    // Return error ID for reference
    return errorObject.id;
  }
  
  /**
   * Log an error to the console and external services
   * @param {Object} errorObject - Error object
   * @private
   */
  logError(errorObject) {
    // Always log to console
    console.error(
      `[Error ${errorObject.id}] ${errorObject.message}`,
      errorObject.context,
      errorObject.stack
    );
    
    // Log to event bus if available
    if (this.eventBus) {
      this.eventBus.publish('error:captured', {
        id: errorObject.id,
        message: errorObject.message,
        context: errorObject.context,
        stack: this.isDebugMode ? errorObject.stack : undefined
      });
    }
    
    // Log to Sentry or other external services if enabled
    if (this.sentryEnabled && window.Sentry) {
      try {
        window.Sentry.captureException(new Error(errorObject.message), {
          extra: errorObject.context
        });
      } catch (sentryError) {
        console.error('Failed to log to Sentry:', sentryError);
      }
    }
  }
  
  /**
   * Generate a unique error ID
   * @returns {string} Unique error ID
   * @private
   */
  generateErrorId() {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
  }
  
  /**
   * Attempt to recover from an error using registered strategies
   * @param {Object} errorObject - Error object
   * @private
   */
  async attemptRecovery(errorObject) {
    // Determine error type from context
    const errorType = errorObject.context?.type || 'unknown';
    
    // Check if we have a recovery strategy for this type
    if (this.recoveryStrategies.has(errorType)) {
      const recoveryStrategy = this.recoveryStrategies.get(errorType);
      
      try {
        // Apply recovery strategy
        const recoverySuccess = await recoveryStrategy(errorObject, errorObject.context);
        
        // Update error with recovery status
        errorObject.handled = true;
        errorObject.recoveryStatus = recoverySuccess ? 'success' : 'failed';
        
        // Log recovery attempt
        if (recoverySuccess) {
          console.log(`Successfully recovered from error ${errorObject.id} (${errorType})`);
          
          if (this.eventBus) {
            this.eventBus.publish('error:recovered', {
              id: errorObject.id,
              type: errorType
            });
          }
        } else {
          console.warn(`Failed to recover from error ${errorObject.id} (${errorType})`);
          
          if (this.eventBus) {
            this.eventBus.publish('error:recoveryFailed', {
              id: errorObject.id,
              type: errorType
            });
          }
          
          // Notify fatal error listeners if recovery failed
          if (this.isFatalErrorType(errorType)) {
            this.notifyFatalErrorListeners(errorObject);
          }
        }
      } catch (recoveryError) {
        // Recovery strategy itself failed
        console.error(`Error recovery failed for ${errorObject.id}:`, recoveryError);
        
        errorObject.handled = true;
        errorObject.recoveryStatus = 'error';
        errorObject.recoveryError = recoveryError.message;
        
        if (this.eventBus) {
          this.eventBus.publish('error:recoveryError', {
            id: errorObject.id,
            type: errorType,
            recoveryError: recoveryError.message
          });
        }
        
        // Notify fatal error listeners
        if (this.isFatalErrorType(errorType)) {
          this.notifyFatalErrorListeners(errorObject);
        }
      }
    } else {
      // No recovery strategy found
      errorObject.handled = false;
      
      // For debug mode, log missing recovery strategy
      if (this.isDebugMode) {
        console.warn(`No recovery strategy for error type: ${errorType}`);
      }
      
      // Check if this is a fatal error type
      if (this.isFatalErrorType(errorType)) {
        this.notifyFatalErrorListeners(errorObject);
      }
    }
  }
  
  /**
   * Check if an error type is considered fatal
   * @param {string} errorType - Type of error
   * @returns {boolean} Whether the error is fatal
   * @private
   */
  isFatalErrorType(errorType) {
    const fatalTypes = [
      'webglcontextlost',
      'renderingFailure',
      'initializationFailure',
      'fatalError'
    ];
    
    return fatalTypes.includes(errorType);
  }
  
  /**
   * Register a recovery strategy for a specific error type
   * @param {string} errorType - Type of error
   * @param {Function} strategy - Recovery strategy function
   */
  registerRecoveryStrategy(errorType, strategy) {
    if (typeof strategy !== 'function') {
      throw new Error('Recovery strategy must be a function');
    }
    
    this.recoveryStrategies.set(errorType, strategy);
    
    if (this.isDebugMode) {
      console.log(`Registered recovery strategy for error type: ${errorType}`);
    }
  }
  
  /**
   * Apply a recovery strategy manually
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Promise<boolean>} Whether recovery was successful
   */
  async applyRecoveryStrategy(errorType, error, context = {}) {
    if (!this.recoveryStrategies.has(errorType)) {
      console.warn(`No recovery strategy found for: ${errorType}`);
      return false;
    }
    
    const strategy = this.recoveryStrategies.get(errorType);
    
    try {
      return await strategy(error, context);
    } catch (recoveryError) {
      console.error(`Recovery strategy execution failed for ${errorType}:`, recoveryError);
      return false;
    }
  }
  
  /**
   * Handle an error with context and attempt recovery
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {string} Error ID
   */
  handleError(error, context = {}) {
    // Capture the error
    const errorId = this.captureError(error, context);
    
    return errorId;
  }
  
  /**
   * Add an error listener
   * @param {Function} listener - Error listener function
   */
  addErrorListener(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Error listener must be a function');
    }
    
    this.errorListeners.add(listener);
  }
  
  /**
   * Remove an error listener
   * @param {Function} listener - Error listener function
   */
  removeErrorListener(listener) {
    this.errorListeners.delete(listener);
  }
  
  /**
   * Add a fatal error listener
   * @param {Function} listener - Fatal error listener function
   */
  addFatalErrorListener(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Fatal error listener must be a function');
    }
    
    this.fatalErrorListeners.add(listener);
  }
  
  /**
   * Remove a fatal error listener
   * @param {Function} listener - Fatal error listener function
   */
  removeFatalErrorListener(listener) {
    this.fatalErrorListeners.delete(listener);
  }
  
  /**
   * Notify all error listeners
   * @param {Object} errorObject - Error object
   * @private
   */
  notifyErrorListeners(errorObject) {
    this.errorListeners.forEach(listener => {
      try {
        listener(errorObject);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }
  
  /**
   * Notify all fatal error listeners
   * @param {Object} errorObject - Error object
   * @private
   */
  notifyFatalErrorListeners(errorObject) {
    this.fatalErrorListeners.forEach(listener => {
      try {
        listener(errorObject);
      } catch (listenerError) {
        console.error('Error in fatal error listener:', listenerError);
      }
    });
    
    // Also publish to event bus
    if (this.eventBus) {
      this.eventBus.publish('error:fatal', {
        id: errorObject.id,
        message: errorObject.message,
        type: errorObject.context?.type || 'unknown',
        recoveryStatus: errorObject.recoveryStatus
      });
    }
  }
  
  /**
   * Get all recent errors
   * @param {number} count - Number of errors to retrieve
   * @returns {Array} Recent errors
   */
  getRecentErrors(count = this.maxErrorCount) {
    return this.errors.slice(0, count);
  }
  
  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = [];
    
    if (this.isDebugMode) {
      console.log('Error history cleared');
    }
  }
  
  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether debug mode should be enabled
   */
  setDebugMode(enabled) {
    this.isDebugMode = enabled;
    
    if (this.isDebugMode) {
      console.log('ErrorHandler debug mode enabled');
    }
  }
  
  /**
   * Enable or disable stack traces
   * @param {boolean} enabled - Whether stack traces should be stored and sent
   */
  setStackTracesEnabled(enabled) {
    this.enableStackTraces = enabled;
  }
  
  /**
   * Create an error with additional data
   * @param {string} message - Error message
   * @param {string} type - Error type
   * @param {string} code - Error code
   * @param {Object} data - Additional error data
   * @returns {Error} Enhanced error object
   */
  createError(message, type = 'Error', code = 'UNKNOWN', data = {}) {
    const error = new Error(message);
    error.type = type;
    error.code = code;
    error.data = data;
    return error;
  }
  
  /**
   * Create a fatal error that will trigger fatal error handling
   * @param {string} message - Error message
   * @param {Object} data - Additional error data
   * @returns {Error} Fatal error object
   */
  createFatalError(message, data = {}) {
    const error = this.createError(message, 'FatalError', 'FATAL', data);
    
    // Immediately handle the error
    this.handleError(error, {
      type: 'fatalError',
      ...data
    });
    
    return error;
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Register with ModuleRegistry
export default registry.register(
  'utils.ErrorHandler',
  errorHandler,
  [],
  {
    description: 'Centralized error handling, logging, and recovery system',
    singleton: true
  }
);

