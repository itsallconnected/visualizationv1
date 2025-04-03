// This is a placeholder file created by the migration script
// To be implemented according to the migration plan

import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';

/**
 * Capability Node class representing a functional area within a subcomponent
 * Capabilities are Level 3 nodes that belong to a Subcomponent
 * 
 * Capabilities define the functional areas or capacities of a subcomponent,
 * describing what the subcomponent can do rather than how it does it. They
 * serve as a bridge between high-level component structures and the specific
 * functions that implement these capabilities.
 * 
 * Capabilities are important for understanding the functional decomposition
 * of a system and for mapping requirements to implementation. They can also
 * be implemented by multiple subcomponents, creating a many-to-many relationship
 * that helps identify shared functionality across the system.
 * 
 * In the security model, capabilities can have special access controls and
 * sensitivity levels, as they often represent critical system functions.
 */
class CapabilityNode extends Node {
  /**
   * Create a Capability node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent subcomponent ID
   * @param {Array} [data.functions] - Array of function IDs
   * @param {Array} [data.implemented_by_subcomponents] - Array of subcomponent IDs that implement this capability
   * @param {Array} [data.required_capabilities] - Array of capability IDs that this capability depends on
   * @param {Object} [data.capability_metrics] - Metrics for measuring this capability
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this capability
   */
  constructor(data) {
    // Set type and level for capabilities
    const nodeData = {
      ...data,
      type: 'capability',
      level: 3,
      expandable: true,
    };
    
    super(nodeData);
    
    // Capability-specific properties
    this.functions = data.functions || [];
    this.implemented_by_subcomponents = data.implemented_by_subcomponents || [];
    this.required_capabilities = data.required_capabilities || [];
    this.capability_metrics = data.capability_metrics || {};
  }
  
