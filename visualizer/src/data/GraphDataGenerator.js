/**
 * GraphDataGenerator converts node data into a format suitable for visualization.
 * It handles graph structure generation, node positioning, and relationship processing.
 */
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

class GraphDataGenerator {
  constructor() {
    this.dataService = null;
    this.nodeRepository = null;
    this.encryptionService = null;
    this.nodeProtectionManager = null;
    this.eventBus = null;
    this.isInitialized = false;
    
    // Cache for generated graph data
    this.graphCache = new Map();
    
    // Default visualization options
    this.options = {
      hierarchical: true,
      nodeSize: {
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
      },
      nodeColors: {
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
        default: '#CCCCCC'
      },
      encryptedColors: {
        component_group: '#7FB5F0',
        component: '#8FDDA8',
        subcomponent: '#C29AD9',
        capability: '#F0AC78',
        function: '#F0918B',
        specification: '#F6DA7A',
        integration: '#7BC6B9',
        technique: '#8FE0A7',
        application: '#82BFED',
        input: '#92BFE0',
        output: '#F8C273',
        default: '#E0E0E0'
      },
      linkTypes: {
        contains: { color: '#999999', dashed: false, width: 1 },
        implements: { color: '#27AE60', dashed: true, width: 2 },
        depends_on: { color: '#E74C3C', dashed: true, width: 2 },
        relates_to: { color: '#3498DB', dashed: true, width: 1.5 },
        default: { color: '#AAAAAA', dashed: false, width: 1 }
      }
    };
  }

  /**
   * Initialize the graph data generator
   */
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Get required dependencies
      this.dataService = registry.getModule('data.DataService');
      this.nodeRepository = registry.getModule('data.NodeRepository');
      this.encryptionService = registry.getModule('encryption.EncryptionService');
      this.nodeProtectionManager = registry.getModule('encryption.NodeProtectionManager');
      this.eventBus = registry.getModule('utils.EventBus') || EventBus;
      
      if (!this.dataService) {
        throw new Error('DataService not found in registry');
      }
      
