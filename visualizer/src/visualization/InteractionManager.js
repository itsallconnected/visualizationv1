import * as THREE from 'three';
import { Raycaster, Vector2 } from 'three';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Manages all user interactions with the visualization
 * Handles mouse/touch events, selection, hovering, and drag operations
 */
class InteractionManager {
  constructor() {
    // DOM elements
    this.container = null;
    
    // THREE.js objects
    this.camera = null;
    this.renderer = null;
    this.raycaster = new Raycaster();
    this.mouse = new Vector2();
    
    // State tracking
    this.isInitialized = false;
    this.isEnabled = true;
    this.isDragging = false;
    this.isRightDragging = false;
    this.isShiftDown = false;
    this.isCtrlDown = false;
    this.isAltDown = false;
    this.isTouching = false;
    this.isMobile = this.detectMobile();
    
    // Touch state tracking
    this.touchStartPositions = [];
    this.lastTouchDistance = 0;
    this.lastTouchRotation = 0;
    this.lastTouchCenter = new Vector2();
    
    // Interaction objects
    this.selectedObject = null;
    this.hoveredObject = null;
    this.dragStartPosition = new Vector2();
    this.prevMousePosition = new Vector2();
    
    // Timing for distinguishing clicks from drags
    this.clickStartTime = 0;
    this.clickTimeout = null;
    this.doubleclickTimeout = null;
    this.longPressTimeout = null;
    
    // Settings
    this.settings = {
      clickMaxDuration: 300,           // Max duration for a click in ms
      doubleclickMaxDelay: 300,        // Max delay between clicks for double-click
      longPressMinDuration: 500,       // Min duration for long press
      dragThreshold: 3,                // Min pixels to move for drag
      raycastObjects: 'visible',       // 'all' or 'visible'
      doubleClickToExpand: true,       // Double-click to expand nodes
      clickToSelect: true,             // Click to select nodes
      hoverToHighlight: true,          // Hover to highlight nodes
      enableDragInteraction: true,     // Enable drag interaction
      enableTouchInteraction: true,    // Enable touch interaction
      enableKeyboardShortcuts: true,   // Enable keyboard shortcuts
      enableMouseWheel: true,          // Enable mouse wheel zoom
      pinchSensitivity: 0.05,          // Sensitivity of pinch zoom
      doubleTapTimeout: 300,           // Time between taps for double-tap
      touchHoldDuration: 500,          // Duration for touch hold (right-click equivalent)
      mobileOptimizationEnabled: true, // Whether to use mobile optimizations
      touchRotationSensitivity: 0.5,   // Sensitivity for two-finger rotation
      touchResponseThreshold: 30       // Milliseconds to throttle touch move events
    };
    
    // Performance optimizations for touch
    this.lastTouchMoveTime = 0;
    
    // Reference to visualization manager
    this.visualizationManager = null;
    
    // Event listeners
    this.listeners = {};
    this.boundEventHandlers = {};
    
    // Event bus for publishing events
    this.eventBus = null;
  }
  
