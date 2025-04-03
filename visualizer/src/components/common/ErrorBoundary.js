import React, { Component } from 'react';
import registry from '../../ModuleRegistry';

/**
 * Error Boundary component that catches errors in child component trees
 * and displays a fallback UI instead of crashing the entire application.
 * 
 * Features:
 * - Catches errors in component rendering and lifecycle methods
 * - Provides fallback UI with error details
 * - Reports errors to error handler service
 * - Supports retry functionality
 * - Configurable fallback component
 * - Isolates errors to specific component trees
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }
  
  /**
   * Update state when errors are caught
   * @param {Error} error - The error that was thrown
   * @returns {Object} - Updated state object
   */
  static getDerivedStateFromError(error) {
    // Update state to trigger fallback UI rendering
    return { hasError: true, error };
  }
  
  /**
   * Lifecycle method called when an error is caught
   * @param {Error} error - The error that was thrown
   * @param {Object} errorInfo - React component stack information
   */
  componentDidCatch(error, errorInfo) {
    // Store component stack info for debugging
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error caught by ErrorBoundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
    
    // Report to error handler if available
    const errorHandler = registry.get('utils.ErrorHandler');
    if (errorHandler) {
      errorHandler.handleError(error, {
        type: 'reactError',
        componentStack: errorInfo.componentStack,
        component: this.props.componentName || 'unknown',
        retryCount: this.state.errorCount
      });
    }
    
    // Call onError prop if provided
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo, this.state.errorCount);
    }
  }
  
  /**
   * Reset error state to attempt recovery
   */
  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null
    });
    
    // Call onRetry prop if provided
    if (typeof this.props.onRetry === 'function') {
      this.props.onRetry(this.state.errorCount);
    }
  };
  
  render() {
    const { hasError, error, errorInfo, errorCount } = this.state;
    const { 
      children, 
      fallback, 
      fallbackComponent: FallbackComponent,
      maxRetries = 3
    } = this.props;
    
    // If there's no error, render children normally
    if (!hasError) {
      return children;
    }
    
    // Check if we've exceeded the retry limit
    const canRetry = errorCount < maxRetries;
    
    // Use custom fallback component if provided
    if (FallbackComponent) {
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          errorCount={errorCount}
          canRetry={canRetry}
          onRetry={this.handleRetry}
        />
      );
    }
    
    // Use custom fallback render prop if provided
    if (typeof fallback === 'function') {
      return fallback({
        error,
        errorInfo,
        errorCount,
        canRetry,
        onRetry: this.handleRetry
      });
    }
    
    // Default fallback UI
    return (
      <div className="error-boundary-fallback">
        <h2>Something went wrong</h2>
        <p className="error-message">
          {error?.message || 'An unexpected error occurred'}
        </p>
        {process.env.NODE_ENV !== 'production' && errorInfo && (
          <details className="error-details">
            <summary>Component Stack</summary>
            <pre>{errorInfo.componentStack}</pre>
          </details>
        )}
        {canRetry && (
          <button onClick={this.handleRetry} className="retry-button">
            Try Again
          </button>
        )}
        {!canRetry && (
          <p className="retry-limit-message">
            Too many errors occurred. Please reload the page.
          </p>
        )}
      </div>
    );
  }
}

// Register component with ModuleRegistry
registry.register(
  'components.common.ErrorBoundary',
  ErrorBoundary,
  ['utils.ErrorHandler'],
  {
    description: 'React error boundary for component error isolation',
    provides: ['errorIsolation', 'errorFallback']
  }
);

export default ErrorBoundary; 