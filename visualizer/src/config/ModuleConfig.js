import registry from '../ModuleRegistry';

/**
 * ModuleConfig provides a configuration system for application modules with validation,
 * environment-specific settings, and overrides for testing.
 * 
 * Features:
 * - Configuration schema validation
 * - Environment-specific module configurations
 * - Override mechanism for testing
 * - Documentation for module configuration
 */
class ModuleConfig {
  constructor() {
    this.configs = new Map();
    this.schemas = new Map();
    this.environments = ['development', 'test', 'production'];
    this.currentEnvironment = process.env.NODE_ENV || 'development';
    this.overrides = new Map();
    this.listeners = new Map();
    this.validationErrors = new Map();
  }

  /**
   * Initialize the module config
   */
  initialize() {
    // Register with ModuleRegistry
    registry.register(
      'config.ModuleConfig', 
      this,
      ['utils.ValidationHelpers', 'utils.EventBus'],
      {
        description: 'Configuration system for application modules',
        provides: ['configValidation', 'environmentConfig']
      }
    );

    // Try to get validation helpers and event bus
    this.validationHelpers = registry.get('utils.ValidationHelpers');
    this.eventBus = registry.get('utils.EventBus');

    // Subscribe to environment changes
    if (this.eventBus) {
      this.eventBus.subscribe('environment:changed', this.handleEnvironmentChange.bind(this));
    }

    // Load environment-specific config
    this.loadEnvironmentConfig();
  }

  /**
   * Register a configuration schema for a module
   * @param {string} moduleName - Module name
   * @param {Object} schema - Configuration schema object
   * @param {Object} defaultConfig - Default configuration values
   * @returns {boolean} - Success state
   */
  registerSchema(moduleName, schema, defaultConfig = {}) {
    if (!moduleName || !schema) {
      console.error('Invalid parameters for registerSchema');
      return false;
    }

    // Store schema and default config
    this.schemas.set(moduleName, schema);

    // Validate default config against schema
    const validationResult = this.validateConfig(moduleName, defaultConfig);
    if (!validationResult.valid) {
      console.error(`Default config for ${moduleName} is invalid:`, validationResult.errors);
      // Store validation errors
      this.validationErrors.set(moduleName, validationResult.errors);
      return false;
    }

    // Store default config
    this.setConfig(moduleName, defaultConfig);

    return true;
  }

  /**
   * Set configuration for a module
   * @param {string} moduleName - Module name
   * @param {Object} config - Configuration object
   * @param {boolean} notify - Whether to notify listeners
   * @returns {boolean} - Success state
   */
  setConfig(moduleName, config, notify = true) {
    if (!moduleName || !config) {
      console.error('Invalid parameters for setConfig');
      return false;
    }

    // Validate config if schema exists
    if (this.schemas.has(moduleName)) {
      const validationResult = this.validateConfig(moduleName, config);
      if (!validationResult.valid) {
        console.error(`Config for ${moduleName} is invalid:`, validationResult.errors);
        // Store validation errors
        this.validationErrors.set(moduleName, validationResult.errors);
        return false;
      }
    }

    // Check if override exists
    if (this.overrides.has(moduleName)) {
      // Merge with override (override takes precedence)
      const override = this.overrides.get(moduleName);
      config = { ...config, ...override };
    }

    // Store config
    this.configs.set(moduleName, { ...config });

    // Notify listeners
    if (notify && this.listeners.has(moduleName)) {
      this.listeners.get(moduleName).forEach(listener => {
        try {
          listener(this.configs.get(moduleName));
        } catch (error) {
          console.error(`Error in config listener for ${moduleName}:`, error);
        }
      });
    }

    // Publish event
    if (notify && this.eventBus) {
      this.eventBus.publish('config:updated', { moduleName, config });
    }

    return true;
  }

  /**
   * Get configuration for a module
   * @param {string} moduleName - Module name
   * @returns {Object|null} - Configuration object or null if not found
   */
  getConfig(moduleName) {
    if (!moduleName) {
      console.error('Invalid parameters for getConfig');
      return null;
    }

    return this.configs.get(moduleName) || null;
  }

