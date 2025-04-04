/**
 * NodeRenderer handles the creation, rendering, and management of
 * visual objects representing nodes in the 3D visualization.
 */
import * as THREE from 'three';
import registry from '../ModuleRegistry';

class NodeRenderer {
  constructor() {
    this.scene = null;
    this.colorManager = null;
    this.nodeObjects = new Map();
    this.nodes = [];
    
    this.selectedNode = null;
    this.hoveredNode = null;
    
    this.isInitialized = false;
    
    // Node appearance settings
    this.settings = {
      defaultSegments: 16,
      defaultGeometry: 'sphere',
      outlineWidth: 2,
      nodeScale: 1.0,
      labelScale: 1.0,
      labelOffset: 1.2,
      showLabels: true,
      labelSize: 12,
      labelFont: 'Arial',
      labelColor: 0xffffff,
      labelBackgroundOpacity: 0.2,
      useTypeGeometries: true,
      useNodeColors: true,
      highlightIntensity: 1.2,
      baseOpacity: 0.9,
      fadeOpacity: 0.3,
      animationDuration: 300
    };
    
    // Mapping of node types to geometries
    this.typeGeometries = {
      component_group: 'sphere',
      component: 'box',
      subcomponent: 'octahedron',
      capability: 'dodecahedron',
      function: 'icosahedron',
      specification: 'tetrahedron',
      integration: 'torus',
      technique: 'cone',
      application: 'cylinder',
      input: 'ring',
      output: 'ring',
      default: 'sphere'
    };
  }
  
  /**
   * Initialize the node renderer
   * @param {THREE.Scene} scene - THREE.js scene
   * @param {Object} colorManager - Color manager service
   * @param {Object} visualizationManager - Visualization manager
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(scene, colorManager, visualizationManager) {
    if (this.isInitialized) return true;
    
    try {
      this.scene = scene;
      
      // Use provided color manager or get from registry
      this.colorManager = colorManager || 
        registry.getModule('visualization.ColorManager');
      
      // Store reference to visualization manager
      this.visualizationManager = visualizationManager || 
        registry.getModule('visualization.VisualizationManager');
      
      if (!this.colorManager) {
        console.warn('ColorManager not found, using default colors');
      }
      
      if (!this.visualizationManager) {
        console.warn('VisualizationManager not found, using default styling');
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize NodeRenderer:', error);
      return false;
    }
  }
  
  /**
   * Set nodes to render
   * @param {Array} nodes - Array of node objects
   * @returns {Promise<boolean>} Success status
   */
  async setNodes(nodes) {
    if (!this.isInitialized) {
      console.error('NodeRenderer not initialized');
      return false;
    }
    
    try {
      // Store nodes
      this.nodes = [...nodes];
      
      // Clear existing node objects
      this.clearNodeObjects();
      
      // Create new node objects
      nodes.forEach(node => {
        this.createNodeObject(node);
      });
      
      return true;
    } catch (error) {
      console.error('Error setting nodes:', error);
      return false;
    }
  }
  
