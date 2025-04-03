import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';
import { EncryptionService } from '../../encryption/EncryptionService';

/**
 * Base Node class for all node types in the visualization
 * Provides core functionality including encryption, permissions, data operations
 * and visualization properties handling
 */
class Node {
  /**
   * Create a node
   * 
   * @param {Object} data - Node data
   * @param {string} data.id - Unique identifier
   * @param {string} data.name - Node name
   * @param {string} data.type - Node type (component_group, component, subcomponent, etc.)
   * @param {string} data.description - Node description
   * @param {string} [data.parent] - Parent node ID
   * @param {number} [data.level=0] - Hierarchy level
   * @param {boolean} [data.expandable=false] - Whether the node can be expanded
   * @param {boolean} [data.has_children=false] - Whether the node has children
   * @param {boolean} [data.isEncrypted=false] - Whether the node content is encrypted
   * @param {Object} [data.permissions] - Node-specific access permissions
   * @param {string} [data.encryptedContent] - Encrypted content
   * @param {string} [data.encryptionMetadata] - Encryption metadata
   * @param {Object} [data.position] - 3D position for visualization
   * @param {Object} [data.visualProperties] - Custom visual properties
   */
  constructor(data) {
    this.id = data.id;
    this.name = data.name || 'Unnamed Node';
    this.type = data.type || 'unknown';
    this.description = data.description || '';
    this.parent = data.parent || null;
    this.level = data.level || 0;
    this.expandable = data.expandable ?? false;
    this.has_children = data.has_children ?? false;
    this.isEncrypted = data.isEncrypted ?? false;
    
    // Set visualization properties
    this.position = data.position || { x: 0, y: 0, z: 0 };
    this.visible = data.visible ?? true;
    this.expanded = data.expanded ?? false;
    this.selected = data.selected ?? false;
    this.hovered = data.hovered ?? false;
    this.highlighted = data.highlighted ?? false;
    this.visualProperties = data.visualProperties || {};
    
    // Additional metadata
    this.metadata = data.metadata || {};
    
    // Security properties
    this.permissions = data.permissions || {
      view: ['admin', 'editor', 'contributor', 'viewer'],
      edit: ['admin', 'editor'],
      delete: ['admin']
    };
    
    // Encryption data
    this.encryptedContent = data.encryptedContent || null;
    this.encryptionMetadata = data.encryptionMetadata || null;
    
    // Track encryption status
    this._encryptionStatus = {
      isProtected: this.isEncrypted,
      isDecrypted: false,
      sensitiveContent: null  // Holds decrypted content in memory
    };
    
    // Track when this node was last updated
    this.lastUpdated = data.lastUpdated || new Date().toISOString();
    this.createdBy = data.createdBy || null;
    this.lastUpdatedBy = data.lastUpdatedBy || null;
    
    // Version control
    this.version = data.version || 1;
    this.versionHistory = data.versionHistory || [];
  }
  