  /**
   * Detect if the current device is mobile
   * @private
   * @returns {boolean} Whether the device is mobile
   */
  detectMobile() {
    return (
      typeof window !== 'undefined' && 
      (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          window.navigator.userAgent
        ) || (window.innerWidth <= 800 && window.innerHeight <= 600)
      )
    );
  }
  
  /**
   * Initialize the interaction manager
   * @param {HTMLElement} container - DOM container for the visualization
   * @param {THREE.WebGLRenderer} renderer - THREE.js renderer
   * @param {THREE.Camera} camera - THREE.js camera
   * @param {Object} visualizationManager - Visualization manager instance
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(container, renderer, camera, visualizationManager) {
    if (this.isInitialized) return true;
    
    try {
      this.container = container;
      this.renderer = renderer;
      this.camera = camera;
      this.visualizationManager = visualizationManager;
      
      // Get event bus
      this.eventBus = registry.getModule('utils.EventBus');
      
      // Create and configure raycaster
      this.raycaster = new THREE.Raycaster();
      this.raycaster.params.Line.threshold = 3;
      this.raycaster.params.Points.threshold = 5;
      
      // Create bound event handlers
      this.bindEventHandlers();
      
      // Attach event listeners
      this.attachEventListeners();
      
      // Update isMobile property based on current device
      this.isMobile = this.detectMobile();
      
      // Enable passive event listeners for touch events on mobile
      this.setupMobileOptimizations();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize InteractionManager:', error);
      return false;
    }
  }
  
  /**
   * Set up mobile-specific optimizations
   * @private
   */
  setupMobileOptimizations() {
    if (!this.isMobile || !this.settings.mobileOptimizationEnabled) return;
    
    if (this.eventBus) {
      this.eventBus.publish('visualization:optimizingForMobile');
    }
    
    // Simplify raycasting for mobile
    this.raycaster.params.Line.threshold = 10;
    this.raycaster.params.Points.threshold = 15;
    
    // Adjust settings for mobile
    this.settings.dragThreshold = 10;
    
    console.log('Mobile optimizations applied to InteractionManager');
  }
  
  /**
   * Create bound event handlers to use with event listeners
   * @private
   */
  bindEventHandlers() {
    // Mouse events
    this.boundEventHandlers.onMouseMove = this.onMouseMove.bind(this);
    this.boundEventHandlers.onMouseDown = this.onMouseDown.bind(this);
    this.boundEventHandlers.onMouseUp = this.onMouseUp.bind(this);
    this.boundEventHandlers.onClick = this.onClick.bind(this);
    this.boundEventHandlers.onDblClick = this.onDblClick.bind(this);
    this.boundEventHandlers.onContextMenu = this.onContextMenu.bind(this);
    this.boundEventHandlers.onWheel = this.onWheel.bind(this);
    
    // Touch events
    this.boundEventHandlers.onTouchStart = this.onTouchStart.bind(this);
    this.boundEventHandlers.onTouchMove = this.onTouchMove.bind(this);
    this.boundEventHandlers.onTouchEnd = this.onTouchEnd.bind(this);
    
    // Keyboard events
    this.boundEventHandlers.onKeyDown = this.onKeyDown.bind(this);
    this.boundEventHandlers.onKeyUp = this.onKeyUp.bind(this);
    
    // Window events
    this.boundEventHandlers.onBlur = this.onBlur.bind(this);
  }
  
  /**
   * Attach event listeners to DOM elements
   * @private
   */
  attachEventListeners() {
    if (!this.container) return;
    
    // Mouse events
    this.container.addEventListener('mousemove', this.boundEventHandlers.onMouseMove, false);
    this.container.addEventListener('mousedown', this.boundEventHandlers.onMouseDown, false);
    window.addEventListener('mouseup', this.boundEventHandlers.onMouseUp, false);
    this.container.addEventListener('click', this.boundEventHandlers.onClick, false);
    this.container.addEventListener('dblclick', this.boundEventHandlers.onDblClick, false);
    this.container.addEventListener('contextmenu', this.boundEventHandlers.onContextMenu, false);
    
    if (this.settings.enableMouseWheel) {
      this.container.addEventListener('wheel', this.boundEventHandlers.onWheel, { passive: false });
    }
    
    // Touch events - use passive for better performance except when preventDefault is needed
    if (this.settings.enableTouchInteraction) {
      this.container.addEventListener('touchstart', this.boundEventHandlers.onTouchStart, 
        { passive: this.isMobile && this.settings.mobileOptimizationEnabled });
      
      this.container.addEventListener('touchmove', this.boundEventHandlers.onTouchMove, 
        { passive: this.isMobile && this.settings.mobileOptimizationEnabled });
      
      this.container.addEventListener('touchend', this.boundEventHandlers.onTouchEnd, 
        { passive: true });
    }
    
    // Keyboard events
    if (this.settings.enableKeyboardShortcuts) {
      window.addEventListener('keydown', this.boundEventHandlers.onKeyDown, false);
      window.addEventListener('keyup', this.boundEventHandlers.onKeyUp, false);
    }
    
    // Window events
    window.addEventListener('blur', this.boundEventHandlers.onBlur, false);
  }
  
  /**
   * Detach event listeners from DOM elements
   * @private
   */
  detachEventListeners() {
    if (!this.container) return;
    
    // Mouse events
    this.container.removeEventListener('mousemove', this.boundEventHandlers.onMouseMove, false);
    this.container.removeEventListener('mousedown', this.boundEventHandlers.onMouseDown, false);
    window.removeEventListener('mouseup', this.boundEventHandlers.onMouseUp, false);
    this.container.removeEventListener('click', this.boundEventHandlers.onClick, false);
    this.container.removeEventListener('dblclick', this.boundEventHandlers.onDblClick, false);
    this.container.removeEventListener('contextmenu', this.boundEventHandlers.onContextMenu, false);
    
    if (this.settings.enableMouseWheel) {
      this.container.removeEventListener('wheel', this.boundEventHandlers.onWheel, { passive: false });
    }
    
    // Touch events
    if (this.settings.enableTouchInteraction) {
      this.container.removeEventListener('touchstart', this.boundEventHandlers.onTouchStart);
      this.container.removeEventListener('touchmove', this.boundEventHandlers.onTouchMove);
      this.container.removeEventListener('touchend', this.boundEventHandlers.onTouchEnd);
    }
    
    // Keyboard events
    if (this.settings.enableKeyboardShortcuts) {
      window.removeEventListener('keydown', this.boundEventHandlers.onKeyDown, false);
      window.removeEventListener('keyup', this.boundEventHandlers.onKeyUp, false);
    }
    
    // Window events
    window.removeEventListener('blur', this.boundEventHandlers.onBlur, false);
  }
  
  /**
   * Update mouse coordinates for raycasting
   * @param {number} x - Client X coordinate
   * @param {number} y - Client Y coordinate
   * @private
   */
  updateMouseCoordinates(x, y) {
    if (!this.container || !this.camera) return;
    
    const rect = this.container.getBoundingClientRect();
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    this.mouse.x = ((x - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((y - rect.top) / rect.height) * 2 + 1;
  }
  
  /**
   * Perform raycasting based on current mouse position
   * @returns {Array<Object>} Array of intersected objects
   * @private
   */
  performRaycast() {
    if (!this.camera || !this.visualizationManager) return [];
    
    // Update the raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get scene objects to test against
    let objects;
    const nodeRenderer = registry.getModule('visualization.NodeRenderer');
    const linkRenderer = registry.getModule('visualization.LinkRenderer');
    
    if (this.settings.raycastObjects === 'visible') {
      // Only raycast visible objects
      objects = [];
      
      if (nodeRenderer && nodeRenderer.getVisibleObjects) {
        objects.push(...nodeRenderer.getVisibleObjects());
      }
      
      if (linkRenderer && linkRenderer.getVisibleObjects) {
        objects.push(...linkRenderer.getVisibleObjects());
      }
    } else {
      // Raycast all objects
      const scene = this.visualizationManager.sceneManager?.getScene();
      objects = scene ? scene.children : [];
    }
    
    // Perform raycasting
    return this.raycaster.intersectObjects(objects, true);
  }
  
  /**
   * Find the closest intersected node
   * @param {Array<Object>} intersects - Array of intersected objects
   * @returns {Object|null} Closest node object or null if none found
   * @private
   */
  findClosestNode(intersects) {
    if (!intersects || intersects.length === 0) return null;
    
    // Look for the first object that has a node ID
    for (const intersect of intersects) {
      const nodeId = this.getNodeIdFromObject(intersect.object);
      if (nodeId) {
        return {
          nodeId,
          object: intersect.object,
          distance: intersect.distance,
          point: intersect.point
        };
      }
    }
    
    return null;
  }
  
  /**
   * Get node ID from a THREE.js object
   * @param {THREE.Object3D} object - THREE.js object
   * @returns {string|null} Node ID or null if not found
   * @private
   */
  getNodeIdFromObject(object) {
    if (!object) return null;
    
    // Try to get node ID from the object or its parent
    if (object.userData && object.userData.nodeId) {
      return object.userData.nodeId;
    }
    
    // Check parent if it exists
    if (object.parent && object.parent.userData && object.parent.userData.nodeId) {
      return object.parent.userData.nodeId;
    }
    
    return null;
  }
  
  /**
   * Handle mouse move event
   * @param {MouseEvent} event - Mouse event
   * @private
   */
  onMouseMove(event) {
    if (!this.isEnabled || this.isTouching) return;
    
    // Update mouse coordinates
    this.updateMouseCoordinates(event.clientX, event.clientY);
    
    // Handle dragging
    if (this.isDragging) {
      // Calculate drag delta
      const deltaX = event.clientX - this.prevMousePosition.x;
      const deltaY = event.clientY - this.prevMousePosition.y;
      
      // Update previous position
      this.prevMousePosition.x = event.clientX;
      this.prevMousePosition.y = event.clientY;
      
      // Handle node dragging
      if (this.selectedObject && this.settings.enableDragInteraction) {
        this.handleNodeDrag(deltaX, deltaY);
      }
      
      // Trigger drag event
      this.triggerEvent('drag', {
        deltaX,
        deltaY,
        nodeId: this.selectedObject ? this.selectedObject.nodeId : null,
        originalEvent: event
      });
      
      return;
    }
    
    // Handle hover if not dragging
    if (this.settings.hoverToHighlight) {
      this.handleHover();
    }
  }
  
  /**
   * Handle hover interaction
   * @private
   */
  handleHover() {
    // Skip if currently dragging or touching
    if (this.isDragging || this.isTouching) return;
    
    // Perform raycast
    const intersects = this.performRaycast();
    const closestNode = this.findClosestNode(intersects);
    
    // If hovering over a different node, update hover state
    if (
      (!closestNode && this.hoveredObject) ||
      (closestNode && (!this.hoveredObject || this.hoveredObject.nodeId !== closestNode.nodeId))
    ) {
      // Clear previous hover
      if (this.hoveredObject) {
        this.triggerEvent('nodeHover', { nodeId: null });
      }
      
      // Set new hover
      this.hoveredObject = closestNode;
      
      if (closestNode) {
        this.triggerEvent('nodeHover', { nodeId: closestNode.nodeId });
      }
    }
  }
  
  /**
   * Handle node drag interaction
   * @param {number} deltaX - X movement
   * @param {number} deltaY - Y movement
   * @private
   */
  handleNodeDrag(deltaX, deltaY) {
    if (!this.selectedObject || !this.selectedObject.object) return;
    
    // Get camera controller for converting screen to world coordinates
    const cameraController = registry.getModule('visualization.CameraController');
    
    // Convert screen delta to world delta
    let worldDelta;
    
    if (cameraController && cameraController.screenToWorldDelta) {
      // Use camera controller for accurate conversion
      worldDelta = cameraController.screenToWorldDelta(deltaX, deltaY);
    } else {
      // Fallback to simple conversion
      worldDelta = this.simpleScreenToWorldDelta(deltaX, deltaY);
    }
    
    // Trigger node drag event
    this.triggerEvent('nodeDrag', {
      nodeId: this.selectedObject.nodeId,
      deltaX: worldDelta.x,
      deltaY: worldDelta.y,
      deltaZ: worldDelta.z
    });
  }
  
  /**
   * Simple conversion from screen to world delta without camera controller
   * @param {number} deltaX - Screen X delta
   * @param {number} deltaY - Screen Y delta
   * @returns {THREE.Vector3} World space delta
   * @private
   */
  simpleScreenToWorldDelta(deltaX, deltaY) {
    if (!this.camera || !this.container) {
      return new THREE.Vector3();
    }
    
    // Get container dimensions
    const rect = this.container.getBoundingClientRect();
    const aspectRatio = rect.width / rect.height;
    
    // Calculate size of world space at the object's distance
    const objectDistance = this.camera.position.distanceTo(
      this.visualizationManager.sceneManager.controls?.target || new THREE.Vector3()
    );
    
    // Basic tangent calculation to approximate world space size
    // For a perspective camera, world space size is proportional to distance
    const fovRadians = (this.camera.fov * Math.PI) / 180;
    const worldHeight = 2 * Math.tan(fovRadians / 2) * objectDistance;
    const worldWidth = worldHeight * aspectRatio;
    
    // Convert screen deltas to world deltas
    // The negative on deltaY accounts for the screen Y being inverse to world Y
    const worldDeltaX = (deltaX / rect.width) * worldWidth;
    const worldDeltaY = (-deltaY / rect.height) * worldHeight;
    
    // Create delta in camera's local space
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Combine right and up vectors scaled by deltas
    return new THREE.Vector3()
      .addScaledVector(cameraRight, worldDeltaX)
      .addScaledVector(cameraUp, worldDeltaY);
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   * @private
   */
  onTouchStart(event) {
    if (!this.isEnabled) return;
    
    // Mark as touching to avoid mouse event conflicts
    this.isTouching = true;
    
    // Store touch start time for distinguishing taps
    this.clickStartTime = Date.now();
    
    // Clear any existing timeouts
    this.clearTouchTimeouts();
    
    // Get touch positions
    const touches = event.touches;
    this.touchStartPositions = [];
    
    for (let i = 0; i < touches.length; i++) {
      this.touchStartPositions.push({
        x: touches[i].clientX,
        y: touches[i].clientY,
        id: touches[i].identifier
      });
    }
    
    // Handle single touch (tap/selection)
    if (touches.length === 1) {
      const touch = touches[0];
      
      // Update mouse position for raycasting
      this.updateMouseCoordinates(touch.clientX, touch.clientY);
      
      // Remember start position for drag detection
      this.dragStartPosition.x = touch.clientX;
      this.dragStartPosition.y = touch.clientY;
      
      // Set up long press timeout (equivalent to right-click)
      this.longPressTimeout = setTimeout(() => {
        // If still touching at same position, trigger long press
        if (this.isTouching && 
            Math.abs(touch.clientX - this.dragStartPosition.x) < this.settings.dragThreshold && 
            Math.abs(touch.clientY - this.dragStartPosition.y) < this.settings.dragThreshold) {
          
          // Perform raycast to find object under touch
          const intersects = this.performRaycast();
          const closestNode = this.findClosestNode(intersects);
          
          if (closestNode) {
            // Trigger node context menu event (like right-click)
            this.triggerEvent('nodeContextMenu', {
              nodeId: closestNode.nodeId,
              position: {
                x: touch.clientX,
                y: touch.clientY
              }
            });
          } else {
            // Trigger background context menu
            this.triggerEvent('backgroundContextMenu', {
              position: {
                x: touch.clientX,
                y: touch.clientY
              }
            });
          }
        }
      }, this.settings.touchHoldDuration);
      
      // Perform raycast to find object under touch
      const intersects = this.performRaycast();
      const closestNode = this.findClosestNode(intersects);
      
      // Store selected object
      this.selectedObject = closestNode;
      
      // Prevent default browser behavior
      if (!this.isMobile || !this.settings.mobileOptimizationEnabled) {
        event.preventDefault();
      }
    }
    // Handle two-finger touch (pinch-zoom, rotation)
    else if (touches.length === 2) {
      // Calculate initial pinch distance and angle
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      this.lastTouchRotation = Math.atan2(dy, dx);
      
      this.lastTouchCenter.x = (touches[0].clientX + touches[1].clientX) / 2;
      this.lastTouchCenter.y = (touches[0].clientY + touches[1].clientY) / 2;
      
      // Prevent default to avoid browser zoom/scroll
      event.preventDefault();
    }
    
    // Trigger touch start event
    this.triggerEvent('touchStart', {
      touches: this.touchStartPositions,
      originalEvent: event
    });
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - Touch event
   * @private
   */
  onTouchMove(event) {
    if (!this.isEnabled || !this.isTouching) return;
    
    // Throttle touch move events on mobile for better performance
    const now = Date.now();
    if (this.isMobile && 
        this.settings.mobileOptimizationEnabled && 
        now - this.lastTouchMoveTime < this.settings.touchResponseThreshold) {
      return;
    }
    this.lastTouchMoveTime = now;
    
    const touches = event.touches;
    
    // Handle single touch (drag)
    if (touches.length === 1) {
      const touch = touches[0];
      
      // Update mouse position for potential hover effects
      this.updateMouseCoordinates(touch.clientX, touch.clientY);
      
      // Calculate drag threshold
      const dragDistance = Math.sqrt(
        Math.pow(touch.clientX - this.dragStartPosition.x, 2) +
        Math.pow(touch.clientY - this.dragStartPosition.y, 2)
      );
      
      // Clear long press timeout if moved beyond threshold
      if (dragDistance > this.settings.dragThreshold && this.longPressTimeout) {
        clearTimeout(this.longPressTimeout);
        this.longPressTimeout = null;
      }
      
      // Check if drag threshold exceeded
      if (dragDistance > this.settings.dragThreshold) {
        // Calculate drag delta
        const deltaX = touch.clientX - this.prevMousePosition.x;
        const deltaY = touch.clientY - this.prevMousePosition.y;
        
        // Update previous position
        this.prevMousePosition.x = touch.clientX;
        this.prevMousePosition.y = touch.clientY;
        
        // Handle node dragging if we have a selected object
        if (this.selectedObject && this.settings.enableDragInteraction) {
          this.handleNodeDrag(deltaX, deltaY);
        }
        
        // Trigger drag event
        this.triggerEvent('drag', {
          deltaX,
          deltaY,
          nodeId: this.selectedObject ? this.selectedObject.nodeId : null,
          originalEvent: event,
          isTouch: true
        });
      } else if (!this.isDragging) {
        // First move, initialize drag
        this.isDragging = true;
        this.prevMousePosition.x = touch.clientX;
        this.prevMousePosition.y = touch.clientY;
      }
      
      if (!this.isMobile || !this.settings.mobileOptimizationEnabled) {
        event.preventDefault();
      }
    }
    // Handle pinch (zoom) and rotation with two fingers
    else if (touches.length === 2) {
      this.handlePinchMove(event);
      event.preventDefault();
    }
    
    // Trigger touch move event
    this.triggerEvent('touchMove', {
      touches: Array.from(touches).map(t => ({
        x: t.clientX,
        y: t.clientY,
        id: t.identifier
      })),
      originalEvent: event
    });
  }
  
  /**
   * Handle pinch and rotation with two fingers
   * @param {TouchEvent} event - Touch event
   * @private
   */
  handlePinchMove(event) {
    const touches = event.touches;
    
    // Calculate current pinch distance and angle
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    
    const currentTouchDistance = Math.sqrt(dx * dx + dy * dy);
    const currentTouchRotation = Math.atan2(dy, dx);
    
    // Calculate center of the two touches
    const centerX = (touches[0].clientX + touches[1].clientX) / 2;
    const centerY = (touches[0].clientY + touches[1].clientY) / 2;
    
    // Calculate zoom delta
    const zoomDelta = (currentTouchDistance / this.lastTouchDistance - 1) * 
      this.settings.pinchSensitivity * 10;
    
    // Calculate rotation delta (in radians)
    const rotationDelta = (currentTouchRotation - this.lastTouchRotation) * 
      this.settings.touchRotationSensitivity;
    
    // Calculate pan delta (movement of the center point)
    const panDeltaX = centerX - this.lastTouchCenter.x;
    const panDeltaY = centerY - this.lastTouchCenter.y;
    
    // Update stored values
    this.lastTouchDistance = currentTouchDistance;
    this.lastTouchRotation = currentTouchRotation;
    this.lastTouchCenter.x = centerX;
    this.lastTouchCenter.y = centerY;
    
    // Get camera controller and orbit controls
    const cameraController = registry.getModule('visualization.CameraController');
    
    if (cameraController && cameraController.controls) {
      const controls = cameraController.controls;
      
      // Apply zoom
      if (Math.abs(zoomDelta) > 0.01) {
        if (controls.enableZoom) {
          controls.dollyIn(1 - zoomDelta);
          controls.update();
        }
        
        // Trigger zoom event
        this.triggerEvent('zoom', {
          delta: zoomDelta,
          center: { x: centerX, y: centerY },
          isTouch: true
        });
      }
      
      // Apply rotation if significant
      if (Math.abs(rotationDelta) > 0.01 && controls.enableRotate) {
        // Rotate around the center of the scene, not the center of the touch
        controls.rotateLeft(rotationDelta);
        controls.update();
        
        // Trigger rotate event
        this.triggerEvent('rotate', {
          delta: rotationDelta,
          isTouch: true
        });
      }
      
      // Apply pan if significant
      if ((Math.abs(panDeltaX) > 2 || Math.abs(panDeltaY) > 2) && controls.enablePan) {
        controls.panLeft(-panDeltaX * 0.002 * controls.panSpeed);
        controls.panUp(-panDeltaY * 0.002 * controls.panSpeed);
        controls.update();
        
        // Trigger pan event
        this.triggerEvent('pan', {
          deltaX: panDeltaX,
          deltaY: panDeltaY,
          isTouch: true
        });
      }
    }
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - Touch event
   * @private
   */
  onTouchEnd(event) {
    if (!this.isEnabled) return;
    
    // Calculate touch duration
    const touchDuration = Date.now() - this.clickStartTime;
    
    // Store remaining touches
    const remainingTouches = event.touches.length;
    
    // If all touches are gone, reset touch state
    if (remainingTouches === 0) {
      // Clean up timeouts
      this.clearTouchTimeouts();
      
      // If touch was short and did not move much, consider it a tap
      if (touchDuration < this.settings.clickMaxDuration && 
          !this.isDragging && 
          this.selectedObject) {
        
        // Double tap detection
        if (this.doubleTapDetection) {
          clearTimeout(this.doubleTapDetection);
          this.doubleTapDetection = null;
          
          if (this.settings.doubleClickToExpand) {
            // Trigger node double tap (equivalent to double click)
            this.triggerEvent('nodeDoubleClick', {
              nodeId: this.selectedObject.nodeId
            });
          }
        } else {
          // Set up double tap detection
          this.doubleTapDetection = setTimeout(() => {
            this.doubleTapDetection = null;
            
            // After timeout, consider it a single tap
            if (this.settings.clickToSelect) {
              this.triggerEvent('nodeClick', {
                nodeId: this.selectedObject.nodeId
              });
            }
          }, this.settings.doubleTapTimeout);
        }
      }
      
      // Reset touch and drag state
      this.isTouching = false;
      this.isDragging = false;
      
      // Trigger touch end event
      this.triggerEvent('touchEnd', {
        remainingTouches,
        originalEvent: event
      });
    }
  }
  
  /**
   * Clear any active touch-related timeouts
   * @private
   */
  clearTouchTimeouts() {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
    
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }
  }
  
  /**
   * Trigger an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   * @private
   */
  triggerEvent(event, data) {
    try {
      // Local event emitting
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in listener for ${event}:`, error);
          }
        });
      }
      
      // Also notify visualization manager
      if (this.visualizationManager) {
        if (typeof this.visualizationManager[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`] === 'function') {
          this.visualizationManager[`handle${event.charAt(0).toUpperCase() + event.slice(1)}`](data);
        }
      }
      
      // Also publish to event bus
      if (this.eventBus) {
        this.eventBus.publish(`interaction:${event}`, data);
      }
    } catch (error) {
      console.error(`Error triggering event ${event}:`, error);
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
   * Dispose of the interaction manager and release resources
   */
  dispose() {
    // Detach event listeners
    this.detachEventListeners();
    
    // Clear timeouts
    this.clearTouchTimeouts();
    if (this.doubleclickTimeout) {
      clearTimeout(this.doubleclickTimeout);
      this.doubleclickTimeout = null;
    }
    if (this.doubleTapDetection) {
      clearTimeout(this.doubleTapDetection);
      this.doubleTapDetection = null;
    }
    
    // Release references
    this.container = null;
    this.camera = null;
    this.renderer = null;
    this.visualizationManager = null;
    this.selectedObject = null;
    this.hoveredObject = null;
    
    // Clean up state
    this.isInitialized = false;
    this.isDragging = false;
    this.isTouching = false;
    
    // Trigger disposed event
    if (this.eventBus) {
      this.eventBus.publish('interaction:disposed');
    }
  }
  
  /**
   * Update interaction settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    // Re-setup mobile optimizations if needed
    if (this.isMobile && this.settings.mobileOptimizationEnabled) {
      this.setupMobileOptimizations();
    }
  }
}

export default registry.register(
  'visualization.InteractionManager',
  new InteractionManager(),
  ['visualization.SceneManager', 'utils.EventBus'],
  {
    description: 'Manages user interactions with the visualization',
    singleton: true
  }
);