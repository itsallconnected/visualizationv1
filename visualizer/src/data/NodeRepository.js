/**
 * NodeRepository handles CRUD operations for node objects and provides
 * querying capabilities for relationships and node hierarchies.
 */
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';

class NodeRepository {
  constructor() {
    this.dataService = null;
    this.encryptionService = null;
    this.nodeProtectionManager = null;
    this.eventBus = null;
    this.nodes = new Map();
    this.hierarchyCache = new Map();
    this.relationshipCache = new Map();
    this.relationships = [];
    this.initialized = false;
  }
  
  /**
   * Initialize the repository
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Get required dependencies
      this.dataService = registry.getModule('data.DataService');
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
      
      // Ensure EncryptionService is initialized if available
      if (this.encryptionService && this.encryptionService.initialize) {
        await this.encryptionService.initialize();
      }
      
      // Ensure NodeProtectionManager is initialized if available
      if (this.nodeProtectionManager && this.nodeProtectionManager.initialize) {
        await this.nodeProtectionManager.initialize();
      }
      
      // Setup event listeners
      this.setupEventListeners();
      
      this.initialized = true;
      console.log('NodeRepository initialized');
    } catch (error) {
      console.error('Failed to initialize NodeRepository:', error);
      throw new Error('NodeRepository initialization failed: ' + error.message);
    }
  }
  
  /**
   * Setup event listeners
   * @private
   */
  setupEventListeners() {
    if (!this.eventBus) return;
    
    // Listen for encryption events that might affect node access
    this.eventBus.subscribe('node:decrypted', this.handleNodeDecrypted.bind(this));
    this.eventBus.subscribe('node:locked', this.handleNodeLocked.bind(this));
    
    // Listen for node protection changes
    this.eventBus.subscribe('nodeProtection:changed', this.handleProtectionChanged.bind(this));
  }
  
