import registry from '../../ModuleRegistry';

/**
 * SettingsValidator
 * 
 * This utility validates application settings against schemas and
 * provides validation error reporting and migration paths for settings.
 * 
 * Features:
 * - Schema-based validation of settings
 * - Runtime checking of setting values
 * - Warning/error system for invalid settings
 * - Migration path for deprecated settings
 * - Validation rules documentation
 */
class SettingsValidator {
  constructor() {
    // Store schema definitions
    this.schemas = new Map();
    
    // Validation results for sections
    this.validationResults = new Map();
    
    // Migration paths for deprecated settings
    this.migrations = new Map();
    
    // Warning and error levels
    this.levels = {
      ERROR: 'error',
      WARNING: 'warning',
      INFO: 'info'
    };
    
    // Flag to control validation behavior in production
    this.validateInProduction = false;
  }
  
  /**
   * Initialize the settings validator
   */
  initialize() {
    // Register with ModuleRegistry
    registry.register(
      'utils.settings.SettingsValidator',
      this,
      ['utils.EventBus', 'utils.ErrorHandler'],
      {
        description: 'Validator for application settings',
        provides: ['settingsValidation', 'schemaMigration']
      }
    );
    
    // Get dependencies
    this.eventBus = registry.get('utils.EventBus');
    this.errorHandler = registry.get('utils.ErrorHandler');
    
    // Subscribe to settings changed events
    if (this.eventBus) {
      this.eventBus.subscribe('settings:updated', this.handleSettingsUpdated.bind(this));
    }
  }
  
  /**
   * Define a schema for a settings section
   * @param {string} section - Settings section name
   * @param {Object} schema - Schema definition
   * @returns {boolean} - Success status
   */
  defineSchema(section, schema) {
    if (!section || !schema || typeof schema !== 'object') {
      this.logError('Invalid schema definition', { section });
      return false;
    }
    
    this.schemas.set(section, schema);
    return true;
  }
  
  /**
   * Validate a settings object against its schema
   * @param {string} section - Settings section name
   * @param {Object} settings - Settings object to validate
   * @param {Object} [options] - Validation options
   * @returns {Object} - Validation result
   */
  validate(section, settings, options = {}) {
    const schema = this.schemas.get(section);
    
    // Skip validation if schema doesn't exist
    if (!schema) {
      return { valid: true, warnings: [], errors: [] };
    }
    
    // Skip validation in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && !this.validateInProduction && !options.force) {
      return { valid: true, warnings: [], errors: [] };
    }
    