  /**
   * Get a specific configuration value
   * @param {string} moduleName - Module name
   * @param {string} key - Configuration key
   * @param {*} defaultValue - Default value if key not found
   * @returns {*} - Configuration value or default value
   */
  getValue(moduleName, key, defaultValue = null) {
    const config = this.getConfig(moduleName);
    if (!config) {
      return defaultValue;
    }

    return key in config ? config[key] : defaultValue;
  }

  /**
   * Set a specific configuration value
   * @param {string} moduleName - Module name
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @returns {boolean} - Success state
   */
  setValue(moduleName, key, value) {
    const config = this.getConfig(moduleName) || {};
    config[key] = value;
    return this.setConfig(moduleName, config);
  }

  /**
   * Set configuration override for testing
   * @param {string} moduleName - Module name
   * @param {Object} override - Override configuration
   * @returns {boolean} - Success state
   */
  setOverride(moduleName, override) {
    if (!moduleName || !override) {
      console.error('Invalid parameters for setOverride');
      return false;
    }

    // Store override
    this.overrides.set(moduleName, override);

    // Apply override to current config
    const config = this.getConfig(moduleName);
    if (config) {
      this.setConfig(moduleName, { ...config });
    }

    return true;
  }

  /**
   * Clear configuration override
   * @param {string} moduleName - Module name (or all if not provided)
   * @returns {boolean} - Success state
   */
  clearOverride(moduleName) {
    if (moduleName) {
      // Clear specific override
      if (this.overrides.has(moduleName)) {
        this.overrides.delete(moduleName);
        // Reapply config without override
        const config = this.getConfig(moduleName);
        if (config) {
          this.setConfig(moduleName, { ...config });
        }
      }
    } else {
      // Clear all overrides
      for (const moduleName of this.overrides.keys()) {
        this.clearOverride(moduleName);
      }
      this.overrides.clear();
    }

    return true;
  }

  /**
   * Subscribe to configuration changes
   * @param {string} moduleName - Module name
   * @param {Function} listener - Listener function
   * @returns {Function} - Unsubscribe function
   */
  subscribe(moduleName, listener) {
    if (!moduleName || typeof listener !== 'function') {
      console.error('Invalid parameters for subscribe');
      return () => {};
    }

    if (!this.listeners.has(moduleName)) {
      this.listeners.set(moduleName, new Set());
    }

    this.listeners.get(moduleName).add(listener);

    // Return unsubscribe function
    return () => {
      if (this.listeners.has(moduleName)) {
        this.listeners.get(moduleName).delete(listener);
      }
    };
  }

  /**
   * Set the current environment
   * @param {string} environment - Environment name
   * @returns {boolean} - Success state
   */
  setEnvironment(environment) {
    if (!this.environments.includes(environment)) {
      console.error(`Invalid environment: ${environment}`);
      return false;
    }

    this.currentEnvironment = environment;

    // Load environment-specific config
    this.loadEnvironmentConfig();

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('environment:changed', { environment });
    }