      // Ensure DataService is initialized
      if (this.dataService.initialize) {
        await this.dataService.initialize();
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.isInitialized = true;
      console.log('GraphDataGenerator initialized');
    } catch (error) {
      console.error('Failed to initialize GraphDataGenerator:', error);
      throw new Error('GraphDataGenerator initialization failed: ' + error.message);
    }
  }

  /**
   * Set up event listeners
   * @private
   */
  setupEventListeners() {
    if (!this.eventBus) return;
    
    // Listen for encryption events
    this.eventBus.subscribe('node:decrypted', this.handleNodeDecrypted.bind(this));
    this.eventBus.subscribe('node:locked', this.handleNodeLocked.bind(this));
    
    // Listen for node updates
    this.eventBus.subscribe('data:nodeUpdated', this.handleNodeUpdated.bind(this));
    
    // Listen for repository events
    this.eventBus.subscribe('repository:node:updated', this.handleNodeUpdated.bind(this));
  }

  /**
   * Handle node decrypted event
   * @param {Object} event - Decryption event
   * @private
   */
  handleNodeDecrypted(event) {
    if (!event || !event.nodeId) return;
    
    // Clear cache for this node's sphere
    this.clearNodeGraphCache(event.nodeId);
    
    // Publish graph update event
    this.eventBus.publish('graph:node:updated', {
      nodeId: event.nodeId,
      reason: 'decrypted'
    });
  }

  /**
   * Handle node locked event
   * @param {Object} event - Lock event
   * @private
   */
  handleNodeLocked(event) {
    if (!event || !event.nodeId) return;
    
    // Clear cache for this node's sphere
    this.clearNodeGraphCache(event.nodeId);
    
    // Publish graph update event
    this.eventBus.publish('graph:node:updated', {
      nodeId: event.nodeId,
      reason: 'locked'
    });
  }

  /**
   * Handle node updated event
   * @param {Object} event - Node update event
   * @private
   */
  handleNodeUpdated(event) {
    if (!event || !event.nodeId) return;
    
    // Clear cache for this node's sphere
    this.clearNodeGraphCache(event.nodeId);
    
    // Publish graph update event
    this.eventBus.publish('graph:node:updated', {
      nodeId: event.nodeId,
      reason: 'updated'
    });
  }

  /**
   * Clear graph cache for a specific node
   * @param {string} nodeId - Node ID
   * @private
   */
  clearNodeGraphCache(nodeId) {
    if (!nodeId) return;
    
    // Clear all cached graph data for simplicity
    // In a more optimized implementation, we could determine which sphere the node belongs to
    this.graphCache.clear();
  }

  /**
   * Generate graph data for visualization
   * @param {Array} nodes - Node data from DataService
   * @param {Array} links - Link data from DataService
   * @param {Object} options - Additional visualization options
   * @returns {Promise<Object>} Graph data object with nodes and links
   */
  async generateGraphData(nodes = [], links = [], options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const { 
        refresh = false, 
        sphere = 'ai-alignment',
        decryptLevel = 'basic',
        cacheKey = `${sphere}_${decryptLevel}`
      } = options;
      
      // Check cache first if not refreshing
      if (!refresh && this.graphCache.has(cacheKey)) {
        return this.graphCache.get(cacheKey);
      }
      
      // If no nodes/links provided, load from DataService
      if (!nodes.length || !links.length) {
        const data = await this.dataService.loadData({ 
          forceRefresh: refresh,
          sphere,
          decryptLevel
        });
        nodes = data.nodes || [];
        links = data.links || [];
      }
      
      // Process nodes into visualization format
      const processedNodes = nodes.map(node => this.processNode(node));
      
      // Process links into visualization format
      const processedLinks = links.map(link => this.processLink(link));
      
      // Generate positions if hierarchical layout
      if (options.hierarchical !== false) {
        this.assignHierarchicalPositions(processedNodes);
      }
      
      // Create result
      const result = { 
        nodes: processedNodes, 
        links: processedLinks,
        sphere,
        decryptLevel,
        timestamp: Date.now()
      };
      
      // Cache the result
      this.graphCache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error generating graph data:', error);
      throw error;
    }
  }

  /**
   * Process a node into visualization format
   * @param {Object} node - Node object
   * @returns {Object} Processed node with visualization properties
   * @private
   */
  processNode(node) {
    if (!node) return null;
    
    // Get node size based on type
    const size = this.options.nodeSize[node.type] || this.options.nodeSize.default;
    
    // Apply level factor to size (deeper nodes are smaller)
    const levelFactor = Math.max(0.6, 1 - ((node.level || 0) * 0.05));
    const adjustedSize = size * levelFactor;
    
    // Determine if node is encrypted and not decrypted
    const isEncrypted = node.encrypted === true;
    const isDecrypted = node._basic_decrypted || node._detail_decrypted || node._full_decrypted || false;
    
    // Get appropriate color based on encryption status
    const colorSet = isEncrypted && !isDecrypted ? 
                    this.options.encryptedColors : 
                    this.options.nodeColors;
                    
    const color = colorSet[node.type] || colorSet.default;
    
    return {
      id: node.id,
      name: node.name || node.id,
      type: node.type || 'default',
      level: node.level || 0,
      parent: node.parent,
      expandable: Boolean(node.children?.length > 0),
      expanded: false,
      visible: !node.parent, // Root nodes start visible
      isEncrypted: isEncrypted,
      isDecrypted: isDecrypted,
      accessLevel: node.access_level || 'public',
      // Original data
      data: node.data || node,
      // Visualization properties
      size: adjustedSize,
      color,
      opacity: isEncrypted && !isDecrypted ? 0.7 : 1.0,
      position: node.position || { x: 0, y: 0, z: 0 },
      // Add custom visualize helper methods
      visualizeWithPassword: () => {
        if (this.encryptionService && isEncrypted && !isDecrypted) {
          this.eventBus.publish('node:decryption:requested', {
            nodeId: node.id,
            keyType: 'detail'
          });
        }
      }
    };
  }

  /**
   * Process a link into visualization format
   * @param {Object} link - Link object
   * @returns {Object} Processed link with visualization properties
   * @private
   */
  processLink(link) {
    if (!link) return null;
    
    // Determine link type styling
    const type = link.type || 'default';
    const styling = this.options.linkTypes[type] || this.options.linkTypes.default;
    
    return {
      id: link.id || `${link.source}-${link.target}`,
      source: link.source,
      target: link.target,
      type: type,
      visible: type === 'contains' ? false : true, // Only non-hierarchical links start visible
      // Original data
      data: link.data || link,
      // Styling
      color: styling.color,
      dashed: styling.dashed,
      width: styling.width
    };
  }

  /**
   * Assign hierarchical positions to nodes
   * @param {Array} nodes - Nodes to position
   * @private
   */
  assignHierarchicalPositions(nodes) {
    if (!nodes || !Array.isArray(nodes)) return;
    
    // Group nodes by level
    const levelGroups = {};
    nodes.forEach(node => {
      const level = node.level || 0;
      if (!levelGroups[level]) {
        levelGroups[level] = [];
      }
      levelGroups[level].push(node);
    });
    
    // Assign positions by level
    const levels = Object.keys(levelGroups).sort((a, b) => Number(a) - Number(b));
    
    levels.forEach(level => {
      const nodesInLevel = levelGroups[level];
      const levelCount = nodesInLevel.length;
      
      // Calculate angle step for circular layout
      const angleStep = (2 * Math.PI) / levelCount;
      
      // Base radius increases with level
      const radius = 50 + (Number(level) * 30);
      
      // Position each node in the level
      nodesInLevel.forEach((node, index) => {
        // Calculate position on circle
        const angle = index * angleStep;
        const x = radius * Math.cos(angle);
        const z = radius * Math.sin(angle);
        
        // Y coordinate based on level (optional, for 3D)
        const y = Number(level) * 20; 
        
        node.position = { x, y, z };
      });
    });
  }

  /**
   * Update visibility based on node expansion state
   * @param {Object} graphData - Graph data with nodes and links
   * @param {string} nodeId - ID of expanded/collapsed node
   * @param {boolean} expanded - Whether node is expanded
   * @returns {Object} Updated graph data
   */
  updateVisibility(graphData, nodeId, expanded) {
    if (!graphData || !graphData.nodes || !graphData.links) return graphData;
    
    const { nodes, links } = graphData;
    
    // Find the node
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return graphData;
    
    // Update node expanded state
    nodes[nodeIndex].expanded = expanded;
    
    // Build a map of nodes for quick lookup
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    
    // Update visibility of child nodes recursively
    this.updateChildrenVisibility(nodeId, expanded, nodeMap, links);
    
    // Update link visibility based on connected nodes
    links.forEach(link => {
      const sourceNode = nodeMap.get(link.source);
      const targetNode = nodeMap.get(link.target);
      
      if (sourceNode && targetNode) {
        if (link.type === 'contains') {
          // Hierarchical links are visible when both ends are visible
          link.visible = sourceNode.visible && targetNode.visible;
        } else {
          // Non-hierarchical links are visible when both ends are visible
          link.visible = sourceNode.visible && targetNode.visible;
        }
      } else {
        link.visible = false;
      }
    });
    
    return { 
      ...graphData,
      nodes: Array.from(nodeMap.values()), 
      links 
    };
  }

  /**
   * Recursively update visibility of child nodes
   * @param {string} nodeId - Parent node ID
   * @param {boolean} visible - Visibility state to set
   * @param {Map} nodeMap - Map of nodes by ID
   * @param {Array} links - Links array
   * @private
   */
  updateChildrenVisibility(nodeId, visible, nodeMap, links) {
    // Find direct children based on parent-child links
    const childLinks = links.filter(link => 
      link.source === nodeId && link.type === 'contains'
    );
    
    // Update each child
    childLinks.forEach(link => {
      const childId = link.target;
      const child = nodeMap.get(childId);
      
      if (child) {
        // Set visibility based on parent's expanded state
        child.visible = visible;
        nodeMap.set(childId, child);
        
        // If parent is collapsed, collapse all descendants
        if (!visible) {
          this.updateChildrenVisibility(childId, false, nodeMap, links);
        } else if (child.expanded) {
          // If parent is expanded and child was already expanded, show child's children
          this.updateChildrenVisibility(childId, true, nodeMap, links);
        }
      }
    });
  }

  /**
   * Get graph data for a specific node's visualization
   * @param {string} nodeId - Node ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Graph data focused on the node
   */
  async getNodeGraphData(nodeId, options = {}) {
    await this.ensureInitialized();
    
    try {
      // Get the node and its connections
      const node = await this.nodeRepository.getNode(nodeId, options);
      
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }
      
      // Get all relationships for this node
      const relationships = await this.nodeRepository.getNodeRelationships(nodeId);
      
      // Get parents, children, and related nodes
      const children = await this.nodeRepository.getChildNodes(nodeId, options);
      
      // Get parent if exists
      let parent = null;
      if (node.parent) {
        parent = await this.nodeRepository.getNode(node.parent, options);
      }
      
      // Collect all node IDs we need to include
      const relatedNodeIds = new Set();
      relatedNodeIds.add(nodeId); // The node itself
      
      // Add parent
      if (parent) {
        relatedNodeIds.add(parent.id);
      }
      
      // Add children
      children.forEach(child => {
        relatedNodeIds.add(child.id);
      });
      
      // Add nodes from relationships
      relationships.forEach(rel => {
        relatedNodeIds.add(rel.source);
        relatedNodeIds.add(rel.target);
      });
      
      // Collect all nodes
      const nodes = [node];
      if (parent) nodes.push(parent);
      nodes.push(...children);
      
      // Get remaining nodes from relationships
      for (const id of relatedNodeIds) {
        if (!nodes.some(n => n.id === id)) {
          const relatedNode = await this.nodeRepository.getNode(id, options);
          if (relatedNode) {
            nodes.push(relatedNode);
          }
        }
      }
      
      // Create links
      const links = [];
      
      // Add parent-child links
      if (parent) {
        links.push({
          source: parent.id,
          target: nodeId,
          type: 'contains'
        });
      }
      
      // Add links to children
      children.forEach(child => {
        links.push({
          source: nodeId,
          target: child.id,
          type: 'contains'
        });
      });
      
      // Add relationship links
      relationships.forEach(rel => {
        if (rel.type !== 'contains') {
          links.push(rel);
        }
      });
      
      // Process into graph data
      return this.generateGraphData(nodes, links, {
        hierarchical: options.hierarchical !== false,
        refresh: true,
        cacheKey: `node_${nodeId}_${options.decryptLevel || 'detail'}`
      });
      
    } catch (error) {
      console.error(`Error getting graph data for node ${nodeId}:`, error);
      throw error;
    }
  }

  /**
   * Clear the graph cache
   */
  clearCache() {
    this.graphCache.clear();
  }

  /**
   * Update visualization options
   * @param {Object} options - New options
   */
  updateOptions(options) {
    this.options = {
      ...this.options,
      ...options
    };
    
    // Clear cache after changing options
    this.clearCache();
  }
  
  /**
   * Ensure the graph data generator is initialized
   * @private
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }
  
  /**
   * Dispose of the graph data generator
   * Cleans up resources and event listeners
   */
  dispose() {
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('node:decrypted', this.handleNodeDecrypted);
      this.eventBus.unsubscribe('node:locked', this.handleNodeLocked);
      this.eventBus.unsubscribe('data:nodeUpdated', this.handleNodeUpdated);
      this.eventBus.unsubscribe('repository:node:updated', this.handleNodeUpdated);
    }
    
    // Clear cache
    this.clearCache();
    
    // Reset initialization state
    this.isInitialized = false;
  }
}

export default registry.register(
  'data.GraphDataGenerator',
  new GraphDataGenerator(),
  [
    'data.DataService', 
    'data.NodeRepository',
    'encryption.EncryptionService',
    'encryption.NodeProtectionManager',
    'utils.EventBus'
  ],
  {
    description: 'Generates graph data structures for visualization',
    usage: 'Transforms node data into a format suitable for visualization, with support for encrypted content'
  }
);

