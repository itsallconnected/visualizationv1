/**
 * LayoutEngine handles positioning of nodes in 3D space based on their hierarchy
 * and relationships. It provides various layout algorithms and manages transitions
 * between them.
 */
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
import registry from '../ModuleRegistry';

class LayoutEngine {
  constructor() {
    this.nodes = [];
    this.links = [];
    
    this.isInitialized = false;
    this.needsUpdate = false;
    
    // Node positions with smooth transitions
    this.nodePositions = new Map();
    this.targetPositions = new Map();
    this.activeTransitions = new Map();
    
    // Default settings
    this.settings = {
      layoutType: 'hierarchical',
      hierarchical: {
        levelSeparation: 150,
        siblingDistance: 50,
        subtreeSeparation: 100,
        direction: 'horizontal', // 'horizontal', 'vertical', 'radial'
      },
      force: {
        linkDistance: 100,
        linkStrength: 0.1,
        charge: -100,
        gravity: 0.05,
        friction: 0.9,
        iterations: 300
      },
      radial: {
        levelSeparation: 100,
        angleSpread: Math.PI * 2,
        startAngle: 0
      },
      cluster: {
        padding: 50,
        clusterPadding: 100,
        useTypes: true
      },
      transitions: {
        enabled: true,
        duration: 1000,
        easing: TWEEN.Easing.Cubic.InOut
      }
    };
    
    // Event bus reference
    this.eventBus = null;
  }
  
  /**
   * Initialize the layout engine
   * @param {Array} nodes - Node data
   * @param {Array} links - Link data
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(nodes = [], links = []) {
    try {
      this.nodes = nodes;
      this.links = links;
      
      // Get EventBus
      this.eventBus = registry.getModule('utils.EventBus');
      
      // Create initial node positions
      this.initializeNodePositions();
      
      this.isInitialized = true;
      this.needsUpdate = true;
      
      // Publish initialized event
      if (this.eventBus) {
        this.eventBus.publish('visualization:layoutEngineInitialized', {
          nodeCount: nodes.length,
          linkCount: links.length
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize LayoutEngine:', error);
      
      // Publish error event
      if (this.eventBus) {
        this.eventBus.publish('error:visualization', {
          component: 'LayoutEngine',
          message: 'Failed to initialize',
          error
        });
      }
      
      return false;
    }
  }
  
  /**
   * Initialize node positions based on any existing positions or create new ones
   * @private
   */
  initializeNodePositions() {
    this.nodePositions.clear();
    this.targetPositions.clear();
    
    this.nodes.forEach(node => {
      // Use existing position if available
      if (node.position && 
          typeof node.position.x === 'number' && 
          typeof node.position.y === 'number' && 
          typeof node.position.z === 'number') {
        
        this.nodePositions.set(node.id, new THREE.Vector3(
          node.position.x,
          node.position.y,
          node.position.z
        ));
      } else {
        // Initialize with a position based on level
        const level = node.level || 0;
        const randomX = (Math.random() - 0.5) * 100;
        const randomY = level * 50;
        const randomZ = (Math.random() - 0.5) * 100;
        
        this.nodePositions.set(node.id, new THREE.Vector3(randomX, randomY, randomZ));
      }
      
      // Initialize target at the same position
      this.targetPositions.set(
        node.id, 
        this.nodePositions.get(node.id).clone()
      );
    });
  }
  
  /**
   * Calculate layout based on current settings
   */
  calculateLayout() {
    if (!this.isInitialized) return;
    
    switch (this.settings.layoutType) {
      case 'hierarchical':
        this.calculateHierarchicalLayout();
        break;
      case 'radial':
        this.calculateRadialLayout();
        break;
      case 'force':
        this.calculateForceLayout();
        break;
      case 'cluster':
        this.calculateClusterLayout();
        break;
      default:
        console.warn(`Unknown layout type: ${this.settings.layoutType}`);
        this.calculateHierarchicalLayout();
    }
    
    // Copy calculated positions to target positions
    this.applyTargetPositions();
    
    this.needsUpdate = true;
    
    // Publish layout calculated event
    if (this.eventBus) {
      this.eventBus.publish('visualization:layoutCalculated', {
        type: this.settings.layoutType
      });
    }
  }
  
