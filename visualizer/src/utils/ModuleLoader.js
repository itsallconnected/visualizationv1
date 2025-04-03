import React, { lazy, Suspense, useState, useEffect } from 'react';
import registry from '../ModuleRegistry';

/**
 * ModuleLoader provides dynamic and lazy loading capabilities for application modules.
 * It handles module loading, caching, error recovery, and loading state management.
 * 
 * Features:
 * - Lazy loading of modules with React.lazy
 * - Loading state management
 * - Error boundaries for module loading failures
 * - Retry mechanisms for failed loads
 * - Cache for faster repeat access
 */
class ModuleLoader {
  constructor() {
    this.moduleCache = new Map();
    this.loadingStates = new Map();
    this.errorStates = new Map();
    this.retryOptions = {
      maxRetries: 3,
      retryDelay: 1000, // ms
      backoffFactor: 1.5,
    };
  }

  /**
   * Initialize the module loader
   */
  initialize() {
    // Register with ModuleRegistry
    registry.register(
      'utils.ModuleLoader', 
      this,
      ['utils.ErrorHandler', 'utils.EventBus'],
      {
        description: 'Dynamic module loading utility',
        provides: ['dynamicLoading', 'lazyLoading', 'retryMechanisms']
      }
    );
    
    // Try to get error handler and event bus
    const errorHandler = registry.get('utils.ErrorHandler');
    const eventBus = registry.get('utils.EventBus');
    
    if (errorHandler) {
      this.errorHandler = errorHandler;
    }
    
    if (eventBus) {
      this.eventBus = eventBus;
      this.eventBus.subscribe('module:loaded', this.handleModuleLoaded.bind(this));
      this.eventBus.subscribe('module:load-error', this.handleModuleLoadError.bind(this));
    }
  }

