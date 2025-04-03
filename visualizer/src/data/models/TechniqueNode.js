import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';

/**
 * Technique Node class representing a specific technique for an integration
 * Techniques are Level 7 nodes that belong to an Integration
 * 
 * Techniques define specific methodologies or technical approaches for implementing
 * an integration. They bridge the gap between theoretical integration approaches
 * and practical applications. Techniques can be connected to multiple applications
 * that implement them in different contexts.
 * 
 * Techniques are particularly important for establishing consistent implementation
 * patterns across the system, ensuring that similar problems are solved in similar
 * ways. They also serve as documentation for implementation decisions.
 */
class TechniqueNode extends Node {
  /**
   * Create a Technique node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent integration ID
   * @param {Array} [data.applications] - Array of application IDs
   * @param {Object} [data.technique_details] - Technique details
   * @param {Object} [data.implementation_notes] - Implementation notes and guidance
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this technique
   */
  constructor(data) {
    // Set type and level for techniques
    const nodeData = {
      ...data,
      type: 'technique',
      level: 7,
      expandable: true,
    };
    
    super(nodeData);
    
    // Technique-specific properties
    this.applications = data.applications || [];
    this.technique_details = data.technique_details || {};
    this.implementation_notes = data.implementation_notes || {};
  }
  
  /**
   * Add an application to this technique
   * This establishes that the application is an implementation of this technique
   * 
   * @param {string} applicationId - Application ID
   */
  addApplication(applicationId) {
    if (!this.applications.includes(applicationId)) {
      this.applications.push(applicationId);
      
      // Notify system of change
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('technique:applicationAdded', {
        techniqueId: this.id,
        applicationId: applicationId
      });
    }
  }
  
  /**
   * Remove an application from this technique
   * 
   * @param {string} applicationId - Application ID
   * @returns {boolean} True if application was removed
   */
  removeApplication(applicationId) {
    const initialLength = this.applications.length;
    this.applications = this.applications.filter(id => id !== applicationId);
    
    // Notify system if removed
    if (initialLength > this.applications.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('technique:applicationRemoved', {
        techniqueId: this.id,
        applicationId: applicationId
      });
    }
    
    return this.applications.length < initialLength;
  }
  
  /**
   * Update technique details
   * Technique details provide specific information about how the technique
   * should be implemented and what considerations to take into account.
   * 
   * @param {Object} details - Technique details
   */
  updateTechniqueDetails(details) {
    this.technique_details = {
      ...this.technique_details,
      ...details
    };
    
    // Notify system of update
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('technique:detailsUpdated', {
      techniqueId: this.id
    });
  }
  
  /**
   * Update implementation notes
   * Implementation notes provide guidance for developers implementing this technique
   * 
   * @param {Object} notes - Implementation notes
   */
  updateImplementationNotes(notes) {
    this.implementation_notes = {
      ...this.implementation_notes,
      ...notes
    };
    
    // Notify system of update
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('technique:notesUpdated', {
      techniqueId: this.id
    });
  }
  
  /**
   * Get technique-specific visual properties to extend the base node properties
   * 
   * @returns {Object} Technique-specific visual properties
   */
  getTechniqueVisualProperties() {
    // Base properties from Node class
    const baseProps = super.getVisualProperties();
    
    // Add technique-specific properties
    return {
      ...baseProps,
      applicationCount: this.applications.length,
      hasDetailedNotes: Object.keys(this.implementation_notes).length > 0,
      detailsComplexity: this.calculateDetailsComplexity()
    };
  }
  
  /**
   * Calculate a complexity score for technique details
   * This can be used in visualization to adjust visual properties
   * 
   * @returns {number} Complexity score (0-100)
   * @private
   */
  calculateDetailsComplexity() {
    // Start with base complexity
    let complexity = 0;
    
    // Add complexity based on details
    if (this.technique_details) {
      // Add complexity based on the amount of details
      const detailsLength = JSON.stringify(this.technique_details).length;
      complexity += Math.min(50, detailsLength / 20);
      
      // Add complexity based on the number of fields
      complexity += Math.min(25, Object.keys(this.technique_details).length * 5);
    }
    
    // Add complexity based on implementation notes
    if (this.implementation_notes) {
      const notesLength = JSON.stringify(this.implementation_notes).length;
      complexity += Math.min(25, notesLength / 40);
    }
    
    // Cap complexity at 100
    return Math.min(100, complexity);
  }
  
  /**
   * Check if this technique has a specific application
   * 
   * @param {string} applicationId - Application ID to check
   * @returns {boolean} Whether the application is associated with this technique
   */
  hasApplication(applicationId) {
    return this.applications.includes(applicationId);
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
      applications: [...this.applications]
    };
    
    // Always include technique details
    result.technique_details = { ...this.technique_details };
    
    // Only include implementation notes if detailed view is requested
    if (includeDetails) {
      result.implementation_notes = { ...this.implementation_notes };
    }
    
    return result;
  }
}

export default registry.register(
  'data.models.TechniqueNode',
  TechniqueNode,
  ['data.models.Node'],
  {
    description: 'Technique node representing a specific technique for an integration',
    level: 7,
    parentType: 'integration'
  }
); 