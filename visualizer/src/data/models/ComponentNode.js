import Node from './Node';
import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';
import { EncryptionService } from '../../encryption/EncryptionService';

/**
 * Component Node class representing a major category in the visualization
 * Components are Level 1 nodes that belong to a Component Group
 */
class ComponentNode extends Node {
  /**
   * Create a Component node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.description - Node description
   * @param {string} data.parent - Parent component group ID
   * @param {Array} [data.relationships] - Array of relationships with other components
   * @param {Object} [data.metadata] - Additional metadata
   * @param {Object} [data.visualProperties] - Visual properties for this component
   */
  constructor(data) {
    // Set type and level for components
    const nodeData = {
      ...data,
      type: 'component',
      level: 1,
      expandable: true,
    };
    
    super(nodeData);
    
    // Component-specific properties
    this.relationships = data.relationships || [];
    
    // Track subcomponents that implement this component
    this.implementedBy = data.implementedBy || [];
    
    // Track relationship encryption status
    this._relationshipEncryption = {};
    
    // Initialize relationship permissions
    this.initializeRelationshipPermissions();
  }
  
  /**
   * Set up permission tracking for relationships
   */
  initializeRelationshipPermissions() {
    this.relationships.forEach(relationship => {
      // Every relationship gets its own permission settings
      if (!relationship.permissions) {
        relationship.permissions = {
          view: ['admin', 'editor', 'contributor', 'viewer'],
          edit: ['admin', 'editor'],
          delete: ['admin']
        };
      }
      
      // Track encryption status for each relationship
      this._relationshipEncryption[relationship.target] = relationship.isEncrypted || false;
    });
  }
  
