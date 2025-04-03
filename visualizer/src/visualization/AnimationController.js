import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Manages animations and transitions throughout the visualization
 * Provides a central system for coordinating animations using TWEEN.js
 */
class AnimationController {
  constructor() {
    this.animations = new Map();
    this.initialized = false;
    this.isAnimating = false;
    this.requestId = null;
    this.defaultEasing = TWEEN.Easing.Quadratic.InOut;
    this.defaultDuration = 800;
    this.presets = this._createPresets();
    this.animationGroups = new Map();
    this.performanceMode = 'balanced'; // 'high-performance', 'balanced', 'high-quality'
  }

  /**
   * Create animation presets for common scenarios
   * @private
   * @returns {Object} Animation presets
   */
  _createPresets() {
    return {
      fadeIn: {
        duration: 800,
        easing: TWEEN.Easing.Quadratic.InOut,
        from: { opacity: 0 },
        to: { opacity: 1 }
      },
      fadeOut: {
        duration: 800,
        easing: TWEEN.Easing.Quadratic.InOut,
        from: { opacity: 1 },
        to: { opacity: 0 }
      },
      zoomIn: {
        duration: 1000,
        easing: TWEEN.Easing.Cubic.Out,
        from: { scale: { x: 0.5, y: 0.5, z: 0.5 } },
        to: { scale: { x: 1, y: 1, z: 1 } }
      },
      zoomOut: {
        duration: 1000,
        easing: TWEEN.Easing.Cubic.In,
        from: { scale: { x: 1, y: 1, z: 1 } },
        to: { scale: { x: 0.5, y: 0.5, z: 0.5 } }
      },
      pulse: {
        duration: 600,
        easing: TWEEN.Easing.Quadratic.InOut,
        from: { scale: { x: 1, y: 1, z: 1 } },
        to: { scale: { x: 1.1, y: 1.1, z: 1.1 } },
        yoyo: true,
        repeat: 1
      },
      shake: {
        duration: 100,
        easing: TWEEN.Easing.Quadratic.InOut,
        steps: [
          { position: { x: 0, y: 0, z: 0 } },
          { position: { x: -5, y: 0, z: 0 } },
          { position: { x: 5, y: 0, z: 0 } },
          { position: { x: -5, y: 0, z: 0 } },
          { position: { x: 5, y: 0, z: 0 } },
          { position: { x: -5, y: 0, z: 0 } },
          { position: { x: 0, y: 0, z: 0 } }
        ]
      },
      bounce: {
        duration: 1000,
        easing: TWEEN.Easing.Bounce.Out,
        from: { position: { y: 50 } },
        to: { position: { y: 0 } }
      },
      highlight: {
        duration: 500,
        easing: TWEEN.Easing.Cubic.Out,
        from: { color: { r: 1, g: 1, b: 1 } },
        to: { color: { r: 1, g: 0.8, b: 0.2 } },
        yoyo: true,
        repeat: 1
      },
      elastic: {
        duration: 1200,
        easing: TWEEN.Easing.Elastic.Out,
        from: { scale: { x: 0.8, y: 0.8, z: 0.8 } },
        to: { scale: { x: 1, y: 1, z: 1 } }
      },
      elasticBounce: {
        duration: 1400,
        easing: TWEEN.Easing.Elastic.InOut,
        from: { position: { y: 30 }, scale: { x: 0.9, y: 1.1, z: 0.9 } },
        to: { position: { y: 0 }, scale: { x: 1, y: 1, z: 1 } }
      },
      swirl: {
        duration: 1000,
        easing: TWEEN.Easing.Sinusoidal.InOut,
        steps: [
          { rotation: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 } },
          { rotation: { x: 0, y: Math.PI / 4, z: 0 }, position: { x: 10, y: 10, z: 0 } },
          { rotation: { x: 0, y: Math.PI / 2, z: 0 }, position: { x: 0, y: 20, z: 0 } },
          { rotation: { x: 0, y: 3 * Math.PI / 4, z: 0 }, position: { x: -10, y: 10, z: 0 } },
          { rotation: { x: 0, y: Math.PI, z: 0 }, position: { x: 0, y: 0, z: 0 } }
        ]
      },
      splash: {
        duration: 800,
        easing: TWEEN.Easing.Circular.Out,
        from: { scale: { x: 0.1, y: 0.1, z: 0.1 }, opacity: 0 },
        to: { scale: { x: 1.2, y: 1.2, z: 1.2 }, opacity: 1 },
        yoyo: true,
        repeat: 1,
        repeatDelay: 100
      },
      floatingPulse: {
        duration: 2000,
        easing: TWEEN.Easing.Sinusoidal.InOut,
        from: { position: { y: 0 }, scale: { x: 1, y: 1, z: 1 } },
        to: { position: { y: 10 }, scale: { x: 1.05, y: 1.05, z: 1.05 } },
        yoyo: true,
        repeat: Infinity
      },
      glitch: {
        duration: 1000,
        easing: TWEEN.Easing.Linear.None,
        steps: [
          { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, opacity: 1 },
          { position: { x: 3, y: -2, z: 0 }, scale: { x: 1.03, y: 0.97, z: 1 }, opacity: 0.8 },
          { position: { x: -5, y: 1, z: 0 }, scale: { x: 0.98, y: 1.02, z: 1 }, opacity: 0.9 },
          { position: { x: 2, y: 3, z: 0 }, scale: { x: 1.01, y: 0.99, z: 1 }, opacity: 0.7 },
          { position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, opacity: 1 }
        ],
        repeatDelay: 3000,
        repeat: 1
      },
      fluidReveal: {
        duration: 1200,
        easing: (k) => {
          // Custom fluid-like easing
          return Math.pow(Math.sin(k * Math.PI / 2), 3);
        },
        from: { 
          opacity: 0,
          scale: { x: 0.7, y: 0.7, z: 0.7 },
          rotation: { x: -Math.PI / 8, y: Math.PI / 4, z: 0 }
        },
        to: { 
          opacity: 1,
          scale: { x: 1, y: 1, z: 1 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      },
      shockwave: {
        duration: 1000,
        easing: TWEEN.Easing.Exponential.Out,
        from: { 
          shockwave: 0,
          opacity: 0.7
        },
        to: { 
          shockwave: 1,
          opacity: 0
        },
        onUpdate: function(obj) {
          // This would be used with a ShockwavePass effect in postprocessing
          if (obj.target && obj.target.material && obj.target.material.uniforms) {
            obj.target.material.uniforms.shockwaveStrength.value = Math.sin(obj.shockwave * Math.PI) * 0.5;
            obj.target.material.uniforms.shockwaveRadius.value = obj.shockwave * 0.8;
          }
        }
      }
    };
  }

  /**
   * Initialize the animation controller
   * 
   * @param {Object} options - Configuration options
   * @param {string} options.performanceMode - Performance mode (high-performance, balanced, high-quality)
   */
  initialize(options = {}) {
    if (this.initialized) return;
    
    this.performanceMode = options.performanceMode || this.performanceMode;
    
    this.setupEventListeners();
    this.startAnimationLoop();
    this.initialized = true;
    
    EventBus.publish('animation:initialized', { performanceMode: this.performanceMode });
    console.log(`AnimationController initialized in ${this.performanceMode} mode`);
  }

  /**
   * Set up event listeners for animation events
   */
  setupEventListeners() {
    EventBus.subscribe('animation:create', this.handleCreateAnimation.bind(this));
    EventBus.subscribe('animation:start', this.handleStartAnimation.bind(this));
    EventBus.subscribe('animation:stop', this.handleStopAnimation.bind(this));
    EventBus.subscribe('animation:pause', this.handlePauseAnimation.bind(this));
    EventBus.subscribe('animation:resume', this.handleResumeAnimation.bind(this));
    EventBus.subscribe('animation:remove', this.handleRemoveAnimation.bind(this));
    EventBus.subscribe('animation:preset', this.handlePresetAnimation.bind(this));
    EventBus.subscribe('animation:group', this.handleAnimationGroup.bind(this));
    EventBus.subscribe('animation:performance', this.handlePerformanceMode.bind(this));
    EventBus.subscribe('scene:update', this.update.bind(this));
  }

  /**
   * Clean up event listeners and stop animation loop
   */
  dispose() {
    EventBus.unsubscribe('animation:create', this.handleCreateAnimation.bind(this));
    EventBus.unsubscribe('animation:start', this.handleStartAnimation.bind(this));
    EventBus.unsubscribe('animation:stop', this.handleStopAnimation.bind(this));
    EventBus.unsubscribe('animation:pause', this.handlePauseAnimation.bind(this));
    EventBus.unsubscribe('animation:resume', this.handleResumeAnimation.bind(this));
    EventBus.unsubscribe('animation:remove', this.handleRemoveAnimation.bind(this));
    EventBus.unsubscribe('animation:preset', this.handlePresetAnimation.bind(this));
    EventBus.unsubscribe('animation:group', this.handleAnimationGroup.bind(this));
    EventBus.unsubscribe('animation:performance', this.handlePerformanceMode.bind(this));
    EventBus.unsubscribe('scene:update', this.update.bind(this));
    
    this.stopAnimationLoop();
    this.animations.clear();
    this.animationGroups.clear();
    this.initialized = false;
    
    EventBus.publish('animation:disposed');
  }

  /**
   * Create a new animation
   * 
   * @param {string} id - Unique identifier for the animation
   * @param {Object} target - Object to animate
   * @param {Object} endState - Final property values
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  createAnimation(id, target, endState, options = {}) {
    // If animation with this ID already exists, remove it
    if (this.animations.has(id)) {
      this.removeAnimation(id);
    }
    
    const {
      duration = this.defaultDuration,
      delay = 0,
      easing = this.defaultEasing,
      onStart,
      onUpdate,
      onComplete,
      repeat = 0,
      yoyo = false,
      group = null
    } = options;
    
    // Create new tween
    const tween = new TWEEN.Tween(target)
      .to(endState, duration)
      .delay(delay)
      .easing(easing);
    
    // Set callbacks
    if (onStart) tween.onStart(onStart);
    if (onUpdate) tween.onUpdate(onUpdate);
    
    // Add completion callback
    tween.onComplete(() => {
      if (onComplete) onComplete();
      
      // If animation is not repeating, remove it when complete
      if (repeat === 0 && !yoyo) {
        this.animations.delete(id);
      }
      
      // Notify that animation is complete
      EventBus.publish('animation:complete', { 
        id,
        target,
        endState
      });
    });
    
    // Set repeat and yoyo options
    if (repeat > 0) tween.repeat(repeat);
    if (yoyo) tween.yoyo(true);
    
    // Store the tween
    this.animations.set(id, {
      tween,
      target,
      endState,
      options,
      status: 'created',
      timestamp: Date.now()
    });
    
    // Add to group if specified
    if (group) {
      if (!this.animationGroups.has(group)) {
        this.animationGroups.set(group, new Set());
      }
      this.animationGroups.get(group).add(id);
    }
    
    return tween;
  }

  /**
   * Create and immediately start an animation
   * 
   * @param {string} id - Unique identifier for the animation
   * @param {Object} target - Object to animate
   * @param {Object} endState - Final property values
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  animate(id, target, endState, options = {}) {
    const tween = this.createAnimation(id, target, endState, options);
    this.startAnimation(id);
    return tween;
  }

  /**
   * Start an animation by ID
   * 
   * @param {string} id - Animation ID
   */
  startAnimation(id) {
    const animation = this.animations.get(id);
    
    if (animation && animation.status !== 'running') {
      animation.tween.start();
      animation.status = 'running';
      animation.startTime = Date.now();
      this.isAnimating = true;
      
      // Ensure animation loop is running
      this.startAnimationLoop();
      
      // Notify that animation has started
      EventBus.publish('animation:started', { 
        id,
        target: animation.target
      });
    }
  }

  /**
   * Stop an animation by ID
   * 
   * @param {string} id - Animation ID
   */
  stopAnimation(id) {
    const animation = this.animations.get(id);
    
    if (animation) {
      TWEEN.remove(animation.tween);
      animation.status = 'stopped';
      animation.endTime = Date.now();
      
      // Check if any animations are still running
      this.checkAnimationStatus();
      
      // Notify that animation has stopped
      EventBus.publish('animation:stopped', { 
        id,
        target: animation.target,
        duration: animation.endTime - (animation.startTime || animation.timestamp)
      });
    }
  }

  /**
   * Pause an animation by ID
   * 
   * @param {string} id - Animation ID
   */
  pauseAnimation(id) {
    const animation = this.animations.get(id);
    
    if (animation && animation.status === 'running') {
      animation.tween.pause();
      animation.status = 'paused';
      animation.pauseTime = Date.now();
      
      // Check if any animations are still running
      this.checkAnimationStatus();
      
      // Notify that animation has been paused
      EventBus.publish('animation:paused', { 
        id,
        target: animation.target,
        elapsedTime: animation.pauseTime - (animation.startTime || animation.timestamp)
      });
    }
  }

  /**
   * Resume a paused animation by ID
   * 
   * @param {string} id - Animation ID
   */
  resumeAnimation(id) {
    const animation = this.animations.get(id);
    
    if (animation && animation.status === 'paused') {
      animation.tween.resume();
      animation.status = 'running';
      animation.resumeTime = Date.now();
      this.isAnimating = true;
      
      // Ensure animation loop is running
      this.startAnimationLoop();
      
      // Notify that animation has resumed
      EventBus.publish('animation:resumed', { 
        id,
        target: animation.target,
        pauseDuration: animation.resumeTime - animation.pauseTime
      });
    }
  }

  /**
   * Remove an animation by ID
   * 
   * @param {string} id - Animation ID
   */
  removeAnimation(id) {
    const animation = this.animations.get(id);
    
    if (animation) {
      TWEEN.remove(animation.tween);
      this.animations.delete(id);
      
      // Remove from any groups
      this.animationGroups.forEach((animIds, groupId) => {
        if (animIds.has(id)) {
          animIds.delete(id);
          if (animIds.size === 0) {
            this.animationGroups.delete(groupId);
          }
        }
      });
      
      // Check if any animations are still running
      this.checkAnimationStatus();
      
      // Notify that animation has been removed
      EventBus.publish('animation:removed', { 
        id,
        target: animation.target
      });
    }
  }

  /**
   * Stop all animations
   */
  stopAllAnimations() {
    this.animations.forEach((animation, id) => {
      TWEEN.remove(animation.tween);
      animation.status = 'stopped';
      animation.endTime = Date.now();
      
      // Notify that animation has stopped
      EventBus.publish('animation:stopped', { 
        id,
        target: animation.target,
        duration: animation.endTime - (animation.startTime || animation.timestamp)
      });
    });
    
    this.isAnimating = false;
    this.stopAnimationLoop();
    
    EventBus.publish('animation:allStopped');
  }

  /**
   * Pause all animations
   */
  pauseAllAnimations() {
    const pausedAnimations = [];
    const pauseTime = Date.now();
    
    this.animations.forEach((animation, id) => {
      if (animation.status === 'running') {
        animation.tween.pause();
        animation.status = 'paused';
        animation.pauseTime = pauseTime;
        
        pausedAnimations.push({
          id,
          target: animation.target,
          elapsedTime: animation.pauseTime - (animation.startTime || animation.timestamp)
        });
        
        // Notify that animation has been paused
        EventBus.publish('animation:paused', { 
          id,
          target: animation.target,
          elapsedTime: animation.pauseTime - (animation.startTime || animation.timestamp)
        });
      }
    });
    
    this.isAnimating = false;
    this.stopAnimationLoop();
    
    if (pausedAnimations.length > 0) {
      EventBus.publish('animation:allPaused', { animations: pausedAnimations });
    }
  }

  /**
   * Resume all paused animations
   */
  resumeAllAnimations() {
    let hasRunningAnimations = false;
    const resumedAnimations = [];
    const resumeTime = Date.now();
    
    this.animations.forEach((animation, id) => {
      if (animation.status === 'paused') {
        animation.tween.resume();
        animation.status = 'running';
        animation.resumeTime = resumeTime;
        hasRunningAnimations = true;
        
        resumedAnimations.push({
          id,
          target: animation.target,
          pauseDuration: animation.resumeTime - animation.pauseTime
        });
        
        // Notify that animation has resumed
        EventBus.publish('animation:resumed', { 
          id,
          target: animation.target,
          pauseDuration: animation.resumeTime - animation.pauseTime
        });
      } else if (animation.status === 'running') {
        hasRunningAnimations = true;
      }
    });
    
    this.isAnimating = hasRunningAnimations;
    
    if (hasRunningAnimations) {
      this.startAnimationLoop();
    }
    
    if (resumedAnimations.length > 0) {
      EventBus.publish('animation:allResumed', { animations: resumedAnimations });
    }
  }

  /**
   * Control animations in a group
   * 
   * @param {string} groupId - Group identifier
   * @param {string} action - Action to perform (start, stop, pause, resume, remove)
   */
  controlGroup(groupId, action) {
    const group = this.animationGroups.get(groupId);
    
    if (!group) {
      console.warn(`Animation group "${groupId}" does not exist`);
      return;
    }
    
    group.forEach(animationId => {
      switch (action) {
        case 'start':
          this.startAnimation(animationId);
          break;
        case 'stop':
          this.stopAnimation(animationId);
          break;
        case 'pause':
          this.pauseAnimation(animationId);
          break;
        case 'resume':
          this.resumeAnimation(animationId);
          break;
        case 'remove':
          this.removeAnimation(animationId);
          break;
        default:
          console.warn(`Unknown animation group action: ${action}`);
      }
    });
    
    EventBus.publish('animation:groupControlled', { 
      groupId,
      action,
      count: group.size
    });
  }

  /**
   * Check if any animations are still running
   */
  checkAnimationStatus() {
    let hasRunningAnimations = false;
    
    this.animations.forEach(animation => {
      if (animation.status === 'running') {
        hasRunningAnimations = true;
      }
    });
    
    this.isAnimating = hasRunningAnimations;
    
    if (!hasRunningAnimations) {
      this.stopAnimationLoop();
    }
  }

  /**
   * Start the animation loop
   */
  startAnimationLoop() {
    if (this.requestId === null) {
      this.animate = this.animate.bind(this);
      this.requestId = requestAnimationFrame(this.animate);
    }
  }

  /**
   * Stop the animation loop
   */
  stopAnimationLoop() {
    if (this.requestId !== null) {
      cancelAnimationFrame(this.requestId);
      this.requestId = null;
    }
  }

  /**
   * Set performance mode
   * 
   * @param {string} mode - Performance mode (high-performance, balanced, high-quality)
   */
  setPerformanceMode(mode) {
    if (['high-performance', 'balanced', 'high-quality'].includes(mode)) {
      this.performanceMode = mode;
      
      // Adjust animation settings based on performance mode
      switch (mode) {
        case 'high-performance':
          this.defaultDuration = 600; // faster animations
          break;
        case 'balanced':
          this.defaultDuration = 800; // default
          break;
        case 'high-quality':
          this.defaultDuration = 1000; // smoother animations
          break;
      }
      
      EventBus.publish('animation:performanceChanged', { mode });
    } else {
      console.warn(`Invalid performance mode: ${mode}`);
    }
  }

  /**
   * Update animations
   * 
   * @param {number} time - Current timestamp
   */
  update(time) {
    if (this.isAnimating) {
      TWEEN.update(time);
    }
  }

  /**
   * Animation loop
   */
  animate(time) {
    this.update(time);
    this.requestId = requestAnimationFrame(this.animate);
  }

  /**
   * Handle animation creation event
   * 
   * @param {Object} data - Event data
   */
  handleCreateAnimation(data) {
    const { id, target, endState, options } = data;
    this.createAnimation(id, target, endState, options);
  }

  /**
   * Handle animation start event
   * 
   * @param {Object} data - Event data
   */
  handleStartAnimation(data) {
    const { id } = data;
    this.startAnimation(id);
  }

  /**
   * Handle animation stop event
   * 
   * @param {Object} data - Event data
   */
  handleStopAnimation(data) {
    const { id } = data;
    this.stopAnimation(id);
  }

  /**
   * Handle animation pause event
   * 
   * @param {Object} data - Event data
   */
  handlePauseAnimation(data) {
    const { id } = data;
    this.pauseAnimation(id);
  }

  /**
   * Handle animation resume event
   * 
   * @param {Object} data - Event data
   */
  handleResumeAnimation(data) {
    const { id } = data;
    this.resumeAnimation(id);
  }

  /**
   * Handle animation remove event
   * 
   * @param {Object} data - Event data
   */
  handleRemoveAnimation(data) {
    const { id } = data;
    this.removeAnimation(id);
  }

  /**
   * Handle animation preset event
   * 
   * @param {Object} data - Event data
   */
  handlePresetAnimation(data) {
    const { id, target, presetName, options } = data;
    this.applyPreset(id, target, presetName, options);
  }

  /**
   * Handle animation group event
   * 
   * @param {Object} data - Event data
   */
  handleAnimationGroup(data) {
    const { groupId, action } = data;
    this.controlGroup(groupId, action);
  }

  /**
   * Handle performance mode change event
   * 
   * @param {Object} data - Event data
   */
  handlePerformanceMode(data) {
    const { mode } = data;
    this.setPerformanceMode(mode);
  }

  /**
   * Apply an animation preset
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object
   * @param {string} presetName - Name of the preset
   * @param {Object} customOptions - Custom options to override preset defaults
   * @returns {TWEEN.Tween|null} - The created tween or null if preset not found
   */
  applyPreset(id, target, presetName, customOptions = {}) {
    const preset = this.presets[presetName];
    
    if (!preset) {
      console.warn(`Animation preset "${presetName}" not found`);
      return null;
    }
    
    const options = { ...preset, ...customOptions };
    let tween;
    
    if (preset.steps) {
      // Handle multi-step animations (like shake)
      return this.sequence(`${id}_sequence`, preset.steps.map((step, index) => ({
        target,
        endState: step,
        options: {
          ...options,
          duration: options.duration / preset.steps.length
        }
      })));
    } else {
      // Set starting values if provided
      if (preset.from) {
        Object.keys(preset.from).forEach(key => {
          if (typeof preset.from[key] === 'object') {
            Object.keys(preset.from[key]).forEach(subKey => {
              target[key][subKey] = preset.from[key][subKey];
            });
          } else {
            target[key] = preset.from[key];
          }
        });
      }
      
      // Apply the animation with preset's "to" values
      tween = this.animate(id, target, preset.to || {}, options);
    }
    
    EventBus.publish('animation:presetApplied', {
      id,
      target,
      presetName
    });
    
    return tween;
  }

  /**
   * Create a fade animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object with opacity property
   * @param {number} targetOpacity - Target opacity (0-1)
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  fade(id, target, targetOpacity, options = {}) {
    return this.animate(id, target, { opacity: targetOpacity }, options);
  }

  /**
   * Create a move animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object with position properties
   * @param {Object} targetPosition - Target position {x, y, z}
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  move(id, target, targetPosition, options = {}) {
    return this.animate(id, target.position, targetPosition, options);
  }

  /**
   * Create a scale animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object with scale properties
   * @param {Object} targetScale - Target scale {x, y, z}
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  scale(id, target, targetScale, options = {}) {
    return this.animate(id, target.scale, targetScale, options);
  }

  /**
   * Create a rotation animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object with rotation properties
   * @param {Object} targetRotation - Target rotation {x, y, z}
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  rotate(id, target, targetRotation, options = {}) {
    return this.animate(id, target.rotation, targetRotation, options);
  }

  /**
   * Create a color animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object with color property
   * @param {Object} targetColor - Target color {r, g, b}
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  color(id, target, targetColor, options = {}) {
    return this.animate(id, target.color, targetColor, options);
  }

  /**
   * Create a sequence of animations
   * 
   * @param {string} id - Animation sequence ID
   * @param {Array} animations - Array of animation configs
   * @returns {Promise} - Promise that resolves when sequence completes
   */
  sequence(id, animations) {
    return new Promise((resolve) => {
      let currentIndex = 0;
      
      const runNextAnimation = () => {
        if (currentIndex >= animations.length) {
          resolve();
          EventBus.publish('animation:sequenceComplete', { id });
          return;
        }
        
        const animation = animations[currentIndex];
        const animId = `${id}_${currentIndex}`;
        const { target, endState, options = {} } = animation;
        
        // Create onComplete callback that runs the next animation
        const originalOnComplete = options.onComplete;
        options.onComplete = () => {
          if (originalOnComplete) originalOnComplete();
          currentIndex++;
          runNextAnimation();
        };
        
        // Create and start the animation
        this.animate(animId, target, endState, options);
      };
      
      // Start the sequence
      runNextAnimation();
      
      // Register the sequence in a group
      animations.forEach((_, index) => {
        const animId = `${id}_${index}`;
        if (!this.animationGroups.has(id)) {
          this.animationGroups.set(id, new Set());
        }
        this.animationGroups.get(id).add(animId);
      });
      
      EventBus.publish('animation:sequenceStarted', { 
        id, 
        count: animations.length 
      });
    });
  }

  /**
   * Create parallel animations that run simultaneously
   * 
   * @param {string} id - Animation group ID
   * @param {Array} animations - Array of animation configs
   * @returns {Promise} - Promise that resolves when all animations complete
   */
  parallel(id, animations) {
    return new Promise((resolve) => {
      let completedCount = 0;
      
      animations.forEach((animation, index) => {
        const animId = `${id}_${index}`;
        const { target, endState, options = {} } = animation;
        
        // Create onComplete callback that tracks completion
        const originalOnComplete = options.onComplete;
        options.onComplete = () => {
          if (originalOnComplete) originalOnComplete();
          completedCount++;
          
          if (completedCount === animations.length) {
            resolve();
            EventBus.publish('animation:parallelComplete', { id });
          }
        };
        
        // Create and start the animation
        this.animate(animId, target, endState, options);
        
        // Register in a group
        if (!this.animationGroups.has(id)) {
          this.animationGroups.set(id, new Set());
        }
        this.animationGroups.get(id).add(animId);
      });
      
      EventBus.publish('animation:parallelStarted', { 
        id, 
        count: animations.length 
      });
    });
  }

  /**
   * Create a staggered animation where multiple targets animate with a delay
   * 
   * @param {string} id - Animation group ID
   * @param {Array} targets - Array of objects to animate
   * @param {Object} endState - Final state for all targets
   * @param {Object} options - Animation options
   * @param {number} staggerDelay - Delay between each target's animation
   * @returns {Promise} - Promise that resolves when all animations complete
   */
  stagger(id, targets, endState, options = {}, staggerDelay = 50) {
    return new Promise((resolve) => {
      let completedCount = 0;
      
      targets.forEach((target, index) => {
        const animId = `${id}_${index}`;
        const staggeredOptions = { ...options };
        
        // Add staggered delay
        staggeredOptions.delay = (options.delay || 0) + (index * staggerDelay);
        
        // Create onComplete callback that tracks completion
        const originalOnComplete = options.onComplete;
        staggeredOptions.onComplete = () => {
          if (originalOnComplete) originalOnComplete(target, index);
          completedCount++;
          
          if (completedCount === targets.length) {
            resolve();
            EventBus.publish('animation:staggerComplete', { id });
          }
        };
        
        // Create and start the animation
        this.animate(animId, target, endState, staggeredOptions);
        
        // Register in a group
        if (!this.animationGroups.has(id)) {
          this.animationGroups.set(id, new Set());
        }
        this.animationGroups.get(id).add(animId);
      });
      
      EventBus.publish('animation:staggerStarted', { 
        id, 
        count: targets.length,
        staggerDelay 
      });
    });
  }
  
  /**
   * Physics-based spring animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object
   * @param {Object} endState - Final property values
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  spring(id, target, endState, options = {}) {
    const springOptions = {
      stiffness: options.stiffness || 100, // spring stiffness
      damping: options.damping || 10,      // damping factor
      mass: options.mass || 1,             // object mass
      ...options
    };
    
    const springEasing = (k) => {
      // Custom spring physics easing function
      // Higher stiffness = more rigid spring
      // Higher damping = less oscillation
      const s = springOptions.stiffness;
      const d = springOptions.damping;
      const m = springOptions.mass;
      
      // Underdamped spring equation
      const beta = d / (2 * Math.sqrt(s * m));
      if (beta < 1) { // underdamped
        const omega = Math.sqrt(s / m);
        const omega_d = omega * Math.sqrt(1 - beta * beta);
        return 1 - Math.exp(-beta * omega * k) * (
          Math.cos(omega_d * k) + 
          (beta * omega / omega_d) * Math.sin(omega_d * k)
        );
      } else { // critically damped or overdamped
        return 1 - (1 + k) * Math.exp(-k);
      }
    };
    
    const customOptions = {
      ...options,
      easing: springEasing,
      duration: options.duration || 1500  // longer duration for springy effect
    };
    
    return this.animate(id, target, endState, customOptions);
  }
  
  /**
   * Fluid motion animation with dynamic resistance
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object
   * @param {Object} endState - Final property values
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  fluid(id, target, endState, options = {}) {
    const fluidOptions = {
      viscosity: options.viscosity || 0.8,  // fluid resistance (0-1)
      turbulence: options.turbulence || 0.2, // random movement (0-1)
      ...options
    };
    
    const fluidEasing = (k) => {
      // Custom fluid dynamics easing
      const v = fluidOptions.viscosity;
      const t = fluidOptions.turbulence;
      
      // Add random turbulence
      const noise = t > 0 ? t * (0.5 - Math.random()) * Math.sin(k * Math.PI) : 0;
      
      // Apply viscosity as resistance that decreases movement speed
      const viscousFlow = Math.pow(k, 1 + v) / (Math.pow(k, 1 + v) + Math.pow(1 - k, 1 + v));
      
      return viscousFlow + noise;
    };
    
    const customOptions = {
      ...options,
      easing: fluidEasing,
      duration: options.duration || 1200
    };
    
    return this.animate(id, target, endState, customOptions);
  }
  
  /**
   * Magnetic attraction/repulsion animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object
   * @param {Object} endState - Final property values 
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  magnetic(id, target, endState, options = {}) {
    const magOptions = {
      attraction: options.attraction || 1,  // positive for attract, negative for repel
      distance: options.distance || 100,    // reference distance
      ...options
    };
    
    const magneticEasing = (k) => {
      // Simulate magnetic field behavior
      const a = magOptions.attraction;
      const d = magOptions.distance;
      
      // Inverse square law for magnetic force
      if (a > 0) { // Attraction
        return 1 - Math.pow(1 - k, 2 * a);
      } else { // Repulsion
        return k < 0.5 ? 
          2 * Math.pow(k, 2 + Math.abs(a)) : 
          1 - Math.pow(2 * (1 - k), 2 + Math.abs(a)) / 2;
      }
    };
    
    const customOptions = {
      ...options,
      easing: magneticEasing,
      duration: options.duration || 1000
    };
    
    return this.animate(id, target, endState, customOptions);
  }
  
  /**
   * Gravity-based fall animation
   * 
   * @param {string} id - Animation ID
   * @param {Object} target - Target object
   * @param {Object} endState - Final property values
   * @param {Object} options - Animation options
   * @returns {TWEEN.Tween} - The created tween
   */
  gravityFall(id, target, endState, options = {}) {
    const gravityOptions = {
      gravity: options.gravity || 9.8,     // acceleration due to gravity
      bounciness: options.bounciness || 0.7, // 0-1, energy preserved in bounce
      ...options
    };
    
    // If we want bounces, we need to create a sequence
    if (gravityOptions.bounciness > 0 && 
        endState.position && 
        target.position) {
      
      const startY = target.position.y;
      const endY = endState.position.y;
      const distance = Math.abs(endY - startY);
      const direction = endY > startY ? 1 : -1;
      
      // Calculate time to fall based on gravity
      const fallTime = Math.sqrt(2 * distance / gravityOptions.gravity) * 1000;
      
      // Create bounce sequence
      const bounceSequence = [];
      let currentHeight = distance;
      let currentDuration = fallTime;
      
      // Create initial fall
      bounceSequence.push({
        target: target,
        endState: {...endState},
        options: {
          ...options,
          easing: TWEEN.Easing.Quadratic.In,
          duration: currentDuration
        }
      });
      
      // Add bounces
      const maxBounces = 3;
      for (let i = 0; i < maxBounces; i++) {
        // Calculate new height based on bounciness
        currentHeight *= gravityOptions.bounciness;
        
        // If bounce is too small, stop
        if (currentHeight < 1) break;
        
        // Calculate time for this bounce (based on physics)
        currentDuration = Math.sqrt(2 * currentHeight / gravityOptions.gravity) * 1000;
        
        // Add bounce up
        bounceSequence.push({
          target: target,
          endState: {
            position: {
              ...endState.position,
              y: endState.position.y - (currentHeight * direction)
            }
          },
          options: {
            ...options,
            easing: TWEEN.Easing.Quadratic.Out,
            duration: currentDuration * 0.8
          }
        });
        
        // Add fall back down
        bounceSequence.push({
          target: target,
          endState: {...endState},
          options: {
            ...options,
            easing: TWEEN.Easing.Quadratic.In,
            duration: currentDuration * 0.8
          }
        });
      }
      
      // Create and return the sequence
      return this.sequence(`${id}_bounce_sequence`, bounceSequence);
    }
    
    // Simple gravity fall without bounces
    const gravityEasing = (k) => {
      // Simulate acceleration due to gravity (quadratic)
      return k * k;
    };
    
    const customOptions = {
      ...options,
      easing: gravityEasing,
      duration: options.duration || 1000
    };
    
    return this.animate(id, target, endState, customOptions);
  }
}

// Export singleton instance
const animationController = new AnimationController();

export default registry.register(
  'visualization.AnimationController',
  animationController,
  [
    'utils.EventBus'
  ],
  {
    description: 'Manages animations and transitions throughout the visualization with comprehensive animation capabilities',
    usage: 'Used for creating smooth transitions and animations in the visualization with support for presets, sequences, and physics-based motion'
  }
); 