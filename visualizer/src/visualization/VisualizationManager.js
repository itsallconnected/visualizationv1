import React, { createContext, useContext, useState, useEffect } from 'react';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';
import * as THREE from 'three';

// Create visualization context
const VisualizationContext = createContext(null);

/**
 * Visualization Manager component that coordinates all visualization aspects
 * 
 * @param {Object} props - Component props
 * @param {Object[]} props.nodes - Nodes to visualize
 * @param {Object[]} props.links - Links between nodes
 * @param {Function} props.onNodeSelect - Callback when a node is selected
 * @param {React.Node} props.children - Child components
 * @returns {React.Component} Visualization provider
 */
export const VisualizationProvider = ({ nodes = [], links = [], onNodeSelect, children }) => {
  const [visualizationRef, setVisualizationRef] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [visibleNodes, setVisibleNodes] = useState(new Set());
  const [activeSphereName, setActiveSphereName] = useState(null);
  const [viewMode, setViewMode] = useState('default');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get the visualization manager instance from registry
  const visualizationManager = registry.getModule('visualization.VisualizationManager');

  // Initialize visualization when container ref is set
  const initializeVisualization = async (containerRef) => {
    if (!containerRef || !visualizationManager) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Initialize the visualization manager
      await visualizationManager.initialize(containerRef);
      
      // Load nodes and links
      await visualizationManager.loadData(nodes, links);
      
      // Start the visualization
      visualizationManager.start();
      
      // Set up event listeners
      visualizationManager.addEventListener('nodeSelect', (node) => {
        setSelectedNode(node);
        if (onNodeSelect) onNodeSelect(node);
      });
      
      visualizationManager.addEventListener('nodeHover', (node) => {
        setHoveredNode(node);
      });
      
      visualizationManager.addEventListener('nodeExpand', (expandedNodeIds) => {
        setExpandedNodes(new Set(expandedNodeIds));
      });
      
      visualizationManager.addEventListener('visibleNodesChange', (nodeIds) => {
        setVisibleNodes(new Set(nodeIds));
      });
      
      visualizationManager.addEventListener('activeSphereChange', (sphereName) => {
        setActiveSphereName(sphereName);
      });
      
      visualizationManager.addEventListener('viewModeChange', (mode) => {
        setViewMode(mode);
      });
      
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize visualization:', err);
      setError(err.message || 'Failed to initialize visualization');
      setIsLoading(false);
    }
  };

  // Clean up visualization resources on unmount
  useEffect(() => {
    return () => {
      if (visualizationManager) {
        visualizationManager.dispose();
      }
    };
  }, []);

  // Handle reference to visualization container
  const handleContainerRef = (ref) => {
    setVisualizationRef(ref);
    if (ref) {
      initializeVisualization(ref);
    }
  };

  // Context value
  const value = {
    containerRef: handleContainerRef,
    selectedNode,
    hoveredNode,
    expandedNodes,
    visibleNodes,
    activeSphereName,
    viewMode,
    isLoading,
    error,
    
    // Expose visualization actions
    selectNode: (nodeId) => visualizationManager?.selectNode(nodeId),
    expandNode: (nodeId) => visualizationManager?.expandNode(nodeId),
    collapseNode: (nodeId) => visualizationManager?.collapseNode(nodeId),
    zoomToNode: (nodeId) => visualizationManager?.zoomToNode(nodeId),
    zoomToFit: () => visualizationManager?.zoomToFit(),
    setViewMode: (mode) => visualizationManager?.setViewMode(mode),
    setActiveSphereName: (name) => visualizationManager?.setActiveSphereName(name),
    refreshVisualization: () => visualizationManager?.refresh(),
  };

  return (
    <VisualizationContext.Provider value={value}>
      {children}
    </VisualizationContext.Provider>
  );
};

// Custom hook to use visualization context
export const useVisualization = () => {
  const context = useContext(VisualizationContext);
  if (!context) {
    throw new Error('useVisualization must be used within a VisualizationProvider');
  }
  return context;
};

/**
 * VisualizationManager serves as the central coordinator for the 3D visualization.
 * It manages all visualization subsystems and handles the global visualization state.
 * It now also integrates style management functionality.
 */