  /**
   * Get the node's display properties for visualization
   * This method uses the VisualizationManager to get visual properties
   * and includes state information rather than colors/sizes directly
   * 
   * @returns {Object} Visual properties for the node
   */
  getVisualProperties() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      // Use VisualizationManager to get visual properties
      return visualizationManager.getNodeVisualProperties(this);
    }
    
    // Fallback if VisualizationManager isn't available
    return {
      type: this.type,
      level: this.level,
      opacity: this.visible ? 1.0 : 0.3,
      position: { ...this.position },
      selected: this.selected,
      hovered: this.hovered,
      highlighted: this.highlighted,
      expanded: this.expanded,
      locked: this.isEncrypted && !this._encryptionStatus.isDecrypted,
      hasPermissionIssue: !this.currentUserHasPermission('view'),
      ...this.visualProperties
    };
  }
  
  /**
   * Set the expanded state of the node
   * 
   * @param {boolean} expanded - New expanded state
   */
  setExpanded(expanded) {
    this.expanded = expanded;
    
    // Notify the system of expansion state change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:expansionChanged', {
      nodeId: this.id,
      expanded: this.expanded
    });
  }
  
  /**
   * Set visibility state of the node
   * 
   * @param {boolean} visible - New visibility state
   */
  setVisible(visible) {
    this.visible = visible;
    
    // Notify the system of visibility change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:visibilityChanged', {
      nodeId: this.id,
      visible: this.visible
    });
  }
  
  /**
   * Set the position of the node
   * 
   * @param {Object} position - New position
   * @param {number} position.x - X coordinate
   * @param {number} position.y - Y coordinate
   * @param {number} position.z - Z coordinate
   */
  setPosition(position) {
    this.position = { ...position };
    
    // Notify the system of position change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:positionChanged', {
      nodeId: this.id,
      position: this.position
    });
  }
  
  /**
   * Set the selected state of the node
   * 
   * @param {boolean} selected - New selection state
   */
  setSelected(selected) {
    this.selected = selected;
    
    // Notify the system of selection change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:selectionChanged', {
      nodeId: this.id,
      selected: this.selected
    });
  }
  
  /**
   * Set the hover state of the node
   * 
   * @param {boolean} hovered - New hover state
   */
  setHovered(hovered) {
    this.hovered = hovered;
    
    // Notify the system of hover change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:hoverChanged', {
      nodeId: this.id,
      hovered: this.hovered
    });
  }
  
  /**
   * Set the highlight state of the node
   * 
   * @param {boolean} highlighted - New highlight state
   */
  setHighlighted(highlighted) {
    this.highlighted = highlighted;
    
    // Notify the system of highlight change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:highlightChanged', {
      nodeId: this.id,
      highlighted: this.highlighted
    });
  }
  
  /**
   * Update visual properties for customizing appearance
   * 
   * @param {Object} properties - Custom visual properties
   */
  updateVisualProperties(properties) {
    this.visualProperties = {
      ...this.visualProperties,
      ...properties
    };
    
    // Notify the system of visual properties change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:visualPropertiesChanged', {
      nodeId: this.id,
      properties: this.visualProperties
    });
  }
  
  /**
   * Encrypt node content using the EncryptionService
   * 
   * @param {string} content - Content to encrypt
   * @param {string} password - Encryption password
   * @returns {boolean} Success state
   */
  encryptContent(content, password) {
    try {
      const result = EncryptionService.encrypt(content, password);
      
      if (result.success) {
        this.encryptedContent = result.encryptedData;
        this.encryptionMetadata = result.metadata;
        this.isEncrypted = true;
        this._encryptionStatus.isProtected = true;
        this._encryptionStatus.isDecrypted = false;
        this._encryptionStatus.sensitiveContent = null;
        
        // Notify system of encryption change
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('node:encrypted', { 
          nodeId: this.id
        });
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Encryption failed:', error);
      return false;
    }
  }
  
  /**
   * Decrypt node content using the EncryptionService
   * 
   * @param {string} password - Decryption password
   * @returns {string|null} Decrypted content or null if decryption failed
   */
  decryptContent(password) {
    if (!this.isEncrypted || !this.encryptedContent) {
      return null;
    }
    
    try {
      const result = EncryptionService.decrypt(
        this.encryptedContent,
        password,
        this.encryptionMetadata
      );
      
      if (result.success) {
        // Update encryption status
        this._encryptionStatus.isDecrypted = true;
        this._encryptionStatus.sensitiveContent = result.decryptedData;
        
        // Notify system of decryption
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('node:decrypted', { 
          nodeId: this.id
        });
        
        return result.decryptedData;
      }
      
      return null;
    } catch (error) {
      console.error('Decryption failed:', error);
      this._encryptionStatus.isDecrypted = false;
      return null;
    }
  }
  
  /**
   * Check if current user has specified permission for this node
   * 
   * @param {string} permission - Permission to check (view, edit, delete)
   * @param {string} role - User role to check against (defaults to current user role)
   * @returns {boolean} Whether user has permission
   */
  currentUserHasPermission(permission, role) {
    // Get current user role from AuthContext if not specified
    const userRole = role || window.currentUserRole || 'viewer';
    
    if (!this.permissions || !this.permissions[permission]) {
      return false;
    }
    
    return this.permissions[permission].includes(userRole);
  }
  
  /**
   * Update permissions for this node
   * 
   * @param {Object} permissions - New permissions object
   * @param {Array<string>} permissions.view - Roles that can view
   * @param {Array<string>} permissions.edit - Roles that can edit
   * @param {Array<string>} permissions.delete - Roles that can delete
   */
  updatePermissions(permissions) {
    this.permissions = {
      ...this.permissions,
      ...permissions
    };
    
    // Notify system of permission change
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:permissionsChanged', { 
      nodeId: this.id
    });
  }
  
  /**
   * Create a new version of this node
   * 
   * @param {string} userId - ID of user creating version
   * @param {string} comment - Version comment
   */
  createVersion(userId, comment = '') {
    // Create version record
    const versionRecord = {
      version: this.version,
      timestamp: new Date().toISOString(),
      userId: userId,
      comment: comment,
      state: this.toObject()
    };
    
    // Add to history
    this.versionHistory.push(versionRecord);
    
    // Increment version
    this.version += 1;
    this.lastUpdated = new Date().toISOString();
    this.lastUpdatedBy = userId;
    
    // Notify system of version creation
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:versionCreated', { 
      nodeId: this.id, 
      version: this.version - 1 
    });
  }
  
  /**
   * Revert to a specific version
   * 
   * @param {number} version - Version to revert to
   * @param {string} userId - ID of user performing reversion
   * @returns {boolean} Success state
   */
  revertToVersion(version, userId) {
    const versionRecord = this.versionHistory.find(v => v.version === version);
    
    if (!versionRecord) {
      return false;
    }
    
    // Create a new version recording this reversion
    this.createVersion(userId, `Reverted to version ${version}`);
    
    // Apply old state (except version and history)
    const oldState = versionRecord.state;
    const currentVersion = this.version;
    const currentHistory = [...this.versionHistory];
    
    Object.assign(this, oldState);
    
    // Restore current version and history
    this.version = currentVersion;
    this.versionHistory = currentHistory;
    
    // Notify system of reversion
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('node:versionReverted', { 
      nodeId: this.id, 
      version: version 
    });
    
    return true;
  }
  
  /**
   * Convert to a plain object for serialization
   * Sensitive encrypted data is handled safely
   * 
   * @param {boolean} includeDecrypted - Whether to include decrypted content
   * @returns {Object} Plain object representation
   */
  toObject(includeDecrypted = false) {
    const obj = {
      id: this.id,
      name: this.name,
      type: this.type,
      description: this.description,
      parent: this.parent,
      level: this.level,
      expandable: this.expandable,
      has_children: this.has_children,
      isEncrypted: this.isEncrypted,
      position: { ...this.position },
      visible: this.visible,
      expanded: this.expanded,
      selected: this.selected,
      hovered: this.hovered,
      highlighted: this.highlighted,
      visualProperties: { ...this.visualProperties },
      metadata: { ...this.metadata },
      permissions: { ...this.permissions },
      version: this.version,
      lastUpdated: this.lastUpdated,
      createdBy: this.createdBy,
      lastUpdatedBy: this.lastUpdatedBy
    };
    
    // Include encryption data for persistence
    if (this.isEncrypted) {
      obj.encryptedContent = this.encryptedContent;
      obj.encryptionMetadata = this.encryptionMetadata;
      
      // Optionally include decrypted content (for in-memory operations only)
      if (includeDecrypted && this._encryptionStatus.isDecrypted) {
        obj.decryptedContent = this._encryptionStatus.sensitiveContent;
      }
    }
    
    return obj;
  }
  
  /**
   * Safe version of toObject that never includes sensitive data
   * Used for transmission over network or storing in logs
   * 
   * @returns {Object} Safe object representation
   */
  toSafeObject() {
    const obj = this.toObject(false);
    
    // Remove sensitive data
    delete obj.encryptedContent;
    delete obj.encryptionMetadata;
    
    return obj;
  }
}

export default registry.register(
  'data.models.Node',
  Node,
  [],
  {
    description: 'Base node class providing core functionality for all node types',
    level: -1,
    isAbstract: true
  }
); 