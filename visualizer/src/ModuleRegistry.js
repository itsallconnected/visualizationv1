import React from 'react';

/**
 * ModuleRegistry is a central registry for tracking all modules in the application.
 * It provides capabilities for:
 * - Manual registration of modules with their dependencies
 * - Automatic discovery of modules in the codebase
 * - Dependency tracking and visualization
 * - Module metadata and documentation
 */
class ModuleRegistry {
  constructor() {
    this.modules = {};
    this.dependencies = {};
    this.metadata = {};
    this._discoveredModules = null;
    this.initializedModules = new Set();
    this.initQueue = [];
    this.initializationInProgress = false;
    this.errorHandler = null;
    this.eventBus = null;
  }

  /**
   * Initialize the registry
   * This should be called after EventBus and ErrorHandler are available
   */
  initialize() {
    // Try to get core utilities if available
    try {
      this.errorHandler = this.getModule('utils.ErrorHandler');
      this.eventBus = this.getModule('utils.EventBus');
      
      if (this.eventBus) {
        this.eventBus.publish('registry:initialized');
      }
    } catch (error) {
      console.error('ModuleRegistry initialization error:', error);
    }
  }

  /**
   * Register a module with the registry
   * @param {string} name - The unique name of the module
   * @param {any} module - The module itself
   * @param {Array<string>} dependencies - Array of dependency module names
   * @param {Object} metadata - Optional metadata about the module
   * @returns {any} - Returns the module for chaining
   */
  register(name, module, dependencies = [], metadata = {}) {
    // Check for self-dependency
    if (dependencies.includes(name)) {
      console.warn(`Module ${name} depends on itself. Removing self-reference.`);
      dependencies = dependencies.filter(dep => dep !== name);
    }
    
    // Store the module
    this.modules[name] = module;
    this.dependencies[name] = dependencies;
    this.metadata[name] = {
      ...metadata,
      registeredAt: new Date().toISOString(),
    };
    
    // Reset cache
    this._discoveredModules = null;
    
    // Check if this creates or is part of a circular dependency
    if (this.checkCircularDependencies(name)) {
      console.warn(`Module ${name} creates circular dependencies. This may cause issues.`);
      
      if (this.eventBus) {
        this.eventBus.publish('registry:circularDependency', { module: name });
      }
    }
    
    // If this module has an initialize method, queue it for initialization
    if (module && typeof module.initialize === 'function') {
      this.queueForInitialization(name);
    }
    
    // Return the module for chaining
    return module;
  }

  /**
   * Queue a module for initialization and process the queue if not already in progress
   * @param {string} name - Module name
   */
  queueForInitialization(name) {
    // Skip if already initialized
    if (this.initializedModules.has(name)) {
      return;
    }
    
    // Add to queue if not already queued
    if (!this.initQueue.includes(name)) {
      this.initQueue.push(name);
    }
    
    // Start processing queue if not already in progress
    if (!this.initializationInProgress) {
      // Use a short timeout to allow for more modules to register
      setTimeout(() => this.processInitQueue(), 0);
    }
  }