  /**
   * Add a relationship to another component
   * 
   * @param {string} targetId - Target component ID
   * @param {string} type - Relationship type
   * @param {Object} metadata - Additional relationship data
   * @param {boolean} isEncrypted - Whether this relationship should be encrypted
   */
  addRelationship(targetId, type, metadata = {}, isEncrypted = false) {
    const relationship = {
      target: targetId,
      type: type,
      isEncrypted: isEncrypted,
      permissions: metadata.permissions || {
        view: ['admin', 'editor', 'contributor', 'viewer'],
        edit: ['admin', 'editor'],
        delete: ['admin']
      },
      ...metadata
    };
    
    // Check if relationship already exists
    const existingIndex = this.relationships.findIndex(r => 
      r.target === targetId && r.type === type
    );
    
    if (existingIndex >= 0) {
      this.relationships[existingIndex] = relationship;
    } else {
      this.relationships.push(relationship);
    }
    
    // Track encryption status
    this._relationshipEncryption[targetId] = isEncrypted;
    
    // Notify system of relationship change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('component:relationshipAdded', { 
      sourceId: this.id, 
      targetId: targetId,
      type: type
    });
  }
  
  /**
   * Remove a relationship
   * 
   * @param {string} targetId - Target component ID
   * @param {string} type - Relationship type
   * @returns {boolean} True if relationship was removed
   */
  removeRelationship(targetId, type) {
    const initialLength = this.relationships.length;
    this.relationships = this.relationships.filter(r => 
      !(r.target === targetId && r.type === type)
    );
    
    // Clean up encryption tracking
    if (this._relationshipEncryption[targetId]) {
      delete this._relationshipEncryption[targetId];
    }
    
    // Notify system of relationship removal
    if (initialLength > this.relationships.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('component:relationshipRemoved', { 
        sourceId: this.id, 
        targetId: targetId,
        type: type
      });
    }
    
    return this.relationships.length < initialLength;
  }
  
  /**
   * Encrypt a specific relationship
   * 
   * @param {string} targetId - Target component ID
   * @param {string} type - Relationship type
   * @param {string} password - Encryption password
   * @returns {boolean} Success state
   */
  encryptRelationship(targetId, type, password) {
    const relationship = this.relationships.find(r => 
      r.target === targetId && r.type === type
    );
    
    if (!relationship) {
      return false;
    }
    
    // Convert relationship data to string for encryption
    const relationshipData = JSON.stringify(relationship);
    
    try {
      const result = EncryptionService.encrypt(relationshipData, password);
      
      if (result.success) {
        // Store encrypted data
        relationship.encryptedData = result.encryptedData;
        relationship.encryptionMetadata = result.metadata;
        relationship.isEncrypted = true;
        
        // Update tracking
        this._relationshipEncryption[targetId] = true;
        
        // Notify system
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('component:relationshipEncrypted', { 
          sourceId: this.id, 
          targetId: targetId
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Relationship encryption failed:', error);
      return false;
    }
  }
  
  /**
   * Decrypt a specific relationship
   * 
   * @param {string} targetId - Target component ID
   * @param {string} type - Relationship type
   * @param {string} password - Decryption password
   * @returns {Object|null} Decrypted relationship data or null if failed
   */
  decryptRelationship(targetId, type, password) {
    const relationship = this.relationships.find(r => 
      r.target === targetId && r.type === type && r.isEncrypted
    );
    
    if (!relationship || !relationship.encryptedData) {
      return null;
    }
    
    try {
      const result = EncryptionService.decrypt(
        relationship.encryptedData,
        password,
        relationship.encryptionMetadata
      );
      
      if (result.success) {
        // Parse the decrypted JSON data
        const decryptedRelationship = JSON.parse(result.decryptedData);
        
        // Notify system
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('component:relationshipDecrypted', { 
          sourceId: this.id, 
          targetId: targetId
        });
        
        return decryptedRelationship;
      }
      return null;
    } catch (error) {
      console.error('Relationship decryption failed:', error);
      return null;
    }
  }
  
  /**
   * Check if user has permission for a specific relationship
   * 
   * @param {string} targetId - Target component ID
   * @param {string} permission - Permission type (view, edit, delete)
   * @param {string} userRole - User role
   * @returns {boolean} Whether user has permission
   */
  hasRelationshipPermission(targetId, permission, userRole) {
    const relationship = this.relationships.find(r => r.target === targetId);
    
    if (!relationship || !relationship.permissions) {
      return false;
    }
    
    const permissionRoles = relationship.permissions[permission] || [];
    return permissionRoles.includes(userRole);
  }
  
  /**
   * Register this component as being implemented by a subcomponent
   * 
   * @param {string} subcomponentId - ID of implementing subcomponent
   */
  addImplementation(subcomponentId) {
    if (!this.implementedBy.includes(subcomponentId)) {
      this.implementedBy.push(subcomponentId);
      
      // Notify system
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('component:implementationAdded', { 
        componentId: this.id, 
        subcomponentId: subcomponentId
      });
    }
  }
  
  /**
   * Remove implementation relationship
   * 
   * @param {string} subcomponentId - ID of implementing subcomponent
   * @returns {boolean} Whether implementation was removed
   */
  removeImplementation(subcomponentId) {
    const initialLength = this.implementedBy.length;
    this.implementedBy = this.implementedBy.filter(id => id !== subcomponentId);
    
    // Notify system if removed
    if (initialLength > this.implementedBy.length) {
      const eventBus = registry.getModule('utils.EventBus') || EventBus;
      eventBus.emit('component:implementationRemoved', { 
        componentId: this.id, 
        subcomponentId: subcomponentId
      });
    }
    
    return this.implementedBy.length < initialLength;
  }
  
  /**
   * Get component-specific visual properties to extend the base node properties
   * 
   * @returns {Object} Component-specific visual properties
   */
  getComponentVisualProperties() {
    // Base properties from Node class
    const baseProps = super.getVisualProperties();
    
    // Add component-specific properties
    return {
      ...baseProps,
      relationshipCount: this.relationships.length,
      hasEncryptedRelationships: Object.values(this._relationshipEncryption).some(val => val),
      implementationCount: this.implementedBy.length
    };
  }
  
  /**
   * Get relationships as visualization-ready objects
   * 
   * @returns {Array} Array of relationship objects for visualization
   */
  getRelationshipsForVisualization() {
    return this.relationships.map(rel => ({
      id: `${this.id}_to_${rel.target}_${rel.type}`,
      sourceId: this.id,
      targetId: rel.target,
      type: rel.type,
      isEncrypted: rel.isEncrypted,
      isDirectional: true,
      metadata: rel.metadata || {}
    }));
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeEncrypted - Whether to include encrypted data
   * @returns {Object} Plain object representation
   */
  toObject(includeEncrypted = false) {
    const baseObject = super.toObject(includeEncrypted);
    
    // Filter relationships based on encryption status
    const filteredRelationships = this.relationships.map(relationship => {
      if (relationship.isEncrypted && !includeEncrypted) {
        // Return limited information for encrypted relationships
        return {
          target: relationship.target,
          type: relationship.type,
          isEncrypted: true
        };
      }
      return { ...relationship };
    });
    
    return {
      ...baseObject,
      relationships: filteredRelationships,
      implementedBy: [...this.implementedBy]
    };
  }
}

export default registry.register(
  'data.models.ComponentNode',
  ComponentNode,
  ['data.models.Node'],
  {
    description: 'Component node representing a major category',
    level: 1,
    parentType: 'component_group'
  }
);

