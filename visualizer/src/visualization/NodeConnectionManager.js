/**
 * NodeConnectionManager handles the creation, editing, and management of
 * connections between nodes in the visualization.
 */
import * as THREE from 'three';
import registry from '../ModuleRegistry';

class NodeConnectionManager {
  constructor() {
    this.scene = null;
    this.linkRenderer = null;
    this.nodeRenderer = null;
    this.interactionManager = null;
    this.colorManager = null;
    this.dataService = null;
    this.visualizationManager = null;
    
    this.isInitialized = false;
    this.isActive = false;
    
    // Connection creation state
    this.connectionState = {
      isCreating: false,
      sourceNodeId: null,
      sourceNode: null,
      targetNodeId: null,
      tempLine: null,
      connectionType: 'default',
      validTarget: false
    };
    
    // Settings
    this.settings = {
      connectionTypes: [
        { id: 'contains', label: 'Contains', color: 0x999999 },
        { id: 'implements', label: 'Implements', color: 0x27AE60 },
        { id: 'depends_on', label: 'Depends On', color: 0xE74C3C },
        { id: 'relates_to', label: 'Relates To', color: 0x3498DB },
        { id: 'integration', label: 'Integration', color: 0xF1C40F }
      ],
      defaultConnectionType: 'relates_to',
      allowedConnections: {
        // Define which node types can connect to other node types
        // Format: source_type: [allowed_target_types]
        component: ['component', 'subcomponent'],
        subcomponent: ['component', 'subcomponent', 'capability'],
        capability: ['subcomponent', 'capability', 'function'],
        function: ['capability', 'function', 'specification'],
        specification: ['function', 'specification', 'integration'],
        integration: ['specification', 'integration', 'technique'],
        technique: ['integration', 'technique', 'application'],
        application: ['technique', 'application', 'input', 'output'],
        input: ['application'],
        output: ['application'],
        // Wildcard allows any connection
        '*': ['*']
      },
      highlightConnectionCandidates: true,
      tempConnectionOpacity: 0.5,
      validTargetColor: 0x00FF00,
      invalidTargetColor: 0xFF0000,
      connectToSelf: false,  // Allow nodes to connect to themselves
      requireConfirmation: true, // Require confirmation before creating connection
      autoApplyHierarchical: true, // Automatically apply hierarchical connection type
      snapToNode: true // Snap to node when creating connections
    };
    
    // Binding methods for event handlers
    this.handleNodeClick = this.handleNodeClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.cancelConnectionCreation = this.cancelConnectionCreation.bind(this);
  }
  
