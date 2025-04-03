// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';
import { EncryptionService } from '../../encryption/EncryptionService';

/**
 * Base class for Input/Output nodes that provides common functionality
 * 
 * IO nodes represent data flowing into and out of applications. They define
 * the interfaces between applications and the rest of the system, specifying
 * the structure and type of data being exchanged.
 * 
 * The base IO node class provides common functionality for both input and output
 * nodes, including data schema management and security features for protecting
 * sensitive data flows.
 * 
 * Security features:
 * - Data schema protection
 * - Encryption integration
 * - Data flow tracking
 * - Sensitivity management
 */
class BaseIONode extends Node {
  /**
   * Create a base IO node
   * 
   * @param {Object} data - Node data
   * @param {string} data.io_type - Specific IO type
   * @param {Object} [data.data_schema] - Data schema details
   * @param {boolean} [data.is_sensitive=false] - Whether this IO contains sensitive data
   * @param {string} [data.format] - Data format (JSON, XML, CSV, etc.)
   * @param {Object} [data.validation_rules] - Rules for validating data
   * @param {Object} [data.visualProperties] - Visual properties for this IO node
   */
  constructor(data) {
    super(data);
    
    // IO-specific properties
    this.io_type = data.io_type || 'generic';
    this.data_schema = data.data_schema || {};
    this.is_sensitive = data.is_sensitive ?? false;
    this.format = data.format || 'json';
    this.validation_rules = data.validation_rules || {};
  }
  
