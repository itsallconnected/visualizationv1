import * as THREE from 'three';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Manages multiple visualization spheres
 * Handles sphere creation, switching, and navigation
 */
class SphereManager {
  constructor() {
    // Collection of sphere configurations
    this.spheres = new Map();
    
    // Current active sphere
    this.activeSphereId = null;
    
    // Scene reference (set during initialization)
    this.scene = null;
    
    // Animation controller reference
    this.animationController = null;
    
    // Camera controller reference
    this.cameraController = null;
    
    // Sphere container
    this.sphereContainer = null;
    
    // Default sphere settings
    this.defaultSettings = {
      radius: 500,
      segments: 64,
      opacity: 0.2,
      color: 0x3366cc,
      wireframe: true,
      position: new THREE.Vector3(0, 0, 0),
      visible: false
    };
    
    // Default sphere layout
    this.layout = {
      radius: 5000,
      startAngle: 0,
      spacing: Math.PI / 4
    };
    
    this.initialized = false;
  }
  
  /**
   * Initialize the sphere manager
   * @param {THREE.Scene} scene - The THREE.js scene
   */
  initialize(scene) {
    if (this.initialized) return;
    
    this.scene = scene;
    
    // Get references to required controllers
    this.animationController = registry.get('visualization.AnimationController');
    this.cameraController = registry.get('visualization.CameraController');
    
    // Create container for all spheres
    this.sphereContainer = new THREE.Group();
    this.sphereContainer.name = 'SphereContainer';
    this.scene.add(this.sphereContainer);
    
    // Set up event listeners
    this.setupEventListeners();
    
    this.initialized = true;
    console.log('SphereManager initialized');
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    EventBus.subscribe('sphere:add', this.handleAddSphere.bind(this));
    EventBus.subscribe('sphere:remove', this.handleRemoveSphere.bind(this));
    EventBus.subscribe('sphere:activate', this.handleActivateSphere.bind(this));
    EventBus.subscribe('sphere:deactivate', this.handleDeactivateSphere.bind(this));
    EventBus.subscribe('sphere:toggle', this.handleToggleSphere.bind(this));
    EventBus.subscribe('sphere:update', this.handleUpdateSphere.bind(this));
    EventBus.subscribe('sphere:navigate', this.handleNavigateSpheres.bind(this));
  }
  
  /**
   * Clean up event listeners and resources
   */
  dispose() {
    EventBus.unsubscribe('sphere:add', this.handleAddSphere.bind(this));
    EventBus.unsubscribe('sphere:remove', this.handleRemoveSphere.bind(this));
    EventBus.unsubscribe('sphere:activate', this.handleActivateSphere.bind(this));
    EventBus.unsubscribe('sphere:deactivate', this.handleDeactivateSphere.bind(this));
    EventBus.unsubscribe('sphere:toggle', this.handleToggleSphere.bind(this));
    EventBus.unsubscribe('sphere:update', this.handleUpdateSphere.bind(this));
    EventBus.unsubscribe('sphere:navigate', this.handleNavigateSpheres.bind(this));
    
    // Clean up resources
    this.spheres.forEach(sphere => {
      this.sphereContainer.remove(sphere.mesh);
      sphere.mesh.geometry.dispose();
      sphere.mesh.material.dispose();
    });
    
    this.scene.remove(this.sphereContainer);
    this.spheres.clear();
    this.initialized = false;
  }
  