  /**
   * Initialize the connection manager
   * @param {Object} dependencies - Required dependencies
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(dependencies = {}) {
    if (this.isInitialized) return true;
    
    try {
      // Get dependencies from parameters or registry
      this.scene = dependencies.scene || 
        (dependencies.sceneManager ? dependencies.sceneManager.getScene() : null) ||
        registry.getModule('visualization.SceneManager')?.getScene();
      
      this.linkRenderer = dependencies.linkRenderer || 
        registry.getModule('visualization.LinkRenderer');
      
      this.nodeRenderer = dependencies.nodeRenderer || 
        registry.getModule('visualization.NodeRenderer');
      
      this.interactionManager = dependencies.interactionManager || 
        registry.getModule('visualization.InteractionManager');
      
      this.colorManager = dependencies.colorManager || 
        registry.getModule('visualization.ColorManager');
      
      this.visualizationManager = dependencies.visualizationManager || 
        registry.getModule('visualization.VisualizationManager');
      
      this.dataService = dependencies.dataService || 
        registry.getModule('data.DataService');
      
      // Check required dependencies
      if (!this.scene) {
        console.error('NodeConnectionManager: Scene is required for initialization');
        return false;
      }
      
      if (!this.linkRenderer) {
        console.error('NodeConnectionManager: LinkRenderer is required for initialization');
        return false;
      }
      
      if (!this.nodeRenderer) {
        console.error('NodeConnectionManager: NodeRenderer is required for initialization');
        return false;
      }
      
      // Create materials for temporary connection line
      this.tempLineMaterial = new THREE.LineBasicMaterial({
        color: this.settings.connectionTypes.find(
          type => type.id === this.settings.defaultConnectionType
        )?.color || 0xFFFFFF,
        transparent: true,
        opacity: this.settings.tempConnectionOpacity,
        depthTest: false
      });
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize NodeConnectionManager:', error);
      return false;
    }
  }
  
  /**
   * Activate connection creation mode
   * @param {string} [connectionType] - Initial connection type
   * @returns {boolean} Success
   */
  activateConnectionMode(connectionType = this.settings.defaultConnectionType) {
    if (!this.isInitialized) {
      console.error('NodeConnectionManager not initialized');
      return false;
    }
    
    if (this.isActive) {
      // Already active, just update connection type
      this.setConnectionType(connectionType);
      return true;
    }
    
    // Set connection type
    this.setConnectionType(connectionType);
    
    // Activate connection mode
    this.isActive = true;
    
    // Register event handlers if interactionManager is available
    if (this.interactionManager) {
      this.interactionManager.addNodeClickHandler(this.handleNodeClick);
      this.interactionManager.addMouseMoveHandler(this.handleMouseMove);
      this.interactionManager.addKeyPressHandler(this.handleKeyPress);
    } else {
      // Fallback to direct DOM events if no interaction manager
      window.addEventListener('mousemove', this.handleMouseMove);
      window.addEventListener('keydown', this.handleKeyPress);
    }
    
    // Highlight valid connection candidates if enabled
    if (this.settings.highlightConnectionCandidates) {
      this.highlightConnectionCandidates();
    }
    
    // Notify any interested components
    registry.getModule('utils.EventBus')?.emit('connectionMode:activated', { 
      connectionType,
      active: true 
    });
    
    return true;
  }
  
  /**
   * Deactivate connection creation mode
   * @returns {boolean} Success
   */
  deactivateConnectionMode() {
    if (!this.isInitialized || !this.isActive) {
      return false;
    }
    
    // Cancel any in-progress connection
    this.cancelConnectionCreation();
    
    // Deactivate connection mode
    this.isActive = false;
    
    // Remove event handlers
    if (this.interactionManager) {
      this.interactionManager.removeNodeClickHandler(this.handleNodeClick);
      this.interactionManager.removeMouseMoveHandler(this.handleMouseMove);
      this.interactionManager.removeKeyPressHandler(this.handleKeyPress);
    } else {
      // Remove direct DOM events
      window.removeEventListener('mousemove', this.handleMouseMove);
      window.removeEventListener('keydown', this.handleKeyPress);
    }
    
    // Reset highlighting
    if (this.nodeRenderer) {
      this.nodeRenderer.resetHighlighting();
    }
    
    // Notify any interested components
    registry.getModule('utils.EventBus')?.emit('connectionMode:deactivated');
    
    return true;
  }
  
  /**
   * Set the type of connection to create
   * @param {string} connectionType - Type of connection
   * @returns {boolean} Success
   */
  setConnectionType(connectionType) {
    const validType = this.settings.connectionTypes.find(type => type.id === connectionType);
    
    if (!validType) {
      console.warn(`Invalid connection type: ${connectionType}`);
      return false;
    }
    
    this.connectionState.connectionType = connectionType;
    
    // Update temporary line color if it exists
    if (this.connectionState.tempLine) {
      this.tempLineMaterial.color.set(validType.color);
    }
    
    // Update highlighting if active and we have a source node
    if (this.isActive && this.connectionState.sourceNodeId && this.settings.highlightConnectionCandidates) {
      this.highlightConnectionCandidates();
    }
    
    // Notify any interested components
    registry.getModule('utils.EventBus')?.emit('connectionType:changed', { 
      connectionType, 
      color: validType.color 
    });
    
    return true;
  }
  
  /**
   * Handle node click event
   * @param {Object} event - Click event data
   * @param {string} nodeId - ID of clicked node
   * @param {Object} nodeData - Data about the clicked node
   * @private
   */
  handleNodeClick(event, nodeId, nodeData) {
    if (!this.isActive) return;
    
    if (!this.connectionState.isCreating) {
      // Starting a new connection
      this.startConnectionCreation(nodeId, nodeData);
    } else {
      // Completing a connection
      this.completeConnectionCreation(nodeId, nodeData);
    }
  }
  