  /**
   * Process the initialization queue, respecting dependencies
   */
  async processInitQueue() {
    if (this.initQueue.length === 0 || this.initializationInProgress) {
      return;
    }
    
    this.initializationInProgress = true;
    
    try {
      // Organize by dependency order
      const orderedModules = this.getTopologicalSortedModules()
        .filter(name => this.initQueue.includes(name));
      
      // Initialize modules in order
      for (const name of orderedModules) {
        // Skip already initialized
        if (this.initializedModules.has(name)) {
          continue;
        }
        
        const module = this.modules[name];
        
        if (module && typeof module.initialize === 'function') {
          try {
            // Check if its dependencies are initialized
            const deps = this.dependencies[name] || [];
            const uninitialized = deps.filter(dep => 
              !this.initializedModules.has(dep) && 
              this.modules[dep] && 
              typeof this.modules[dep].initialize === 'function'
            );
            
            if (uninitialized.length > 0) {
              // Skip for now, keep in queue
              continue;
            }
            
            // Initialize the module
            await module.initialize();
            
            // Mark as initialized
            this.initializedModules.add(name);
            
            // Remove from queue
            this.initQueue = this.initQueue.filter(item => item !== name);
            
            // Notify if eventBus is available
            if (this.eventBus) {
              this.eventBus.publish('registry:moduleInitialized', { module: name });
            }
          } catch (error) {
            console.error(`Error initializing module ${name}:`, error);
            
            // Log to error handler if available
            if (this.errorHandler) {
              this.errorHandler.handleError(error, {
                type: 'initializationFailure',
                module: name
              });
            }
            
            // Remove from queue to avoid blocking other modules
            this.initQueue = this.initQueue.filter(item => item !== name);
          }
        } else {
          // No initialize method, just mark as initialized
          this.initializedModules.add(name);
          this.initQueue = this.initQueue.filter(item => item !== name);
        }
      }
      
      // If we still have pending modules, try again
      if (this.initQueue.length > 0) {
        // There may be a circular dependency blocking initialization
        // or a dependency wasn't registered yet
        console.warn(
          `Module initialization incomplete. Remaining modules: ${this.initQueue.join(', ')}`
        );
        
        // Try again if we have pending modules (in case some dependencies were loaded after)
        setTimeout(() => {
          this.initializationInProgress = false;
          this.processInitQueue();
        }, 500);
      } else {
        this.initializationInProgress = false;
        
        // Initialization complete
        if (this.eventBus) {
          this.eventBus.publish('registry:initializationComplete');
        }
      }
    } catch (error) {
      console.error('Error processing initialization queue:', error);
      this.initializationInProgress = false;
      
      // Log to error handler if available
      if (this.errorHandler) {
        this.errorHandler.handleError(error, {
          type: 'registryFailure',
          queue: [...this.initQueue]
        });
      }
    }
  }

  /**
   * Get a module by name
   * @param {string} name - Module name
   * @returns {any} The requested module or undefined
   */
  getModule(name) {
    return this.modules[name];
  }

  /**
   * Safely get a module, returning null if not available
   * @param {string} name - Module name
   * @returns {any} The requested module or null
   */
  get(name) {
    return this.modules[name] || null;
  }

  /**
   * Get all registered modules
   * @returns {Object} All modules
   */
  getAllModules() {
    return this.modules;
  }

  /**
   * Get dependencies for a specific module
   * @param {string} name - Module name
   * @returns {Array<string>} Array of dependency names
   */
  getDependencies(name) {
    return this.dependencies[name] || [];
  }

  /**
   * Get metadata for a specific module
   * @param {string} name - Module name
   * @returns {Object} Module metadata
   */
  getMetadata(name) {
    return this.metadata[name] || {};
  }

