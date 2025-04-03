/**
 * @fileoverview
 * ModuleTypes.js defines the TypeScript/JSDoc interfaces for the module registry system.
 * These type definitions help ensure type safety and consistency across the application.
 * 
 * Note: Even though this file uses JSDoc for typing, it can be used with TypeScript
 * or with JavaScript tooling that supports JSDoc type annotations.
 */

/**
 * @typedef {Object} ModuleMetadata
 * @property {string} [description] - Description of the module's purpose and functionality
 * @property {string} [version] - Module version (semantic versioning recommended)
 * @property {string} [author] - Module author or team
 * @property {string} [category] - Category the module belongs to (e.g., 'ui', 'service', 'utility')
 * @property {string[]} [tags] - Tags for categorizing and searching modules
 * @property {string[]} [provides] - Capabilities provided by this module
 * @property {Object.<string, string>} [config] - Module-specific configuration values
 * @property {boolean} [deprecated] - Whether the module is deprecated
 * @property {string} [deprecationMessage] - Message explaining deprecation reason and migration path
 * @property {string} [registeredAt] - ISO date string when the module was registered
 */

/**
 * @typedef {Object} ModuleValidationResult
 * @property {boolean} valid - Whether the module is valid
 * @property {string[]} [missing] - Array of missing dependencies
 * @property {Object.<string, string>} [errors] - Validation errors by field
 * @property {Object.<string, string>} [warnings] - Validation warnings by field
 */

/**
 * @typedef {Object} ModuleRegistryValidationResult
 * @property {boolean} valid - Whether all modules are valid
 * @property {Object.<string, ModuleValidationResult>} moduleResults - Validation results by module
 */

/**
 * @typedef {Object} ModuleLoadOptions
 * @property {boolean} [lazy=true] - Whether to load the module lazily
 * @property {boolean} [retryOnError=true] - Whether to retry loading on error
 * @property {number} [retryCount] - Current retry count (internal use)
 * @property {number} [maxRetries=3] - Maximum number of retries
 * @property {number} [retryDelay=1000] - Delay between retries in milliseconds
 * @property {number} [backoffFactor=1.5] - Factor to increase delay between retries
 * @property {Function} [onLoad] - Callback for successful loading
 * @property {Function} [onError] - Callback for loading error
 */

/**
 * @typedef {Object} ModuleLoaderResult
 * @property {any} module - The loaded module or null if not loaded
 * @property {boolean} loading - Whether the module is currently loading
 * @property {Error|null} error - Error if loading failed, null otherwise
 * @property {boolean} available - Whether the module is available (loaded successfully)
 */

/**
 * @typedef {Object} ModuleInitializableInterface
 * @property {Function} initialize - Initialization function to be called when dependencies are ready
 */

/**
 * @typedef {Object} ModuleLifecycleHooks
 * @property {Function} [onRegister] - Called when the module is registered
 * @property {Function} [onInitialize] - Called when the module is initialized
 * @property {Function} [onLoad] - Called when the module is loaded
 * @property {Function} [onUnload] - Called when the module is unloaded
 * @property {Function} [onUpdate] - Called when the module is updated
 * @property {Function} [onEnabled] - Called when the module is enabled
 * @property {Function} [onDisabled] - Called when the module is disabled
 * @property {Function} [onError] - Called when an error occurs in the module
 */

/**
 * @typedef {Object} ModuleConfigSchema
 * @property {string} type - The configuration field type
 * @property {boolean} [required] - Whether the field is required
 * @property {any} [default] - Default value for the field
 * @property {string} [description] - Description of the configuration field
 * @property {Function} [validate] - Validation function for the field
 * @property {any[]} [enum] - Enumeration of allowed values
 * @property {number} [min] - Minimum value for numbers
 * @property {number} [max] - Maximum value for numbers
 * @property {string} [pattern] - Regular expression pattern for strings
 * @property {ModuleConfigSchema[]} [items] - Schema for array items
 * @property {Object.<string, ModuleConfigSchema>} [properties] - Schema for object properties
 */

