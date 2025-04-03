import React, { Component } from 'react';
import registry from '../ModuleRegistry';
import ErrorDisplay from './ErrorDisplay';

/**
 * ErrorBoundary component catches JavaScript errors anywhere in its child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the whole application.
 * 
 * This component works with the application's central ErrorHandler for consistent error handling.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      recovered: false
    };
    
    // Get the error handler instance - may be null if not yet registered
    this.errorHandler = registry.get('utils.ErrorHandler');
  }
  
  /**
   * Update state when an error occurs
   * 
   * @static
   * @param {Error} error - The error that was thrown
   * @returns {Object} Updated state object
   */
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  /**
   * Catch and handle the error
   * 
   * @param {Error} error - The error that was thrown
   * @param {Object} errorInfo - React component stack information
   */
  componentDidCatch(error, errorInfo) {
    // Log the error through the central error handler if available
    let errorId = null;
    
    // Try to get the error handler again if it wasn't available during construction
    if (!this.errorHandler) {
      this.errorHandler = registry.get('utils.ErrorHandler');
    }
    
    if (this.errorHandler) {
      errorId = this.errorHandler.handleError(error, {
        type: 'reactError',
        componentStack: errorInfo.componentStack,
        component: this.props.componentName || 'Unknown',
        isFatal: this.props.isFatal || false
      });
      
      // Register a recovery listener
      if (this.props.onRecoveryAttempt) {
        this.errorHandler.addErrorListener((errorObj) => {
          if (errorObj.id === errorId && 
              errorObj.recoveryStatus === 'success' && 
              this.props.onRecoveryAttempt) {
            this.setState({ recovered: true });
            this.props.onRecoveryAttempt(errorObj);
          }
        });
      }
    } else {
      // Fallback to console if error handler is not available
      console.error('React Error Boundary caught an error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
    }
    
    // Update state with detailed error information
    this.setState({
      error,
      errorInfo,
      errorId
    });
    
    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }
  }
  
  /**
   * Try to recover from the error
   */
  handleRetry = () => {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    
    // Reset the error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      recovered: false
    });
  };
  
  render() {
    const { hasError, error, recovered } = this.state;
    
    // Return children if no error or if recovered
    if (!hasError || recovered) {
      return this.props.children;
    }
    
    // Use custom fallback component if provided
    if (this.props.fallback) {
      return React.cloneElement(this.props.fallback, {
        error,
        onRetry: this.handleRetry
      });
    }
    
    // Use default error display
    return (
      <ErrorDisplay 
        error={error}
        componentName={this.props.componentName || 'Component'}
        onRetry={this.handleRetry}
        showDetails={this.props.showErrorDetails !== false}
      />
    );
  }
}

// Register with ModuleRegistry
export default registry.register(
  'components.ErrorBoundary',
  ErrorBoundary,
  ['utils.ErrorHandler'],
  {
    description: 'React error boundary component for catching and displaying component errors',
    usage: 'Wrap components to catch and handle rendering errors gracefully'
  }
); 