  /**
   * Update existing nodes
   * @param {Array} nodes - Updated node objects
   * @returns {Promise<boolean>} Success status
   */
  async updateNodes(nodes) {
    if (!this.isInitialized) {
      console.error('NodeRenderer not initialized');
      return false;
    }
    
    try {
      // Update node reference
      this.nodes = [...nodes];
      
      // Update each node
      nodes.forEach(node => {
        const nodeObject = this.nodeObjects.get(node.id);
        
        if (nodeObject) {
          // Update existing node
          this.updateNodeObject(node, nodeObject);
        } else {
          // Create new node if it doesn't exist
          this.createNodeObject(node);
        }
      });
      
      // Remove nodes that no longer exist
      const currentIds = new Set(nodes.map(node => node.id));
      const objectIds = Array.from(this.nodeObjects.keys());
      
      objectIds.forEach(id => {
        if (!currentIds.has(id)) {
          this.removeNodeObject(id);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error updating nodes:', error);
      return false;
    }
  }
  
  /**
   * Create a visual object for a node
   * @param {Object} node - Node data
   * @private
   */
  createNodeObject(node) {
    if (!node || !node.id) return null;
    
    // Get node type
    const nodeType = node.type || 'default';
    
    // Get base color for node
    const color = this.getNodeColor(nodeType);
    
    // Get geometry type for node
    const geometryType = this.settings.useTypeGeometries 
      ? this.typeGeometries[nodeType] || this.typeGeometries.default
      : this.settings.defaultGeometry;
    
    // Create geometry
    const geometry = this.createGeometry(geometryType, this.getNodeSize(node));
    
    // Create material
    const material = new THREE.MeshStandardMaterial({
      color: color,
      transparent: true,
      opacity: node.visible ? this.settings.baseOpacity : this.settings.fadeOpacity,
      metalness: 0.2,
      roughness: 0.7
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { nodeId: node.id };
    
    // Position the mesh
    this.updateNodePosition(mesh, node);
    
    // Add label if enabled
    let label = null;
    if (this.settings.showLabels) {
      label = this.createLabel(node);
      mesh.add(label);
    }
    
    // Create node object
    const nodeObject = {
      mesh,
      label,
      type: nodeType,
      selected: false,
      hovered: false,
      visible: node.visible
    };
    
    // Add to scene
    this.scene.add(mesh);
    
    // Store in map
    this.nodeObjects.set(node.id, nodeObject);
    
    return nodeObject;
  }
  
  /**
   * Update an existing node object
   * @param {Object} node - Updated node data
   * @param {Object} nodeObject - Existing node object
   * @private
   */
  updateNodeObject(node, nodeObject) {
    if (!node || !nodeObject) return;
    
    const { mesh, label } = nodeObject;
    
    // Update position
    this.updateNodePosition(mesh, node);
    
    // Update visibility
    if (nodeObject.visible !== node.visible) {
      mesh.material.opacity = node.visible 
        ? this.settings.baseOpacity 
        : this.settings.fadeOpacity;
      mesh.visible = node.visible;
      
      if (label) {
        label.visible = node.visible && this.settings.showLabels;
      }
      
      nodeObject.visible = node.visible;
    }
    
    // Update type if changed
    if (nodeObject.type !== node.type && this.settings.useNodeColors) {
      const color = this.getNodeColor(node.type);
      mesh.material.color.set(color);
      nodeObject.type = node.type;
    }
    
    // Update label if name changed
    if (label && node.name && label.userData.name !== node.name) {
      mesh.remove(label);
      const newLabel = this.createLabel(node);
      mesh.add(newLabel);
      nodeObject.label = newLabel;
    }
  }
  
  /**
   * Update the position of a node
   * @param {THREE.Mesh} mesh - Node mesh
   * @param {Object} node - Node data
   * @private
   */
  updateNodePosition(mesh, node) {
    if (!mesh || !node.position) return;
    
    mesh.position.set(
      node.position.x || 0,
      node.position.y || 0,
      node.position.z || 0
    );
  }
  
  /**
   * Create a text label for a node
   * @param {Object} node - Node data
   * @returns {THREE.Object3D} Label object
   * @private
   */
  createLabel(node) {
    if (!node.name) return null;
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    // Set canvas size
    const fontSize = this.settings.labelSize;
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw background
    context.fillStyle = `rgba(0, 0, 0, ${this.settings.labelBackgroundOpacity})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw text
    context.font = `${fontSize}px ${this.settings.labelFont}`;
    context.fillStyle = new THREE.Color(this.settings.labelColor).getStyle();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(node.name, canvas.width / 2, canvas.height / 2);
    
    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.userData = { 
      nodeId: node.id,
      name: node.name,
      type: 'label'
    };
    
    // Scale sprite
    const labelScale = this.settings.labelScale;
    sprite.scale.set(canvas.width / 64 * labelScale, canvas.height / 64 * labelScale, 1);
    
    // Position above node
    const nodeSize = this.getNodeSize(node);
    sprite.position.set(0, nodeSize * this.settings.labelOffset, 0);
    
    return sprite;
  }
  
  /**
   * Create geometry for a node
   * @param {string} type - Geometry type
   * @param {number} size - Size of the geometry
   * @returns {THREE.BufferGeometry} Geometry object
   * @private
   */
  createGeometry(type, size) {
    const segments = this.settings.defaultSegments;
    const radius = size / 2;
    
    switch (type) {
      case 'sphere':
        return new THREE.SphereGeometry(radius, segments, segments);
      case 'box':
        return new THREE.BoxGeometry(size, size, size);
      case 'octahedron':
        return new THREE.OctahedronGeometry(radius);
      case 'dodecahedron':
        return new THREE.DodecahedronGeometry(radius);
      case 'icosahedron':
        return new THREE.IcosahedronGeometry(radius);
      case 'tetrahedron':
        return new THREE.TetrahedronGeometry(radius);
      case 'torus':
        return new THREE.TorusGeometry(radius, radius / 3, 16, segments);
      case 'cone':
        return new THREE.ConeGeometry(radius, size, segments);
      case 'cylinder':
        return new THREE.CylinderGeometry(radius, radius, size, segments);
      case 'ring':
        return new THREE.TorusGeometry(radius, radius / 4, 16, segments);
      default:
        return new THREE.SphereGeometry(radius, segments, segments);
    }
  }
  
  /**
   * Calculate size for a node based on level and type
   * @param {Object} node - Node data
   * @returns {number} Node size
   * @private
   */
  getNodeSize(node) {
    // Use visualization manager if available
    if (this.visualizationManager) {
      return this.visualizationManager.getNodeSize(node.type, node.level || 0);
    }
    
    // Fallback to local calculation
    // Base sizes by node type
    const baseSizes = {
      component_group: 18,
      component: 15,
      subcomponent: 12,
      capability: 10,
      function: 9,
      specification: 9,
      integration: 8,
      technique: 8,
      application: 8,
      input: 6,
      output: 7,
      default: 6
    };
    
    // Get base size for node type
    const nodeType = node.type || 'default';
    const baseSize = baseSizes[nodeType] || baseSizes.default;
    
    // Adjust for level
    const level = node.level || 0;
    const levelFactor = Math.max(0.6, 1 - (level * 0.05));
    
    // Apply level factor and global scale
    return baseSize * levelFactor * this.settings.nodeScale;
  }
  
  /**
   * Get color for a node type
   * @param {string} nodeType - Type of node
   * @returns {number} Hex color
   * @private
   */
  getNodeColor(nodeType) {
    // Use visualization manager if available
    if (this.visualizationManager) {
      const colorString = this.visualizationManager.getNodeColor(nodeType);
      // Convert from CSS color string to hex number if needed
      if (typeof colorString === 'string' && colorString.startsWith('#')) {
        return parseInt(colorString.substring(1), 16);
      }
      return colorString;
    }
    
    // Fallback to color manager
    if (this.colorManager) {
      return this.colorManager.getNodeTypeColor(nodeType);
    }
    
    // Default colors if no managers available
    const defaultColors = {
      component_group: 0x4A90E2,
      component: 0x50C878,
      subcomponent: 0x9B59B6,
      capability: 0xE67E22,
      function: 0xE74C3C,
      specification: 0xF1C40F,
      integration: 0x16A085,
      technique: 0x2ECC71,
      application: 0x3498DB,
      input: 0x5499C7,
      output: 0xF39C12,
      default: 0xCCCCCC
    };
    
    return defaultColors[nodeType] || defaultColors.default;
  }
  
  /**
   * Remove a node object
   * @param {string} nodeId - ID of node to remove
   * @private
   */
  removeNodeObject(nodeId) {
    const nodeObject = this.nodeObjects.get(nodeId);
    if (!nodeObject) return;
    
    // Remove from scene
    this.scene.remove(nodeObject.mesh);
    
    // Dispose resources
    if (nodeObject.mesh.geometry) nodeObject.mesh.geometry.dispose();
    if (nodeObject.mesh.material) nodeObject.mesh.material.dispose();
    
    // Remove from map
    this.nodeObjects.delete(nodeId);
  }
  
  /**
   * Clear all node objects
   * @private
   */
  clearNodeObjects() {
    // Remove all node objects from scene and dispose resources
    this.nodeObjects.forEach((nodeObject, nodeId) => {
      this.removeNodeObject(nodeId);
    });
    
    this.nodeObjects.clear();
  }
  
  /**
   * Set selected node
   * @param {string} nodeId - ID of selected node
   */
  setSelectedNode(nodeId) {
    // Deselect current selection
    if (this.selectedNode) {
      const prevSelected = this.nodeObjects.get(this.selectedNode);
      if (prevSelected) {
        prevSelected.selected = false;
        this.updateNodeObjectState(prevSelected);
      }
    }
    
    // Update selected node
    this.selectedNode = nodeId;
    
    // Select new node
    if (nodeId) {
      const nodeObject = this.nodeObjects.get(nodeId);
      if (nodeObject) {
        nodeObject.selected = true;
        this.updateNodeObjectState(nodeObject);
      }
    }
  }
  
  /**
   * Set hovered node
   * @param {string} nodeId - ID of hovered node
   */
  setHoveredNode(nodeId) {
    // Remove hover from current
    if (this.hoveredNode) {
      const prevHovered = this.nodeObjects.get(this.hoveredNode);
      if (prevHovered) {
        prevHovered.hovered = false;
        this.updateNodeObjectState(prevHovered);
      }
    }
    
    // Update hovered node
    this.hoveredNode = nodeId;
    
    // Apply hover to new node
    if (nodeId) {
      const nodeObject = this.nodeObjects.get(nodeId);
      if (nodeObject) {
        nodeObject.hovered = true;
        this.updateNodeObjectState(nodeObject);
      }
    }
  }
  
  /**
   * Update material/appearance based on node state
   * @param {Object} nodeObject - Node object to update
   * @private
   */
  updateNodeObjectState(nodeObject) {
    if (!nodeObject || !nodeObject.mesh) return;
    
    const { mesh, selected, hovered, type } = nodeObject;
    
    // Get base color for node type
    let color = this.getNodeColor(type);
    
    // Get highlighted color if selected or hovered
    if (selected || hovered) {
      const outlineColor = selected 
        ? 0x00FF00  // Green for selection
        : 0xFFFF00; // Yellow for hover
      
      // Update outline pass in SceneManager if available
      const sceneManager = registry.getModule('visualization.SceneManager');
      if (sceneManager && sceneManager.setOutlinedObjects) {
        sceneManager.setOutlinedObjects([mesh], outlineColor);
      }
      
      // Make material emissive
      mesh.material.emissive.set(new THREE.Color(color).multiplyScalar(0.2));
    } else {
      // Reset emissive
      mesh.material.emissive.set(0x000000);
    }
  }
  
  /**
   * Update method called each frame
   * @param {number} delta - Time since last update in seconds
   */
  update(delta) {
    // Animate node objects here if needed
  }
  
  /**
   * Get all nodes
   * @returns {Array} Array of node objects
   */
  getNodes() {
    return [...this.nodes];
  }
  
  /**
   * Get node by ID
   * @param {string} nodeId - Node ID
   * @returns {Object} Node data
   */
  getNodeById(nodeId) {
    return this.nodes.find(node => node.id === nodeId);
  }
  
  /**
   * Get node object by ID
   * @param {string} nodeId - Node ID
   * @returns {Object} Node object (mesh, etc.)
   */
  getNodeObjectById(nodeId) {
    return this.nodeObjects.get(nodeId);
  }
  
  /**
   * Show or hide node labels
   * @param {boolean} show - Whether to show labels
   */
  showLabels(show) {
    this.settings.showLabels = show;
    
    this.nodeObjects.forEach((nodeObject) => {
      if (nodeObject.label) {
        nodeObject.label.visible = show && nodeObject.visible;
      }
    });
  }
  
  /**
   * Update rendering settings
   * @param {Object} newSettings - New settings
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    // Refresh all nodes if needed for setting changes
    if (newSettings.useTypeGeometries !== undefined ||
        newSettings.labelScale !== undefined ||
        newSettings.nodeScale !== undefined) {
      this.setNodes(this.nodes);
    } else if (newSettings.showLabels !== undefined) {
      this.showLabels(newSettings.showLabels);
    }
  }
  
  /**
   * Highlight nodes
   * @param {Array<string>} nodeIds - Array of node IDs to highlight
   * @param {boolean} exclusive - Only highlight specified nodes
   */
  highlightNodes(nodeIds, exclusive = false) {
    const nodesToHighlight = new Set(nodeIds);
    
    this.nodeObjects.forEach((nodeObject, id) => {
      if (nodesToHighlight.has(id)) {
        // Highlight this node
        nodeObject.mesh.material.emissive.set(new THREE.Color(0xFFFF00).multiplyScalar(0.3));
        nodeObject.mesh.material.opacity = this.settings.baseOpacity * this.settings.highlightIntensity;
      } else if (exclusive) {
        // Fade other nodes
        nodeObject.mesh.material.emissive.set(new THREE.Color(0x000000));
        nodeObject.mesh.material.opacity = this.settings.fadeOpacity;
      } else {
        // Reset to normal
        nodeObject.mesh.material.emissive.set(new THREE.Color(0x000000));
        nodeObject.mesh.material.opacity = this.settings.baseOpacity;
      }
    });
  }
  
  /**
   * Reset all node highlighting
   */
  resetHighlighting() {
    this.highlightNodes([]);
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    this.clearNodeObjects();
    this.scene = null;
    this.colorManager = null;
    this.nodes = [];
    this.selectedNode = null;
    this.hoveredNode = null;
    this.isInitialized = false;
  }
}

export default registry.register(
  'visualization.NodeRenderer',
  new NodeRenderer(),
  ['visualization.ColorManager', 'visualization.SceneManager', 'visualization.VisualizationManager'],
  {
    description: 'Creates and manages visual representations of nodes',
    singleton: true
  }
);