  /**
   * Handle node decrypted event
   * @param {Object} event - Decryption event
   * @private
   */
  handleNodeDecrypted(event) {
    if (!event || !event.nodeId) return;
    
    // Clear cache for this node to ensure we get fresh data
    this.nodes.delete(event.nodeId);
    this.clearHierarchyCache(event.nodeId);
    
    // Publish node updated event
    this.eventBus.publish('repository:node:updated', {
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
    
    // Clear cache for this node
    this.nodes.delete(event.nodeId);
    this.clearHierarchyCache(event.nodeId);
    
    // Publish node updated event
    this.eventBus.publish('repository:node:updated', {
      nodeId: event.nodeId,
      reason: 'locked'
    });
  }
  
  /**
   * Handle node protection changed event
   * @param {Object} event - Protection event
   * @private
   */
  handleProtectionChanged(event) {
    if (!event || !event.nodeId) return;
    
    // Clear cache for this node
    this.nodes.delete(event.nodeId);
    this.clearHierarchyCache(event.nodeId);
    
    // Publish node updated event
    this.eventBus.publish('repository:node:updated', {
      nodeId: event.nodeId,
      reason: 'protection_changed'
    });
  }
  
  /**
   * Clear hierarchy cache for a node
   * @param {string} nodeId - Node ID
   * @private
   */
  clearHierarchyCache(nodeId) {
    // Clear direct children cache
    this.hierarchyCache.delete(`children:${nodeId}`);
    
    // Clear cache for any parent that might contain this node
    for (const [key, value] of this.hierarchyCache.entries()) {
      if (key.startsWith('children:') && value.includes(nodeId)) {
        this.hierarchyCache.delete(key);
      }
    }
  }
  
  /**
   * Get a node by its ID
   * @param {string} nodeId - Node identifier
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} Node object
   */
  async getNode(nodeId, options = {}) {
    const { refresh = false, decryptLevel = 'detail' } = options;
    
    await this.ensureInitialized();
    
    // Check if node exists in local cache and doesn't need refresh
    if (!refresh && this.nodes.has(nodeId)) {
      const cachedNode = this.nodes.get(nodeId);
      
      // Check if we need a higher level of decryption
      if (!cachedNode.encrypted || 
          (decryptLevel === 'basic' && cachedNode._basic_decrypted) ||
          (decryptLevel === 'detail' && (cachedNode._detail_decrypted || cachedNode._full_decrypted)) ||
          (decryptLevel === 'full' && cachedNode._full_decrypted)) {
        // We have the node at the required decryption level
        return cachedNode;
      }
    }
    
    // Get from data service with the requested decrypt level
    const node = await this.dataService.getNodeDetails(nodeId, decryptLevel);
    
    // Update local cache
    if (node) {
      this.nodes.set(nodeId, node);
    }
    
    return node;
  }
  
  /**
   * Get all nodes
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Array>} Array of node objects
   */
  async getAllNodes(options = {}) {
    const { refresh = false, sphere = 'ai-alignment', decryptLevel = 'basic' } = options;
    
    await this.ensureInitialized();
    
    // Get from data service
    const data = await this.dataService.loadData({ 
      forceRefresh: refresh,
      sphere,
      decryptLevel
    });
    
    const nodes = data.nodes || [];
    
    // Update local cache
    nodes.forEach(node => {
      this.nodes.set(node.id, node);
    });
    
    return nodes;
  }
  
  /**
   * Get nodes of a specific type
   * @param {string} type - Node type
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Array>} Array of node objects
   */
  async getNodesByType(type, options = {}) {
    const allNodes = await this.getAllNodes(options);
    return allNodes.filter(node => node.type === type);
  }
  
  /**
   * Get child nodes for a parent
   * @param {string} parentId - Parent node ID
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Array>} Array of child nodes
   */
  async getChildNodes(parentId, options = {}) {
    const { refresh = false, decryptLevel = 'basic' } = options;
    
    await this.ensureInitialized();
    
    // Check hierarchy cache if not refreshing
    const cacheKey = `children:${parentId}`;
    if (!refresh && this.hierarchyCache.has(cacheKey)) {
      const childIds = this.hierarchyCache.get(cacheKey);
      
      // Get each node with appropriate decryption level
      const children = await Promise.all(
        childIds.map(id => this.getNode(id, { decryptLevel }))
      );
      
      return children.filter(Boolean); // Filter out any nulls
    }
    
    // Get all nodes and filter by parent
    const allNodes = await this.getAllNodes({ refresh, decryptLevel });
    const children = allNodes.filter(node => node.parent === parentId);
    
    // Update caches
    const childIds = children.map(node => node.id);
    this.hierarchyCache.set(cacheKey, childIds);
    
    return children;
  }
  
  /**
   * Get all descendant nodes for a parent
   * @param {string} parentId - Parent node ID
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Array>} Array of descendant nodes
   */
  async getDescendants(parentId, options = {}) {
    await this.ensureInitialized();
    
    const result = [];
    const children = await this.getChildNodes(parentId, options);
    result.push(...children);
    
    // Recursively get descendants for each child
    for (const child of children) {
      if (child.expandable || child.has_children || child.children?.length > 0) {
        const descendants = await this.getDescendants(child.id, options);
        result.push(...descendants);
      }
    }
    
    return result;
  }
  
  /**
   * Get the entire node hierarchy
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Object>} Hierarchy object with parent-child relationships
   */
  async getHierarchy(options = {}) {
    await this.ensureInitialized();
    
    const allNodes = await this.getAllNodes(options);
    const hierarchy = {};
    
    // Group nodes by parent
    allNodes.forEach(node => {
      const parentId = node.parent || 'root';
      if (!hierarchy[parentId]) {
        hierarchy[parentId] = [];
      }
      hierarchy[parentId].push(node);
    });
    
    return hierarchy;
  }
  
  /**
   * Get all relationships between nodes
   * @param {Object} options - Options for retrieval
   * @returns {Promise<Array>} Array of relationship objects
   */
  async getRelationships(options = {}) {
    const { refresh = false } = options;
    
    await this.ensureInitialized();
    
    // Check cache if not refreshing
    if (!refresh && this.relationships.length > 0) {
      return this.relationships;
    }
    
    try {
      // Get all nodes to extract relationships
      const data = await this.dataService.loadData(options);
      const nodes = data.nodes || [];
      const links = data.links || [];
      
      // Extract relationship links (non-hierarchical links)
      this.relationships = links.filter(link => link.type !== 'contains');
      
      // Also extract relationships defined in node data
      nodes.forEach(node => {
        if (node.data && node.data.relationships) {
          node.data.relationships.forEach(rel => {
            // Add relationship if not already included
            const existingRel = this.relationships.find(r => 
              r.source === node.id && 
              r.target === rel.target && 
              r.type === (rel.type || 'relates_to')
            );
            
            if (!existingRel) {
              this.relationships.push({
                source: node.id,
                target: rel.target,
                type: rel.type || 'relates_to',
                metadata: rel.metadata || {}
              });
            }
          });
        }
      });
      
      return this.relationships;
    } catch (error) {
      console.error('Error getting relationships:', error);
      return [];
    }
  }
  
  /**
   * Save a node
   * @param {Object} node - Node to save
   * @returns {Promise<Object>} Saved node
   */
  async saveNode(node) {
    await this.ensureInitialized();
    
    // Check if node is encrypted
    let nodeToSave = { ...node };
    
    // Check node protection status
    if (this.nodeProtectionManager && node.id) {
      const isProtected = this.nodeProtectionManager.isNodeProtected(node.id);
      
      if (isProtected) {
        // Check if we have necessary access
        const hasAccess = this.nodeProtectionManager.hasNodeAccess(node.id, 'detail');
        
        if (!hasAccess) {
          // Request access before saving
          this.eventBus.publish('node:decryption:requested', {
            nodeId: node.id,
            keyType: 'detail'
          });
          
          throw new Error('Node is protected. Please decrypt it before saving.');
        }
      }
    }
    
    // Save node
    const savedNode = await this.dataService.updateNode(node.id, nodeToSave);
    
    // Update local cache
    this.nodes.set(savedNode.id, savedNode);
    
    // Invalidate relevant hierarchy cache
    if (savedNode.parent) {
      this.hierarchyCache.delete(`children:${savedNode.parent}`);
    }
    
    // If node changed parent, also invalidate old parent's cache
    if (node.oldParent && node.oldParent !== savedNode.parent) {
      this.hierarchyCache.delete(`children:${node.oldParent}`);
    }
    
    return savedNode;
  }
  
  /**
   * Create a new node
   * @param {Object} nodeData - Node data
   * @returns {Promise<Object>} Created node
   */
  async createNode(nodeData) {
    // Creating a new node is just saving without an ID
    const newNode = { ...nodeData };
    delete newNode.id; // Ensure no ID for creation
    
    // Check if we need to encrypt the node
    if (newNode.encrypted && this.encryptionService) {
      // Check if encryption options are provided
      if (newNode.encryptionOptions) {
        // Use encryption service to encrypt the node
        const encryptedNode = this.encryptionService.encryptNode(newNode, newNode.encryptionOptions);
        
        // Remove encryption options from what gets saved
        delete encryptedNode.encryptionOptions;
        
        return this.saveNode(encryptedNode);
      } else {
        // Node is marked for encryption but no options provided
        throw new Error('Encryption options required for encrypted node');
      }
    }
    
    // Normal node creation
    return this.saveNode(newNode);
  }
  
  /**
   * Update an existing node
   * @param {Object} nodeData - Node data with ID
   * @returns {Promise<Object>} Updated node
   */
  async updateNode(nodeData) {
    // Must have an ID for updates
    if (!nodeData.id) {
      throw new Error('Cannot update node without ID');
    }
    
    return this.saveNode(nodeData);
  }
  
  /**
   * Encrypt an existing node
   * @param {string} nodeId - Node ID
   * @param {Object} options - Encryption options
   * @returns {Promise<Object>} Encrypted node
   */
  async encryptNode(nodeId, options = {}) {
    await this.ensureInitialized();
    
    if (!this.encryptionService) {
      throw new Error('Encryption service not available');
    }
    
    // Get the node
    const node = await this.getNode(nodeId, { refresh: true });
    
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    // Use the DataService's encryptNode method
    return this.dataService.encryptNode(nodeId, options);
  }
  
  /**
   * Delete a node
   * @param {string} nodeId - Node ID to delete
   * @returns {Promise<boolean>} Success indicator
   */
  async deleteNode(nodeId) {
    await this.ensureInitialized();
    
    // Get the node to find its parent
    const node = await this.getNode(nodeId);
    const parentId = node?.parent;
    
    // Check if node is protected
    if (this.nodeProtectionManager && this.nodeProtectionManager.isNodeProtected(nodeId)) {
      // Check if we have necessary access
      const hasAccess = this.nodeProtectionManager.hasNodeAccess(nodeId, 'full');
      
      if (!hasAccess) {
        // Request access before deleting
        this.eventBus.publish('node:decryption:requested', {
          nodeId,
          keyType: 'full'
        });
        
        throw new Error('Node is protected. Please decrypt it with full access before deleting.');
      }
    }
    
    // Currently we'll use the DataService updateNode with a special flag
    try {
      await this.dataService.updateNode(nodeId, { _deleted: true });
      
      // Remove from local cache
      this.nodes.delete(nodeId);
      
      // Invalidate relevant hierarchy cache
      if (parentId) {
        this.hierarchyCache.delete(`children:${parentId}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error deleting node ${nodeId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get relationships for a node
   * @param {string} nodeId - Node ID
   * @returns {Promise<Array>} Array of relationships
   */
  async getNodeRelationships(nodeId) {
    await this.ensureInitialized();
    
    // Get all relationships
    const allRelationships = await this.getRelationships();
    
    // Filter relationships involving this node
    return allRelationships.filter(rel => 
      rel.source === nodeId || rel.target === nodeId
    );
  }
  
  /**
   * Find nodes by search query
   * @param {string} query - Search query
   * @param {Object} options - Search options (fields, types, etc.)
   * @returns {Promise<Array>} Matching nodes
   */
  async searchNodes(query, options = {}) {
    await this.ensureInitialized();
    
    const searchOptions = {
      decryptLevel: 'basic',
      ...options
    };
    
    const allNodes = await this.getAllNodes(searchOptions);
    const searchFields = options.fields || ['name', 'description'];
    const nodeTypes = options.types || null;
    
    // Normalize query for case-insensitive search
    const normalizedQuery = query.toLowerCase();
    
    return allNodes.filter(node => {
      // Filter by type if specified
      if (nodeTypes && !nodeTypes.includes(node.type)) {
        return false;
      }
      
      // Skip nodes that are encrypted and not decrypted
      if (node.encrypted && !node._basic_decrypted) {
        return false;
      }
      
      // Search in specified fields
      return searchFields.some(field => {
        const value = node[field];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(normalizedQuery);
        }
        return false;
      });
    });
  }
  
  /**
   * Clear local caches
   */
  clearCache() {
    this.nodes.clear();
    this.hierarchyCache.clear();
    this.relationshipCache.clear();
    this.relationships = [];
  }
  
  /**
   * Ensure the repository is initialized
   * @private
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }
  
  /**
   * Dispose of the repository
   * Cleans up resources and event listeners
   */
  dispose() {
    // Unsubscribe from events
    if (this.eventBus) {
      this.eventBus.unsubscribe('node:decrypted', this.handleNodeDecrypted);
      this.eventBus.unsubscribe('node:locked', this.handleNodeLocked);
      this.eventBus.unsubscribe('nodeProtection:changed', this.handleProtectionChanged);
    }
    
    // Clear caches
    this.clearCache();
    
    // Reset initialization state
    this.initialized = false;
  }
}

export default registry.register(
  'data.NodeRepository',
  new NodeRepository(),
  [
    'data.DataService',
    'encryption.EncryptionService',
    'encryption.NodeProtectionManager',
    'utils.EventBus'
  ],
  {
    description: 'Repository for node CRUD operations and queries',
    usage: 'Provides a central point for accessing and manipulating nodes with encryption support'
  }
);