  /**
   * Auto-discover all modules in the application
   * @returns {Object} Map of all discovered modules
   */
  discoverModules() {
    if (this._discoveredModules) {
      return this._discoveredModules;
    }

    // This uses webpack's require.context to automatically find module files
    const context = require.context('./', true, /\.js$/);
    
    const discoveredModules = {};
    context.keys().forEach(key => {
      // Skip index files, test files, and the registry itself
      if (key.includes('index.js') || 
          key.includes('.test.js') || 
          key.includes('ModuleRegistry.js')) {
        return;
      }
      
      try {
        const module = context(key);
        const moduleName = key
          .replace('./', '')
          .replace(/\.\w+$/, '') // Remove extension
          .replace(/\//g, '.'); // Convert path to dot notation
        
        if (module.default) {
          discoveredModules[moduleName] = module.default;
        }
      } catch (error) {
        console.error(`Error loading module at ${key}:`, error);
      }
    });
    
    this._discoveredModules = discoveredModules;
    return discoveredModules;
  }

  /**
   * Get a visual representation of module dependencies
   * @returns {Object} Dependency map
   */
  generateDependencyMap() {
    const map = {};
    Object.keys(this.dependencies).forEach(moduleName => {
      map[moduleName] = this.dependencies[moduleName];
    });
    return map;
  }

  /**
   * Find all modules that depend on a specific module
   * @param {string} moduleName - Name of the module to check
   * @returns {Array<string>} Array of dependent module names
   */
  findDependents(moduleName) {
    return Object.keys(this.dependencies).filter(name => 
      this.dependencies[name].includes(moduleName)
    );
  }

  /**
   * Check if a module is part of a circular dependency
   * @param {string} moduleName - Name of the module to check
   * @returns {boolean} True if circular dependencies exist
   */
  checkCircularDependencies(moduleName) {
    const visited = new Set();
    const path = [moduleName];
    const circularPaths = [];
    
    const visit = (node) => {
      if (visited.has(node)) {
        return false;
      }
      
      const dependencies = this.dependencies[node] || [];
      for (const dep of dependencies) {
        // Check if this dependency is in the current path
        const depIndex = path.indexOf(dep);
        if (depIndex >= 0) {
          // We found a circular path
          const circularPath = path.slice(depIndex).concat(dep);
          circularPaths.push(circularPath);
          return true;
        }
        
        // Continue down this path
        path.push(dep);
        if (visit(dep)) {
          return true;
        }
        path.pop();
      }
      
      visited.add(node);
      return false;
    };
    
    const hasCircular = visit(moduleName);
    
    // Log circular paths if found
    if (hasCircular && circularPaths.length > 0) {
      console.warn('Circular dependency paths detected:');
      circularPaths.forEach(path => {
        console.warn(`  ${path.join(' -> ')}`);
      });
    }
    
    return hasCircular;
  }

  /**
   * Get a topologically sorted list of modules based on dependencies
   * @returns {Array<string>} Sorted module names
   */
  getTopologicalSortedModules() {
    const sorted = [];
    const visited = new Set();
    const temp = new Set();
    const circularDependencies = new Set();

    const visit = (name) => {
      if (temp.has(name)) {
        // Circular dependency detected
        circularDependencies.add(name);
        return;
      }
      
      if (visited.has(name)) return;
      
      temp.add(name);
      
      const deps = this.dependencies[name] || [];
      for (const dep of deps) {
        // Skip if dependency doesn't exist
        if (!this.modules[dep]) {
          continue;
        }
        
        visit(dep);
      }
      
      temp.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    // Process all modules
    Object.keys(this.modules).forEach(name => {
      if (!visited.has(name)) {
        visit(name);
      }
    });
    
    // Report circular dependencies
    if (circularDependencies.size > 0) {
      console.warn(
        `Circular dependencies detected in ${[...circularDependencies].join(', ')}. ` +
        'Some modules may not initialize properly.'
      );
    }

    return sorted;
  }
  
  /**
   * Check if all dependencies for a module are available
   * @param {string} moduleName - Module name
   * @returns {Object} Result object with status and missing dependencies
   */
  validateDependencies(moduleName) {
    const result = {
      valid: true,
      missing: []
    };
    
    if (!this.modules[moduleName]) {
      result.valid = false;
      return result;
    }
    
    const dependencies = this.dependencies[moduleName] || [];
    for (const dep of dependencies) {
      if (!this.modules[dep]) {
        result.valid = false;
        result.missing.push(dep);
      }
    }
    
    return result;
  }
  
  /**
   * Validate all registered modules
   * @returns {Object} Validation results
   */
  validateAllModules() {
    const results = {
      valid: true,
      moduleResults: {}
    };
    
    for (const moduleName of Object.keys(this.modules)) {
      const moduleResult = this.validateDependencies(moduleName);
      results.moduleResults[moduleName] = moduleResult;
      
      if (!moduleResult.valid) {
        results.valid = false;
      }
    }
    
    return results;
  }
}

// Create a singleton instance
const registry = new ModuleRegistry();

// Export the singleton
export default registry; 