  /**
   * Apply calculated target positions with transitions
   * @private
   */
  applyTargetPositions() {
    // Cancel any active transitions
    this.activeTransitions.forEach(tween => {
      tween.stop();
    });
    this.activeTransitions.clear();
    
    // Apply new target positions with transitions
    if (this.settings.transitions.enabled) {
      this.nodes.forEach(node => {
        const currentPos = this.nodePositions.get(node.id);
        const targetPos = this.targetPositions.get(node.id);
        
        if (!currentPos || !targetPos) return;
        
        // Skip transition if positions are very close
        if (currentPos.distanceTo(targetPos) < 0.1) {
          this.nodePositions.set(node.id, targetPos.clone());
          return;
        }
        
        // Create animation state
        const state = {
          x: currentPos.x,
          y: currentPos.y,
          z: currentPos.z
        };
        
        // Create tween
        const tween = new TWEEN.Tween(state)
          .to({
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z
          }, this.settings.transitions.duration)
          .easing(this.settings.transitions.easing)
          .onUpdate(() => {
            this.nodePositions.set(node.id, new THREE.Vector3(state.x, state.y, state.z));
          })
          .onComplete(() => {
            this.activeTransitions.delete(node.id);
            
            // Update node position directly when complete
            this.nodePositions.set(node.id, targetPos.clone());
          })
          .start();
        
        this.activeTransitions.set(node.id, tween);
      });
    } else {
      // Without transitions, directly copy target positions
      this.targetPositions.forEach((position, nodeId) => {
        this.nodePositions.set(nodeId, position.clone());
      });
    }
  }
  
  /**
   * Calculate hierarchical tree layout
   * @private
   */
  calculateHierarchicalLayout() {
    // Group nodes by level and parent
    const nodesByParent = new Map();
    const rootNodes = [];
    
    this.nodes.forEach(node => {
      if (!node.parent) {
        rootNodes.push(node);
      } else {
        if (!nodesByParent.has(node.parent)) {
          nodesByParent.set(node.parent, []);
        }
        nodesByParent.get(node.parent).push(node);
      }
    });
    
    // Layout settings
    const { levelSeparation, siblingDistance, subtreeSeparation, direction } = this.settings.hierarchical;
    
    // Recursive function to position nodes
    const positionNode = (node, x, y, z, level = 0) => {
      const children = nodesByParent.get(node.id) || [];
      
      // Set node target position
      const targetPos = new THREE.Vector3(x, y, z);
      this.targetPositions.set(node.id, targetPos);
      
      // Skip if no children
      if (children.length === 0) return 1; // Width is 1 for leaf nodes
      
      // Calculate total width of children
      const childWidths = children.map(child => {
        // Recursively calculate subtree width
        return positionNode(child, 0, 0, 0, level + 1); 
      });
      
      // Calculate total width including spacing
      const totalChildWidth = childWidths.reduce((sum, width) => sum + width, 0) +
        (children.length - 1) * (siblingDistance / 100);
      
      // Position children
      let offset = -totalChildWidth / 2;
      
      children.forEach((child, index) => {
        const childWidth = childWidths[index];
        const childCenter = offset + childWidth / 2;
        
        // Position based on direction
        let childX = x;
        let childY = y;
        let childZ = z;
        
        switch (direction) {
          case 'horizontal':
            childX = x + levelSeparation;
            childY = y + childCenter;
            break;
          case 'vertical':
            childX = x + childCenter;
            childY = y + levelSeparation;
            break;
          case 'radial':
            const angle = (childCenter / totalChildWidth) * Math.PI * 2;
            childX = x + Math.cos(angle) * levelSeparation;
            childZ = z + Math.sin(angle) * levelSeparation;
            childY = y + level * levelSeparation * 0.3; // Slight level-based Y offset
            break;
        }
        
        // Update target position
        this.targetPositions.set(child.id, new THREE.Vector3(childX, childY, childZ));
        
        offset += childWidth + (siblingDistance / 100);
      });
      
      return totalChildWidth;
    };
    
    // Position root nodes
    let rootOffset = 0;
    rootNodes.forEach(rootNode => {
      // Horizontal spacing between root nodes
      const rootX = direction === 'vertical' ? rootOffset : 0;
      const rootY = direction === 'horizontal' ? rootOffset : 0;
      
      // Calculate subtree layout
      const treeWidth = positionNode(rootNode, rootX, rootY, 0);
      
      // Add separation between trees
      rootOffset += treeWidth + subtreeSeparation;
    });
  }
  