class VisualizationManager {
  constructor() {
    this.sceneManager = null;
    this.cameraController = null;
    this.nodeRenderer = null;
    this.linkRenderer = null;
    this.interactionManager = null;
    this.layoutEngine = null;
    this.animationController = null;
    this.sphereManager = null;
    this.colorManager = null;
    this.nodeConnectionManager = null;
    
    this.graphDataGenerator = null;
    this.nodeRepository = null;
    
    this.container = null;
    this.isInitialized = false;
    this.isRunning = false;
    
    // Visualization state
    this.state = {
      selectedNode: null,
      hoveredNode: null,
      expandedNodes: new Set(),
      visibleNodes: new Set(),
      activeSphereName: null,
      viewMode: 'default',
      renderMode: '3d'
    };
    
    // Event listeners
    this.listeners = {};
    
    // Data state
    this.nodes = [];
    this.links = [];
    this.nodeMap = new Map();
    this.linkMap = new Map();
    
    // Style configuration - integrated from StyleManager
    this.nodeSizes = {
      // Base sizes by node type
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
      default: 10,
      
      // Size reduction per level
      levelReduction: 0.8,
      minSize: 3,
      baseSize: 10
    };
    
    // Line width settings
    this.lineWidths = {
      contains: 2.0,
      implements: 1.5,
      depends_on: 1.0,
      integration_point: 1.5,
      data_flow: 1.0,
      refers_to: 1.0,
      influences: 1.2,
      alternative_to: 1.0,
      obsoletes: 1.0,
      generic: 1.0,
      default: 1.0
    };
    
    // Line dash patterns
    this.dashPatterns = {
      contains: null,              // Solid line
      implements: [3, 3],          // Dashed
      depends_on: [6, 3],          // Long dash
      integration_point: [3, 3, 10, 3], // Dash-dot
      data_flow: [2, 2],           // Dotted
      refers_to: [5, 3, 1, 3],     // Dash-dot-dot
      influences: [8, 3, 3, 3],    // Long dash short dash
      alternative_to: [5, 5],      // Equal dashes
      obsoletes: [2, 2, 6, 2],     // Dot long dash dot
      generic: null,               // Solid line
      default: null                // Solid line
    };
    
    // Relationship type descriptions
    this.relationshipDescriptions = {
      contains: 'Contains/Parent-Child',
      implements: 'Implements/Realizes',
      depends_on: 'Depends On',
      integration_point: 'Integration Point',
      data_flow: 'Data Flow',
      refers_to: 'Refers To',
      influences: 'Influences',
      alternative_to: 'Alternative To',
      obsoletes: 'Obsoletes/Replaces',
      generic: 'Generic Relationship',
      default: 'Unknown Relationship Type'
    };
    
    // Node geometries by type
    this.nodeGeometries = {
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
   * Initialize the visualization manager and all subsystems
   * @param {HTMLElement} container - DOM container for the visualization
   * @returns {Promise<boolean>} Initialization success
   */
  async initialize(container) {
    if (this.isInitialized) return true;
    
    try {
      this.container = container;
      
      // Get data services from registry
      this.graphDataGenerator = registry.getModule('data.GraphDataGenerator');
      this.nodeRepository = registry.getModule('data.NodeRepository');
      
      if (!this.graphDataGenerator || !this.nodeRepository) {
        throw new Error('Required data services not found');
      }
      
      // Initialize data services if needed
      if (this.graphDataGenerator.initialize) {
        await this.graphDataGenerator.initialize();
      }
      
      if (this.nodeRepository.initialize) {
        await this.nodeRepository.initialize();
      }
      
      // Initialize visualization subsystems in the correct order
      
      // 1. Scene Manager - creates and manages the THREE.js scene
      this.sceneManager = registry.getModule('visualization.SceneManager');
      if (!this.sceneManager) {
        throw new Error('SceneManager not found in registry');
      }
      await this.sceneManager.initialize(container);
      
      // 2. Camera Controller - manages camera movement and controls
      this.cameraController = registry.getModule('visualization.CameraController');
      if (this.cameraController) {
        await this.cameraController.initialize(
          this.sceneManager.getScene(),
          this.sceneManager.getRenderer()
        );
      }
      
      // 3. Color Manager - provides consistent coloring for nodes and links
      this.colorManager = registry.getModule('visualization.ColorManager');
      
      // 4. Layout Engine - positions nodes based on hierarchy
      this.layoutEngine = registry.getModule('visualization.LayoutEngine');
      
      // 5. Node Renderer - creates and manages node objects
      this.nodeRenderer = registry.getModule('visualization.NodeRenderer');
      if (this.nodeRenderer) {
        await this.nodeRenderer.initialize(
          this.sceneManager.getScene(),
          this.colorManager || null,
          this // Pass VisualizationManager for styling
        );
      }
      
      // 6. Link Renderer - creates and manages link objects
      this.linkRenderer = registry.getModule('visualization.LinkRenderer');
      if (this.linkRenderer) {
        await this.linkRenderer.initialize(
          this.sceneManager.getScene(),
          this.colorManager || null,
          this // Pass VisualizationManager for styling
        );
      }
      
      // 7. Animation Controller - manages transitions and animations
      this.animationController = registry.getModule('visualization.AnimationController');
      if (this.animationController) {
        await this.animationController.initialize();
      }
      
      // 8. Interaction Manager - handles user input
      this.interactionManager = registry.getModule('visualization.InteractionManager');
      if (this.interactionManager) {
        await this.interactionManager.initialize(
          this.container,
          this.sceneManager.getRenderer(),
          this.sceneManager.getCamera(),
          this
        );
      }
      
      // 9. Sphere Manager - manages multiple visualization spheres
      this.sphereManager = registry.getModule('visualization.SphereManager');
      if (this.sphereManager) {
        await this.sphereManager.initialize(this);
      }
      
      // 10. Node Connection Manager - handles node relationship connections
      this.nodeConnectionManager = registry.getModule('visualization.NodeConnectionManager');
      if (this.nodeConnectionManager) {
        await this.nodeConnectionManager.initialize(this);
      }
      
      // Store reference to the EventBus with fallback to direct import
      this.eventBus = registry.getModule('utils.EventBus') || EventBus;
      if (!this.eventBus) {
        console.warn('EventBus not available, some features may be limited');
      }
      
      // Set up event handling for subsystems
      this.setupEventHandling();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Visualization initialization failed:', error);
      this.triggerEvent('error', { message: 'Failed to initialize visualization', error });
      return false;
    }
  }
  
  /**
   * Set up event handling for visualization subsystems
   */
  setupEventHandling() {
    // Listen for scene manager events
    if (this.sceneManager) {
      this.sceneManager.addEventListener('render', this.handleRender.bind(this));
    }
    
    // Listen for interaction events
    if (this.interactionManager) {
      this.interactionManager.addEventListener('nodeClick', this.handleNodeClick.bind(this));
      this.interactionManager.addEventListener('nodeHover', this.handleNodeHover.bind(this));
      this.interactionManager.addEventListener('nodeDoubleClick', this.handleNodeDoubleClick.bind(this));
      this.interactionManager.addEventListener('backgroundClick', this.handleBackgroundClick.bind(this));
    }
    
    // Subscribe to relevant events from the event bus
    if (this.eventBus) {
      this.eventBus.subscribe('data:nodesUpdated', this.handleNodesUpdated.bind(this));
      this.eventBus.subscribe('data:nodeSelected', this.handleExternalNodeSelect.bind(this));
    }
  }
  
  /**
   * Handle render events from the scene manager
   * @param {Object} data - Render event data
   */
  handleRender(data) {
    // Trigger render event for subscribers
    this.triggerEvent('render', data);
  }
  
  /**
   * Handle node click events from the interaction manager
   * @param {Object} data - Node click event data
   */
  handleNodeClick(data) {
    const { nodeId } = data;
    this.selectNode(nodeId);
  }
  
  /**
   * Handle node hover events from the interaction manager
   * @param {Object} data - Node hover event data
   */
  handleNodeHover(data) {
    const { nodeId } = data;
    this.setHoveredNode(nodeId);
  }
  
  /**
   * Handle node double-click events from the interaction manager
   * @param {Object} data - Node double-click event data
   */
  handleNodeDoubleClick(data) {
    const { nodeId } = data;
    this.toggleNodeExpansion(nodeId);
  }
  
  /**
   * Handle background click events from the interaction manager
   */
  handleBackgroundClick() {
    this.clearSelection();
  }
  
  /**
   * Handle data updates from the event bus
   * @param {Object} data - Updated nodes data
   */
  handleNodesUpdated(data) {
    // Reload visualization data
    this.loadData(data.nodes || [], data.links || []);
  }
  
  /**
   * Handle external node selection events
   * @param {Object} data - Node selection data
   */
  handleExternalNodeSelect(data) {
    this.selectNode(data.nodeId);
  }
  
  /**
   * Start the visualization render loop
   */
  start() {
    if (!this.isInitialized) {
      console.error('Cannot start visualization: not initialized');
      return;
    }
    
    if (this.isRunning) return;
    
    // Start the scene manager's render loop
    this.sceneManager.startRenderLoop(this.update.bind(this));
    this.isRunning = true;
  }
  
  /**
   * Stop the visualization render loop
   */
  stop() {
    if (!this.isRunning) return;
    
    this.sceneManager.stopRenderLoop();
    this.isRunning = false;
  }
  
  /**
   * Update the visualization (called each frame)
   * @param {number} timestamp - Current timestamp
   * @param {number} delta - Time since last frame
   */
  update(timestamp, delta) {
    // Update animation controller
    if (this.animationController) {
      this.animationController.update(timestamp, delta);
    }
    
    // Update layout if needed
    if (this.layoutEngine && this.layoutEngine.needsUpdate) {
      this.layoutEngine.update(delta);
    }
    
    // Update node renderer
    if (this.nodeRenderer) {
      this.nodeRenderer.update(timestamp, delta);
    }
    
    // Update link renderer
    if (this.linkRenderer) {
      this.linkRenderer.update(timestamp, delta);
    }
    
    // Trigger update event for subscribers
    this.triggerEvent('update', { timestamp, delta });
  }
  
  /**
   * Load visualization data
   * @param {Array} nodes - Node data
   * @param {Array} links - Link data
   * @returns {Promise<boolean>} Success indicator
   */
  async loadData(nodes = [], links = []) {
    if (!this.isInitialized) {
      console.error('Cannot load data: visualization not initialized');
      return false;
    }
    
    try {
      // Store raw data
      this.nodes = nodes;
      this.links = links;
      
      // Create maps for quick lookups
      this.nodeMap = new Map(nodes.map(node => [node.id, node]));
      this.linkMap = new Map(links.map(link => [
        link.id || `${link.source}-${link.target}`, 
        link
      ]));
      
      // Generate graph data using the graph data generator
      if (!this.graphDataGenerator) {
        this.graphDataGenerator = registry.getModule('data.GraphDataGenerator');
        
        if (!this.graphDataGenerator) {
          throw new Error('GraphDataGenerator not found in registry');
        }
        
        // Initialize if needed
        if (!this.graphDataGenerator.isInitialized && this.graphDataGenerator.initialize) {
          await this.graphDataGenerator.initialize();
        }
      }
      
      // Generate visualization data
      const graphData = await this.graphDataGenerator.generateGraphData(nodes, links);
      
      // Clear existing visualization
      this.clearVisualization();
      
      // Load new data into renderers
      if (this.nodeRenderer) {
        await this.nodeRenderer.loadNodes(graphData.nodes);
      }
      
      if (this.linkRenderer) {
        await this.linkRenderer.loadLinks(graphData.links);
      }
      
      // Initialize layout engine with the new data
      if (this.layoutEngine) {
        await this.layoutEngine.initialize(graphData.nodes, graphData.links);
        this.layoutEngine.calculateLayout();
      }
      
      // Set up initial visible nodes (roots)
      const rootNodes = nodes.filter(node => !node.parent);
      this.state.visibleNodes = new Set(rootNodes.map(node => node.id));
      
      // Set initial active sphere if sphere manager exists
      if (this.sphereManager && this.sphereManager.spheres.length > 0) {
        this.state.activeSphereName = this.sphereManager.spheres[0].name;
      }
      
      // Update components with the new state
      this.updateComponents();
      
      // Trigger data loaded event
      this.triggerEvent('dataLoaded', { nodeCount: nodes.length, linkCount: links.length });
      
      // Publish event to eventbus
      if (this.eventBus) {
        this.eventBus.publish('visualization:dataLoaded', { 
          nodeCount: nodes.length, 
          linkCount: links.length 
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load visualization data:', error);
      this.triggerEvent('error', { message: 'Failed to load visualization data', error });
      
      // Publish error to eventbus
      if (this.eventBus) {
        this.eventBus.publish('visualization:error', {
          message: 'Failed to load visualization data',
          error
        });
      }
      
      return false;
    }
  }
  
  /**
   * Clear all visualization objects but keep the scene
   */
  clearVisualization() {
    // Clear renderers
    if (this.nodeRenderer) {
      this.nodeRenderer.clear();
    }
    
    if (this.linkRenderer) {
      this.linkRenderer.clear();
    }
    
    // Reset state
    this.state.selectedNode = null;
    this.state.hoveredNode = null;
    this.state.expandedNodes = new Set();
    this.state.visibleNodes = new Set();
    
    // Update components
    this.updateComponents();
  }
  
  /**
   * Update visualization components based on current state
   */
  updateComponents() {
    // Update node visibility
    if (this.nodeRenderer) {
      this.nodeRenderer.updateVisibility(this.state.visibleNodes);
    }
    
    // Update link visibility
    if (this.linkRenderer) {
      this.linkRenderer.updateVisibility(this.state.visibleNodes);
    }
    
    // Update selected node highlight
    if (this.nodeRenderer && this.state.selectedNode) {
      this.nodeRenderer.highlightNode(this.state.selectedNode, 'selected');
    }
    
    // Update hovered node highlight
    if (this.nodeRenderer && this.state.hoveredNode) {
      this.nodeRenderer.highlightNode(this.state.hoveredNode, 'hovered');
    }
    
    // Update active sphere
    if (this.sphereManager && this.state.activeSphereName) {
      this.sphereManager.activateSphere(this.state.activeSphereName);
    }
  }
  
  /**
   * Select a node
   * @param {string} nodeId - ID of the node to select
   */
  selectNode(nodeId) {
    // Check if the node exists
    if (!nodeId || !this.nodeMap.has(nodeId)) {
      this.clearSelection();
      return;
    }
    
    const node = this.nodeMap.get(nodeId);
    
    // Update state
    this.state.selectedNode = nodeId;
    
    // Update components
    this.updateComponents();
    
    // Trigger event
    this.triggerEvent('nodeSelect', node);
  }
  
  /**
   * Clear current node selection
   */
  clearSelection() {
    const previousSelection = this.state.selectedNode;
    
    // Clear selection in state
    this.state.selectedNode = null;
    
    // Update components
    this.updateComponents();
    
    // Trigger event if there was a selection
    if (previousSelection) {
      this.triggerEvent('nodeSelect', null);
    }
  }
  
  /**
   * Set hovered node
   * @param {string} nodeId - ID of the node being hovered
   */
  setHoveredNode(nodeId) {
    // Skip if it's the same node
    if (this.state.hoveredNode === nodeId) return;
    
    // Check if the node exists
    const node = nodeId ? this.nodeMap.get(nodeId) : null;
    
    // Update state
    this.state.hoveredNode = nodeId;
    
    // Update components
    this.updateComponents();
    
    // Trigger event
    this.triggerEvent('nodeHover', node);
  }
  
  /**
   * Toggle node expansion state
   * @param {string} nodeId - ID of the node to toggle
   */
  toggleNodeExpansion(nodeId) {
    // Check if the node exists
    if (!nodeId || !this.nodeMap.has(nodeId)) return;
    
    const isExpanded = this.state.expandedNodes.has(nodeId);
    
    if (isExpanded) {
      this.collapseNode(nodeId);
    } else {
      this.expandNode(nodeId);
    }
  }
  
  /**
   * Expand a node to show its children
   * @param {string} nodeId - ID of the node to expand
   */
  expandNode(nodeId) {
    // Check if the node exists and isn't already expanded
    if (!nodeId || !this.nodeMap.has(nodeId) || this.state.expandedNodes.has(nodeId)) return;
    
    const node = this.nodeMap.get(nodeId);
    
    // Add to expanded nodes
    this.state.expandedNodes.add(nodeId);
    
    // Add child nodes to visible nodes
    const childNodes = this.nodes.filter(n => n.parent === nodeId);
    childNodes.forEach(child => {
      this.state.visibleNodes.add(child.id);
    });
    
    // Update components
    this.updateComponents();
    
    // Recalculate layout
    if (this.layoutEngine) {
      this.layoutEngine.invalidateLayout();
      this.layoutEngine.calculateLayout();
    }
    
    // Trigger event
    this.triggerEvent('nodeExpand', {
      nodeId,
      expandedNodes: Array.from(this.state.expandedNodes),
      children: childNodes.map(child => child.id)
    });
  }
  
  /**
   * Collapse a node to hide its children
   * @param {string} nodeId - ID of the node to collapse
   */
  collapseNode(nodeId) {
    // Check if the node exists and is expanded
    if (!nodeId || !this.nodeMap.has(nodeId) || !this.state.expandedNodes.has(nodeId)) return;
    
    const node = this.nodeMap.get(nodeId);
    
    // Remove from expanded nodes
    this.state.expandedNodes.delete(nodeId);
    
    // Remove child nodes from visible nodes (recursively)
    this.removeDescendantsFromVisible(nodeId);
    
    // Update components
    this.updateComponents();
    
    // Recalculate layout
    if (this.layoutEngine) {
      this.layoutEngine.invalidateLayout();
      this.layoutEngine.calculateLayout();
    }
    
    // Trigger event
    this.triggerEvent('nodeCollapse', {
      nodeId,
      expandedNodes: Array.from(this.state.expandedNodes)
    });
  }
  
  /**
   * Recursively remove descendant nodes from the visible set
   * @param {string} nodeId - ID of the parent node
   */
  removeDescendantsFromVisible(nodeId) {
    // Find direct children
    const children = this.nodes.filter(node => node.parent === nodeId);
    
    // For each child, recursively remove its descendants
    children.forEach(child => {
      // Remove the child from visible nodes
      this.state.visibleNodes.delete(child.id);
      
      // If this child was expanded, remove its descendants too
      if (this.state.expandedNodes.has(child.id)) {
        this.removeDescendantsFromVisible(child.id);
        this.state.expandedNodes.delete(child.id);
      }
    });
  }
  
  /**
   * Zoom to a specific node
   * @param {string} nodeId - ID of the node to zoom to
   */
  zoomToNode(nodeId) {
    // Check if node exists
    if (!nodeId || !this.nodeMap.has(nodeId) || !this.nodeRenderer) return;
    
    // Get node object from renderer
    const nodeObject = this.nodeRenderer.getNodeObject(nodeId);
    if (!nodeObject) return;
    
    // Use camera controller to zoom to the node
    if (this.cameraController) {
      this.cameraController.focusOnObject(nodeObject, {
        duration: 1000,
        easing: 'easeInOutQuad'
      });
    }
  }
  
  /**
   * Zoom to fit all visible nodes
   */
  zoomToFit() {
    if (!this.nodeRenderer || !this.cameraController) return;
    
    // Get all visible node objects
    const visibleNodeObjects = Array.from(this.state.visibleNodes)
      .map(nodeId => this.nodeRenderer.getNodeObject(nodeId))
      .filter(Boolean);
    
    if (visibleNodeObjects.length === 0) return;
    
    // Use camera controller to fit all objects
    this.cameraController.fitToObjects(visibleNodeObjects, {
      padding: 1.5,
      duration: 1000,
      easing: 'easeInOutQuad'
    });
  }
  
  /**
   * Set the active view mode
   * @param {string} mode - View mode ('default', '2d', 'hierarchical', etc.)
   */
  setViewMode(mode) {
    if (this.state.viewMode === mode) return;
    
    // Update state
    this.state.viewMode = mode;
    
    // Update layout engine mode
    if (this.layoutEngine) {
      this.layoutEngine.setLayoutMode(mode);
      this.layoutEngine.invalidateLayout();
      this.layoutEngine.calculateLayout();
    }
    
    // Trigger event
    this.triggerEvent('viewModeChange', mode);
  }
  
  /**
   * Set the active sphere
   * @param {string} sphereName - Name of the sphere to activate
   */
  setActiveSphereName(sphereName) {
    if (this.state.activeSphereName === sphereName) return;
    
    // Check if sphere exists
    if (this.sphereManager && !this.sphereManager.hasSphere(sphereName)) {
      return;
    }
    
    // Update state
    this.state.activeSphereName = sphereName;
    
    // Update sphere manager
    if (this.sphereManager) {
      this.sphereManager.activateSphere(sphereName);
    }
    
    // Trigger event
    this.triggerEvent('activeSphereChange', sphereName);
  }
  
  /**
   * Add event listener
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
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  removeEventListener(event, callback) {
    if (!this.listeners[event]) return;
    
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }
  
  /**
   * Trigger an event and notify all listeners
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  triggerEvent(event, data) {
    // First, notify internal listeners
    if (this.listeners[event]) {
      for (const callback of this.listeners[event]) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
    
    // Next, publish to the EventBus if available
    if (this.eventBus) {
      try {
        this.eventBus.publish(`visualization:${event}`, data);
      } catch (error) {
        console.error(`Error publishing event to EventBus: ${event}`, error);
      }
    }
  }
  
  /**
   * Refresh the visualization
   */
  refresh() {
    // Recalculate layout
    if (this.layoutEngine) {
      this.layoutEngine.invalidateLayout();
      this.layoutEngine.calculateLayout();
    }
    
    // Update components
    this.updateComponents();
    
    // Trigger refresh event
    this.triggerEvent('refresh', null);
  }
  
  /**
   * Resize the visualization
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    if (!this.isInitialized) return;
    
    // Update scene manager
    this.sceneManager.resize(width, height);
    
    // Update camera
    if (this.cameraController) {
      this.cameraController.updateCameraAspect(width / height);
    }
  }
  
  /**
   * Clean up resources when the visualization is destroyed
   */
  dispose() {
    // Stop the render loop
    this.stop();
    
    // Dispose scene manager resources
    if (this.sceneManager) {
      this.sceneManager.dispose();
    }
    
    // Clean up other subsystems
    if (this.interactionManager) {
      this.interactionManager.dispose();
    }
    
    if (this.nodeRenderer) {
      this.nodeRenderer.dispose();
    }
    
    if (this.linkRenderer) {
      this.linkRenderer.dispose();
    }
    
    // Clear event listeners
    this.listeners = {};
    
    this.isInitialized = false;
    this.isRunning = false;
  }
  
  /**
   * Get the current visualization state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Set a new visualization state
   * @param {Object} newState - New state to apply
   */
  setState(newState) {
    this.state = {
      ...this.state,
      ...newState
    };
    
    // Update components based on new state
    this.updateComponents();
  }
  
  /**
   * Style Management Methods - Integrated from StyleManager
   */
  
  /**
   * Get node size based on type and level
   * 
   * @param {string} nodeType - Type of node
   * @param {number} level - Hierarchy level of node
   * @returns {number} Node size
   */
  getNodeSize(nodeType, level) {
    // Start with type-specific size if available
    const baseSize = this.nodeSizes[nodeType] || this.nodeSizes.default;
    
    // Apply level reduction
    if (level > 0) {
      return Math.max(baseSize - (level * this.nodeSizes.levelReduction), this.nodeSizes.minSize);
    }
    
    return baseSize;
  }
  
  /**
   * Get node color based on type
   * 
   * @param {string} nodeType - Type of node
   * @returns {string} Hex color code
   */
  getNodeColor(nodeType) {
    if (this.colorManager) {
      return this.colorManager.getNodeTypeColorAsCss(nodeType);
    }
    
    // Fallback colors if color manager is not available
    const colors = {
      component_group: '#4A90E2',
      component: '#50C878',
      subcomponent: '#9B59B6',
      capability: '#E67E22',
      function: '#E74C3C',
      specification: '#F1C40F',
      integration: '#16A085',
      technique: '#2ECC71',
      application: '#3498DB',
      input: '#5499C7',
      output: '#F39C12',
      unknown: '#CCCCCC'
    };
    
    return colors[nodeType] || colors.unknown;
  }
  
  /**
   * Get node color as THREE.Color
   * 
   * @param {string} nodeType - Type of node
   * @returns {THREE.Color} THREE.js color
   */
  getNodeColorAsThree(nodeType) {
    const colorHex = this.getNodeColor(nodeType);
    return new THREE.Color(colorHex);
  }
  
  /**
   * Get relationship color based on type
   * 
   * @param {string} relationType - Type of relationship
   * @returns {string} Hex color code
   */
  getRelationshipColor(relationType) {
    if (this.colorManager) {
      return this.colorManager.getRelationshipColorAsCss(relationType);
    }
    
    // Fallback colors if color manager is not available
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
    
    return colors[relationType] || colors.generic;
  }
  
  /**
   * Get line width based on relationship type
   * 
   * @param {string} relationType - Type of relationship
   * @returns {number} Line width
   */
  getLineWidth(relationType) {
    return this.lineWidths[relationType] || this.lineWidths.default;
  }
  
  /**
   * Get dash pattern based on relationship type
   * 
   * @param {string} relationType - Type of relationship
   * @returns {Array|null} Dash pattern or null for solid line
   */
  getDashPattern(relationType) {
    return this.dashPatterns[relationType] || this.dashPatterns.default;
  }
  
  /**
   * Get relationship description
   * 
   * @param {string} relationType - Type of relationship
   * @returns {string} Description of the relationship type
   */
  getRelationshipDescription(relationType) {
    return this.relationshipDescriptions[relationType] || this.relationshipDescriptions.default;
  }
  
  /**
   * Get node geometry type
   * 
   * @param {string} nodeType - Type of node
   * @returns {string} Geometry type name
   */
  getNodeGeometryType(nodeType) {
    return this.nodeGeometries[nodeType] || this.nodeGeometries.default;
  }
  
  /**
   * Get complete visual properties for a node
   * 
   * @param {Object} node - Node data
   * @returns {Object} Visual properties
   */
  getNodeVisualProperties(node) {
    const isEncrypted = node.isEncrypted && (!node._encryptionStatus || !node._encryptionStatus.isDecrypted);
    const hasPermissionIssue = typeof node.currentUserHasPermission === 'function' 
      ? !node.currentUserHasPermission('view')
      : false;
    
    return {
      color: this.getNodeColor(node.type),
      size: this.getNodeSize(node.type, node.level),
      opacity: node.visible ? 1.0 : 0.3,
      geometryType: this.getNodeGeometryType(node.type),
      position: node.position || { x: 0, y: 0, z: 0 },
      locked: isEncrypted,
      hasPermissionIssue: hasPermissionIssue
    };
  }
  
  /**
   * Get complete visual properties for a relationship
   * 
   * @param {Object} relationship - Relationship data
   * @returns {Object} Visual properties
   */
  getRelationshipVisualProperties(relationship) {
    const isEncrypted = relationship.isEncrypted && 
      (!relationship._encryptionStatus || !relationship._encryptionStatus.isDecrypted);
    
    const hasPermissionIssue = typeof relationship.currentUserHasPermission === 'function'
      ? !relationship.currentUserHasPermission('view')
      : false;
    
    return {
      color: this.getRelationshipColor(relationship.type),
      lineWidth: this.getLineWidth(relationship.type),
      opacity: relationship.visible ? 1.0 : 0.0,
      dashPattern: this.getDashPattern(relationship.type),
      highlight: relationship.highlight || false,
      isEncrypted: isEncrypted,
      hasPermissionIssue: hasPermissionIssue,
      description: this.getRelationshipDescription(relationship.type)
    };
  }
}

export default registry.register(
  'visualization.VisualizationManager',
  new VisualizationManager(),
  [
    'data.GraphDataGenerator',
    'data.NodeRepository',
    'visualization.SceneManager',
    'visualization.CameraController',
    'visualization.ColorManager',
    'visualization.NodeRenderer',
    'visualization.LinkRenderer',
    'visualization.LayoutEngine',
    'visualization.InteractionManager',
    'visualization.AnimationController',
    'visualization.SphereManager',
    'visualization.NodeConnectionManager',
    'utils.EventBus'
  ],
  {
    description: 'Central coordinator for the 3D visualization with integrated style management',
    singleton: true
  }
); 