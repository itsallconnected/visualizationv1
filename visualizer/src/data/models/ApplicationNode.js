import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';

/**
 * Application Node class representing a practical application of a technique
 * Applications are Level 8 nodes that belong to a Technique
 */
class ApplicationNode extends Node {
  /**
   * Create an Application node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent technique ID
   * @param {Array} [data.inputs] - Array of input IDs
   * @param {Array} [data.outputs] - Array of output IDs
   * @param {Object} [data.application_details] - Application details
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Custom visual properties
   */
  constructor(data) {
    // Set type and level for applications
    const nodeData = {
      ...data,
      type: 'application',
      level: 8,
      expandable: true,
    };
    
    super(nodeData);
    
    // Application-specific properties
    this.inputs = data.inputs || [];
    this.outputs = data.outputs || [];
    this.application_details = data.application_details || {};
    
    // Track sensitive I/O
    this._sensitiveInputs = new Set(data.sensitiveInputs || []);
    this._sensitiveOutputs = new Set(data.sensitiveOutputs || []);
  }
  
  /**
   * Add an input to this application
   * 
   * @param {string} inputId - Input ID
   * @param {boolean} isSensitive - Whether this input contains sensitive data
   */
  addInput(inputId, isSensitive = false) {
    if (!this.inputs.includes(inputId)) {
      this.inputs.push(inputId);
      
      // Track sensitive inputs
      if (isSensitive) {
        this._sensitiveInputs.add(inputId);
      }
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('application:inputAdded', {
        applicationId: this.id,
        inputId: inputId,
        isSensitive: isSensitive
      });
    }
  }
  
  /**
   * Remove an input from this application
   * 
   * @param {string} inputId - Input ID
   * @returns {boolean} True if input was removed
   */
  removeInput(inputId) {
    const initialLength = this.inputs.length;
    this.inputs = this.inputs.filter(id => id !== inputId);
    
    // Remove from sensitive tracking
    this._sensitiveInputs.delete(inputId);
    
    // Notify system if removed
    if (initialLength > this.inputs.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('application:inputRemoved', {
        applicationId: this.id,
        inputId: inputId
      });
    }
    
    return this.inputs.length < initialLength;
  }
  
  /**
   * Add an output to this application
   * 
   * @param {string} outputId - Output ID
   * @param {boolean} isSensitive - Whether this output contains sensitive data
   */
  addOutput(outputId, isSensitive = false) {
    if (!this.outputs.includes(outputId)) {
      this.outputs.push(outputId);
      
      // Track sensitive outputs
      if (isSensitive) {
        this._sensitiveOutputs.add(outputId);
      }
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('application:outputAdded', {
        applicationId: this.id,
        outputId: outputId,
        isSensitive: isSensitive
      });
    }
  }
  
  /**
   * Remove an output from this application
   * 
   * @param {string} outputId - Output ID
   * @returns {boolean} True if output was removed
   */
  removeOutput(outputId) {
    const initialLength = this.outputs.length;
    this.outputs = this.outputs.filter(id => id !== outputId);
    
    // Remove from sensitive tracking
    this._sensitiveOutputs.delete(outputId);
    
    // Notify system if removed
    if (initialLength > this.outputs.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('application:outputRemoved', {
        applicationId: this.id,
        outputId: outputId
      });
    }
    
    return this.outputs.length < initialLength;
  }
  
  /**
   * Check if an input or output is sensitive
   * 
   * @param {string} id - Input or output ID
   * @param {string} type - 'input' or 'output'
   * @returns {boolean} Whether the input/output is sensitive
   */
  isIOSensitive(id, type) {
    if (type === 'input') {
      return this._sensitiveInputs.has(id);
    } else if (type === 'output') {
      return this._sensitiveOutputs.has(id);
    }
    return false;
  }
  
  /**
   * Update application details
   * 
   * @param {Object} details - Application details
   */
  updateApplicationDetails(details) {
    this.application_details = {
      ...this.application_details,
      ...details
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('application:detailsUpdated', {
      applicationId: this.id
    });
  }
  
  /**
   * Get application-specific visual properties to extend the base node properties
   * 
   * @returns {Object} Application-specific visual properties
   */
  getAppVisualProperties() {
    // Base properties from Node class
    const baseProps = super.getVisualProperties();
    
    // Add application-specific properties
    return {
      ...baseProps,
      hasInputs: this.inputs.length > 0,
      hasOutputs: this.outputs.length > 0,
      hasSensitiveData: this._sensitiveInputs.size > 0 || this._sensitiveOutputs.size > 0,
      ioCount: this.inputs.length + this.outputs.length
    };
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeSecurityDetails - Whether to include security information
   * @returns {Object} Plain object representation
   */
  toObject(includeSecurityDetails = false) {
    const baseObject = super.toObject(includeSecurityDetails);
    
    const obj = {
      ...baseObject,
      inputs: [...this.inputs],
      outputs: [...this.outputs],
      application_details: { ...this.application_details }
    };
    
    // Include security information if requested
    if (includeSecurityDetails) {
      obj.sensitiveInputs = Array.from(this._sensitiveInputs);
      obj.sensitiveOutputs = Array.from(this._sensitiveOutputs);
    }
    
    return obj;
  }
}

export default registry.register(
  'data.models.ApplicationNode',
  ApplicationNode,
  ['data.models.Node'],
  {
    description: 'Application node representing a practical application of a technique',
    level: 8,
    parentType: 'technique'
  }
); 