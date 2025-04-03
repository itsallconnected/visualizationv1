import { useState, useCallback, useEffect } from 'react';
import registry from '../ModuleRegistry';

/**
 * Hook for error handling in React components
 * 
 * This hook provides easy access to error handling functionality including:
 * - Try/catch wrappers for async operations
 * - Error state management
 * - Integration with the central error handling system
 * - Error transformation and categorization
 * - Reset capabilities
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.source - Source component for error reporting
 * @param {boolean} options.captureRejections - Whether to auto-capture promise rejections
 * @param {Function} options.onError - Callback when errors occur
 * @param {boolean} options.reportErrors - Whether to report errors to error handler
 * @returns {Object} Error handling utilities
 */
const useErrorHandler = (options = {}) => {
  const {
    source = 'unknown',
    captureRejections = true,
    onError,
    reportErrors = true,
  } = options;
  
  // Local error state
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Get error handler from registry
  const errorHandler = registry.get('utils.ErrorHandler');
  const errorTypes = registry.get('utils.errors.ErrorTypes');
  
  // Reset error state
  const resetError = useCallback(() => {
    setError(null);
  }, []);
  
  // Handle errors
  const handleError = useCallback((err, context = {}) => {
    // Set local error state
    setError(err);
    setIsLoading(false);
    
    // Call onError callback if provided
    if (onError && typeof onError === 'function') {
      onError(err, context);
    }
    
    // Report to error handler if available and reporting is enabled
    if (errorHandler && reportErrors) {
      errorHandler.handleError(err, {
        source,
        ...context
      });
    } else if (!errorHandler && process.env.NODE_ENV !== 'production') {
      console.error(`Error in ${source}:`, err);
      console.error('Context:', context);
    }
    
    return err;
  }, [errorHandler, onError, reportErrors, source]);
  
  // Create a wrapped async function that catches errors
  const wrapAsync = useCallback((asyncFn, loadingState = true, errorContext = {}) => {
    return async (...args) => {
      try {
        if (loadingState) {
          setIsLoading(true);
        }
        resetError();
        const result = await asyncFn(...args);
        if (loadingState) {
          setIsLoading(false);
        }
        return result;
      } catch (err) {
        handleError(err, { ...errorContext, args });
        throw err; // Re-throw to allow further handling
      }
    };
  }, [handleError, resetError]);
  
  // Create specific error types
  const createError = useCallback((message, options = {}) => {
    if (errorTypes) {
      return errorTypes.createAppError(message, { source, ...options });
    } else {
      // Fallback if errorTypes is not available
      const error = new Error(message);
      error.data = options.data;
      error.code = options.code;
      error.source = source;
      return error;
    }
  }, [errorTypes, source]);
  
  // Set up rejection handling
  useEffect(() => {
    if (!captureRejections) return;
    
    const handleRejection = (event) => {
      handleError(event.reason, {
        type: 'unhandledRejection',
        source
      });
    };
    
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [captureRejections, handleError, source]);
  
  // Return the hook API
  return {
    // Current error state
    error,
    isLoading,
    hasError: error !== null,
    
    // Error management functions
    handleError,
    resetError,
    wrapAsync,
    createError,
    
    // Utility functions
    createApiError: useCallback((message, options) => {
      return errorTypes ? 
        errorTypes.createApiError(message, { source, ...options }) : 
        createError(message, { code: 'API_ERROR', ...options });
    }, [errorTypes, createError, source]),
    
    createValidationError: useCallback((message, options) => {
      return errorTypes ? 
        errorTypes.createValidationError(message, { source, ...options }) : 
        createError(message, { code: 'VALIDATION_ERROR', ...options });
    }, [errorTypes, createError, source]),
    
    // Try/catch helper for non-async functions
    tryCatch: useCallback((fn, errorContext = {}) => {
      try {
        return fn();
      } catch (err) {
        handleError(err, errorContext);
        return undefined;
      }
    }, [handleError])
  };
};

// Register with ModuleRegistry
registry.register(
  'hooks.useErrorHandler',
  useErrorHandler,
  ['utils.ErrorHandler', 'utils.errors.ErrorTypes'],
  {
    description: 'React hook for component-level error handling',
    provides: ['errorHandling', 'asyncErrorHandling', 'errorState']
  }
);

export default useErrorHandler; 