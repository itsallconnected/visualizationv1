/**
 * CameraController handles camera movement, controls, and view transitions
 * for the 3D visualization.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

class CameraController {
  constructor() {
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.scene = null;
    
    this.isInitialized = false;
    this.activeTransition = null;
    
    // Default settings
    this.settings = {
      enableDamping: true,
      dampingFactor: 0.1,
      enableZoom: true,
      zoomSpeed: 1.0,
      minDistance: 10,
      maxDistance: 1000,
      enablePan: true,
      panSpeed: 1.0,
      enableRotate: true,
      rotateSpeed: 1.0,
      autoRotate: false,
      autoRotateSpeed: 1.0,
      defaultPosition: new THREE.Vector3(0, 50, 250),
      defaultTarget: new THREE.Vector3(0, 0, 0),
      transitionDuration: 1000,
      transitionEasing: TWEEN.Easing.Cubic.InOut
    };
    
    // Event bus for publishing events
    this.eventBus = null;
    
    // Event listeners
    this.listeners = {};
    this.boundEventHandlers = {};
  }
  
  /**
   * Initialize the camera controller
   * @param {THREE.Scene} scene - The THREE.js scene
   * @param {THREE.WebGLRenderer} renderer - The THREE.js renderer
   * @returns {Promise<boolean>} Initialization result
   */
  async initialize(scene, renderer) {
    if (this.isInitialized) return true;
    
    try {
      this.scene = scene;
      this.renderer = renderer;
      
      // Get event bus
      this.eventBus = registry.getModule('utils.EventBus');
      
      // Get camera from scene manager
      const sceneManager = registry.getModule('visualization.SceneManager');
      this.camera = sceneManager ? sceneManager.getCamera() : null;
      
      if (!this.camera) {
        console.error('No camera found in scene manager');
        return false;
      }
      
      // Create orbit controls
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.applyControlSettings();
      
      // Bind event handlers
      this.boundEventHandlers.onControlsChange = this.handleControlsChange.bind(this);
      this.boundEventHandlers.onControlsStart = this.handleControlsStart.bind(this);
      this.boundEventHandlers.onControlsEnd = this.handleControlsEnd.bind(this);
      
      // Add event listeners to controls
      this.controls.addEventListener('change', this.boundEventHandlers.onControlsChange);
      this.controls.addEventListener('start', this.boundEventHandlers.onControlsStart);
      this.controls.addEventListener('end', this.boundEventHandlers.onControlsEnd);
      
      // Set initial position
      this.resetView(false);
      
      // Subscribe to events
      if (this.eventBus) {
        this.eventBus.subscribe('visualization:resetView', this.resetView.bind(this));
        this.eventBus.subscribe('visualization:fitObjects', this.fitToObjects.bind(this));
        this.eventBus.subscribe('visualization:focusNode', this.handleFocusNode.bind(this));
      }
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize CameraController:', error);
      return false;
    }
  }
  
  /**
   * Handle when controls change event fires
   * @param {Event} event - Controls change event
   * @private
   */
  handleControlsChange(event) {
    this.triggerEvent('cameraChange', {
      position: this.camera.position.clone(),
      target: this.controls.target.clone()
    });
  }
  
  /**
   * Handle when controls start event fires
   * @param {Event} event - Controls start event
   * @private
   */
  handleControlsStart(event) {
    // Cancel any active transitions when user takes control
    if (this.activeTransition) {
      this.activeTransition.stop();
      this.activeTransition = null;
    }
    
    this.triggerEvent('controlsStart', {
      position: this.camera.position.clone(),
      target: this.controls.target.clone()
    });
  }
  
  /**
   * Handle when controls end event fires
   * @param {Event} event - Controls end event
   * @private
   */
  handleControlsEnd(event) {
    this.triggerEvent('controlsEnd', {
      position: this.camera.position.clone(),
      target: this.controls.target.clone()
    });
  }
  
  /**
   * Handle focus node request
   * @param {Object} data - Event data with nodeId
   * @private
   */
  handleFocusNode(data) {
    if (!data || !data.nodeId) return;
    
    const nodeRenderer = registry.getModule('visualization.NodeRenderer');
    if (!nodeRenderer) return;
    
    const nodeObject = nodeRenderer.getNodeObject(data.nodeId);
    if (nodeObject && nodeObject.mesh) {
      this.focusOnObject(nodeObject.mesh, data.options);
    }
  }
  
  /**
   * Apply control settings
   * @private
   */
  applyControlSettings() {
    if (!this.controls) return;
    
    this.controls.enableDamping = this.settings.enableDamping;
    this.controls.dampingFactor = this.settings.dampingFactor;
    
    this.controls.enableZoom = this.settings.enableZoom;
    this.controls.zoomSpeed = this.settings.zoomSpeed;
    this.controls.minDistance = this.settings.minDistance;
    this.controls.maxDistance = this.settings.maxDistance;
    
    this.controls.enablePan = this.settings.enablePan;
    this.controls.panSpeed = this.settings.panSpeed;
    
    this.controls.enableRotate = this.settings.enableRotate;
    this.controls.rotateSpeed = this.settings.rotateSpeed;
    
    this.controls.autoRotate = this.settings.autoRotate;
    this.controls.autoRotateSpeed = this.settings.autoRotateSpeed;
  }
  
  /**
   * Update method called each frame
   * @param {number} delta - Time since last update in seconds
   */
  update(delta) {
    if (!this.isInitialized) return;
    
    // Update TWEEN animations
    TWEEN.update();
    
    // Update controls
    if (this.controls) {
      this.controls.update();
    }
    
    // Trigger update event
    this.triggerEvent('update', { delta });
  }
  
  /**
   * Reset camera to default position and target
   * @param {boolean} [animated=true] - Whether to animate the transition
   */
  resetView(animated = true) {
    if (!this.isInitialized) return;
    
    const targetPosition = this.settings.defaultPosition.clone();
    const targetLookAt = this.settings.defaultTarget.clone();
    
    if (animated) {
      this.animateCameraMove(targetPosition, targetLookAt);
    } else {
      this.camera.position.copy(targetPosition);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
    }
    
    // Trigger event
    this.triggerEvent('viewReset', { position: targetPosition, target: targetLookAt });
  }
  
  /**
   * Focus on a specific object
   * @param {THREE.Object3D} object - Object to focus on
   * @param {Object} [options] - Focus options
   */
  focusOnObject(object, options = {}) {
    if (!this.isInitialized || !object) return;
    
    // Get object position
    const position = new THREE.Vector3();
    if (object.getWorldPosition) {
      object.getWorldPosition(position);
    } else {
      // Calculate world position if getWorldPosition is not available
      position.setFromMatrixPosition(object.matrixWorld);
    }
    
    // Use zoomToPosition with the object's position
    this.zoomToPosition(position, options);
  }
  
  /**
   * Zoom to a specific position
   * @param {THREE.Vector3} position - Position to focus on
   * @param {Object} options - Zoom options
   * @param {number} [options.duration] - Animation duration in ms
   * @param {THREE.Vector3} [options.offset] - Camera offset from target
   * @param {string} [options.easing] - Easing function name (e.g. 'easeInOutQuad')
   * @param {Function} [options.onComplete] - Callback when animation completes
   */
  zoomToPosition(position, options = {}) {
    if (!this.isInitialized || !position) return;
    
    const duration = options.duration || this.settings.transitionDuration;
    
    // Get easing function by name or use default
    let easingFunction = this.settings.transitionEasing;
    if (options.easing) {
      switch (options.easing) {
        case 'linear':
          easingFunction = TWEEN.Easing.Linear.None;
          break;
        case 'easeInQuad':
          easingFunction = TWEEN.Easing.Quadratic.In;
          break;
        case 'easeOutQuad':
          easingFunction = TWEEN.Easing.Quadratic.Out;
          break;
        case 'easeInOutQuad':
          easingFunction = TWEEN.Easing.Quadratic.InOut;
          break;
        case 'easeInCubic':
          easingFunction = TWEEN.Easing.Cubic.In;
          break;
        case 'easeOutCubic':
          easingFunction = TWEEN.Easing.Cubic.Out;
          break;
        case 'easeInOutCubic':
          easingFunction = TWEEN.Easing.Cubic.InOut;
          break;
        // Add more easing options as needed
      }
    }
    
    // Calculate target position
    let targetPosition;
    if (options.offset) {
      targetPosition = position.clone().add(options.offset);
    } else {
      // Get current camera direction
      const direction = new THREE.Vector3().subVectors(
        this.camera.position, 
        this.controls.target
      ).normalize();
      
      // Default offset - back and up from the target based on current direction
      const distance = options.distance || 50;
      targetPosition = position.clone().add(direction.multiplyScalar(distance));
    }
    
    this.animateCameraMove(targetPosition, position, {
      duration,
      easing: easingFunction,
      onComplete: options.onComplete
    });
    
    // Trigger event
    this.triggerEvent('zoomToPosition', { position, targetPosition });
  }
  
  /**
   * Animate camera movement
   * @param {THREE.Vector3} targetPosition - Target camera position
   * @param {THREE.Vector3} targetLookAt - Target look-at position
   * @param {Object} options - Animation options
   * @private
   */
  animateCameraMove(targetPosition, targetLookAt, options = {}) {
    // Cancel any active transition
    if (this.activeTransition) {
      this.activeTransition.stop();
      this.activeTransition = null;
    }
    
    const duration = options.duration || this.settings.transitionDuration;
    const easing = options.easing || this.settings.transitionEasing;
    
    // Current state
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    
    // Animation state
    const animationState = {
      posX: startPosition.x,
      posY: startPosition.y,
      posZ: startPosition.z,
      targetX: startTarget.x,
      targetY: startTarget.y,
      targetZ: startTarget.z
    };
    
    // Target state
    const endState = {
      posX: targetPosition.x,
      posY: targetPosition.y,
      posZ: targetPosition.z,
      targetX: targetLookAt.x,
      targetY: targetLookAt.y,
      targetZ: targetLookAt.z
    };
    
    // Create tween
    this.activeTransition = new TWEEN.Tween(animationState)
      .to(endState, duration)
      .easing(easing)
      .onUpdate(() => {
        // Update camera position
        this.camera.position.set(
          animationState.posX,
          animationState.posY,
          animationState.posZ
        );
        
        // Update controls target
        this.controls.target.set(
          animationState.targetX,
          animationState.targetY,
          animationState.targetZ
        );
        
        // Update controls
        this.controls.update();
        
        // Trigger camera move event
        this.triggerEvent('cameraMoving', {
          position: this.camera.position.clone(),
          target: this.controls.target.clone(),
          progress: this.activeTransition._elapsed / duration
        });
      })
      .onComplete(() => {
        this.activeTransition = null;
        
        // Trigger camera moved event
        this.triggerEvent('cameraMoved', {
          position: this.camera.position.clone(),
          target: this.controls.target.clone()
        });
        
        if (options.onComplete) options.onComplete();
      })
      .onStop(() => {
        // Handle when animation is explicitly stopped
        this.triggerEvent('cameraMoveStopped', {
          position: this.camera.position.clone(),
          target: this.controls.target.clone()
        });
      })
      .start();
  }
  
  /**
   * Fit camera view to include all given objects
   * @param {Array<THREE.Object3D>} objects - Objects to fit in view
   * @param {Object} [options] - Fit options
   * @param {number} [options.padding=1.2] - View padding factor
   * @param {number} [options.duration] - Animation duration
   * @param {string} [options.easing] - Easing function name
   */
  fitToObjects(objects, options = {}) {
    if (!this.isInitialized || !objects || objects.length === 0) return;
    
    const padding = options.padding || 1.2;
    const animated = options.duration !== 0;
    
    // Create bounding box
    const boundingBox = new THREE.Box3();
    
    // Add each object to the bounding box
    objects.forEach(object => {
      if (object.geometry) {
        // For objects with geometry
        if (!object.geometry.boundingBox) {
          object.geometry.computeBoundingBox();
        }
        
        if (object.geometry.boundingBox) {
          const objectBox = object.geometry.boundingBox.clone();
          objectBox.applyMatrix4(object.matrixWorld);
          boundingBox.union(objectBox);
        } else {
          // Fallback for geometries without bounding box
          const box = new THREE.Box3().setFromObject(object);
          boundingBox.union(box);
        }
      } else {
        // For objects without geometry (like groups)
        const box = new THREE.Box3().setFromObject(object);
        boundingBox.union(box);
      }
    });
    
    // Handle empty or invalid bounding box
    if (boundingBox.isEmpty() || !boundingBox.isBox3) {
      console.warn('Invalid or empty bounding box, using object positions instead');
      
      // Use the first object's position as fallback
      if (objects.length > 0) {
        const position = new THREE.Vector3();
        objects[0].getWorldPosition(position);
        this.zoomToPosition(position, options);
        return;
      }
      return;
    }
    
    // Get bounding sphere from box
    const boundingSphere = new THREE.Sphere();
    boundingBox.getBoundingSphere(boundingSphere);
    
    // Calculate target position
    const center = boundingSphere.center;
    const radius = boundingSphere.radius * padding;
    
    // Calculate camera position based on current camera orientation
    const direction = this.camera.position.clone()
      .sub(this.controls.target)
      .normalize();
    
    // Calculate distance using vertical field of view
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = radius / Math.sin(fov / 2);
    
    const position = center.clone().add(direction.multiplyScalar(distance));
    
    // Move camera
    if (animated) {
      this.animateCameraMove(position, center, options);
    } else {
      this.camera.position.copy(position);
      this.controls.target.copy(center);
      this.controls.update();
      
      // Trigger camera moved event
      this.triggerEvent('cameraMoved', {
        position: this.camera.position.clone(),
        target: this.controls.target.clone()
      });
    }
  }
  
  /**
   * Convert screen coordinates to world coordinates
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {number} [z=0] - Z depth (0 = near plane, 1 = far plane)
   * @returns {THREE.Vector3} World position
   */
  screenToWorld(x, y, z = 0) {
    if (!this.camera || !this.renderer) {
      return new THREE.Vector3();
    }
    
    // Create normalized device coordinates (-1 to +1)
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((y - rect.top) / rect.height) * 2 + 1;
    
    // Create 3D point and unproject
    const point = new THREE.Vector3(ndcX, ndcY, z);
    point.unproject(this.camera);
    
    return point;
  }
  
  /**
   * Convert screen coordinates delta to world delta, accounting for camera orientation
   * @param {number} deltaX - Screen X delta
   * @param {number} deltaY - Screen Y delta
   * @returns {THREE.Vector3} World space delta
   */
  screenToWorldDelta(deltaX, deltaY) {
    if (!this.camera || !this.renderer) {
      return new THREE.Vector3();
    }
    
    // Get container dimensions
    const rect = this.renderer.domElement.getBoundingClientRect();
    
    // Get center point in screen space
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Get world position at center with zero depth
    const worldCenter = this.screenToWorld(centerX, centerY, 0);
    
    // Get world position at center + delta with zero depth
    const worldDelta = this.screenToWorld(centerX + deltaX, centerY + deltaY, 0);
    
    // Get camera's right and up vectors (in world space)
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Project the delta onto the camera's right and up vectors
    const moveDelta = new THREE.Vector3().subVectors(worldDelta, worldCenter);
    const rightAmount = moveDelta.dot(cameraRight);
    const upAmount = moveDelta.dot(cameraUp);
    
    // Create a world-space delta that follows the camera's orientation
    return new THREE.Vector3(
      cameraRight.x * rightAmount + cameraUp.x * upAmount,
      cameraRight.y * rightAmount + cameraUp.y * upAmount,
      cameraRight.z * rightAmount + cameraUp.z * upAmount
    );
  }
  
  /**
   * Enable or disable controls
   * @param {boolean} enabled - Whether controls are enabled
   */
  setControlsEnabled(enabled) {
    if (!this.controls) return;
    
    this.controls.enabled = enabled;
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('visualization:controlsEnabled', { enabled });
    }
  }
  
  /**
   * Update controller settings
   * @param {Object} settings - New settings to apply
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    this.applyControlSettings();
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('visualization:cameraSettingsUpdated', this.settings);
    }
  }
  
  /**
   * Dispose of the controller and release resources
   */
  dispose() {
    // Stop any active transitions
    if (this.activeTransition) {
      this.activeTransition.stop();
      this.activeTransition = null;
    }
    
    // Remove control event listeners
    if (this.controls) {
      this.controls.removeEventListener('change', this.boundEventHandlers.onControlsChange);
      this.controls.removeEventListener('start', this.boundEventHandlers.onControlsStart);
      this.controls.removeEventListener('end', this.boundEventHandlers.onControlsEnd);
      
      // Dispose of controls
      this.controls.dispose();
      this.controls = null;
    }
    
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('visualization:resetView', this.resetView.bind(this));
      this.eventBus.unsubscribe('visualization:fitObjects', this.fitToObjects.bind(this));
      this.eventBus.unsubscribe('visualization:focusNode', this.handleFocusNode.bind(this));
    }
    
    this.camera = null;
    this.renderer = null;
    this.scene = null;
    this.isInitialized = false;
    
    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('visualization:cameraControllerDisposed');
    }
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }
  
  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    const index = this.listeners[event].indexOf(callback);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }
  
  /**
   * Trigger an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @private
   */
  triggerEvent(event, data) {
    // Local event listeners
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in camera ${event} listener:`, error);
        }
      });
    }
    
    // Global events via EventBus
    if (this.eventBus) {
      this.eventBus.publish(`camera:${event}`, data);
    }
  }
}

export default registry.register(
  'visualization.CameraController',
  new CameraController(),
  ['visualization.SceneManager', 'utils.EventBus'],
  {
    description: 'Handles camera movement, controls, and view transitions',
    singleton: true
  }
);