  /**
   * Load a module dynamically
   * @param {string} modulePath - Path to the module
   * @param {Object} options - Loading options
   * @returns {Promise<any>} - Promise resolving to the loaded module
   */
  async loadModule(modulePath, options = {}) {
    // Set default options
    const opts = {
      lazy: true,
      retryOnError: true,
      ...options
    };
    
    // Check if module is already cached
    if (this.moduleCache.has(modulePath)) {
      return this.moduleCache.get(modulePath);
    }
    
    // Update loading state
    this.setLoadingState(modulePath, true);
    this.clearErrorState(modulePath);

    try {
      // Dynamic import
      const importedModule = await this.importModule(modulePath, opts);
      
      // Cache the module
      this.moduleCache.set(modulePath, importedModule);
      
      // Clear loading state
      this.setLoadingState(modulePath, false);
      
      // Notify success
      if (this.eventBus) {
        this.eventBus.publish('module:loaded', { modulePath });
      }
      
      return importedModule;
    } catch (error) {
      // Set error state
      this.setErrorState(modulePath, error);
      
      // Clear loading state
      this.setLoadingState(modulePath, false);
      
      // Log the error
      if (this.errorHandler) {
        this.errorHandler.handleError(error, {
          type: 'moduleLoadFailure',
          modulePath,
          attempt: options.retryCount || 1
        });
      } else {
        console.error(`Failed to load module at ${modulePath}:`, error);
      }
      
      // Notify error
      if (this.eventBus) {
        this.eventBus.publish('module:load-error', { 
          modulePath, 
          error,
          retryCount: options.retryCount || 1
        });
      }
      
      // Retry if enabled
      if (opts.retryOnError && (!options.retryCount || options.retryCount < this.retryOptions.maxRetries)) {
        const retryCount = (options.retryCount || 0) + 1;
        const delay = this.retryOptions.retryDelay * Math.pow(this.retryOptions.backoffFactor, retryCount - 1);
        
        // Log retry attempt
        console.log(`Retrying module load for ${modulePath} in ${delay}ms (attempt ${retryCount})`);
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            this.loadModule(modulePath, { ...options, retryCount })
              .then(resolve)
              .catch(reject);
          }, delay);
        });
      }
      
      throw error;
    }
  }

  /**
   * Import a module dynamically
   * @param {string} modulePath - Path to the module
   * @param {Object} options - Import options
   * @returns {Promise<any>} - Promise resolving to the imported module
   */
  async importModule(modulePath, options) {
    // This function would be adjusted based on the actual module structure
    // Here's a simple implementation that will need customization:
    try {
      // For direct imports (web pack dynamic import format)
      const module = await import(/* webpackChunkName: "[request]" */ `../${modulePath}`);
      return module.default || module;
    } catch (error) {
      console.error(`Error importing module at ${modulePath}:`, error);
      throw error;
    }
  }

  /**
   * Create a lazy-loaded React component for a module
   * @param {string} modulePath - Path to the component module
   * @param {Object} options - Options for lazy loading
   * @returns {React.LazyExoticComponent} - Lazy-loaded component
   */
  createLazyComponent(modulePath, options = {}) {
    // Create a lazy component
    const LazyComponent = lazy(() => {
      // Track loading state
      this.setLoadingState(modulePath, true);
      this.clearErrorState(modulePath);
      
      return import(/* webpackChunkName: "[request]" */ `../${modulePath}`)
        .then(module => {
          // Success
          this.setLoadingState(modulePath, false);
          
          // Cache the module
          const component = module.default || module;
          this.moduleCache.set(modulePath, component);
          
          // Notify success
          if (this.eventBus) {
            this.eventBus.publish('module:loaded', { modulePath });
          }
          
          return module;
        })
        .catch(error => {
          // Failure
          this.setLoadingState(modulePath, false);
          this.setErrorState(modulePath, error);
          
          // Log the error
          if (this.errorHandler) {
            this.errorHandler.handleError(error, {
              type: 'componentLoadFailure',
              modulePath
            });
          } else {
            console.error(`Failed to load component at ${modulePath}:`, error);
          }
          
          // Notify error
          if (this.eventBus) {
            this.eventBus.publish('module:load-error', { modulePath, error });
          }
          
          throw error;
        });
    });
    
    // Create a component that wraps the lazy component with loading and error states
    return props => (
      <ModuleErrorBoundary modulePath={modulePath} onRetry={() => this.clearCache(modulePath)}>
        <Suspense fallback={this.renderLoadingState(modulePath, options)}>
          <LazyComponent {...props} />
        </Suspense>
      </ModuleErrorBoundary>
    );
  }

  /**
   * Render the loading state for a module
   * @param {string} modulePath - Path to the module
   * @param {Object} options - Loading options
   * @returns {JSX.Element} - Loading state component
   */
  renderLoadingState(modulePath, options = {}) {
    // Default loading component
    const defaultLoading = <div className="module-loading">Loading module...</div>;
    
    // Use custom loading component if provided
    if (options.loadingComponent) {
      return options.loadingComponent;
    }
    
    return defaultLoading;
  }

  /**
   * Clear the module cache
   * @param {string} modulePath - Path to the module (optional, clears all if not provided)
   */
  clearCache(modulePath) {
    if (modulePath) {
      this.moduleCache.delete(modulePath);
      this.loadingStates.delete(modulePath);
      this.errorStates.delete(modulePath);
    } else {
      this.moduleCache.clear();
      this.loadingStates.clear();
      this.errorStates.clear();
    }
  }

  /**
   * Get the loading state for a module
   * @param {string} modulePath - Path to the module
   * @returns {boolean} - True if the module is loading
   */
  isLoading(modulePath) {
    return this.loadingStates.get(modulePath) || false;
  }

  /**
   * Set the loading state for a module
   * @param {string} modulePath - Path to the module
   * @param {boolean} isLoading - Loading state
   */
  setLoadingState(modulePath, isLoading) {
    this.loadingStates.set(modulePath, isLoading);
  }

  /**
   * Get the error state for a module
   * @param {string} modulePath - Path to the module
   * @returns {Error|null} - Error object or null if no error
   */
  getErrorState(modulePath) {
    return this.errorStates.get(modulePath) || null;
  }

  /**
   * Set the error state for a module
   * @param {string} modulePath - Path to the module
   * @param {Error} error - Error object
   */
  setErrorState(modulePath, error) {
    this.errorStates.set(modulePath, error);
  }

  /**
   * Clear the error state for a module
   * @param {string} modulePath - Path to the module
   */
  clearErrorState(modulePath) {
    this.errorStates.delete(modulePath);
  }

  /**
   * Configure retry options
   * @param {Object} options - Retry options
   */
  configureRetry(options = {}) {
    this.retryOptions = {
      ...this.retryOptions,
      ...options,
    };
  }

  /**
   * Event handler for module loaded event
   * @param {Object} data - Event data
   */
  handleModuleLoaded(data) {
    // Implementation can be extended based on requirements
    console.log(`Module loaded: ${data.modulePath}`);
  }

  /**
   * Event handler for module load error event
   * @param {Object} data - Event data
   */
  handleModuleLoadError(data) {
    // Implementation can be extended based on requirements
    console.error(`Module load error: ${data.modulePath}`, data.error);
  }
}

/**
 * Error boundary component for module loading errors
 */
class ModuleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error
    const errorHandler = registry.get('utils.ErrorHandler');
    if (errorHandler) {
      errorHandler.handleError(error, {
        type: 'moduleErrorBoundary',
        modulePath: this.props.modulePath,
        errorInfo
      });
    } else {
      console.error(`Error loading module ${this.props.modulePath}:`, error, errorInfo);
    }
  }

  handleRetry = () => {
    // Call retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    
    // Reset error state
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      // Render error UI
      return (
        <div className="module-error">
          <h3>Failed to load module</h3>
          <p>{this.state.error?.message || 'An error occurred while loading this module.'}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Create a singleton instance
const moduleLoader = new ModuleLoader();

// Export the singleton
export default moduleLoader; 