    return true;
  }

  /**
   * Get the current environment
   * @returns {string} - Current environment
   */
  getEnvironment() {
    return this.currentEnvironment;
  }

  /**
   * Load environment-specific configuration
   * @private
   */
  loadEnvironmentConfig() {
    try {
      // Dynamic import of environment-specific config
      const environmentModule = require(`./environments/${this.currentEnvironment}.js`);
      const environmentConfig = environmentModule.default || environmentModule;

      // Apply environment config to each module
      for (const [moduleName, config] of Object.entries(environmentConfig)) {
        const currentConfig = this.getConfig(moduleName) || {};
        this.setConfig(moduleName, { ...currentConfig, ...config }, false);
      }

      // Notify listeners
      if (this.eventBus) {
        this.eventBus.publish('config:environmentLoaded', { environment: this.currentEnvironment });
      }
    } catch (error) {
      console.warn(`Environment config not found for ${this.currentEnvironment}:`, error);
    }
  }

  /**
   * Validate a configuration object against a schema
   * @param {string} moduleName - Module name
   * @param {Object} config - Configuration object to validate
   * @returns {Object} - Validation result with valid flag and errors
   */
  validateConfig(moduleName, config) {
    const result = {
      valid: true,
      errors: {}
    };

    const schema = this.schemas.get(moduleName);
    if (!schema) {
      // No schema, assume valid
      return result;
    }

    if (!this.validationHelpers) {
      console.warn('ValidationHelpers not available, skipping validation');
      return result;
    }

    // Check each field in schema
    for (const [key, fieldSchema] of Object.entries(schema)) {
      // Check required fields
      if (fieldSchema.required && (config[key] === undefined || config[key] === null)) {
        result.valid = false;
        result.errors[key] = `Field '${key}' is required`;
        continue;
      }

      // Skip validation if field is not provided
      if (config[key] === undefined) {
        continue;
      }

      // Type validation
      if (fieldSchema.type) {
        const typeValid = this.validateType(config[key], fieldSchema.type);
        if (!typeValid) {
          result.valid = false;
          result.errors[key] = `Field '${key}' should be of type ${fieldSchema.type}`;
          continue;
        }
      }

      // Range validation for numbers
      if (fieldSchema.type === 'number') {
        // Min value
        if (fieldSchema.min !== undefined && config[key] < fieldSchema.min) {
          result.valid = false;
          result.errors[key] = `Field '${key}' should be >= ${fieldSchema.min}`;
          continue;
        }

        // Max value
        if (fieldSchema.max !== undefined && config[key] > fieldSchema.max) {
          result.valid = false;
          result.errors[key] = `Field '${key}' should be <= ${fieldSchema.max}`;
          continue;
        }
      }

      // Pattern validation for strings
      if (fieldSchema.type === 'string' && fieldSchema.pattern) {
        const regex = new RegExp(fieldSchema.pattern);
        if (!regex.test(config[key])) {
          result.valid = false;
          result.errors[key] = `Field '${key}' should match pattern ${fieldSchema.pattern}`;
          continue;
        }
      }

      // Enum validation
      if (fieldSchema.enum && !fieldSchema.enum.includes(config[key])) {
        result.valid = false;
        result.errors[key] = `Field '${key}' should be one of: ${fieldSchema.enum.join(', ')}`;
        continue;
      }

      // Custom validation function
      if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
        try {
          const customValid = fieldSchema.validate(config[key]);
          if (!customValid) {
            result.valid = false;
            result.errors[key] = `Field '${key}' failed custom validation`;
            continue;
          }
        } catch (error) {
          result.valid = false;
          result.errors[key] = `Field '${key}' validation error: ${error.message}`;
          continue;
        }
      }

      // Array item validation
      if (fieldSchema.type === 'array' && fieldSchema.items && Array.isArray(config[key])) {
        for (let i = 0; i < config[key].length; i++) {
          const itemResult = this.validateItem(config[key][i], fieldSchema.items);
          if (!itemResult.valid) {
            result.valid = false;
            result.errors[`${key}[${i}]`] = itemResult.errors;
            continue;
          }
        }
      }

      // Object property validation
      if (fieldSchema.type === 'object' && fieldSchema.properties && typeof config[key] === 'object') {
        for (const [propKey, propSchema] of Object.entries(fieldSchema.properties)) {
          if (propSchema.required && (config[key][propKey] === undefined || config[key][propKey] === null)) {
            result.valid = false;
            result.errors[`${key}.${propKey}`] = `Property '${propKey}' is required`;
            continue;
          }

          if (config[key][propKey] !== undefined) {
            const propResult = this.validateItem(config[key][propKey], propSchema);
            if (!propResult.valid) {
              result.valid = false;
              result.errors[`${key}.${propKey}`] = propResult.errors;
              continue;
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate an item against a schema
   * @private
   * @param {*} item - Item to validate
   * @param {Object} schema - Schema for the item
   * @returns {Object} - Validation result
   */
  validateItem(item, schema) {
    const result = {
      valid: true,
      errors: {}
    };

    // Type validation
    if (schema.type) {
      const typeValid = this.validateType(item, schema.type);
      if (!typeValid) {
        result.valid = false;
        result.errors.type = `Should be of type ${schema.type}`;
        return result;
      }
    }

    // Range validation for numbers
    if (schema.type === 'number') {
      // Min value
      if (schema.min !== undefined && item < schema.min) {
        result.valid = false;
        result.errors.min = `Should be >= ${schema.min}`;
        return result;
      }

      // Max value
      if (schema.max !== undefined && item > schema.max) {
        result.valid = false;
        result.errors.max = `Should be <= ${schema.max}`;
        return result;
      }
    }

    // Pattern validation for strings
    if (schema.type === 'string' && schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(item)) {
        result.valid = false;
        result.errors.pattern = `Should match pattern ${schema.pattern}`;
        return result;
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(item)) {
      result.valid = false;
      result.errors.enum = `Should be one of: ${schema.enum.join(', ')}`;
      return result;
    }

    // Custom validation function
    if (schema.validate && typeof schema.validate === 'function') {
      try {
        const customValid = schema.validate(item);
        if (!customValid) {
          result.valid = false;
          result.errors.custom = 'Failed custom validation';
          return result;
        }
      } catch (error) {
        result.valid = false;
        result.errors.custom = `Validation error: ${error.message}`;
        return result;
      }
    }

    return result;
  }

  /**
   * Validate a value against a type
   * @private
   * @param {*} value - Value to validate
   * @param {string} type - Expected type
   * @returns {boolean} - Whether the value matches the type
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'function':
        return typeof value === 'function';
      case 'any':
        return true;
      default:
        return false;
    }
  }

  /**
   * Get validation errors for a module
   * @param {string} moduleName - Module name
   * @returns {Object|null} - Validation errors or null if none
   */
  getValidationErrors(moduleName) {
    return this.validationErrors.get(moduleName) || null;
  }

  /**
   * Reset validation errors for a module
   * @param {string} moduleName - Module name
   */
  resetValidationErrors(moduleName) {
    this.validationErrors.delete(moduleName);
  }

  /**
   * Handle environment change event
   * @private
   * @param {Object} data - Event data
   */
  handleEnvironmentChange(data) {
    this.setEnvironment(data.environment);
  }

  /**
   * Generate documentation for module configuration
   * @param {string} moduleName - Module name
   * @returns {Object} - Documentation object
   */
  generateDocumentation(moduleName) {
    const schema = this.schemas.get(moduleName);
    if (!schema) {
      return null;
    }

    const config = this.getConfig(moduleName) || {};
    const docs = {
      moduleName,
      description: `Configuration for ${moduleName}`,
      fields: {}
    };

    for (const [key, fieldSchema] of Object.entries(schema)) {
      docs.fields[key] = {
        type: fieldSchema.type || 'any',
        description: fieldSchema.description || '',
        required: !!fieldSchema.required,
        default: fieldSchema.default,
        currentValue: config[key],
        enum: fieldSchema.enum,
        min: fieldSchema.min,
        max: fieldSchema.max,
        pattern: fieldSchema.pattern
      };

      // Clean up undefined fields
      for (const prop in docs.fields[key]) {
        if (docs.fields[key][prop] === undefined) {
          delete docs.fields[key][prop];
        }
      }
    }

    return docs;
  }

  /**
   * Generate documentation for all module configurations
   * @returns {Object} - Documentation object
   */
  generateAllDocumentation() {
    const docs = {};
    for (const moduleName of this.schemas.keys()) {
      docs[moduleName] = this.generateDocumentation(moduleName);
    }
    return docs;
  }
}

// Create a singleton instance
const moduleConfig = new ModuleConfig();

// Export the singleton
export default moduleConfig;

// Create environment-specific configuration files if they don't exist
try {
  require('./environments/development.js');
} catch (error) {
  // Create development.js if it doesn't exist
  if (typeof window === 'undefined') {
    const fs = require('fs');
    const path = require('path');
    
    // Create environments directory if it doesn't exist
    const envDir = path.join(__dirname, 'environments');
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }
    
    // Create development.js file
    const devConfigPath = path.join(envDir, 'development.js');
    if (!fs.existsSync(devConfigPath)) {
      const devConfig = `/**
 * Development environment configuration
 * 
 * This file contains environment-specific configuration overrides for development.
 */

export default {
  // Example configuration overrides for development
  'utils.ErrorHandler': {
    logToConsole: true,
    detailedErrors: true,
    captureStack: true
  },
  
  'visualization.VisualizationManager': {
    performanceMode: false,
    debugMode: true,
    showFPS: true
  }
};
`;
      fs.writeFileSync(devConfigPath, devConfig);
    }
  }
} 