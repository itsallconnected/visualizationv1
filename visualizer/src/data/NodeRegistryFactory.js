/**
 * NodeRegistryFactory provides a centralized factory for creating and registering
 * different types of node objects from data. It maps node types to their
 * appropriate class implementations.
 */
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

class NodeRegistryFactory {
  constructor() {
    this.nodeTypes = new Map();
    this.nodeTypesByLevel = new Map();
    this.encryptionService = null;
    this.nodeProtectionManager = null;
    this.eventBus = null;
    this.initialized = false;
  }

  /**
   * Initialize the node registry
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Get required services
      this.encryptionService = registry.getModule('encryption.EncryptionService');
      this.nodeProtectionManager = registry.getModule('encryption.NodeProtectionManager');
      this.eventBus = registry.getModule('utils.EventBus') || EventBus;
      
      // Get all node model classes from the registry
      const modules = registry.getAllModules();
      
      // Look for modules in the data.models namespace
      Object.keys(modules).forEach(moduleName => {
        if (moduleName.startsWith('data.models.') && moduleName !== 'data.models.Node') {
          const nodeClass = modules[moduleName];
          const metadata = registry.getMetadata(moduleName);
          
          if (metadata) {
            const nodeType = this.getNodeTypeName(moduleName);
            
            // Register by node type
            this.nodeTypes.set(nodeType, {
              class: nodeClass,
              level: metadata.level || 0,
              metadata
            });
            
            // Register by level
            const level = metadata.level || 0;
            if (!this.nodeTypesByLevel.has(level)) {
              this.nodeTypesByLevel.set(level, []);
            }
            this.nodeTypesByLevel.get(level).push({
              type: nodeType,
              class: nodeClass,
              metadata
            });
          }
        }
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      console.log('NodeRegistryFactory initialized');
    } catch (error) {
      console.error('Failed to initialize NodeRegistryFactory:', error);
      throw new Error('NodeRegistryFactory initialization failed: ' + error.message);
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
  }

  /**
   * Handle node decrypted event
   * @param {Object} event - Decryption event
   * @private
   */
  handleNodeDecrypted(event) {
    // We don't need to do anything here currently, but in the future
    // we might want to maintain a cache of nodes that could be affected
  }

  /**
   * Handle node locked event
   * @param {Object} event - Lock event
   * @private
   */
  handleNodeLocked(event) {
    // We don't need to do anything here currently
  }

  /**
   * Extract node type name from module name
   * @param {string} moduleName - Full module name (e.g., 'data.models.ComponentNode')
   * @returns {string} Node type (e.g., 'component')
   * @private
   */
  getNodeTypeName(moduleName) {
    // Convert CamelCase to snake_case for node types
    const className = moduleName.split('.').pop().replace('Node', '');
    return className
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Create a node instance from data
   * @param {Object} nodeData - Raw node data
   * @param {Object} options - Options for creation
   * @returns {Object} Appropriate node instance
   */
  createNode(nodeData, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }
    
    // Create a copy of the data to avoid modifying the original
    const nodeCopy = { ...nodeData };
    
    // Check if node is encrypted and should be decrypted
    if (nodeCopy.encrypted && this.encryptionService && options.decryptLevel) {
      // Process the node through the encryption service
      nodeCopy = this.encryptionService.processNode(nodeCopy, options.decryptLevel);
    }
    
    const nodeType = nodeCopy.type;
    const nodeInfo = this.nodeTypes.get(nodeType);
    
    if (nodeInfo && nodeInfo.class) {
      return new nodeInfo.class(nodeCopy);
    } else {
      // Log warning about unknown node type
      console.warn(`Unknown node type: ${nodeType}, using default`);
      
      // Get the default node class (base Node or ComponentGroupNode)
      const Node = registry.getModule('data.models.Node');
      return new Node(nodeCopy);
    }
  }

  /**
   * Create multiple nodes from raw data
   * @param {Array} nodesData - Array of raw node data
   * @param {Object} options - Options for creation
   * @returns {Array} Array of node instances
   */
  createNodes(nodesData, options = {}) {
    return nodesData.map(nodeData => this.createNode(nodeData, options));
  }

  /**
   * Get all registered node types
   * @returns {Array} Array of node type info objects
   */
  getAllNodeTypes() {
    if (!this.initialized) {
      this.initialize();
    }
    
    return Array.from(this.nodeTypes.entries()).map(([type, info]) => ({
      type,
      level: info.level,
      metadata: info.metadata
    }));
  }

  /**
   * Get node types at a specific level
   * @param {number} level - Hierarchy level
   * @returns {Array} Array of node type info objects
   */
  getNodeTypesByLevel(level) {
    if (!this.initialized) {
      this.initialize();
    }
    
    return this.nodeTypesByLevel.get(level) || [];
  }

  /**
   * Get child node types for a parent type
   * @param {string} parentType - Parent node type
   * @returns {Array} Array of valid child node types
   */
  getChildNodeTypes(parentType) {
    if (!this.initialized) {
      this.initialize();
    }
    
    const parentInfo = this.nodeTypes.get(parentType);
    if (!parentInfo) return [];
    
    const parentLevel = parentInfo.level;
    const childLevel = parentLevel + 1;
    
    // Get node types at the child level
    const childTypes = this.getNodeTypesByLevel(childLevel);
    
    // Filter to only include valid children
    return childTypes.filter(childInfo => {
      // Check if this child has a parent type restriction
      if (childInfo.metadata.parentType) {
        return childInfo.metadata.parentType === parentType;
      }
      return true;
    });
  }

  /**
   * Create a new empty node of the specified type
   * @param {string} type - Node type
   * @param {Object} baseData - Base data to include
   * @param {Object} options - Additional options
   * @returns {Object} New node instance
   */
  createEmptyNode(type, baseData = {}, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }
    
    const nodeInfo = this.nodeTypes.get(type);
    if (!nodeInfo) {
      throw new Error(`Unknown node type: ${type}`);
    }
    
    // Create minimal data for the node
    const nodeData = {
      id: this.generateTempId(),
      name: `New ${type.replace(/_/g, ' ')}`,
      type,
      description: '',
      encrypted: options.encrypted === true,
      access_level: options.accessLevel || 'public',
      ...baseData
    };
    
    // Apply encryption if needed
    if (options.encrypted && this.encryptionService && options.encryptionOptions) {
      try {
        const encryptedData = this.encryptionService.encryptNode(nodeData, options.encryptionOptions);
        return this.createNode(encryptedData, options);
      } catch (error) {
        console.error('Error encrypting new node:', error);
        // Continue with unencrypted node
      }
    }
    
    return this.createNode(nodeData, options);
  }

  /**
   * Generate a temporary ID for a new node
   * @returns {string} Temporary ID
   * @private
   */
  generateTempId() {
    return `temp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  
  /**
   * Dispose of the registry
   * Cleans up resources and event listeners
   */
  dispose() {
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('node:decrypted', this.handleNodeDecrypted);
      this.eventBus.unsubscribe('node:locked', this.handleNodeLocked);
    }
    
    // Clear registries
    this.nodeTypes.clear();
    this.nodeTypesByLevel.clear();
    
    // Reset initialization state
    this.initialized = false;
  }
}

export default registry.register(
  'data.NodeRegistryFactory',
  new NodeRegistryFactory(),
  [
    'encryption.EncryptionService',
    'encryption.NodeProtectionManager',
    'utils.EventBus'
  ],
  {
    description: 'Factory for creating and registering node objects',
    singleton: true
  }
);

