import registry from '../../ModuleRegistry';
import { EventBus } from '../../utils/EventBus';
import { EncryptionService } from '../../encryption/EncryptionService';

/**
 * Relationship class for defining connections between nodes
 * 
 * Relationships represent the various connections between nodes in the visualization.
 * They define how different parts of the system interact with each other, including
 * parent-child relationships, implementation relationships, dependencies, data flows,
 * and other types of connections.
 * 
 * Each relationship can have its own security settings, including encryption for
 * sensitive relationships and permission controls to limit who can see or modify
 * specific relationships. Relationships also have visual properties that control
 * how they appear in the visualization.
 * 
 * Security features:
 * - Relationship-specific permissions
 * - Encryption for sensitive relationships
 * - Visibility controls
 * - Event-based tracking of changes
 */
class Relationship {
  /**
   * Create a relationship
   * 
   * @param {Object} data - Relationship data
   * @param {string} data.id - Unique identifier
   * @param {string} data.sourceId - Source node ID
   * @param {string} data.targetId - Target node ID
   * @param {string} data.type - Relationship type (contains, implements, depends_on, etc.)
   * @param {boolean} [data.isDirectional=true] - Whether the relationship is directional
   * @param {boolean} [data.isEncrypted=false] - Whether the relationship data is encrypted
   * @param {Object} [data.encryptedData] - Encrypted relationship data
   * @param {Object} [data.encryptionMetadata] - Metadata for encryption
   * @param {Object} [data.permissions] - Permission settings for this relationship
   * @param {Object} [data.metadata] - Additional metadata for the relationship
   * @param {Object} [data.visualProperties] - Custom visual properties
   */
  constructor(data) {
    this.id = data.id;
    this.sourceId = data.sourceId;
    this.targetId = data.targetId;
    this.type = data.type || 'generic';
    this.isDirectional = data.isDirectional ?? true;
    this.metadata = data.metadata || {};
    
    // Visualization properties
    this.visible = data.visible ?? true;
    this.highlight = data.highlight ?? false;
    this.selected = data.selected ?? false;
    this.hovered = data.hovered ?? false;
    this.opacity = data.opacity ?? 1.0;
    this.lineWidth = data.lineWidth;
    this.dashPattern = data.dashPattern;
    this.visualProperties = data.visualProperties || {};
    
    // Security properties
    this.isEncrypted = data.isEncrypted ?? false;
    this.encryptedData = data.encryptedData || null;
    this.encryptionMetadata = data.encryptionMetadata || null;
    
    // Permission settings
    this.permissions = data.permissions || {
      view: ['admin', 'editor', 'contributor', 'viewer'],
      edit: ['admin', 'editor'],
      delete: ['admin']
    };
    
    // Track encryption status
    this._encryptionStatus = {
      isDecrypted: false,
      sensitiveData: null
    };
    
    // Tracking
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }
  