    // Initialize result
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Validate required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (settings[field] === undefined) {
          result.valid = false;
          result.errors.push({
            field,
            message: `Required field '${field}' is missing`,
            level: this.levels.ERROR
          });
        }
      }
    }
    
    // Validate field types and values
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        // Skip if field not present and not required
        if (settings[field] === undefined) {
          if (fieldSchema.required) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Required field '${field}' is missing`,
              level: this.levels.ERROR
            });
          }
          continue;
        }
        
        // Validate field type
        if (fieldSchema.type) {
          const typeValid = this.validateType(settings[field], fieldSchema.type);
          if (!typeValid) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Field '${field}' should be of type ${fieldSchema.type}`,
              level: this.levels.ERROR,
              expected: fieldSchema.type,
              received: typeof settings[field]
            });
            continue;
          }
        }
        
        // Validate enum values
        if (fieldSchema.enum && !fieldSchema.enum.includes(settings[field])) {
          result.valid = false;
          result.errors.push({
            field,
            message: `Field '${field}' should be one of: ${fieldSchema.enum.join(', ')}`,
            level: this.levels.ERROR,
            expected: fieldSchema.enum,
            received: settings[field]
          });
          continue;
        }
        
        // Validate minimum and maximum for numbers
        if (fieldSchema.type === 'number' || fieldSchema.type === 'integer') {
          if (fieldSchema.minimum !== undefined && settings[field] < fieldSchema.minimum) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Field '${field}' should be >= ${fieldSchema.minimum}`,
              level: this.levels.ERROR,
              expected: `>= ${fieldSchema.minimum}`,
              received: settings[field]
            });
          }
          
          if (fieldSchema.maximum !== undefined && settings[field] > fieldSchema.maximum) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Field '${field}' should be <= ${fieldSchema.maximum}`,
              level: this.levels.ERROR,
              expected: `<= ${fieldSchema.maximum}`,
              received: settings[field]
            });
          }
        }
        
        // Validate string patterns
        if (fieldSchema.type === 'string' && fieldSchema.pattern) {
          const regex = new RegExp(fieldSchema.pattern);
          if (!regex.test(settings[field])) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Field '${field}' should match pattern ${fieldSchema.pattern}`,
              level: this.levels.ERROR,
              expected: fieldSchema.pattern,
              received: settings[field]
            });
          }
        }
        
        // Check for deprecated fields
        if (fieldSchema.deprecated) {
          result.warnings.push({
            field,
            message: fieldSchema.deprecationMessage || `Field '${field}' is deprecated`,
            level: this.levels.WARNING,
            deprecated: true,
            replacement: fieldSchema.replacement
          });
        }
        
        // Validate nested objects
        if (fieldSchema.type === 'object' && fieldSchema.properties && typeof settings[field] === 'object') {
          const nestedResult = this.validateObject(settings[field], fieldSchema);
          
          if (!nestedResult.valid) {
            result.valid = false;
            // Add nested errors with path prefix
            nestedResult.errors.forEach(error => {
              result.errors.push({
                ...error,
                field: `${field}.${error.field}`,
                path: [field, ...(error.path || [error.field])]
              });
            });
            
            // Add nested warnings with path prefix
            nestedResult.warnings.forEach(warning => {
              result.warnings.push({
                ...warning,
                field: `${field}.${warning.field}`,
                path: [field, ...(warning.path || [warning.field])]
              });
            });
          }
        }
        
        // Validate array items
        if (fieldSchema.type === 'array' && fieldSchema.items && Array.isArray(settings[field])) {
          settings[field].forEach((item, index) => {
            const itemResult = this.validateArrayItem(item, fieldSchema.items);
            
            if (!itemResult.valid) {
              result.valid = false;
              // Add item errors with index
              itemResult.errors.forEach(error => {
                result.errors.push({
                  ...error,
                  field: `${field}[${index}]${error.field ? `.${error.field}` : ''}`,
                  path: [field, index, ...(error.path || (error.field ? [error.field] : []))]
                });
              });
              
              // Add item warnings with index
              itemResult.warnings.forEach(warning => {
                result.warnings.push({
                  ...warning,
                  field: `${field}[${index}]${warning.field ? `.${warning.field}` : ''}`,
                  path: [field, index, ...(warning.path || (warning.field ? [warning.field] : []))]
                });
              });
            }
          });
        }
        
        // Run custom validators
        if (fieldSchema.validate && typeof fieldSchema.validate === 'function') {
          try {
            const customResult = fieldSchema.validate(settings[field], settings);
            
            if (customResult !== true) {
              if (typeof customResult === 'string') {
                // String result is an error message
                result.valid = false;
                result.errors.push({
                  field,
                  message: customResult,
                  level: this.levels.ERROR
                });
              } else if (customResult && typeof customResult === 'object') {
                // Object result can contain errors and warnings
                if (customResult.valid === false) {
                  result.valid = false;
                }
                
                // Add custom errors
                if (customResult.errors && Array.isArray(customResult.errors)) {
                  customResult.errors.forEach(error => {
                    if (typeof error === 'string') {
                      result.errors.push({
                        field,
                        message: error,
                        level: this.levels.ERROR
                      });
                    } else {
                      result.errors.push({
                        ...error,
                        field: error.field ? `${field}.${error.field}` : field,
                        level: error.level || this.levels.ERROR
                      });
                    }
                  });
                }
                
                // Add custom warnings
                if (customResult.warnings && Array.isArray(customResult.warnings)) {
                  customResult.warnings.forEach(warning => {
                    if (typeof warning === 'string') {
                      result.warnings.push({
                        field,
                        message: warning,
                        level: this.levels.WARNING
                      });
                    } else {
                      result.warnings.push({
                        ...warning,
                        field: warning.field ? `${field}.${warning.field}` : field,
                        level: warning.level || this.levels.WARNING
                      });
                    }
                  });
                }
              }
            }
          } catch (error) {
            // Error in custom validator
            result.valid = false;
            result.errors.push({
              field,
              message: `Validation error: ${error.message}`,
              level: this.levels.ERROR,
              error
            });
          }
        }
      }
    }
    
    // Save validation result
    this.validationResults.set(section, result);
    
    // Handle any errors or warnings
    if (!result.valid && result.errors.length > 0) {
      this.handleValidationErrors(section, result.errors);
    }
    
    if (result.warnings.length > 0) {
      this.handleValidationWarnings(section, result.warnings);
    }
    
    return result;
  }
  
  /**
   * Validate a nested object against a schema
   * @param {Object} obj - Object to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} - Validation result
   */
  validateObject(obj, schema) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Required properties check
    if (schema.required) {
      for (const field of schema.required) {
        if (obj[field] === undefined) {
          result.valid = false;
          result.errors.push({
            field,
            message: `Required field '${field}' is missing`,
            level: this.levels.ERROR
          });
        }
      }
    }
    
    // Validate each property against its schema
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        // Skip if field not present and not required
        if (obj[field] === undefined) {
          if (fieldSchema.required) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Required field '${field}' is missing`,
              level: this.levels.ERROR
            });
          }
          continue;
        }
        
        // Validate field type
        if (fieldSchema.type) {
          const typeValid = this.validateType(obj[field], fieldSchema.type);
          if (!typeValid) {
            result.valid = false;
            result.errors.push({
              field,
              message: `Field '${field}' should be of type ${fieldSchema.type}`,
              level: this.levels.ERROR,
              expected: fieldSchema.type,
              received: typeof obj[field]
            });
            continue;
          }
        }
        
        // Further validation based on type...
        // (Similar to the main validate method, but for nested objects)
        // This is simplified for brevity, but would include similar validations
      }
    }
    
    return result;
  }
  
  /**
   * Validate an array item against a schema
   * @param {*} item - Array item to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} - Validation result
   */
  validateArrayItem(item, schema) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };
    
    // Validate item type
    if (schema.type) {
      const typeValid = this.validateType(item, schema.type);
      if (!typeValid) {
        result.valid = false;
        result.errors.push({
          message: `Item should be of type ${schema.type}`,
          level: this.levels.ERROR,
          expected: schema.type,
          received: typeof item
        });
        return result; // Early return for type mismatch
      }
    }
    
    // If item is an object and schema has properties, validate as object
    if (schema.type === 'object' && schema.properties && typeof item === 'object') {
      const objResult = this.validateObject(item, schema);
      if (!objResult.valid) {
        result.valid = false;
        result.errors.push(...objResult.errors);
        result.warnings.push(...objResult.warnings);
      }
    }
    
    // Other validations can be added here as needed
    
    return result;
  }
  
  /**
   * Validate a value against a type
   * @param {*} value - Value to validate
   * @param {string} type - Type to validate against
   * @returns {boolean} - Whether the value matches the type
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && !isNaN(value) && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'null':
        return value === null;
      case 'any':
        return true;
      default:
        // Handle union types (e.g., 'string|number')
        if (type.includes('|')) {
          const types = type.split('|');
          return types.some(t => this.validateType(value, t));
        }
        return false;
    }
  }
  
  /**
   * Define a migration path for a deprecated setting
   * @param {string} section - Settings section name
   * @param {string} oldPath - Deprecated setting path
   * @param {Object} migration - Migration configuration
   * @returns {boolean} - Success status
   */
  defineMigration(section, oldPath, migration) {
    if (!section || !oldPath || !migration) {
      this.logError('Invalid migration definition', { section, oldPath });
      return false;
    }
    
    if (!this.migrations.has(section)) {
      this.migrations.set(section, new Map());
    }
    
    this.migrations.get(section).set(oldPath, {
      ...migration,
      applied: false
    });
    
    return true;
  }
  
  /**
   * Apply migrations to a settings object
   * @param {string} section - Settings section name
   * @param {Object} settings - Settings object to migrate
   * @returns {Object} - Migrated settings
   */
  applyMigrations(section, settings) {
    if (!settings || typeof settings !== 'object' || !this.migrations.has(section)) {
      return settings;
    }
    
    const sectionMigrations = this.migrations.get(section);
    const migratedSettings = { ...settings };
    const appliedMigrations = [];
    
    for (const [oldPath, migration] of sectionMigrations.entries()) {
      // Skip if already applied
      if (migration.applied) continue;
      
      // Get the old value
      const oldPathParts = oldPath.split('.');
      let oldValue = migratedSettings;
      
      for (const part of oldPathParts) {
        if (oldValue === undefined || oldValue === null) break;
        oldValue = oldValue[part];
      }
      
      // Skip if old path doesn't exist
      if (oldValue === undefined) continue;
      
      try {
        if (migration.newPath) {
          // Simple path migration
          const newPathParts = migration.newPath.split('.');
          
          // Create nested objects as needed
          let current = migratedSettings;
          for (let i = 0; i < newPathParts.length - 1; i++) {
            if (!current[newPathParts[i]] || typeof current[newPathParts[i]] !== 'object') {
              current[newPathParts[i]] = {};
            }
            current = current[newPathParts[i]];
          }
          
          // Set the new value
          const lastPart = newPathParts[newPathParts.length - 1];
          
          if (migration.transform && typeof migration.transform === 'function') {
            // Apply transformation
            current[lastPart] = migration.transform(oldValue, migratedSettings);
          } else {
            current[lastPart] = oldValue;
          }
          
          // Remove old value if removeOld is true
          if (migration.removeOld !== false) {
            let oldParent = migratedSettings;
            for (let i = 0; i < oldPathParts.length - 1; i++) {
              if (!oldParent[oldPathParts[i]]) break;
              oldParent = oldParent[oldPathParts[i]];
            }
            
            if (oldParent && oldPathParts.length > 0) {
              delete oldParent[oldPathParts[oldPathParts.length - 1]];
            }
          }
        } else if (migration.transform && typeof migration.transform === 'function') {
          // Custom transformation
          migratedSettings = migration.transform(migratedSettings);
        }
        
        // Mark migration as applied
        migration.applied = true;
        appliedMigrations.push(oldPath);
        
        // Log migration if enabled
        if (migration.log !== false) {
          this.logInfo(`Applied migration for ${section}.${oldPath}`, {
            section,
            oldPath,
            newPath: migration.newPath
          });
        }
      } catch (error) {
        this.logError(`Error applying migration for ${section}.${oldPath}`, {
          section,
          oldPath,
          error: error.message
        });
      }
    }
    
    // Notify migrations applied
    if (appliedMigrations.length > 0 && this.eventBus) {
      this.eventBus.publish('settings:migrationsApplied', {
        section,
        migrations: appliedMigrations
      });
    }
    
    return migratedSettings;
  }
  
  /**
   * Get validation result for a section
   * @param {string} section - Settings section name
   * @returns {Object|null} - Validation result or null if not validated
   */
  getValidationResult(section) {
    return this.validationResults.get(section) || null;
  }
  
  /**
   * Get validation schema for a section
   * @param {string} section - Settings section name
   * @returns {Object|null} - Schema object or null if not defined
   */
  getSchema(section) {
    return this.schemas.get(section) || null;
  }
  
  /**
   * Generate documentation for a schema
   * @param {string} section - Settings section name
   * @returns {Object|null} - Documentation object or null if no schema
   */
  generateSchemaDocumentation(section) {
    const schema = this.schemas.get(section);
    if (!schema) return null;
    
    const docs = {
      section,
      description: schema.description || `Schema for ${section} settings`,
      properties: {}
    };
    
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        docs.properties[name] = {
          type: prop.type || 'any',
          description: prop.description || '',
          required: schema.required && schema.required.includes(name),
          default: prop.default,
          enum: prop.enum,
          deprecated: !!prop.deprecated,
          deprecationMessage: prop.deprecationMessage,
          replacement: prop.replacement
        };
        
        // Add numeric constraints
        if (prop.type === 'number' || prop.type === 'integer') {
          if (prop.minimum !== undefined) {
            docs.properties[name].minimum = prop.minimum;
          }
          if (prop.maximum !== undefined) {
            docs.properties[name].maximum = prop.maximum;
          }
        }
        
        // Add string constraints
        if (prop.type === 'string' && prop.pattern) {
          docs.properties[name].pattern = prop.pattern;
        }
        
        // Clean up undefined properties
        for (const key in docs.properties[name]) {
          if (docs.properties[name][key] === undefined) {
            delete docs.properties[name][key];
          }
        }
      }
    }
    
    return docs;
  }
  
  /**
   * Handle settings updated event
   * @param {Object} data - Event data
   */
  handleSettingsUpdated(data) {
    if (!data.section || !data.settings) return;
    
    // Validate updated settings
    this.validate(data.section, data.settings);
  }
  
  /**
   * Handle validation errors
   * @param {string} section - Settings section name
   * @param {Array} errors - Array of validation errors
   */
  handleValidationErrors(section, errors) {
    if (!errors || !errors.length) return;
    
    // Log errors
    this.logError(`Validation errors in ${section} settings`, {
      section,
      errors,
      count: errors.length
    });
    
    // Publish validation errors event
    if (this.eventBus) {
      this.eventBus.publish('settings:validationErrors', {
        section,
        errors
      });
    }
  }
  
  /**
   * Handle validation warnings
   * @param {string} section - Settings section name
   * @param {Array} warnings - Array of validation warnings
   */
  handleValidationWarnings(section, warnings) {
    if (!warnings || !warnings.length) return;
    
    // Log warnings
    this.logWarning(`Validation warnings in ${section} settings`, {
      section,
      warnings,
      count: warnings.length
    });
    
    // Publish validation warnings event
    if (this.eventBus) {
      this.eventBus.publish('settings:validationWarnings', {
        section,
        warnings
      });
    }
  }
  
  /**
   * Log an error
   * @param {string} message - Error message
   * @param {Object} [data] - Additional error data
   */
  logError(message, data = {}) {
    if (this.errorHandler) {
      this.errorHandler.handleError(new Error(message), {
        type: 'settingsValidation',
        ...data
      });
    } else {
      console.error(`[SettingsValidator] ${message}`, data);
    }
  }
  
  /**
   * Log a warning
   * @param {string} message - Warning message
   * @param {Object} [data] - Additional warning data
   */
  logWarning(message, data = {}) {
    if (this.errorHandler) {
      this.errorHandler.logWarning(message, {
        type: 'settingsValidation',
        ...data
      });
    } else {
      console.warn(`[SettingsValidator] ${message}`, data);
    }
  }
  
  /**
   * Log an info message
   * @param {string} message - Info message
   * @param {Object} [data] - Additional info data
   */
  logInfo(message, data = {}) {
    if (this.errorHandler) {
      this.errorHandler.logInfo(message, {
        type: 'settingsValidation',
        ...data
      });
    } else {
      console.info(`[SettingsValidator] ${message}`, data);
    }
  }
}

// Create a singleton instance
const settingsValidator = new SettingsValidator();

// Export the singleton
export default settingsValidator; 