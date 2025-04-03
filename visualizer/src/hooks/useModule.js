import { useState, useEffect, useContext, createContext, useRef, useMemo } from 'react';
import registry from '../ModuleRegistry';

/**
 * Context for providing module registry access to components
 */
const ModuleContext = createContext({
  registry: null,
  loadingModules: new Set(),
  errorModules: new Map(),
});

/**
 * Provider component for ModuleContext
 */
export const ModuleProvider = ({ children }) => {
  // Track loading and error states
  const [loadingModules, setLoadingModules] = useState(new Set());
  const [errorModules, setErrorModules] = useState(new Map());
  
  // Listen for module events
  useEffect(() => {
    const eventBus = registry.get('utils.EventBus');
    if (!eventBus) return;
    
    // Handler for module loading events
    const handleModuleLoading = ({ moduleName }) => {
      setLoadingModules(prev => {
        const next = new Set(prev);
        next.add(moduleName);
        return next;
      });
    };
    
    // Handler for module loaded events
    const handleModuleLoaded = ({ moduleName }) => {
      setLoadingModules(prev => {
        const next = new Set(prev);
        next.delete(moduleName);
        return next;
      });
      
      setErrorModules(prev => {
        const next = new Map(prev);
        next.delete(moduleName);
        return next;
      });
    };
    
    // Handler for module load error events
    const handleModuleError = ({ moduleName, error }) => {
      setLoadingModules(prev => {
        const next = new Set(prev);
        next.delete(moduleName);
        return next;
      });
      
      setErrorModules(prev => {
        const next = new Map(prev);
        next.set(moduleName, error);
        return next;
      });
    };
    
    // Subscribe to events
    eventBus.subscribe('module:loading', handleModuleLoading);
    eventBus.subscribe('module:loaded', handleModuleLoaded);
    eventBus.subscribe('module:error', handleModuleError);
    
    // Cleanup subscriptions
    return () => {
      eventBus.unsubscribe('module:loading', handleModuleLoading);
      eventBus.unsubscribe('module:loaded', handleModuleLoaded);
      eventBus.unsubscribe('module:error', handleModuleError);
    };
  }, []);
  
  // Create context value
  const contextValue = useMemo(() => ({
    registry,
    loadingModules,
    errorModules,
  }), [loadingModules, errorModules]);
  
  return (
    <ModuleContext.Provider value={contextValue}>
      {children}
    </ModuleContext.Provider>
  );
};

/**
 * Hook for accessing modules from the registry
 * 
 * @param {string} moduleName - Name of the module to access
 * @param {Object} options - Options for module access
 * @returns {Object} - Module access result with module, loading state, and error
 */
const useModule = (moduleName, options = {}) => {
  // Default options
  const opts = {
    required: false,
    fallback: null,
    onLoad: null,
    onError: null,
    ...options,
  };
  
  // Get context values
  const { registry, loadingModules, errorModules } = useContext(ModuleContext);
  
  // Local state for this specific module
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [module, setModule] = useState(null);
  
  // Use refs for callback functions to avoid unnecessary effects
  const onLoadRef = useRef(opts.onLoad);
  const onErrorRef = useRef(opts.onError);
  
  // Update refs when callbacks change
  useEffect(() => {
    onLoadRef.current = opts.onLoad;
    onErrorRef.current = opts.onError;
  }, [opts.onLoad, opts.onError]);
  
  // Get if the module is loading
  const isLoading = useMemo(() => {
    return localLoading || loadingModules.has(moduleName);
  }, [localLoading, loadingModules, moduleName]);
  
  // Get error if any
  const error = useMemo(() => {
    return localError || errorModules.get(moduleName) || null;
  }, [localError, errorModules, moduleName]);
  
  // Attempt to load the module if not already loaded
  useEffect(() => {
    // If we already have the module, skip loading
    if (module) return;
    
    // Try to get the module from the registry
    const mod = registry.get(moduleName);
    if (mod) {
      setModule(mod);
      if (onLoadRef.current) {
        onLoadRef.current(mod);
      }
      return;
    }
    
    // If the module doesn't exist and isn't required, use fallback
    if (!opts.required) {
      if (opts.fallback !== undefined) {
        setModule(opts.fallback);
      }
      return;
    }
    
    // If the module doesn't exist but is required, try to load it
    const moduleLoader = registry.get('utils.ModuleLoader');
    if (!moduleLoader) {
      setLocalError(new Error('ModuleLoader not available'));
      if (onErrorRef.current) {
        onErrorRef.current(new Error('ModuleLoader not available'));
      }
      return;
    }
    
    // Set loading state
    setLocalLoading(true);
    
    // Try to load the module
    moduleLoader.loadModule(`modules/${moduleName}`)
      .then(loadedModule => {
        setModule(loadedModule);
        setLocalLoading(false);
        setLocalError(null);
        if (onLoadRef.current) {
          onLoadRef.current(loadedModule);
        }
      })
      .catch(err => {
        setLocalLoading(false);
        setLocalError(err);
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
      });
    
  }, [moduleName, opts.required, opts.fallback, module]);
  
  // Create a cached result object
  const result = useMemo(() => ({
    module,
    loading: isLoading,
    error,
    available: !!module,
  }), [module, isLoading, error]);
  
  return result;
};

// Register the hook with the registry
registry.register(
  'hooks.useModule',
  useModule,
  ['utils.ModuleLoader', 'utils.EventBus'],
  {
    description: 'React hook for accessing modules from the registry',
    provides: ['moduleAccess', 'reactIntegration']
  }
);

export default useModule; 