  /**
   * Create a new visualization sphere
   * 
   * @param {string} id - Unique identifier for the sphere
   * @param {Object} config - Sphere configuration
   * @returns {Object} - Sphere object
   */
  createSphere(id, config = {}) {
    if (this.spheres.has(id)) {
      console.warn(`Sphere with ID ${id} already exists`);
      return this.spheres.get(id);
    }
    
    // Merge config with default settings
    const settings = { ...this.defaultSettings, ...config };
    
    // Create geometry and material
    const geometry = new THREE.SphereGeometry(
      settings.radius, 
      settings.segments, 
      settings.segments
    );
    
    const material = new THREE.MeshBasicMaterial({
      color: settings.color,
      wireframe: settings.wireframe,
      transparent: true,
      opacity: settings.opacity
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Sphere_${id}`;
    mesh.position.copy(settings.position);
    mesh.visible = settings.visible;
    
    // Create sphere object
    const sphere = {
      id,
      mesh,
      settings,
      nodes: new Map(),
      links: new Map(),
      expanded: new Set(),
      selected: null
    };
    
    // Add mesh to container
    this.sphereContainer.add(mesh);
    
    // Store sphere
    this.spheres.set(id, sphere);
    
    // Notify sphere creation
    EventBus.publish('sphere:created', { id, sphere });
    
    return sphere;
  }
  
  /**
   * Add a sphere with auto-positioning
   * 
   * @param {string} id - Unique identifier for the sphere
   * @param {Object} config - Sphere configuration
   * @returns {Object} - Sphere object
   */
  addSphere(id, config = {}) {
    // Calculate position based on layout
    const position = this.calculateSpherePosition(this.spheres.size);
    
    // Create sphere with calculated position
    return this.createSphere(id, {
      ...config,
      position
    });
  }
  
  /**
   * Calculate position for a sphere in the layout
   * 
   * @param {number} index - Index of the sphere
   * @returns {THREE.Vector3} - Calculated position
   */
  calculateSpherePosition(index) {
    const angle = this.layout.startAngle + (index * this.layout.spacing);
    const x = this.layout.radius * Math.cos(angle);
    const z = this.layout.radius * Math.sin(angle);
    
    return new THREE.Vector3(x, 0, z);
  }
  
  /**
   * Remove a sphere
   * 
   * @param {string} id - Sphere ID
   * @returns {boolean} - Success status
   */
  removeSphere(id) {
    const sphere = this.spheres.get(id);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${id} not found`);
      return false;
    }
    
    // If this is the active sphere, deactivate it first
    if (this.activeSphereId === id) {
      this.deactivateSphere(id);
    }
    
    // Remove mesh from container
    this.sphereContainer.remove(sphere.mesh);
    
    // Dispose of resources
    sphere.mesh.geometry.dispose();
    sphere.mesh.material.dispose();
    
    // Remove from collection
    this.spheres.delete(id);
    
    // Notify sphere removal
    EventBus.publish('sphere:removed', { id });
    
    return true;
  }
  
  /**
   * Get a sphere by ID
   * 
   * @param {string} id - Sphere ID
   * @returns {Object|null} - Sphere object or null if not found
   */
  getSphere(id) {
    return this.spheres.get(id) || null;
  }
  