  /**
   * Add a function to this capability
   * Functions define the specific ways a capability is implemented
   * 
   * @param {string} functionId - Function ID
   */
  addFunction(functionId) {
    if (!this.functions.includes(functionId)) {
      this.functions.push(functionId);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:functionAdded', {
        capabilityId: this.id,
        functionId: functionId
      });
    }
  }
  
  /**
   * Remove a function from this capability
   * 
   * @param {string} functionId - Function ID
   * @returns {boolean} True if function was removed
   */
  removeFunction(functionId) {
    const initialLength = this.functions.length;
    this.functions = this.functions.filter(id => id !== functionId);
    
    // Notify system if removed
    if (initialLength > this.functions.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:functionRemoved', {
        capabilityId: this.id,
        functionId: functionId
      });
    }
    
    return this.functions.length < initialLength;
  }
  
  /**
   * Add a subcomponent implementation relationship
   * This tracks which subcomponents implement this capability
   * 
   * @param {string} subcomponentId - Subcomponent ID
   */
  addImplementingSubcomponent(subcomponentId) {
    if (!this.implemented_by_subcomponents.includes(subcomponentId)) {
      this.implemented_by_subcomponents.push(subcomponentId);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:implementorAdded', {
        capabilityId: this.id,
        subcomponentId: subcomponentId
      });
    }
  }
  
  /**
   * Remove a subcomponent implementation relationship
   * 
   * @param {string} subcomponentId - Subcomponent ID
   * @returns {boolean} True if implementation was removed
   */
  removeImplementingSubcomponent(subcomponentId) {
    const initialLength = this.implemented_by_subcomponents.length;
    this.implemented_by_subcomponents = this.implemented_by_subcomponents.filter(id => id !== subcomponentId);
    
    // Notify system if removed
    if (initialLength > this.implemented_by_subcomponents.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:implementorRemoved', {
        capabilityId: this.id,
        subcomponentId: subcomponentId
      });
    }
    
    return this.implemented_by_subcomponents.length < initialLength;
  }
  
  /**
   * Add a required capability
   * Required capabilities are dependencies that this capability needs
   * 
   * @param {string} capabilityId - Capability ID
   */
  addRequiredCapability(capabilityId) {
    // Prevent self-reference
    if (capabilityId === this.id) {
      console.error('Cannot add self as a required capability');
      return false;
    }
    
    if (!this.required_capabilities.includes(capabilityId)) {
      this.required_capabilities.push(capabilityId);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:dependencyAdded', {
        capabilityId: this.id,
        requiredCapabilityId: capabilityId
      });
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Remove a required capability
   * 
   * @param {string} capabilityId - Capability ID
   * @returns {boolean} True if dependency was removed
   */
  removeRequiredCapability(capabilityId) {
    const initialLength = this.required_capabilities.length;
    this.required_capabilities = this.required_capabilities.filter(id => id !== capabilityId);
    
    // Notify system if removed
    if (initialLength > this.required_capabilities.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('capability:dependencyRemoved', {
        capabilityId: this.id,
        requiredCapabilityId: capabilityId
      });
    }
    
    return this.required_capabilities.length < initialLength;
  }
  
  /**
   * Update capability metrics
   * Metrics help measure and evaluate the capability
   * 
   * @param {Object} metrics - Capability metrics
   */
  updateCapabilityMetrics(metrics) {
    this.capability_metrics = {
      ...this.capability_metrics,
      ...metrics
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('capability:metricsUpdated', {
      capabilityId: this.id
    });
  }
  
  /**
   * Get capability-specific visual properties for visualization
   * 
   * @returns {Object} Visual properties specific to this capability
   */
  getCapabilityVisualProperties() {
    // Get base visual properties from parent class
    const baseProps = super.getVisualProperties();
    
    // Calculate dependency complexity for visual representation
    const dependencyComplexity = this.calculateDependencyComplexity();
    
    // Add capability-specific properties
    return {
      ...baseProps,
      functionCount: this.functions.length,
      implementorCount: this.implemented_by_subcomponents.length,
      dependencyCount: this.required_capabilities.length,
      hasMetrics: Object.keys(this.capability_metrics).length > 0,
      dependencyComplexity: dependencyComplexity,
      // Include key metrics for visualization if they exist
      ...(this.capability_metrics.importance && {
        importance: this.capability_metrics.importance
      }),
      ...(this.capability_metrics.maturity && {
        maturity: this.capability_metrics.maturity
      })
    };
  }
  
  /**
   * Calculate a dependency complexity score for visualization purposes
   * This measures how interconnected this capability is
   * 
   * @returns {number} Complexity score (0-100)
   * @private
   */
  calculateDependencyComplexity() {
    // Start with base score
    let complexity = 0;
    
    // Add score based on dependencies
    complexity += Math.min(40, this.required_capabilities.length * 10);
    
    // Add score based on implementors
    complexity += Math.min(30, this.implemented_by_subcomponents.length * 7.5);
    
    // Add score based on functions
    complexity += Math.min(30, this.functions.length * 5);
    
    // Cap complexity at 100
    return Math.min(100, complexity);
  }
  
  /**
   * Get implementation relationships for visualization
   * 
   * @returns {Array} Array of implementation relationships
   */
  getImplementationRelationships() {
    return this.implemented_by_subcomponents.map(subcompId => ({
      id: `${subcompId}_implements_${this.id}`,
      sourceId: subcompId,
      targetId: this.id,
      type: 'implements',
      isDirectional: true
    }));
  }
  
  /**
   * Get dependency relationships for visualization
   * 
   * @returns {Array} Array of dependency relationships
   */
  getDependencyRelationships() {
    return this.required_capabilities.map(capId => ({
      id: `${this.id}_depends_on_${capId}`,
      sourceId: this.id,
      targetId: capId,
      type: 'depends_on',
      isDirectional: true
    }));
  }
  
  /**
   * Check if this capability is implemented by a specific subcomponent
   * 
   * @param {string} subcomponentId - Subcomponent ID to check
   * @returns {boolean} Whether the subcomponent implements this capability
   */
  isImplementedBy(subcomponentId) {
    return this.implemented_by_subcomponents.includes(subcomponentId);
  }
  
  /**
   * Check if this capability depends on another capability
   * 
   * @param {string} capabilityId - Capability ID to check
   * @returns {boolean} Whether this capability requires the specified capability
   */
  requires(capabilityId) {
    return this.required_capabilities.includes(capabilityId);
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeDetails - Whether to include full details
   * @returns {Object} Plain object representation
   */
  toObject(includeDetails = false) {
    const baseObject = super.toObject(includeDetails);
    
    const result = {
      ...baseObject,
      functions: [...this.functions],
      implemented_by_subcomponents: [...this.implemented_by_subcomponents]
    };
    
    // Include additional details if requested
    if (includeDetails) {
      result.required_capabilities = [...this.required_capabilities];
      result.capability_metrics = { ...this.capability_metrics };
    }
    
    return result;
  }
}

export default registry.register(
  'data.models.CapabilityNode',
  CapabilityNode,
  ['data.models.Node'],
  {
    description: 'Capability node representing a functional area within a subcomponent',
    level: 3,
    parentType: 'subcomponent'
  }
);