  /**
   * Set the visibility of the relationship
   * Controls whether the relationship is shown in the visualization
   * 
   * @param {boolean} visible - Visibility state
   */
  setVisible(visible) {
    this.visible = visible;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:visibilityChanged', {
      relationshipId: this.id,
      visible: visible
    });
  }
  
  /**
   * Set the highlight state of the relationship
   * Highlighted relationships are visually emphasized in the visualization
   * 
   * @param {boolean} highlight - Highlight state
   */
  setHighlight(highlight) {
    this.highlight = highlight;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:highlightChanged', {
      relationshipId: this.id,
      highlight: highlight
    });
  }
  
  /**
   * Set the selected state of the relationship
   * 
   * @param {boolean} selected - Selection state
   */
  setSelected(selected) {
    this.selected = selected;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:selectionChanged', {
      relationshipId: this.id,
      selected: selected
    });
  }
  
  /**
   * Set the hover state of the relationship
   * 
   * @param {boolean} hovered - Hover state
   */
  setHovered(hovered) {
    this.hovered = hovered;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:hoverChanged', {
      relationshipId: this.id,
      hovered: hovered
    });
  }
  
  /**
   * Set the opacity of the relationship
   * 
   * @param {number} opacity - Opacity value (0.0 to 1.0)
   */
  setOpacity(opacity) {
    this.opacity = Math.max(0, Math.min(1, opacity));
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:opacityChanged', {
      relationshipId: this.id,
      opacity: this.opacity
    });
  }
  
  /**
   * Set the line width of the relationship
   * 
   * @param {number} width - Line width
   */
  setLineWidth(width) {
    this.lineWidth = width;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:lineWidthChanged', {
      relationshipId: this.id,
      lineWidth: this.lineWidth
    });
  }
  
  /**
   * Set the dash pattern of the relationship
   * 
   * @param {Array|null} pattern - Dash pattern array or null for solid line
   */
  setDashPattern(pattern) {
    this.dashPattern = pattern;
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:dashPatternChanged', {
      relationshipId: this.id,
      dashPattern: this.dashPattern
    });
  }
  
  /**
   * Update custom visual properties
   * 
   * @param {Object} properties - Visual properties to update
   */
  updateVisualProperties(properties) {
    this.visualProperties = {
      ...this.visualProperties,
      ...properties
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:visualPropertiesChanged', {
      relationshipId: this.id,
      properties: this.visualProperties
    });
  }
  
  /**
   * Update metadata for the relationship
   * 
   * @param {Object} metadata - New metadata
   */
  updateMetadata(metadata) {
    this.metadata = {
      ...this.metadata,
      ...metadata
    };
    
    this.updatedAt = new Date().toISOString();
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:metadataUpdated', {
      relationshipId: this.id
    });
  }
  
  /**
   * Encrypt the relationship data
   * Used for protecting sensitive relationship information
   * 
   * @param {Object} data - Data to encrypt
   * @param {string} password - Encryption password
   * @returns {boolean} Success state
   */
  encryptData(data, password) {
    try {
      // Convert data to string
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      
      // Encrypt using the EncryptionService
      const result = EncryptionService.encrypt(dataStr, password);
      
      if (result.success) {
        this.encryptedData = result.encryptedData;
        this.encryptionMetadata = result.metadata;
        this.isEncrypted = true;
        this._encryptionStatus.isDecrypted = false;
        this._encryptionStatus.sensitiveData = null;
        
        // Notify system
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('relationship:encrypted', {
          relationshipId: this.id
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
   * Decrypt the relationship data
   * 
   * @param {string} password - Decryption password
   * @returns {Object|null} Decrypted data or null if decryption failed
   */
  decryptData(password) {
    if (!this.isEncrypted || !this.encryptedData) {
      return null;
    }
    
    try {
      const result = EncryptionService.decrypt(
        this.encryptedData,
        password,
        this.encryptionMetadata
      );
      
      if (result.success) {
        // Try to parse as JSON, return as string if not valid JSON
        let decryptedData;
        try {
          decryptedData = JSON.parse(result.decryptedData);
        } catch (e) {
          decryptedData = result.decryptedData;
        }
        
        // Update encryption status
        this._encryptionStatus.isDecrypted = true;
        this._encryptionStatus.sensitiveData = decryptedData;
        
        // Notify system
        const eventBus = registry.getModule('utils.EventBus') || EventBus;
        eventBus.emit('relationship:decrypted', {
          relationshipId: this.id
        });
        
        return decryptedData;
      }
      
      return null;
    } catch (error) {
      console.error('Relationship decryption failed:', error);
      return null;
    }
  }
  
  /**
   * Update permissions for this relationship
   * 
   * @param {Object} permissions - New permissions
   * @param {Array<string>} permissions.view - Roles that can view
   * @param {Array<string>} permissions.edit - Roles that can edit
   * @param {Array<string>} permissions.delete - Roles that can delete
   */
  updatePermissions(permissions) {
    this.permissions = {
      ...this.permissions,
      ...permissions
    };
    
    // Notify system
    const eventBus = registry.getModule('utils.EventBus') || EventBus;
    eventBus.emit('relationship:permissionsChanged', {
      relationshipId: this.id
    });
  }
  
  /**
   * Check if current user has specified permission for this relationship
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
   * Get the visual properties for the relationship
   * These properties define how the relationship appears in the visualization
   * 
   * @returns {Object} Visual properties
   */
  getVisualProperties() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      // Use VisualizationManager to get visual properties
      return visualizationManager.getRelationshipVisualProperties(this);
    }
    
    // Fallback if VisualizationManager isn't available
    return {
      color: this.getColorByType(),
      lineWidth: this.lineWidth || this.getLineWidthByType(),
      opacity: this.visible ? (this.opacity || 1.0) : 0.0,
      dashPattern: this.dashPattern || this.getDashPatternByType(),
      highlight: this.highlight,
      selected: this.selected,
      hovered: this.hovered,
      isEncrypted: this.isEncrypted && !this._encryptionStatus.isDecrypted,
      hasPermissionIssue: !this.currentUserHasPermission('view'),
      isDirectional: this.isDirectional,
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: this.type,
      ...this.visualProperties
    };
  }
  
  /**
   * Get color based on relationship type
   * Different relationship types have distinct colors for visual clarity
   * 
   * @returns {string} Hex color code
   */
  getColorByType() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      return visualizationManager.getRelationshipColor(this.type);
    }
    
    // Fallback if VisualizationManager isn't available
    const colors = {
      contains: '#4A90E2',       // Blue - hierarchical containment
      implements: '#50C878',     // Green - implementation relationships
      depends_on: '#E74C3C',     // Red - dependency relationships
      integration_point: '#9B59B6', // Purple - system integration connections
      data_flow: '#F39C12',      // Orange - data movement
      refers_to: '#2ECC71',      // Lighter green - reference relationships
      influences: '#E67E22',     // Darker orange - influence relationships
      alternative_to: '#3498DB', // Lighter blue - alternative options
      obsoletes: '#95A5A6',      // Gray - obsolescence relationships
      generic: '#AAAAAA'         // Light gray - default
    };
    
    return colors[this.type] || colors.generic;
  }
  
  /**
   * Get line width based on relationship type
   * Some relationship types have thicker lines for emphasis
   * 
   * @returns {number} Line width
   */
  getLineWidthByType() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      return visualizationManager.getLineWidth(this.type);
    }
    
    // Fallback if VisualizationManager isn't available
    const widths = {
      contains: 2.0,
      implements: 1.5,
      depends_on: 1.0,
      integration_point: 1.5,
      data_flow: 1.0,
      refers_to: 1.0,
      influences: 1.2,
      alternative_to: 1.0,
      obsoletes: 1.0,
      generic: 1.0
    };
    
    return widths[this.type] || widths.generic;
  }
  
  /**
   * Get dash pattern based on relationship type
   * Different dash patterns help distinguish relationship types visually
   * 
   * @returns {Array|null} Dash pattern array or null for solid line
   */
  getDashPatternByType() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      return visualizationManager.getDashPattern(this.type);
    }
    
    // Fallback if VisualizationManager isn't available
    const patterns = {
      contains: null,              // Solid line
      implements: [3, 3],          // Dashed
      depends_on: [6, 3],          // Long dash
      integration_point: [3, 3, 10, 3], // Dash-dot
      data_flow: [2, 2],           // Dotted
      refers_to: [5, 3, 1, 3],     // Dash-dot-dot
      influences: [8, 3, 3, 3],    // Long dash short dash
      alternative_to: [5, 5],      // Equal dashes
      obsoletes: [2, 2, 6, 2],     // Dot long dash dot
      generic: null                // Solid line
    };
    
    return patterns[this.type] || patterns.generic;
  }
  
  /**
   * Check if the relationship is currently decrypted
   * 
   * @returns {boolean} Whether the relationship is decrypted
   */
  isDecrypted() {
    return this.isEncrypted ? this._encryptionStatus.isDecrypted : true;
  }
  
  /**
   * Get the relationship description based on type
   * 
   * @returns {string} Human-readable description of the relationship
   */
  getDescription() {
    // Get visualization manager
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    
    if (visualizationManager) {
      return visualizationManager.getRelationshipDescription(this.type);
    }
    
    // Fallback if VisualizationManager isn't available
    const descriptions = {
      contains: 'Contains/Parent-Child',
      implements: 'Implements/Realizes',
      depends_on: 'Depends On',
      integration_point: 'Integration Point',
      data_flow: 'Data Flow',
      refers_to: 'Refers To',
      influences: 'Influences',
      alternative_to: 'Alternative To',
      obsoletes: 'Obsoletes/Replaces',
      generic: 'Generic Relationship'
    };
    
    return descriptions[this.type] || 'Unknown Relationship Type';
  }
  
  /**
   * Convert to a plain object for serialization
   * 
   * @param {boolean} includeSecurityInfo - Whether to include security information
   * @returns {Object} Plain object representation
   */
  toObject(includeSecurityInfo = false) {
    const obj = {
      id: this.id,
      sourceId: this.sourceId,
      targetId: this.targetId,
      type: this.type,
      isDirectional: this.isDirectional,
      metadata: { ...this.metadata },
      visible: this.visible,
      highlight: this.highlight,
      selected: this.selected,
      hovered: this.hovered,
      opacity: this.opacity,
      lineWidth: this.lineWidth,
      dashPattern: this.dashPattern,
      visualProperties: { ...this.visualProperties },
      isEncrypted: this.isEncrypted,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
    
    // Include security information if requested
    if (includeSecurityInfo) {
      obj.permissions = { ...this.permissions };
      
      if (this.isEncrypted) {
        obj.encryptedData = this.encryptedData;
        obj.encryptionMetadata = this.encryptionMetadata;
        
        // Include decrypted content if available
        if (this._encryptionStatus.isDecrypted) {
          obj.decryptedData = this._encryptionStatus.sensitiveData;
        }
      }
    }
    
    return obj;
  }
  
  /**
   * Safe version of toObject that never includes sensitive data
   * 
   * @returns {Object} Safe object representation without sensitive data
   */
  toSafeObject() {
    const obj = this.toObject(false);
    
    // Remove even the encrypted data for maximum safety
    delete obj.encryptedData;
    delete obj.encryptionMetadata;
    
    return obj;
  }
}

export default registry.register(
  'data.models.Relationship',
  Relationship,
  [],
  {
    description: 'Defines a relationship between nodes in the visualization',
  }
);