  /**
   * Start creating a connection from a node
   * @param {string} nodeId - Source node ID
   * @param {Object} nodeData - Source node data
   * @private
   */
  startConnectionCreation(nodeId, nodeData) {
    this.connectionState.isCreating = true;
    this.connectionState.sourceNodeId = nodeId;
    this.connectionState.sourceNode = nodeData;
    
    // Create temporary line
    const sourcePosition = this.nodeRenderer.getNodePosition(nodeId);
    if (!sourcePosition) {
      console.error(`Could not find position for node ${nodeId}`);
      this.cancelConnectionCreation();
      return;
    }
    
    // Create temporary line geometry
    const points = [
      new THREE.Vector3(sourcePosition.x, sourcePosition.y, sourcePosition.z),
      new THREE.Vector3(sourcePosition.x, sourcePosition.y, sourcePosition.z)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, this.tempLineMaterial);
    line.renderOrder = 1000; // Ensure it renders on top
    
    this.connectionState.tempLine = line;
    this.scene.add(line);
    
    // Highlight valid connection targets
    if (this.settings.highlightConnectionCandidates) {
      this.highlightConnectionCandidates();
    }
    
    // Notify any interested components
    registry.getModule('utils.EventBus')?.emit('connection:started', { 
      sourceNodeId: nodeId, 
      sourceNodeType: nodeData.type 
    });
  }
  
  /**
   * Complete the connection to the target node
   * @param {string} targetNodeId - Target node ID
   * @param {Object} targetNodeData - Target node data
   * @private
   */
  completeConnectionCreation(targetNodeId, targetNodeData) {
    // Check if target is valid
    if (!this.isValidConnectionTarget(targetNodeId, targetNodeData)) {
      // Invalid target
      console.warn(`Invalid connection target: ${targetNodeId}`);
      registry.getModule('utils.EventBus')?.emit('connection:invalid', { 
        sourceNodeId: this.connectionState.sourceNodeId, 
        targetNodeId,
        reason: 'invalid_target' 
      });
      return;
    }
    
    // Check if connecting to self and it's not allowed
    if (targetNodeId === this.connectionState.sourceNodeId && !this.settings.connectToSelf) {
      console.warn('Cannot connect node to itself');
      registry.getModule('utils.EventBus')?.emit('connection:invalid', { 
        sourceNodeId: this.connectionState.sourceNodeId, 
        targetNodeId,
        reason: 'self_connection' 
      });
      return;
    }
    
    // Determine connection type
    let connectionType = this.connectionState.connectionType;
    
    // Auto-apply hierarchical connection type if enabled
    if (this.settings.autoApplyHierarchical) {
      const sourceNodeData = this.connectionState.sourceNode;
      
      // Check if this is a parent-child relationship
      if (targetNodeData.parent === sourceNodeData.id) {
        // Child connecting to parent
        connectionType = 'contains';
      } else if (sourceNodeData.parent === targetNodeData.id) {
        // Parent connecting to child
        connectionType = 'contains';
      }
    }
    
    // Create connection data
    const connectionData = {
      id: `link-${this.connectionState.sourceNodeId}-${targetNodeId}`,
      source: this.connectionState.sourceNodeId,
      target: targetNodeId,
      type: connectionType,
      data: {
        createdAt: new Date().toISOString(),
        createdBy: registry.getModule('auth.AuthService')?.getCurrentUser()?.id || 'system'
      }
    };
    
    // If requiring confirmation, emit event and wait for confirmation
    if (this.settings.requireConfirmation) {
      registry.getModule('utils.EventBus')?.emit('connection:confirm', {
        connection: connectionData,
        sourceNode: this.connectionState.sourceNode,
        targetNode: targetNodeData,
        callback: (confirmed) => {
          if (confirmed) {
            this.createConnection(connectionData);
          }
          // Remove temporary line and reset state regardless of confirmation
          this.cleanupAfterConnection();
        }
      });
    } else {
      // Create connection immediately
      this.createConnection(connectionData);
      this.cleanupAfterConnection();
    }
  }
  
