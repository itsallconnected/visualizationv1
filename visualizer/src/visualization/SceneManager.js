/**
 * SceneManager handles the THREE.js setup, scene creation, rendering pipeline,
 * and animation loop for the visualization.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

class SceneManager {
  constructor() {
    // THREE.js objects
    this.scene = null;
    this.renderer = null;
    this.camera = null;
    this.composer = null;
    this.outlinePass = null;
    
    // DOM elements
    this.container = null;
    
    // State
    this.isInitialized = false;
    this.isRunning = false;
    this.frameId = null;
    this.lastTime = 0;
    this.updateCallback = null;
    
    // Resize handler with debounce
    this.resizeTimeout = null;
    this.boundHandleResize = this.handleResize.bind(this);
    
    // Scene settings
    this.settings = {
      backgroundColor: 0x121212,
      fogColor: 0x121212,
      fogNear: 50,
      fogFar: 500,
      ambientLightColor: 0xffffff,
      ambientLightIntensity: 0.5,
      directionalLightColor: 0xffffff,
      directionalLightIntensity: 0.8,
      outlineColor: 0xffffff,
      selectedOutlineColor: 0x00ff00,
      hoveredOutlineColor: 0xffff00,
      antialias: true,
      shadows: false,
      pixelRatio: window.devicePixelRatio || 1,
      resizeDebounceTime: 100
    };
    
    // Event listeners
    this.listeners = {};
    
    // Stats for performance monitoring
    this.stats = null;
  }
  
  /**
   * Initialize the scene manager
   * @param {HTMLElement} container - DOM container for the renderer
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(container) {
    if (this.isInitialized) return true;
    
    try {
      this.container = container;
      
      // Create scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(this.settings.backgroundColor);
      this.scene.fog = new THREE.Fog(this.settings.fogColor, this.settings.fogNear, this.settings.fogFar);
      
      // Create camera
      const { clientWidth, clientHeight } = container;
      const aspect = clientWidth / clientHeight;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      this.camera.position.set(0, 0, 100);
      this.camera.lookAt(0, 0, 0);
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({
        antialias: this.settings.antialias,
        alpha: true,
        preserveDrawingBuffer: true
      });
      this.renderer.setSize(clientWidth, clientHeight);
      this.renderer.setPixelRatio(this.settings.pixelRatio);
      this.renderer.shadowMap.enabled = this.settings.shadows;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.setClearColor(this.settings.backgroundColor, 1);
      
      // Add renderer to DOM
      container.appendChild(this.renderer.domElement);
      
      // Add lighting
      const ambientLight = new THREE.AmbientLight(
        this.settings.ambientLightColor,
        this.settings.ambientLightIntensity
      );
      this.scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(
        this.settings.directionalLightColor,
        this.settings.directionalLightIntensity
      );
      directionalLight.position.set(1, 1, 1);
      if (this.settings.shadows) {
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.bias = -0.0001;
      }
      this.scene.add(directionalLight);
      
      // Set up post-processing
      this.setupPostProcessing();
      
      // Initialize performance stats if in development mode
      if (process.env.NODE_ENV === 'development') {
        this.initStats();
      }
      
      // Add window resize listener
      window.addEventListener('resize', this.boundHandleResize);
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize SceneManager:', error);
      return false;
    }
  }
  
  /**
   * Set up post-processing effects
   * @private
   */
  setupPostProcessing() {
    try {
      // Create effect composer
      this.composer = new EffectComposer(this.renderer);
      
      // Add render pass
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);
      
      // Add outline pass for selection/hover highlighting
      const { clientWidth, clientHeight } = this.container;
      this.outlinePass = new OutlinePass(
        new THREE.Vector2(clientWidth, clientHeight),
        this.scene,
        this.camera
      );
      this.outlinePass.visibleEdgeColor.set(this.settings.outlineColor);
      this.outlinePass.hiddenEdgeColor.set(this.settings.outlineColor);
      this.outlinePass.edgeStrength = 3.0;
      this.outlinePass.edgeGlow = 0.5;
      this.outlinePass.edgeThickness = 1.0;
      this.outlinePass.pulsePeriod = 0;
      this.composer.addPass(this.outlinePass);
      
      // Add anti-aliasing pass
      const fxaaPass = new ShaderPass(FXAAShader);
      fxaaPass.material.uniforms['resolution'].value.set(
        1 / (clientWidth * this.settings.pixelRatio),
        1 / (clientHeight * this.settings.pixelRatio)
      );
      this.composer.addPass(fxaaPass);
    } catch (error) {
      console.error('Failed to set up post-processing:', error);
      // Continue without post-processing
      this.composer = null;
      this.outlinePass = null;
    }
  }
  
  /**
   * Initialize performance stats
   * @private
   */
  async initStats() {
    try {
      // Dynamically import Stats.js for development only
      const { default: Stats } = await import('stats.js');
      this.stats = new Stats();
      this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
      this.stats.dom.style.position = 'absolute';
      this.stats.dom.style.top = '0px';
      this.stats.dom.style.zIndex = '100';
      this.container.appendChild(this.stats.dom);
    } catch (error) {
      console.warn('Stats.js could not be loaded for performance monitoring', error);
    }
  }
  
  /**
   * Handle window resize event with debouncing
   * @private
   */
  handleResize() {
    if (!this.container || !this.isInitialized) return;
    
    // Clear previous timeout
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    
    // Set new timeout to debounce resize events
    this.resizeTimeout = setTimeout(() => {
      const { clientWidth, clientHeight } = this.container;
      this.resize(clientWidth, clientHeight);
      this.resizeTimeout = null;
    }, this.settings.resizeDebounceTime);
  }
  
  /**
   * Resize the renderer and update camera aspect ratio
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    if (!this.isInitialized) return;
    
    try {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      this.renderer.setSize(width, height);
      
      if (this.composer) {
        this.composer.setSize(width, height);
        
        // Update FXAA pass resolution if it exists
        const fxaaPass = this.composer.passes.find(pass => 
          pass.material && 
          pass.material.uniforms && 
          pass.material.uniforms.resolution
        );
        
        if (fxaaPass) {
          fxaaPass.material.uniforms.resolution.value.set(
            1 / (width * this.settings.pixelRatio),
            1 / (height * this.settings.pixelRatio)
          );
        }
        
        // Update outline pass resolution
        if (this.outlinePass) {
          this.outlinePass.resolution.set(width, height);
        }
      }
      
      // Trigger resize event
      this.triggerEvent('resize', { width, height });
    } catch (error) {
      console.error('Error during resize:', error);
    }
  }
  
  /**
   * Start the render loop
   * @param {Function} updateCallback - Callback to run each frame
   */
  startRenderLoop(updateCallback) {
    if (this.isRunning) return;
    
    this.updateCallback = updateCallback;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    // Start animation loop
    this.renderFrame();
    
    // Trigger start event
    this.triggerEvent('start', null);
  }
  
  /**
   * Stop the render loop
   */
  stopRenderLoop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    
    // Trigger stop event
    this.triggerEvent('stop', null);
  }
  
  /**
   * Render a single frame
   * @private
   */
  renderFrame() {
    if (!this.isRunning) return;
    
    // Start performance measurement
    if (this.stats) this.stats.begin();
    
    // Calculate delta time
    const now = performance.now();
    const delta = (now - this.lastTime) / 1000; // in seconds
    this.lastTime = now;
    
    // Execute update callback
    if (this.updateCallback) {
      this.updateCallback(now, delta);
    }
    
    // Render the scene
    try {
      if (this.composer && this.composer.renderer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    } catch (error) {
      console.error('Render error:', error);
      // Attempt recovery
      this.handleRenderError(error);
    }
    
    // End performance measurement
    if (this.stats) this.stats.end();
    
    // Request next frame
    this.frameId = requestAnimationFrame(() => this.renderFrame());
    
    // Trigger render event
    this.triggerEvent('render', { timestamp: now, delta });
  }
  
  /**
   * Handle rendering errors by falling back to simpler rendering
   * @param {Error} error - The error that occurred
   * @private
   */
  handleRenderError(error) {
    console.warn('Trying to recover from render error');
    
    // Try to fall back to simple rendering if composer fails
    if (this.composer && this.renderer) {
      try {
        // Disable post-processing and use direct rendering
        this.composer = null;
        this.renderer.render(this.scene, this.camera);
        console.log('Recovered using direct rendering');
      } catch (fallbackError) {
        console.error('Failed to recover from render error:', fallbackError);
        // If still fails, stop the render loop to prevent further errors
        this.stopRenderLoop();
      }
    }
  }
  
  /**
   * Set objects to be highlighted with the outline effect
   * @param {Array<THREE.Object3D>} objects - Objects to highlight
   * @param {number} [color] - Outline color (defaults to settings.outlineColor)
   */
  setOutlinedObjects(objects, color) {
    if (!this.outlinePass) return;
    
    this.outlinePass.selectedObjects = objects || [];
    
    if (color !== undefined) {
      this.outlinePass.visibleEdgeColor.set(color);
      this.outlinePass.hiddenEdgeColor.set(color);
    } else {
      this.outlinePass.visibleEdgeColor.set(this.settings.outlineColor);
      this.outlinePass.hiddenEdgeColor.set(this.settings.outlineColor);
    }
  }
  
  /**
   * Set the selected objects with specific highlight color
   * @param {Array<THREE.Object3D>} objects - Selected objects
   */
  setSelectedObjects(objects) {
    this.setOutlinedObjects(objects, this.settings.selectedOutlineColor);
  }
  
  /**
   * Set the hovered objects with specific highlight color
   * @param {Array<THREE.Object3D>} objects - Hovered objects
   */
  setHoveredObjects(objects) {
    this.setOutlinedObjects(objects, this.settings.hoveredOutlineColor);
  }
  
  /**
   * Clear the scene of all objects except camera and lights
   * Properly disposes of geometries and materials to prevent memory leaks
   */
  clearScene() {
    if (!this.scene) return;
    
    // Keep track of what needs to be kept
    const keepObjects = new Set();
    
    // Keep camera
    if (this.camera) {
      keepObjects.add(this.camera);
    }
    
    // Keep lights
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Light) {
        keepObjects.add(child);
      }
    });
    
    // Dispose of all other objects
    this.scene.traverse((object) => {
      // Skip objects that should be kept
      if (keepObjects.has(object)) {
        return;
      }
      
      // Dispose of geometries
      if (object.geometry) {
        object.geometry.dispose();
      }
      
      // Dispose of materials
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => this.disposeMaterial(material));
        } else {
          this.disposeMaterial(object.material);
        }
      }
    });
    
    // Remove all objects except those in keepObjects
    while (this.scene.children.length > 0) {
      const child = this.scene.children[0];
      if (keepObjects.has(child)) {
        this.scene.children.splice(0, 1);
        continue;
      }
      this.scene.remove(child);
    }
    
    // Add back the objects we want to keep
    keepObjects.forEach(object => {
      if (!this.scene.children.includes(object)) {
        this.scene.add(object);
      }
    });
  }
  
  /**
   * Dispose of a material and its textures
   * @param {THREE.Material} material - Material to dispose
   * @private
   */
  disposeMaterial(material) {
    if (!material) return;
    
    // Dispose of any textures
    Object.keys(material).forEach(prop => {
      if (!material[prop]) return;
      if (material[prop].isTexture) {
        material[prop].dispose();
      }
    });
    
    // Dispose of material itself
    material.dispose();
  }
  
  /**
   * Dispose of scene manager and clean up resources
   */
  dispose() {
    // Stop render loop
    this.stopRenderLoop();
    
    // Remove event listeners
    window.removeEventListener('resize', this.boundHandleResize);
    
    // Remove stats
    if (this.stats && this.stats.dom.parentNode) {
      this.stats.dom.parentNode.removeChild(this.stats.dom);
    }
    
    // Clear the scene
    this.clearScene();
    
    // Dispose of the renderer
    if (this.renderer) {
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
    
    // Dispose of composer and passes
    if (this.composer) {
      this.composer.passes.forEach(pass => {
        if (pass.dispose) pass.dispose();
      });
    }
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.outlinePass = null;
    this.isInitialized = false;
    
    // Publish event about disposal
    const eventBus = registry.getModule('utils.EventBus');
    if (eventBus) {
      eventBus.publish('visualization:sceneManagerDisposed');
    }
  }
  
  /**
   * Get the scene object
   * @returns {THREE.Scene} THREE.js scene
   */
  getScene() {
    return this.scene;
  }
  
  /**
   * Get the camera object
   * @returns {THREE.Camera} THREE.js camera
   */
  getCamera() {
    return this.camera;
  }
  
  /**
   * Get the renderer object
   * @returns {THREE.WebGLRenderer} THREE.js renderer
   */
  getRenderer() {
    return this.renderer;
  }
  
  /**
   * Update scene settings
   * @param {Object} newSettings - New settings to apply
   */
  updateSettings(newSettings) {
    this.settings = {
      ...this.settings,
      ...newSettings
    };
    
    // Apply new settings to scene
    if (this.scene) {
      this.scene.background = new THREE.Color(this.settings.backgroundColor);
      this.scene.fog = new THREE.Fog(this.settings.fogColor, this.settings.fogNear, this.settings.fogFar);
    }
    
    // Apply new settings to renderer
    if (this.renderer) {
      this.renderer.setClearColor(this.settings.backgroundColor, 1);
      this.renderer.shadowMap.enabled = this.settings.shadows;
    }
  }
  
  /**
   * Add an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
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
   * @param {Function} callback - Event callback
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
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }
}

export default registry.register(
  'visualization.SceneManager',
  new SceneManager(),
  [],
  {
    description: 'Manages the THREE.js scene, renderer, and animation loop',
    singleton: true
  }
);