/**
 * @typedef {Object} ModuleRegistryInterface
 * @property {Function} initialize - Initialize the registry
 * @property {Function} register - Register a module with the registry
 * @property {Function} getModule - Get a module by name
 * @property {Function} get - Safely get a module, returning null if not available
 * @property {Function} getAllModules - Get all registered modules
 * @property {Function} getDependencies - Get dependencies for a specific module
 * @property {Function} getMetadata - Get metadata for a specific module
 * @property {Function} discoverModules - Auto-discover all modules in the application
 * @property {Function} generateDependencyMap - Get a visual representation of module dependencies
 * @property {Function} findDependents - Find all modules that depend on a specific module
 * @property {Function} checkCircularDependencies - Check if a module is part of a circular dependency
 * @property {Function} getTopologicalSortedModules - Get a topologically sorted list of modules
 * @property {Function} validateDependencies - Check if all dependencies for a module are available
 * @property {Function} validateAllModules - Validate all registered modules
 */

/**
 * @typedef {Object} ModuleLoaderInterface
 * @property {Function} initialize - Initialize the module loader
 * @property {Function} loadModule - Load a module dynamically
 * @property {Function} importModule - Import a module dynamically
 * @property {Function} createLazyComponent - Create a lazy-loaded React component for a module
 * @property {Function} renderLoadingState - Render the loading state for a module
 * @property {Function} clearCache - Clear the module cache
 * @property {Function} isLoading - Get the loading state for a module
 * @property {Function} setLoadingState - Set the loading state for a module
 * @property {Function} getErrorState - Get the error state for a module
 * @property {Function} setErrorState - Set the error state for a module
 * @property {Function} clearErrorState - Clear the error state for a module
 * @property {Function} configureRetry - Configure retry options
 * @property {Function} handleModuleLoaded - Event handler for module loaded event
 * @property {Function} handleModuleLoadError - Event handler for module load error event
 */

/**
 * @typedef {Object} ModuleContextInterface
 * @property {ModuleRegistryInterface} registry - The module registry
 * @property {Set<string>} loadingModules - Set of currently loading module names
 * @property {Map<string, Error>} errorModules - Map of module names to errors
 */

/**
 * @typedef {Object} ModuleHookOptions
 * @property {boolean} [required=false] - Whether the module is required (will attempt to load if not found)
 * @property {any} [fallback=null] - Fallback value if module is not found and not required
 * @property {Function} [onLoad=null] - Callback function when module is loaded
 * @property {Function} [onError=null] - Callback function when module loading fails
 */

/**
 * @typedef {Object} ModuleHookResult
 * @property {any} module - The requested module or fallback value
 * @property {boolean} loading - Whether the module is currently loading
 * @property {Error|null} error - Error if loading failed, null otherwise
 * @property {boolean} available - Whether the module is available (loaded successfully)
 */

/**
 * @type {ModuleRegistryInterface}
 * Reference to the ModuleRegistry singleton
 */
const ModuleRegistry = {};

/**
 * @type {ModuleLoaderInterface}
 * Reference to the ModuleLoader singleton
 */
const ModuleLoader = {};

/**
 * @type {Function}
 * @param {string} moduleName - Name of the module to access
 * @param {ModuleHookOptions} [options] - Options for module access
 * @returns {ModuleHookResult} - Module access result with module, loading state, and error
 * Reference to the useModule hook function
 */
const useModule = function() {};

/**
 * @type {Object}
 * Exported type definitions for use in other modules
 */
const ModuleTypes = {
  // These don't actually exist at runtime, they're just for documentation
  ModuleMetadata: {}, 
  ModuleValidationResult: {}, 
  ModuleRegistryValidationResult: {},
  ModuleLoadOptions: {},
  ModuleLoaderResult: {},
  ModuleInitializableInterface: {},
  ModuleLifecycleHooks: {},
  ModuleConfigSchema: {},
  ModuleRegistryInterface: {},
  ModuleLoaderInterface: {},
  ModuleContextInterface: {},
  ModuleHookOptions: {},
  ModuleHookResult: {}
};

// Register with the module registry
import registry from '../ModuleRegistry';

registry.register(
  'types.ModuleTypes',
  ModuleTypes,
  [],
  {
    description: 'Type definitions for the module registry system',
    category: 'types',
    provides: ['typeDefinitions', 'documentation']
  }
);

export default ModuleTypes; 