  /**
   * Create a connection between nodes
   * @param {Object} connectionData - Connection data
   * @private
   */
  async createConnection(connectionData) {
    try {
      // If we have a data service, use it to save the connection
      if (this.dataService) {
        await this.dataService.createRelationship({
          sourceId: connectionData.source,
          targetId: connectionData.target,
          type: connectionData.type,
          data: connectionData.data
        });
      }
      
      // Update link renderer
      if (this.linkRenderer) {
        await this.linkRenderer.updateLinks([connectionData]);
      }
      
      // Notify any interested components
      registry.getModule('utils.EventBus')?.emit('connection:created', connectionData);
      
      return true;
    } catch (error) {
      console.error('Failed to create connection:', error);
      registry.getModule('utils.EventBus')?.emit('connection:error', { 
        error,
        connection: connectionData
      });
      return false;
    }
  }
  
  /**
   * Clean up after connection completion
   * @private
   */
  cleanupAfterConnection() {
    // Remove temporary line
    if (this.connectionState.tempLine) {
      this.scene.remove(this.connectionState.tempLine);
      if (this.connectionState.tempLine.geometry) {
        this.connectionState.tempLine.geometry.dispose();
      }
      this.connectionState.tempLine = null;
    }
    
    // Reset connection state
    this.connectionState.isCreating = false;
    this.connectionState.sourceNodeId = null;
    this.connectionState.sourceNode = null;
    this.connectionState.targetNodeId = null;
    this.connectionState.validTarget = false;
    
    // Reset highlighting
    if (this.nodeRenderer) {
      this.nodeRenderer.resetHighlighting();
    }
  }
  
  /**
   * Cancel current connection creation
   */
  cancelConnectionCreation() {
    if (!this.connectionState.isCreating) return;
    
    // Cleanup
    this.cleanupAfterConnection();
    
    // Notify any interested components
    registry.getModule('utils.EventBus')?.emit('connection:cancelled', {
      sourceNodeId: this.connectionState.sourceNodeId
    });
  }
  
  /**
   * Handle mouse move during connection creation
   * @param {Object} event - Mouse move event
   * @private
   */
  handleMouseMove(event) {
    if (!this.isActive || !this.connectionState.isCreating || !this.connectionState.tempLine) {
      return;
    }
    
    // Convert mouse position to 3D coordinates
    const mouse = new THREE.Vector2();
    
    if (event.clientX !== undefined) {
      // Browser event
      const rect = this.interactionManager?.getDomElement()?.getBoundingClientRect() ||
                  this.scene.userData.viewportRect ||
                  { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
      
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    } else if (event.x !== undefined) {
      // Normalized event
      mouse.x = event.x * 2 - 1;
      mouse.y = -(event.y * 2 - 1);
    } else {
      return;
    }
    
    // Get mouse position in 3D space
    let position;
    
    // If hovering over a node and snap is enabled, use node position
    if (this.settings.snapToNode && this.connectionState.targetNodeId) {
      position = this.nodeRenderer.getNodePosition(this.connectionState.targetNodeId);
    } else {
      // Otherwise, use mouse position projected onto a plane
      const camera = this.scene.userData.camera || registry.getModule('visualization.SceneManager')?.getCamera();
      
      if (!camera) return;
      
      // Create a ray from the camera
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      
      // Create a plane at the source node's depth
      const sourcePosition = this.nodeRenderer.getNodePosition(this.connectionState.sourceNodeId);
      if (!sourcePosition) return;
      
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sourcePosition.z);
      
      // Find the intersection point
      const targetPoint = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, targetPoint);
      
      if (!targetPoint) return;
      
      position = { x: targetPoint.x, y: targetPoint.y, z: targetPoint.z };
    }
    
    if (!position) return;
    
    // Update temp line
    const geometry = this.connectionState.tempLine.geometry;
    const sourcePosition = this.nodeRenderer.getNodePosition(this.connectionState.sourceNodeId);
    
    if (!sourcePosition) return;
    
