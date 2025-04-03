import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';

/**
 * Integration Node class representing a system integration approach
 * Integrations are Level 6 nodes that belong to a Specification
 * 
 * Integration nodes define how specifications are integrated into larger systems.
 * They bridge the gap between theoretical specifications and practical techniques
 * for implementation. Integration nodes provide important context about system
 * interactions, technical considerations, and strategic approaches.
 * 
 * Integrations serve as a crucial translation layer between abstract functional
 * specifications and concrete implementation techniques. They document the strategic
 * decisions made when implementing a specification within the broader system context.
 */
class IntegrationNode extends Node {
  /**
   * Create an Integration node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent specification ID
   * @param {Array} [data.techniques] - Array of technique IDs
   * @param {Object} [data.integration_approach] - Integration approach details
   * @param {Array} [data.constraints] - Implementation constraints
   * @param {Array} [data.dependencies] - External dependencies
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this integration
   */
  constructor(data) {
    // Set type and level for integrations
    const nodeData = {
      ...data,
      type: 'integration',
      level: 6,
      expandable: true,
    };
    
    super(nodeData);
    
    // Integration-specific properties
    this.techniques = data.techniques || [];
    this.integration_approach = data.integration_approach || {};
    this.constraints = data.constraints || [];
    this.dependencies = data.dependencies || [];
  }
  
  /**
   * Add a technique to this integration
   * Techniques represent specific methodologies for implementing this integration
   * 
   * @param {string} techniqueId - Technique ID
   */
  addTechnique(techniqueId) {
    if (!this.techniques.includes(techniqueId)) {
      this.techniques.push(techniqueId);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('integration:techniqueAdded', {
        integrationId: this.id,
        techniqueId: techniqueId
      });
    }
  }
  
  /**
   * Remove a technique from this integration
   * 
   * @param {string} techniqueId - Technique ID
   * @returns {boolean} True if technique was removed
   */
  removeTechnique(techniqueId) {
    const initialLength = this.techniques.length;
    this.techniques = this.techniques.filter(id => id !== techniqueId);
    
    // Notify system if removed
    if (initialLength > this.techniques.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('integration:techniqueRemoved', {
        integrationId: this.id,
        techniqueId: techniqueId
      });
    }
    
    return this.techniques.length < initialLength;
  }
  