  /**
   * Calculate radial layout
   * @private
   */
  calculateRadialLayout() {
    // Group nodes by level
    const nodesByLevel = new Map();
    
    this.nodes.forEach(node => {
      const level = node.level || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level).push(node);
    });
    
    // Layout settings
    const { levelSeparation, angleSpread, startAngle } = this.settings.radial;
    
    // Position nodes by level
    const levels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
    
    levels.forEach(level => {
      const nodesInLevel = nodesByLevel.get(level);
      const nodeCount = nodesInLevel.length;
      
      // Calculate radius based on level
      const radius = level * levelSeparation;
      
      // Position each node in this level
      nodesInLevel.forEach((node, index) => {
        // Calculate angle based on node index
        const angle = startAngle + (index / nodeCount) * angleSpread;
        
        // Calculate position using polar coordinates
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        const y = 0; // Keep Y at zero for flat layout
        
        // Set target position
        this.targetPositions.set(node.id, new THREE.Vector3(x, y, z));
      });
    });
  }
  
  /**
   * Simple force-directed layout
   * @private
   */
  calculateForceLayout() {
    const { linkDistance, linkStrength, charge, gravity, friction, iterations } = this.settings.force;
    
    // Initialize positions if not set
    this.nodes.forEach(node => {
      if (!this.targetPositions.has(node.id)) {
        const randomPos = new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        this.targetPositions.set(node.id, randomPos);
      }
    });
    
    // Execute force algorithm iterations
    for (let i = 0; i < iterations; i++) {
      // Reset forces
      const forces = this.nodes.map(() => new THREE.Vector3(0, 0, 0));
      
      // Apply repulsion forces (nodes repel each other)
      for (let j = 0; j < this.nodes.length; j++) {
        const nodeJ = this.nodes[j];
        const posJ = this.targetPositions.get(nodeJ.id);
        
        for (let k = j + 1; k < this.nodes.length; k++) {
          const nodeK = this.nodes[k];
          const posK = this.targetPositions.get(nodeK.id);
          
          // Vector pointing from j to k
          const diff = new THREE.Vector3()
            .subVectors(posK, posJ);
          
          const distance = diff.length();
          if (distance === 0) continue;
          
          // Normalize and scale by charge
          diff.normalize().multiplyScalar(charge / (distance * distance));
          
          // Apply force to both nodes (equal and opposite)
          forces[j].sub(diff);
          forces[k].add(diff);
        }
      }
      
      // Apply attraction forces (connected nodes attract)
      this.links.forEach(link => {
        const sourceIndex = this.nodes.findIndex(n => n.id === link.source);
        const targetIndex = this.nodes.findIndex(n => n.id === link.target);
        
        if (sourceIndex < 0 || targetIndex < 0) return;
        
        const sourcePos = this.targetPositions.get(link.source);
        const targetPos = this.targetPositions.get(link.target);
        
        // Vector pointing from source to target
        const diff = new THREE.Vector3()
          .subVectors(targetPos, sourcePos);
        
        const distance = diff.length();
        if (distance === 0) return;
        
        // Force is proportional to how stretched the spring is
        const force = diff.normalize()
          .multiplyScalar((distance - linkDistance) * linkStrength);
        
        // Apply spring force to both nodes
        forces[sourceIndex].add(force);
        forces[targetIndex].sub(force);
      });
      
      // Apply gravity towards center
      for (let j = 0; j < this.nodes.length; j++) {
        const pos = this.targetPositions.get(this.nodes[j].id);
        
        // Vector pointing to center
        const gravityForce = new THREE.Vector3()
          .subVectors(new THREE.Vector3(0, 0, 0), pos)
          .multiplyScalar(gravity);
        
        forces[j].add(gravityForce);
      }
      
      // Update positions based on forces
      for (let j = 0; j < this.nodes.length; j++) {
        const nodeId = this.nodes[j].id;
        const oldPos = this.targetPositions.get(nodeId);
        const newPos = oldPos.clone().add(forces[j].multiplyScalar(friction));
        
        this.targetPositions.set(nodeId, newPos);
      }
    }
  }
  
  /**
   * Calculate cluster layout based on node types
   * @private
   */
  calculateClusterLayout() {
    const { padding, clusterPadding, useTypes } = this.settings.cluster;
    
    // Group nodes by type or category
    const clusters = new Map();
    
    this.nodes.forEach(node => {
      // Use node type or category as cluster key
      const clusterKey = useTypes ? node.type : (node.category || 'default');
      
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      
      clusters.get(clusterKey).push(node);
    });
    
    // Position each cluster
    const clusterKeys = Array.from(clusters.keys());
    const clusterCount = clusterKeys.length;
    
    // Calculate cluster centers in a grid or circle
    const clusterCenters = new Map();
    
    if (clusterCount <= 6) {
      // Place in a circle for a few clusters
      clusterKeys.forEach((key, index) => {
        const angle = (index / clusterCount) * Math.PI * 2;
        const distance = 300; // Radius of the circle
        
        clusterCenters.set(key, new THREE.Vector3(
          Math.cos(angle) * distance,
          0,
          Math.sin(angle) * distance
        ));
      });
    } else {
      // Place in a grid for many clusters
      const gridSize = Math.ceil(Math.sqrt(clusterCount));
      const gridStep = 300; // Distance between grid points
      
      clusterKeys.forEach((key, index) => {
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;
        
        clusterCenters.set(key, new THREE.Vector3(
          (col - (gridSize - 1) / 2) * gridStep,
          0,
          (row - (gridSize - 1) / 2) * gridStep
        ));
      });
    }
    
    // Position nodes within each cluster
    clusters.forEach((nodes, clusterKey) => {
      const center = clusterCenters.get(clusterKey);
      const nodeCount = nodes.length;
      
      // Very small clusters - place nodes around center point
      if (nodeCount <= 10) {
        nodes.forEach((node, index) => {
          const angle = (index / nodeCount) * Math.PI * 2;
          const distance = padding * 3;
          
          const x = center.x + Math.cos(angle) * distance;
          const z = center.z + Math.sin(angle) * distance;
          
          this.targetPositions.set(node.id, new THREE.Vector3(x, center.y, z));
        });
      } 
      // Larger clusters - arrange in a grid
      else {
        const gridSize = Math.ceil(Math.sqrt(nodeCount));
        
        nodes.forEach((node, index) => {
          const row = Math.floor(index / gridSize);
          const col = index % gridSize;
          
          const x = center.x + (col - (gridSize - 1) / 2) * padding;
          const z = center.z + (row - (gridSize - 1) / 2) * padding;
          
          this.targetPositions.set(node.id, new THREE.Vector3(x, center.y, z));
        });
      }
    });
  }
  
  /**
   * Get node position from internal map
   * @param {string} nodeId - Node ID
   * @returns {THREE.Vector3|null} Node position or null if not found
   */
  getNodePosition(nodeId) {
    return this.nodePositions.has(nodeId) 
      ? this.nodePositions.get(nodeId).clone()
      : null;
  }
  
  /**
   * Set node position directly
   * @param {string} nodeId - Node ID
   * @param {THREE.Vector3} position - New position
   */
  setNodePosition(nodeId, position) {
    if (!position) return;
    
    // Cancel any active transition for this node
    if (this.activeTransitions.has(nodeId)) {
      this.activeTransitions.get(nodeId).stop();
      this.activeTransitions.delete(nodeId);
    }
    
    // Update both current and target position
    this.nodePositions.set(nodeId, position.clone());
    this.targetPositions.set(nodeId, position.clone());
    
    this.needsUpdate = true;
  }
  
  /**
   * Set multiple node positions at once
   * @param {Object} positionMap - Map of node IDs to positions
   */
  setNodePositions(positionMap) {
    if (!positionMap) return;
    
    Object.entries(positionMap).forEach(([nodeId, position]) => {
      this.setNodePosition(nodeId, new THREE.Vector3(position.x, position.y, position.z));
    });
  }
  
  /**
   * Get all current node positions
   * @returns {Map<string, THREE.Vector3>} Map of node IDs to positions
   */
  getAllNodePositions() {
    // Create a deep copy to prevent external modification
    const positions = new Map();
    this.nodePositions.forEach((pos, id) => {
      positions.set(id, pos.clone());
    });
    return positions;
  }
  
  /**
   * Update node data
   * @param {Array} nodes - Updated node data
   * @param {Array} links - Updated link data
   */
  updateData(nodes, links) {
    this.nodes = nodes;
    this.links = links;
    
    // Keep positions for existing nodes, initialize new ones
    nodes.forEach(node => {
      if (!this.nodePositions.has(node.id)) {
        // Initialize with a position based on level
        const level = node.level || 0;
        const randomX = (Math.random() - 0.5) * 100;
        const randomY = level * 50;
        const randomZ = (Math.random() - 0.5) * 100;
        
        this.nodePositions.set(node.id, new THREE.Vector3(randomX, randomY, randomZ));
        this.targetPositions.set(node.id, new THREE.Vector3(randomX, randomY, randomZ));
      }
    });
    
    // Remove positions for deleted nodes
    const nodeIds = new Set(nodes.map(node => node.id));
    Array.from(this.nodePositions.keys()).forEach(id => {
      if (!nodeIds.has(id)) {
        this.nodePositions.delete(id);
        this.targetPositions.delete(id);
        
        if (this.activeTransitions.has(id)) {
          this.activeTransitions.get(id).stop();
          this.activeTransitions.delete(id);
        }
      }
    });
    
    this.needsUpdate = true;
  }
  
  /**
   * Update method called each frame
   * @param {number} delta - Time since last update in seconds
   */
  update(delta) {
    if (!this.isInitialized) return;
    
    // Update transitions
    TWEEN.update();
    
    this.needsUpdate = this.activeTransitions.size > 0;
  }
  
  /**
   * Change the layout type
   * @param {string} layoutType - New layout type
   * @param {Object} options - Layout specific options
   */
  changeLayout(layoutType, options = {}) {
    // Update layout type
    this.settings.layoutType = layoutType;
    
    // Update options for this layout if provided
    if (options && typeof options === 'object') {
      if (layoutType in this.settings) {
        this.settings[layoutType] = {
          ...this.settings[layoutType],
          ...options
        };
      }
    }
    
    // Recalculate layout
    this.calculateLayout();
    
    // Publish layout change event
    if (this.eventBus) {
      this.eventBus.publish('visualization:layoutChanged', {
        type: layoutType,
        options: this.settings[layoutType]
      });
    }
  }
  
  /**
   * Update layout settings
   * @param {Object} settings - New settings
   */
  updateSettings(settings) {
    // Deep merge settings
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    // Merge specific layout settings
    Object.keys(settings).forEach(key => {
      if (key in this.settings && typeof settings[key] === 'object') {
        this.settings[key] = {
          ...this.settings[key],
          ...settings[key]
        };
      }
    });
    
    // Recalculate layout if needed
    if (settings.layoutType || settings[this.settings.layoutType]) {
      this.calculateLayout();
    }
  }
  
  /**
   * Dispose of the layout engine
   */
  dispose() {
    // Stop all transitions
    this.activeTransitions.forEach(tween => tween.stop());
    this.activeTransitions.clear();
    
    this.nodes = [];
    this.links = [];
    this.nodePositions.clear();
    this.targetPositions.clear();
    this.isInitialized = false;
    this.needsUpdate = false;
    
    // Publish disposed event
    if (this.eventBus) {
      this.eventBus.publish('visualization:layoutEngineDisposed');
    }
  }
}

export default registry.register(
  'visualization.LayoutEngine',
  new LayoutEngine(),
  ['utils.EventBus'],
  {
    description: 'Handles layout algorithms for positioning nodes in 3D space',
    singleton: true
  }
);