    // Update the second point (target)
    const positions = geometry.attributes.position.array;
    positions[3] = position.x;
    positions[4] = position.y;
    positions[5] = position.z;
    
    geometry.attributes.position.needsUpdate = true;
    
    // Update color based on validity
    if (this.connectionState.validTarget) {
      this.tempLineMaterial.color.set(this.settings.validTargetColor);
    } else {
      this.tempLineMaterial.color.set(
        this.settings.connectionTypes.find(
          type => type.id === this.connectionState.connectionType
        )?.color || 0xFFFFFF
      );
    }
  }
  
  /**
   * Handle key press event
   * @param {Object} event - Key event
   * @private
   */
  handleKeyPress(event) {
    if (!this.isActive) return;
    
    // Cancel on escape key
    if (event.key === 'Escape' || event.keyCode === 27) {
      if (this.connectionState.isCreating) {
        this.cancelConnectionCreation();
      } else {
        this.deactivateConnectionMode();
      }
    }
  }
  
  /**
   * Check if a node is a valid connection target
   * @param {string} nodeId - Target node ID
   * @param {Object} nodeData - Target node data
   * @returns {boolean} Is valid target
   * @private
   */
  isValidConnectionTarget(nodeId, nodeData) {
    if (!this.connectionState.sourceNode) return false;
    
    // Check if connecting to self is allowed
    if (nodeId === this.connectionState.sourceNodeId && !this.settings.connectToSelf) {
      return false;
    }
    
    // Get allowed connection types
    const sourceType = this.connectionState.sourceNode.type;
    const targetType = nodeData.type;
    
    // Check in allowed connections mapping
    const allowedTargets = this.settings.allowedConnections[sourceType] || [];
    const wildcardAllowed = this.settings.allowedConnections['*'] || [];
    
    // Check if target type is in allowed list or wildcard is allowed
    return allowedTargets.includes(targetType) || 
           allowedTargets.includes('*') ||
           wildcardAllowed.includes(targetType) ||
           wildcardAllowed.includes('*');
  }
  
  /**
   * Highlight valid connection candidates
   * @private
   */
  highlightConnectionCandidates() {
    if (!this.nodeRenderer || !this.connectionState.sourceNodeId) return;
    
    const sourceNode = this.connectionState.sourceNode;
    const sourceType = sourceNode?.type;
    
    if (!sourceType) return;
    
    // Get allowed target types
    const allowedTargets = this.settings.allowedConnections[sourceType] || [];
    const wildcardAllowed = this.settings.allowedConnections['*'] || [];
    
    // Combine allowed types
    const allowedTypes = [...new Set([
      ...allowedTargets,
      ...wildcardAllowed.filter(type => type !== '*')
    ])].filter(type => type !== '*');
    
    // Get all nodes of allowed types
    this.nodeRenderer.highlightNodesByTypes(allowedTypes);
  }
  
  /**
   * Update the target node when hovering
   * @param {string} nodeId - Node ID being hovered
   * @param {Object} nodeData - Node data
   */
  updateTargetNode(nodeId, nodeData) {
    if (!this.isActive || !this.connectionState.isCreating) return;
    
    this.connectionState.targetNodeId = nodeId;
    this.connectionState.validTarget = nodeId ? this.isValidConnectionTarget(nodeId, nodeData) : false;
    
    // Update temp line color
    if (this.connectionState.tempLine) {
      if (this.connectionState.validTarget) {
        this.tempLineMaterial.color.set(this.settings.validTargetColor);
      } else {
        this.tempLineMaterial.color.set(
          this.settings.connectionTypes.find(
            type => type.id === this.connectionState.connectionType
          )?.color || 0xFFFFFF
        );
      }
    }
  }
  
  /**
   * Edit an existing connection
   * @param {string} connectionId - ID of connection to edit
   * @param {Object} updates - Properties to update
   * @returns {Promise<boolean>} Success
   */
  async editConnection(connectionId, updates) {
    if (!this.isInitialized) return false;
    
    try {
      // Get existing connection
      const link = this.linkRenderer?.getLinkById(connectionId);
      
      if (!link) {
        console.error(`Connection ${connectionId} not found`);
        return false;
      }
      
      // Create updated link data
      const updatedLink = {
        ...link,
        ...updates
      };
      
      // Update in data service if available
      if (this.dataService) {
        await this.dataService.updateRelationship(connectionId, updates);
      }
      
      // Update link renderer
      if (this.linkRenderer) {
        await this.linkRenderer.updateLinks([updatedLink]);
      }
      
      // Notify any interested components
      registry.getModule('utils.EventBus')?.emit('connection:updated', updatedLink);
      
      return true;
    } catch (error) {
      console.error('Failed to edit connection:', error);
      registry.getModule('utils.EventBus')?.emit('connection:error', { 
        error,
        connectionId,
        updates
      });
      return false;
    }
  }
  
  /**
   * Delete a connection
   * @param {string} connectionId - ID of connection to delete
   * @returns {Promise<boolean>} Success
   */
  async deleteConnection(connectionId) {
    if (!this.isInitialized) return false;
    
    try {
      // Get existing connection
      const link = this.linkRenderer?.getLinkById(connectionId);
      
      if (!link) {
        console.error(`Connection ${connectionId} not found`);
        return false;
      }
      
      // Update in data service if available
      if (this.dataService) {
        await this.dataService.deleteRelationship(connectionId);
      }
      
      // Remove from link renderer
      if (this.linkRenderer) {
        const links = this.linkRenderer.getLinks().filter(l => l.id !== connectionId);
        await this.linkRenderer.setLinks(links);
      }
      
      // Notify any interested components
      registry.getModule('utils.EventBus')?.emit('connection:deleted', {
        id: connectionId,
        link
      });
      
      return true;
    } catch (error) {
      console.error('Failed to delete connection:', error);
      registry.getModule('utils.EventBus')?.emit('connection:error', { 
        error,
        connectionId
      });
      return false;
    }
  }
  
  /**
   * Get all connections
   * @returns {Array} Array of connection objects
   */
  getConnections() {
    return this.linkRenderer?.getLinks() || [];
  }
  
  /**
   * Get a specific connection by ID
   * @param {string} connectionId - Connection ID
   * @returns {Object} Connection object
   */
  getConnectionById(connectionId) {
    return this.linkRenderer?.getLinkById(connectionId);
  }
  
  /**
   * Find connections for a specific node
   * @param {string} nodeId - Node ID
   * @returns {Array} Array of connection objects
   */
  getConnectionsForNode(nodeId) {
    const links = this.linkRenderer?.getLinks() || [];
    return links.filter(link => 
      (typeof link.source === 'string' ? link.source : link.source.id) === nodeId || 
      (typeof link.target === 'string' ? link.target : link.target.id) === nodeId
    );
  }
  
  /**
   * Update settings
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    // Update temp line material if it exists and connection type changed
    if (this.connectionState.tempLine && newSettings.defaultConnectionType) {
      const color = this.settings.connectionTypes.find(
        type => type.id === this.settings.defaultConnectionType
      )?.color || 0xFFFFFF;
      
      this.tempLineMaterial.color.set(color);
    }
  }
  
  /**
   * Dispose resources and clean up
   */
  dispose() {
    // Deactivate connection mode
    this.deactivateConnectionMode();
    
    // Dispose of temporary materials
    if (this.tempLineMaterial) {
      this.tempLineMaterial.dispose();
    }
    
    // Clear references
    this.scene = null;
    this.linkRenderer = null;
    this.nodeRenderer = null;
    this.interactionManager = null;
    this.colorManager = null;
    this.dataService = null;
    this.visualizationManager = null;
    this.isInitialized = false;
  }
}

export default registry.register(
  'visualization.NodeConnectionManager',
  new NodeConnectionManager(),
  [
    'visualization.LinkRenderer',
    'visualization.NodeRenderer',
    'visualization.InteractionManager',
    'visualization.SceneManager',
    'visualization.ColorManager',
    'visualization.VisualizationManager',
    'data.DataService',
    'utils.EventBus'
  ],
  {
    description: 'Handles the creation and management of connections between nodes',
    singleton: true
  }
);