  /**
   * Update integration approach details
   * The integration approach defines the strategic and tactical decisions
   * for implementing the parent specification
   * 
   * @param {Object} approach - Integration approach details
   */
  updateIntegrationApproach(approach) {
    this.integration_approach = {
      ...this.integration_approach,
      ...approach
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('integration:approachUpdated', {
      integrationId: this.id
    });
  }
  
  /**
   * Add a constraint to this integration
   * Constraints define limitations or requirements that affect implementation
   * 
   * @param {Object} constraint - Constraint details
   * @param {string} constraint.id - Constraint ID
   * @param {string} constraint.description - Constraint description
   * @param {string} [constraint.type] - Constraint type (technical, business, legal, etc.)
   * @param {string} [constraint.impact] - Impact level (high, medium, low)
   * @returns {boolean} Success status
   */
  addConstraint(constraint) {
    // Validate constraint
    if (!constraint.id || !constraint.description) {
      console.error('Invalid constraint format');
      return false;
    }
    
    // Check if constraint already exists
    const existingIndex = this.constraints.findIndex(c => c.id === constraint.id);
    
    if (existingIndex >= 0) {
      // Update existing constraint
      this.constraints[existingIndex] = { ...constraint };
    } else {
      // Add new constraint
      this.constraints.push({ ...constraint });
    }
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('integration:constraintAdded', {
      integrationId: this.id,
      constraintId: constraint.id
    });
    
    return true;
  }
  
  /**
   * Remove a constraint
   * 
   * @param {string} constraintId - Constraint ID
   * @returns {boolean} True if constraint was removed
   */
  removeConstraint(constraintId) {
    const initialLength = this.constraints.length;
    this.constraints = this.constraints.filter(c => c.id !== constraintId);
    
    // Notify system if removed
    if (initialLength > this.constraints.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('integration:constraintRemoved', {
        integrationId: this.id,
        constraintId: constraintId
      });
    }
    
    return this.constraints.length < initialLength;
  }
  
  /**
   * Add a dependency to this integration
   * Dependencies represent external systems, libraries, or services
   * that this integration requires
   * 
   * @param {Object} dependency - Dependency details
   * @param {string} dependency.id - Dependency ID
   * @param {string} dependency.name - Dependency name
   * @param {string} [dependency.version] - Version requirement
   * @param {string} [dependency.type] - Dependency type (library, service, system, etc.)
   * @returns {boolean} Success status
   */
  addDependency(dependency) {
    // Validate dependency
    if (!dependency.id || !dependency.name) {
      console.error('Invalid dependency format');
      return false;
    }
    
    // Check if dependency already exists
    const existingIndex = this.dependencies.findIndex(d => d.id === dependency.id);
    
    if (existingIndex >= 0) {
      // Update existing dependency
      this.dependencies[existingIndex] = { ...dependency };
    } else {
      // Add new dependency
      this.dependencies.push({ ...dependency });
    }
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('integration:dependencyAdded', {
      integrationId: this.id,
      dependencyId: dependency.id
    });
    
    return true;
  }
  
  /**
   * Remove a dependency
   * 
   * @param {string} dependencyId - Dependency ID
   * @returns {boolean} True if dependency was removed
   */
  removeDependency(dependencyId) {
    const initialLength = this.dependencies.length;
    this.dependencies = this.dependencies.filter(d => d.id !== dependencyId);
    
    // Notify system if removed
    if (initialLength > this.dependencies.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('integration:dependencyRemoved', {
        integrationId: this.id,
        dependencyId: dependencyId
      });
    }
    
    return this.dependencies.length < initialLength;
  }
  
  /**
   * Get integration-specific visual properties
   * 
   * @returns {Object} Integration-specific visual properties for visualization
   */
  getIntegrationVisualProperties() {
    // Get base visual properties from parent class
    const baseProps = super.getVisualProperties();
    
    // Add integration-specific properties
    return {
      ...baseProps,
      techniqueCount: this.techniques.length,
      constraintCount: this.constraints.length,
      dependencyCount: this.dependencies.length,
      approachComplexity: this.calculateApproachComplexity(),
      highImpactConstraints: this.getHighImpactConstraints().length,
      criticalDependencies: this.getCriticalDependencies().length
    };
  }
  
  /**
   * Calculate approach complexity for visualization purposes
   * 
   * @returns {number} Complexity score (0-100)
   * @private
   */
  calculateApproachComplexity() {
    // Start with base score
    let complexity = 0;
    
    // Calculate approach complexity based on integration details
    const approachDetails = JSON.stringify(this.integration_approach);
    complexity += Math.min(40, approachDetails.length / 25);
    
    // Add complexity based on constraints
    complexity += Math.min(30, this.constraints.length * 5);
    
    // Add complexity based on dependencies
    complexity += Math.min(30, this.dependencies.length * 5);
    
    // Cap complexity at 100
    return Math.min(100, complexity);
  }
  
  /**
   * Get technique relationships for visualization
   * 
   * @returns {Array} Array of technique relationships
   */
  getTechniqueRelationships() {
    return this.techniques.map(techId => ({
      id: `${this.id}_to_${techId}`,
      sourceId: this.id,
      targetId: techId,
      type: 'contains',
      isDirectional: true,
      metadata: { relationship: 'integration_technique' }
    }));
  }
  
  /**
   * Get high impact constraints
   * 
   * @returns {Array} Array of high impact constraints
   * @private
   */
  getHighImpactConstraints() {
    return this.constraints.filter(c => 
      c.impact === 'high' || c.impact === 'critical'
    );
  }
  
  /**
   * Get critical dependencies
   * 
   * @returns {Array} Array of critical dependencies
   * @private
   */
  getCriticalDependencies() {
    return this.dependencies.filter(d => 
      d.criticality === 'high' || d.criticality === 'critical'
    );
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
      techniques: [...this.techniques],
      integration_approach: { ...this.integration_approach }
    };
    
    // Include additional details if requested
    if (includeDetails) {
      result.constraints = this.constraints.map(c => ({ ...c }));
      result.dependencies = this.dependencies.map(d => ({ ...d }));
    }
    
    return result;
  }
}

export default registry.register(
  'data.models.IntegrationNode',
  IntegrationNode,
  ['data.models.Node'],
  {
    description: 'Integration node representing a system integration approach',
    level: 6,
    parentType: 'specification'
  }
); 