  /**
   * Update data schema
   * The schema defines the structure and types of data flowing through this IO
   * 
   * @param {Object} schema - Data schema
   */
  updateDataSchema(schema) {
    this.data_schema = {
      ...this.data_schema,
      ...schema
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('io:schemaUpdated', {
      nodeId: this.id,
      type: this.type
    });
  }
  
  /**
   * Set sensitivity status
   * Sensitive IO nodes may require special handling such as encryption
   * 
   * @param {boolean} isSensitive - Whether this IO contains sensitive data
   */
  setSensitivity(isSensitive) {
    this.is_sensitive = isSensitive;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('io:sensitivityChanged', {
      nodeId: this.id,
      type: this.type,
      isSensitive: isSensitive
    });
  }
  
  /**
   * Update data format
   * 
   * @param {string} format - Data format (JSON, XML, CSV, etc.)
   * @returns {boolean} Success status
   */
  updateFormat(format) {
    const validFormats = ['json', 'xml', 'csv', 'binary', 'text', 'protobuf', 'avro'];
    
    if (!validFormats.includes(format.toLowerCase())) {
      console.error(`Invalid format: ${format}`);
      return false;
    }
    
    this.format = format.toLowerCase();
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('io:formatUpdated', {
      nodeId: this.id,
      type: this.type,
      format: this.format
    });
    
    return true;
  }
  
  /**
   * Update validation rules
   * 
   * @param {Object} rules - Validation rules
   */
  updateValidationRules(rules) {
    this.validation_rules = {
      ...this.validation_rules,
      ...rules
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('io:validationRulesUpdated', {
      nodeId: this.id,
      type: this.type
    });
  }
  
  /**
   * Get IO-specific visual properties for visualization
   * 
   * @returns {Object} Visual properties for IO node
   */
  getIOVisualProperties() {
    // Get base visual properties from parent class
    const baseProps = super.getVisualProperties();
    
    // Add common IO-specific properties
    return {
      ...baseProps,
      is_sensitive: this.is_sensitive,
      io_type: this.io_type,
      format: this.format,
      hasSchema: Object.keys(this.data_schema).length > 0,
      hasValidationRules: Object.keys(this.validation_rules).length > 0,
      schemaComplexity: this.calculateSchemaComplexity()
    };
  }
  
  /**
   * Calculate schema complexity for visualization purposes
   * 
   * @returns {number} Complexity score (0-100)
   * @private
   */
  calculateSchemaComplexity() {
    if (Object.keys(this.data_schema).length === 0) return 0;
    
    // Calculate schema complexity based on JSON representation
    const schemaJson = JSON.stringify(this.data_schema);
    
    // Base complexity on schema size
    let complexity = Math.min(70, schemaJson.length / 10);
    
    // Add for validation rules
    complexity += Math.min(30, Object.keys(this.validation_rules).length * 5);
    
    // Cap at 100
    return Math.min(100, complexity);
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeDetails - Whether to include all details
   * @returns {Object} Plain object representation
   */
  toObject(includeDetails = false) {
    const baseObject = super.toObject(includeDetails);
    
    const result = {
      ...baseObject,
      io_type: this.io_type,
      data_schema: { ...this.data_schema },
      is_sensitive: this.is_sensitive,
      format: this.format
    };
    
    if (includeDetails) {
      result.validation_rules = { ...this.validation_rules };
    }
    
    return result;
  }
}

/**
 * Input Node class representing an input data flow for an application
 * Input nodes are Level 9 nodes that belong to an Application
 * 
 * Input nodes define data coming into an application, specifying the structure,
 * format, and source of the data. They can be connected to data sources and
 * have validation rules to ensure data integrity.
 * 
 * Input nodes are essential for understanding data dependencies and
 * data flow through the system.
 */
class InputNode extends BaseIONode {
  /**
   * Create an Input node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent application ID
   * @param {string} [data.io_type] - Input type
   * @param {Object} [data.data_schema] - Data schema
   * @param {Array} [data.source_connections] - Source connection IDs
   * @param {boolean} [data.required=true] - Whether this input is required
   * @param {Object} [data.default_value] - Default value if input is not provided
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this input
   */
  constructor(data) {
    // Set type and level for inputs
    const nodeData = {
      ...data,
      type: 'input',
      level: 9,
      expandable: false,
    };
    
    super(nodeData);
    
    // Input-specific properties
    this.source_connections = data.source_connections || [];
    this.required = data.required ?? true;
    this.default_value = data.default_value || null;
  }
  
  /**
   * Add a source connection to this input
   * Source connections define where the input data comes from
   * 
   * @param {string} sourceId - Source node ID
   * @param {string} connectionType - Connection type
   */
  addSourceConnection(sourceId, connectionType = 'data_flow') {
    const connection = { source: sourceId, type: connectionType };
    
    // Check if connection already exists
    const exists = this.source_connections.some(c => 
      c.source === sourceId && c.type === connectionType
    );
    
    if (!exists) {
      this.source_connections.push(connection);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('input:sourceConnectionAdded', {
        inputId: this.id,
        sourceId: sourceId,
        connectionType: connectionType
      });
    }
  }
  
  /**
   * Remove a source connection
   * 
   * @param {string} sourceId - Source node ID
   * @param {string} connectionType - Connection type
   * @returns {boolean} True if connection was removed
   */
  removeSourceConnection(sourceId, connectionType = 'data_flow') {
    const initialLength = this.source_connections.length;
    this.source_connections = this.source_connections.filter(c => 
      !(c.source === sourceId && c.type === connectionType)
    );
    
    // Notify system if removed
    if (initialLength > this.source_connections.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('input:sourceConnectionRemoved', {
        inputId: this.id,
        sourceId: sourceId,
        connectionType: connectionType
      });
    }
    
    return this.source_connections.length < initialLength;
  }
  
  /**
   * Set whether this input is required
   * 
   * @param {boolean} isRequired - Whether the input is required
   */
  setRequired(isRequired) {
    this.required = isRequired;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('input:requiredStatusChanged', {
      inputId: this.id,
      required: isRequired
    });
  }
  
  /**
   * Set default value for this input
   * Used when the input is not provided but required
   * 
   * @param {*} defaultValue - Default value
   */
  setDefaultValue(defaultValue) {
    this.default_value = defaultValue;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('input:defaultValueChanged', {
      inputId: this.id
    });
  }
  
  /**
   * Get input-specific visual properties for visualization
   * 
   * @returns {Object} Visual properties for input node
   */
  getInputVisualProperties() {
    // Get base IO visual properties
    const baseProps = this.getIOVisualProperties();
    
    // Add input-specific properties
    return {
      ...baseProps,
      sourceCount: this.source_connections.length,
      isRequired: this.required,
      hasDefaultValue: this.default_value !== null,
      dataFlowDirection: 'incoming'
    };
  }
  
  /**
   * Get source connections for visualization
   * 
   * @returns {Array} Array of source connection objects
   */
  getSourceConnectionsForVisualization() {
    return this.source_connections.map(conn => ({
      id: `${conn.source}_to_${this.id}_${conn.type}`,
      sourceId: conn.source,
      targetId: this.id,
      type: conn.type || 'data_flow',
      isDirectional: true,
      isSensitive: this.is_sensitive
    }));
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeDetails - Whether to include all details
   * @returns {Object} Plain object representation
   */
  toObject(includeDetails = false) {
    const baseObject = super.toObject(includeDetails);
    
    const result = {
      ...baseObject,
      source_connections: [...this.source_connections],
      required: this.required
    };
    
    if (this.default_value !== null) {
      result.default_value = this.default_value;
    }
    
    return result;
  }
}

/**
 * Output Node class representing an output data flow from an application
 * Output nodes are Level 9 nodes that belong to an Application
 * 
 * Output nodes define data produced by an application, specifying the structure,
 * format, and destinations of the data. They connect to downstream consumers
 * and document the application's externally visible outputs.
 * 
 * Output nodes are crucial for understanding system integration points and
 * data dependencies between components.
 */
class OutputNode extends BaseIONode {
  /**
   * Create an Output node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent application ID
   * @param {string} [data.io_type] - Output type
   * @param {Object} [data.data_schema] - Data schema
   * @param {Array} [data.target_connections] - Target connection IDs
   * @param {string} [data.frequency] - Output frequency (continuous, periodic, on-demand)
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this output
   */
  constructor(data) {
    // Set type and level for outputs
    const nodeData = {
      ...data,
      type: 'output',
      level: 9,
      expandable: false,
    };
    
    super(nodeData);
    
    // Output-specific properties
    this.target_connections = data.target_connections || [];
    this.frequency = data.frequency || 'on-demand';
  }
  
  /**
   * Add a target connection from this output
   * Target connections define where the output data goes
   * 
   * @param {string} targetId - Target node ID
   * @param {string} connectionType - Connection type
   */
  addTargetConnection(targetId, connectionType = 'data_flow') {
    const connection = { target: targetId, type: connectionType };
    
    // Check if connection already exists
    const exists = this.target_connections.some(c => 
      c.target === targetId && c.type === connectionType
    );
    
    if (!exists) {
      this.target_connections.push(connection);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('output:targetConnectionAdded', {
        outputId: this.id,
        targetId: targetId,
        connectionType: connectionType
      });
    }
  }
  
  /**
   * Remove a target connection
   * 
   * @param {string} targetId - Target node ID
   * @param {string} connectionType - Connection type
   * @returns {boolean} True if connection was removed
   */
  removeTargetConnection(targetId, connectionType = 'data_flow') {
    const initialLength = this.target_connections.length;
    this.target_connections = this.target_connections.filter(c => 
      !(c.target === targetId && c.type === connectionType)
    );
    
    // Notify system if removed
    if (initialLength > this.target_connections.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('output:targetConnectionRemoved', {
        outputId: this.id,
        targetId: targetId,
        connectionType: connectionType
      });
    }
    
    return this.target_connections.length < initialLength;
  }
  
  /**
   * Set the output frequency
   * 
   * @param {string} frequency - Output frequency (continuous, periodic, on-demand)
   * @returns {boolean} Success status
   */
  setFrequency(frequency) {
    const validFrequencies = ['continuous', 'periodic', 'on-demand', 'scheduled', 'triggered'];
    
    if (!validFrequencies.includes(frequency.toLowerCase())) {
      console.error(`Invalid frequency: ${frequency}`);
      return false;
    }
    
    this.frequency = frequency.toLowerCase();
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('output:frequencyChanged', {
      outputId: this.id,
      frequency: this.frequency
    });
    
    return true;
  }
  
  /**
   * Get output-specific visual properties for visualization
   * 
   * @returns {Object} Visual properties for output node
   */
  getOutputVisualProperties() {
    // Get base IO visual properties
    const baseProps = this.getIOVisualProperties();
    
    // Calculate frequency factor for visual representation
    const frequencyFactor = this.calculateFrequencyFactor();
    
    // Add output-specific properties
    return {
      ...baseProps,
      targetCount: this.target_connections.length,
      frequency: this.frequency,
      frequencyFactor: frequencyFactor,
      dataFlowDirection: 'outgoing'
    };
  }
  
  /**
   * Calculate frequency factor for visualization
   * This helps visualize how often data flows through this output
   * 
   * @returns {number} Frequency factor (0-1)
   * @private
   */
  calculateFrequencyFactor() {
    // Convert frequency to a numeric factor
    const frequencyMap = {
      'continuous': 1.0,
      'periodic': 0.7,
      'scheduled': 0.5,
      'triggered': 0.3,
      'on-demand': 0.2
    };
    
    return frequencyMap[this.frequency] || 0.5;
  }
  
  /**
   * Get target connections for visualization
   * 
   * @returns {Array} Array of target connection objects
   */
  getTargetConnectionsForVisualization() {
    return this.target_connections.map(conn => ({
      id: `${this.id}_to_${conn.target}_${conn.type}`,
      sourceId: this.id,
      targetId: conn.target,
      type: conn.type || 'data_flow',
      isDirectional: true,
      isSensitive: this.is_sensitive,
      frequency: this.frequency
    }));
  }
  
  /**
   * Check if this output has a specific target
   * 
   * @param {string} targetId - Target ID to check
   * @returns {boolean} Whether the target is connected
   */
  hasTarget(targetId) {
    return this.target_connections.some(c => c.target === targetId);
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeDetails - Whether to include all details
   * @returns {Object} Plain object representation
   */
  toObject(includeDetails = false) {
    const baseObject = super.toObject(includeDetails);
    
    return {
      ...baseObject,
      target_connections: [...this.target_connections],
      frequency: this.frequency
    };
  }
}

// Register all classes with the registry
const InputNodeRegistered = registry.register(
  'data.models.InputNode',
  InputNode,
  ['data.models.Node'],
  {
    description: 'Input node representing data flowing into an application',
    level: 9,
    parentType: 'application'
  }
);

const OutputNodeRegistered = registry.register(
  'data.models.OutputNode',
  OutputNode,
  ['data.models.Node'],
  {
    description: 'Output node representing data flowing out of an application',
    level: 9,
    parentType: 'application'
  }
);

// Export all classes
export { InputNode, OutputNode };