  /**
   * Activate a sphere (make it visible and current)
   * 
   * @param {string} id - Sphere ID
   * @param {Object} options - Activation options
   * @returns {boolean} - Success status
   */
  activateSphere(id, options = {}) {
    const sphere = this.spheres.get(id);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${id} not found`);
      return false;
    }
    
    const { animate = true, duration = 1200 } = options;
    
    // If another sphere is active, deactivate it first
    if (this.activeSphereId && this.activeSphereId !== id) {
      this.deactivateSphere(this.activeSphereId, { animate: false });
    }
    
    // Make sphere visible
    sphere.mesh.visible = true;
    
    // Move camera to sphere if animation controller is available
    if (animate && this.cameraController && this.animationController) {
      this.cameraController.moveTo(sphere.mesh.position, {
        duration,
        onComplete: () => {
          // Notify sphere activation completed
          EventBus.publish('sphere:activated', { id, sphere });
        }
      });
    } else {
      // Immediately move camera
      if (this.cameraController) {
        this.cameraController.setPosition(sphere.mesh.position);
      }
      
      // Notify sphere activation
      EventBus.publish('sphere:activated', { id, sphere });
    }
    
    // Set as active sphere
    this.activeSphereId = id;
    
    return true;
  }
  
  /**
   * Deactivate a sphere
   * 
   * @param {string} id - Sphere ID
   * @param {Object} options - Deactivation options
   * @returns {boolean} - Success status
   */
  deactivateSphere(id, options = {}) {
    const sphere = this.spheres.get(id);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${id} not found`);
      return false;
    }
    
    const { animate = true, duration = 800 } = options;
    
    // Only if this is the active sphere
    if (this.activeSphereId === id) {
      // If animating, fade out the sphere
      if (animate && this.animationController) {
        const material = sphere.mesh.material;
        const originalOpacity = material.opacity;
        
        this.animationController.animate(`deactivate_${id}`, 
          { opacity: originalOpacity }, 
          { opacity: 0 }, 
          {
            duration,
            onUpdate: (obj) => {
              material.opacity = obj.opacity;
            },
            onComplete: () => {
              sphere.mesh.visible = false;
              material.opacity = originalOpacity;
              
              // Clear active sphere
              this.activeSphereId = null;
              
              // Notify sphere deactivation completed
              EventBus.publish('sphere:deactivated', { id, sphere });
            }
          }
        );
      } else {
        // Immediately hide sphere
        sphere.mesh.visible = false;
        
        // Clear active sphere
        this.activeSphereId = null;
        
        // Notify sphere deactivation
        EventBus.publish('sphere:deactivated', { id, sphere });
      }
    }
    
    return true;
  }
  
  /**
   * Toggle a sphere's activation state
   * 
   * @param {string} id - Sphere ID
   * @param {Object} options - Toggle options
   * @returns {boolean} - Success status
   */
  toggleSphere(id, options = {}) {
    if (this.activeSphereId === id) {
      return this.deactivateSphere(id, options);
    } else {
      return this.activateSphere(id, options);
    }
  }
  
  /**
   * Update a sphere's settings
   * 
   * @param {string} id - Sphere ID
   * @param {Object} settings - New settings
   * @returns {boolean} - Success status
   */
  updateSphere(id, settings = {}) {
    const sphere = this.spheres.get(id);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${id} not found`);
      return false;
    }
    
    // Update settings
    sphere.settings = { ...sphere.settings, ...settings };
    
    // Update mesh properties
    const mesh = sphere.mesh;
    const material = mesh.material;
    
    if (settings.radius !== undefined) {
      // Create new geometry with updated radius
      const oldGeometry = mesh.geometry;
      mesh.geometry = new THREE.SphereGeometry(
        settings.radius, 
        sphere.settings.segments, 
        sphere.settings.segments
      );
      oldGeometry.dispose();
    }
    
    if (settings.color !== undefined) {
      material.color.set(settings.color);
    }
    
    if (settings.opacity !== undefined) {
      material.opacity = settings.opacity;
    }
    
    if (settings.wireframe !== undefined) {
      material.wireframe = settings.wireframe;
    }
    
    if (settings.position !== undefined) {
      mesh.position.copy(settings.position);
    }
    
    if (settings.visible !== undefined) {
      mesh.visible = settings.visible;
    }
    
    // Notify sphere update
    EventBus.publish('sphere:updated', { id, sphere, settings });
    
    return true;
  }
  
  /**
   * Navigate between spheres with animation
   * 
   * @param {string} fromId - Source sphere ID
   * @param {string} toId - Destination sphere ID
   * @param {Object} options - Navigation options
   * @returns {boolean} - Success status
   */
  navigateBetweenSpheres(fromId, toId, options = {}) {
    const fromSphere = this.spheres.get(fromId);
    const toSphere = this.spheres.get(toId);
    
    if (!fromSphere || !toSphere) {
      console.warn(`One or both spheres not found (${fromId} → ${toId})`);
      return false;
    }
    
    const { duration = 2000, arcHeight = 1000, steps = 100 } = options;
    
    // Create arc path between spheres
    const fromPos = fromSphere.mesh.position.clone();
    const toPos = toSphere.mesh.position.clone();
    const midPoint = new THREE.Vector3().addVectors(fromPos, toPos).multiplyScalar(0.5);
    midPoint.y += arcHeight;
    
    // If camera controller is available, use it to move along the path
    if (this.cameraController && this.animationController) {
      // Deactivate current sphere
      this.deactivateSphere(fromId, { animate: true, duration: duration * 0.3 });
      
      // Generate arc points
      const points = this.generateArcPoints(fromPos, toPos, midPoint, steps);
      
      // Create timeline for camera movement
      const stepDuration = duration / steps;
      
      // Create sequence of camera movements
      const cameraAnimations = points.map((point, index) => ({
        target: this.cameraController.camera.position,
        endState: point,
        options: {
          duration: stepDuration,
          easing: TWEEN.Easing.Quadratic.InOut
        }
      }));
      
      // Execute the sequence
      this.animationController.sequence('sphere_navigation', cameraAnimations)
        .then(() => {
          // Activate destination sphere
          this.activateSphere(toId, { animate: true, duration: duration * 0.3 });
        });
      
      return true;
    } else {
      // Fallback: directly activate destination sphere
      return this.activateSphere(toId, options);
    }
  }
  
  /**
   * Generate points along an arc path
   * 
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {THREE.Vector3} mid - Middle control point
   * @param {number} steps - Number of points to generate
   * @returns {Array<THREE.Vector3>} - Array of points
   */
  generateArcPoints(start, end, mid, steps) {
    const points = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      // Quadratic Bezier curve
      const point = new THREE.Vector3();
      
      point.x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * mid.x + t * t * end.x;
      point.y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * mid.y + t * t * end.y;
      point.z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * mid.z + t * t * end.z;
      
      points.push(point);
    }
    
    return points;
  }
  
  /**
   * Add a node to a sphere
   * 
   * @param {string} sphereId - Sphere ID
   * @param {string} nodeId - Node ID
   * @param {Object} nodeObject - Node object
   * @returns {boolean} - Success status
   */
  addNodeToSphere(sphereId, nodeId, nodeObject) {
    const sphere = this.spheres.get(sphereId);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${sphereId} not found`);
      return false;
    }
    
    sphere.nodes.set(nodeId, nodeObject);
    return true;
  }
  
  /**
   * Remove a node from a sphere
   * 
   * @param {string} sphereId - Sphere ID
   * @param {string} nodeId - Node ID
   * @returns {boolean} - Success status
   */
  removeNodeFromSphere(sphereId, nodeId) {
    const sphere = this.spheres.get(sphereId);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${sphereId} not found`);
      return false;
    }
    
    return sphere.nodes.delete(nodeId);
  }
  
  /**
   * Add a link to a sphere
   * 
   * @param {string} sphereId - Sphere ID
   * @param {string} linkId - Link ID
   * @param {Object} linkObject - Link object
   * @returns {boolean} - Success status
   */
  addLinkToSphere(sphereId, linkId, linkObject) {
    const sphere = this.spheres.get(sphereId);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${sphereId} not found`);
      return false;
    }
    
    sphere.links.set(linkId, linkObject);
    return true;
  }
  
  /**
   * Remove a link from a sphere
   * 
   * @param {string} sphereId - Sphere ID
   * @param {string} linkId - Link ID
   * @returns {boolean} - Success status
   */
  removeLinkFromSphere(sphereId, linkId) {
    const sphere = this.spheres.get(sphereId);
    
    if (!sphere) {
      console.warn(`Sphere with ID ${sphereId} not found`);
      return false;
    }
    
    return sphere.links.delete(linkId);
  }
  
  /**
   * Create a cross-sphere connection
   * 
   * @param {string} sourceNodeId - Source node ID
   * @param {string} sourceSphereId - Source sphere ID
   * @param {string} targetNodeId - Target node ID
   * @param {string} targetSphereId - Target sphere ID
   * @param {Object} options - Connection options
   * @returns {string} - Connection ID
   */
  createCrossSphereConnection(sourceNodeId, sourceSphereId, targetNodeId, targetSphereId, options = {}) {
    const sourceSphere = this.spheres.get(sourceSphereId);
    const targetSphere = this.spheres.get(targetSphereId);
    
    if (!sourceSphere || !targetSphere) {
      console.warn('One or both spheres not found');
      return null;
    }
    
    const sourceNode = sourceSphere.nodes.get(sourceNodeId);
    const targetNode = targetSphere.nodes.get(targetNodeId);
    
    if (!sourceNode || !targetNode) {
      console.warn('One or both nodes not found');
      return null;
    }
    
    // Generate connection ID
    const connectionId = `cross_${sourceSphereId}_${sourceNodeId}_${targetSphereId}_${targetNodeId}`;
    
    // Create connection data
    const connection = {
      id: connectionId,
      sourceNodeId,
      sourceSphereId,
      targetNodeId,
      targetSphereId,
      type: options.type || 'cross-sphere',
      visible: options.visible || false,
      color: options.color || 0xff9900,
      width: options.width || 2,
      dashed: options.dashed || true
    };
    
    // Store cross-sphere connection
    this.crossSphereConnections = this.crossSphereConnections || new Map();
    this.crossSphereConnections.set(connectionId, connection);
    
    // Notify connection creation
    EventBus.publish('sphere:connection:created', { connection });
    
    return connectionId;
  }
  
  /**
   * Remove a cross-sphere connection
   * 
   * @param {string} connectionId - Connection ID
   * @returns {boolean} - Success status
   */
  removeCrossSphereConnection(connectionId) {
    if (!this.crossSphereConnections) return false;
    
    const connection = this.crossSphereConnections.get(connectionId);
    
    if (!connection) {
      console.warn(`Cross-sphere connection with ID ${connectionId} not found`);
      return false;
    }
    
    this.crossSphereConnections.delete(connectionId);
    
    // Notify connection removal
    EventBus.publish('sphere:connection:removed', { connectionId, connection });
    
    return true;
  }
  
  /**
   * Get all cross-sphere connections
   * 
   * @returns {Array} - Array of connections
   */
  getAllCrossSphereConnections() {
    if (!this.crossSphereConnections) return [];
    return Array.from(this.crossSphereConnections.values());
  }
  
  /**
   * Get cross-sphere connections for a node
   * 
   * @param {string} nodeId - Node ID
   * @param {string} sphereId - Sphere ID
   * @returns {Array} - Array of connections
   */
  getNodeCrossSphereConnections(nodeId, sphereId) {
    if (!this.crossSphereConnections) return [];
    
    return Array.from(this.crossSphereConnections.values())
      .filter(conn => 
        (conn.sourceNodeId === nodeId && conn.sourceSphereId === sphereId) ||
        (conn.targetNodeId === nodeId && conn.targetSphereId === sphereId)
      );
  }
  
  /**
   * Toggle visibility of cross-sphere connections
   * 
   * @param {boolean} visible - Visibility state
   */
  toggleCrossSphereConnectionsVisibility(visible) {
    if (!this.crossSphereConnections) return;
    
    this.crossSphereConnections.forEach(connection => {
      connection.visible = visible;
      
      // Notify connection visibility change
      EventBus.publish('sphere:connection:visibility', { 
        connectionId: connection.id, 
        visible 
      });
    });
  }
  
  /**
   * Handle add sphere event
   * 
   * @param {Object} data - Event data
   */
  handleAddSphere(data) {
    const { id, config } = data;
    this.addSphere(id, config);
  }
  
  /**
   * Handle remove sphere event
   * 
   * @param {Object} data - Event data
   */
  handleRemoveSphere(data) {
    const { id } = data;
    this.removeSphere(id);
  }
  
  /**
   * Handle activate sphere event
   * 
   * @param {Object} data - Event data
   */
  handleActivateSphere(data) {
    const { id, options } = data;
    this.activateSphere(id, options);
  }
  
  /**
   * Handle deactivate sphere event
   * 
   * @param {Object} data - Event data
   */
  handleDeactivateSphere(data) {
    const { id, options } = data;
    this.deactivateSphere(id, options);
  }
  
  /**
   * Handle toggle sphere event
   * 
   * @param {Object} data - Event data
   */
  handleToggleSphere(data) {
    const { id, options } = data;
    this.toggleSphere(id, options);
  }
  
  /**
   * Handle update sphere event
   * 
   * @param {Object} data - Event data
   */
  handleUpdateSphere(data) {
    const { id, settings } = data;
    this.updateSphere(id, settings);
  }
  
  /**
   * Handle navigate spheres event
   * 
   * @param {Object} data - Event data
   */
  handleNavigateSpheres(data) {
    const { fromId, toId, options } = data;
    this.navigateBetweenSpheres(fromId, toId, options);
  }
}

// Export singleton instance
const sphereManager = new SphereManager();

export default registry.register(
  'visualization.SphereManager',
  sphereManager,
  [
    'visualization.AnimationController',
    'visualization.CameraController',
    'utils.EventBus'
  ],
  {
    description: 'Manages multiple visualization spheres and navigation between them',
    usage: 'Used for handling multi-sphere visualization and cross-sphere connections'
  }
); 