// This file implements data access services for the AI Alignment Visualization
import registry from '../ModuleRegistry';
import { EventBus } from '../utils/EventBus';
import APP_SETTINGS from '../config/app-settings';

/**
 * DataService provides centralized data access for the visualization application.
 * It coordinates loading data from GitHub repository and manages caching.
 */
class DataService {
  constructor() {
    this.cache = {};
    this.settings = APP_SETTINGS;
    this.loading = false;
    this.initialized = false;
    this.githubService = null;
    this.encryptionService = null;
    this.nodeProtectionManager = null;
    this.lastLoadTime = null;
    this.eventBus = null;
  }

  /**
   * Initialize the data service
   */
  async initialize() {
    if (this.initialized) return;
    
    // Get required services
    this.githubService = registry.getModule('api.GitHubService');
    this.encryptionService = registry.getModule('encryption.EncryptionService');
    this.nodeProtectionManager = registry.getModule('encryption.NodeProtectionManager');
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    if (!this.githubService) {
      throw new Error('GitHub service not available');
    }
    
    // Initialize encryption service if available
    if (this.encryptionService && !this.encryptionService.initialized) {
      await this.encryptionService.initialize();
    }
    
    // Initialize node protection manager if available
    if (this.nodeProtectionManager && !this.nodeProtectionManager.initialized) {
      await this.nodeProtectionManager.initialize();
    }
    
    this.initialized = true;
    console.log('Data service initialized');
  }

  /**
   * Load visualization data from GitHub
   * @param {Object} options - Loading options
   * @returns {Promise<Object>} Loaded data
   */
  async loadData(options = {}) {
    const { forceRefresh = false, sphere = 'ai-alignment', decryptLevel = 'basic' } = options;
    
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Check cache if not forcing refresh
    const cacheKey = `data_${sphere}_${decryptLevel}`;
    const currentTime = new Date().getTime();
    const cacheTimeout = this.settings.cache.ttl * 1000; // Convert to milliseconds
    
    if (!forceRefresh && 
        this.cache[cacheKey] && 
        this.lastLoadTime && 
        (currentTime - this.lastLoadTime < cacheTimeout)) {
      console.log('Using cached data');
      return this.cache[cacheKey];
    }
    
    try {
      this.loading = true;
      this.eventBus.publish('data:loadingStarted', { sphere });
      
      // Load components and subcomponents in parallel
      const [components, subcomponents] = await Promise.all([
        this.githubService.fetchComponents(sphere),
        this.githubService.fetchSubcomponents(sphere)
      ]);
      
      if (!components || !subcomponents) {
        const error = new Error('Failed to load component data from GitHub');
        this.eventBus.publish('data:error', { 
          message: 'Failed to load visualization data',
          error 
        });
        throw error;
      }
      
      // Process the data - handle both array and object formats for backward compatibility
      const componentsArray = Array.isArray(components) ? components : this.extractComponentsFromObject(components);
      const subcomponentsArray = Array.isArray(subcomponents) ? subcomponents : this.extractComponentsFromObject(subcomponents);
      
      // Decrypt data if encryption service is available
      const processedComponents = this.processEncryptedData(componentsArray, decryptLevel);
      const processedSubcomponents = this.processEncryptedData(subcomponentsArray, decryptLevel);
      
      // Process the data
      const data = this.processData(processedComponents, processedSubcomponents);
      
      // Update cache
      this.cache[cacheKey] = data;
      this.lastLoadTime = currentTime;
      
      // Publish data loaded event
      this.eventBus.publish('data:loaded', { 
        sphere,
        nodeCount: data.nodes.length,
        linkCount: data.links.length,
        timestamp: currentTime,
        nodes: data.nodes
      });
      
      return data;
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Publish data error event
      this.eventBus.publish('data:error', { 
        message: 'Failed to load visualization data',
        error 
      });
      
      // If there's cached data, return it as a fallback
      if (this.cache[cacheKey]) {
        console.warn('Using cached data as fallback due to load error');
        
        // Notify that we're using stale data
        const cacheAge = currentTime - (this.lastLoadTime || 0);
        const cacheAgeMinutes = Math.floor(cacheAge / 60000);
        
        this.eventBus.publish('data:usingStaleData', {
          sphere,
          cacheAge,
          cacheAgeMinutes,
          reason: error.message
        });
        
        return this.cache[cacheKey];
      }
      
      throw error;
    } finally {
      this.loading = false;
      this.eventBus.publish('data:loadingFinished', { sphere });
    }
  }
  
  /**
   * Process encrypted data from GitHub
   * @param {Array} nodes - Node data from GitHub
   * @param {string} decryptLevel - Level of decryption to apply
   * @returns {Array} Processed nodes
   * @private
   */
  processEncryptedData(nodes, decryptLevel = 'basic') {
    if (!this.encryptionService || !nodes || !Array.isArray(nodes)) {
      return nodes;
    }
    
    // Process each node to handle encryption
    return nodes.map(node => {
      if (!node || !node.encrypted) {
        return node; // Not encrypted
      }
      
      try {
        // Use encryption service to process the node
        return this.encryptionService.processNode(node, decryptLevel);
      } catch (error) {
        console.warn(`Error decrypting node ${node.id}:`, error);
        // For failed decryption, return the node with just basic info
        return {
          id: node.id,
          name: node.name || `Encrypted ${node.type || 'Node'}`,
          type: node.type,
          parent: node.parent,
          encrypted: true,
          _decryption_failed: true
        };
      }
    });
  }
  
  /**
   * Extract components from object format (for backward compatibility)
   * @param {Object} data - Component data in object format
   * @returns {Array} Components array
   */
  extractComponentsFromObject(data) {
    if (!data || typeof data !== 'object') return [];
    
    // If data is already an array, return it
    if (Array.isArray(data)) return data;
    
    // If data is an object with nodes/components property, extract that
    if (data.nodes) return data.nodes;
    if (data.components) return data.components;
    
    // Otherwise, try to convert object to array of components
    return Object.values(data).filter(item => item && typeof item === 'object');
  }

  /**
   * Process raw data from GitHub into a structured format for the visualization
   * @param {Array} components - Component data
   * @param {Array} subcomponents - Subcomponent data
   * @returns {Object} Processed data ready for visualization
   */
  processData(components, subcomponents) {
    // Ensure we have valid arrays
    const componentsArray = Array.isArray(components) ? components : [];
    const subcomponentsArray = Array.isArray(subcomponents) ? subcomponents : [];
    
    // Use Map for better performance with large datasets
    const nodesMap = new Map();
    const links = [];
    
    // Pre-process components and subcomponents into a single combined array for efficiency
    const allNodes = [
      ...componentsArray.map(comp => ({ ...comp, nodeType: 'component' })),
      ...subcomponentsArray.map(sub => ({ ...sub, nodeType: 'subcomponent' }))
    ];
    
    // Create a node ID index for faster lookups
    const nodeIdIndex = new Set(allNodes.map(node => node.id));
    
    // Process all nodes in a single pass, much more efficient than multiple loops
    allNodes.forEach(node => {
      if (!node.id) {
        console.warn('Node missing ID:', node);
        return;
      }
      
      // Create a standardized node object
      const nodeObj = {
        id: node.id,
        type: node.type || node.nodeType,
        name: node.name || node.id,
        description: node.description || '',
        parent: node.parent || null,
        level: node.level || (node.nodeType === 'component' ? 1 : 2),
        children: [],
        encrypted: node.encrypted === true,
        access_level: node.access_level || 'public',
        _decrypted: node._basic_decrypted || node._detail_decrypted || node._full_decrypted || false,
        data: node
      };
      
      nodesMap.set(node.id, nodeObj);
      
      // Process parent relationship if it exists
      if (node.parent && nodeIdIndex.has(node.parent)) {
        // We'll add the actual hierarchy in the next step
        links.push({
          source: node.parent,
          target: node.id,
          type: 'contains'
        });
      }
      
      // Process relationship links
      if (node.relationships && Array.isArray(node.relationships)) {
        node.relationships.forEach(rel => {
          if (!rel.target) {
            console.warn(`Relationship missing target in node ${node.id}:`, rel);
            return;
          }
          
          // Only create links to nodes that actually exist
          if (nodeIdIndex.has(rel.target)) {
            links.push({
              source: node.id,
              target: rel.target,
              type: rel.type || 'relates_to',
              data: rel
            });
          } else {
            console.warn(`Skipping relationship: target node '${rel.target}' not found for node ${node.id}`);
          }
        });
      }
      
      // Process implementation links
      if (node.implemented_by_subcomponents && Array.isArray(node.implemented_by_subcomponents)) {
        node.implemented_by_subcomponents.forEach(implementerId => {
          if (nodeIdIndex.has(implementerId)) {
            links.push({
              source: node.id,
              target: implementerId,
              type: 'implements'
            });
          } else {
            console.warn(`Skipping implementation: target node '${implementerId}' not found for node ${node.id}`);
          }
        });
      }
    });
    
    // Build hierarchy relationships (populate children arrays)
    for (const link of links) {
      if (link.type === 'contains' && nodesMap.has(link.source) && nodesMap.has(link.target)) {
        const parentNode = nodesMap.get(link.source);
        if (!parentNode.children.includes(link.target)) {
          parentNode.children.push(link.target);
        }
      }
    }
    
    return {
      nodes: Array.from(nodesMap.values()),
      links,
      nodesMap
    };
  }

  /**
   * Get node details by ID
   * @param {string} nodeId - Node identifier
   * @param {string} decryptLevel - Level of decryption to apply
   * @returns {Promise<Object>} Node details
   */
  async getNodeDetails(nodeId, decryptLevel = 'detail') {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // First check all loaded data
    for (const key in this.cache) {
      if (this.cache[key].nodesMap && this.cache[key].nodesMap.has(nodeId)) {
        const node = this.cache[key].nodesMap.get(nodeId);
        
        // If we already have the node with the requested decrypt level, return it
        if (
          (decryptLevel === 'basic' && (node._basic_decrypted || !node.encrypted)) ||
          (decryptLevel === 'detail' && (node._detail_decrypted || node._full_decrypted || !node.encrypted)) ||
          (decryptLevel === 'full' && (node._full_decrypted || !node.encrypted))
        ) {
          return node;
        }
        
        // If we have the node but need to decrypt further
        if (this.encryptionService) {
          // Check if user has proper access
          if (this.nodeProtectionManager && !this.nodeProtectionManager.hasNodeAccess(nodeId, decryptLevel)) {
            // Request access if needed
            this.eventBus.publish('node:decryption:requested', {
              nodeId,
              keyType: decryptLevel
            });
            
            // Return the node with the current level of decryption
            return node;
          }
          
          // Try to decrypt with the requested level
          const processedNode = this.encryptionService.processNode(node.data, decryptLevel);
          if (processedNode && (processedNode._basic_decrypted || processedNode._detail_decrypted || processedNode._full_decrypted)) {
            // Update the node in the cache with the decrypted version
            const updatedNode = {
              ...node,
              data: processedNode,
              _decrypted: true,
              _basic_decrypted: processedNode._basic_decrypted || node._basic_decrypted,
              _detail_decrypted: processedNode._detail_decrypted || node._detail_decrypted,
              _full_decrypted: processedNode._full_decrypted || node._full_decrypted
            };
            
            // Update nodes in the cache
            this.cache[key].nodesMap.set(nodeId, updatedNode);
            
            return updatedNode;
          }
        }
        
        // If we can't decrypt further, return the node as is
        return node;
      }
    }
    
    // If not found, try loading data
    try {
      const data = await this.loadData({ decryptLevel });
      return data.nodesMap.get(nodeId) || null;
    } catch (error) {
      console.error(`Error getting node details for ${nodeId}:`, error);
      this.eventBus.publish('data:error', { 
        message: `Failed to get node details for ${nodeId}`,
        error 
      });
      return null;
    }
  }

  /**
   * Update node data
   * @param {string} nodeId - Node identifier
   * @param {Object} updates - Data to update
   * @returns {Promise<Object>} Updated node
   */
  async updateNode(nodeId, updates) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Find the node in the cache
    let nodeToUpdate = null;
    let cacheKey = null;
    
    for (const key in this.cache) {
      if (this.cache[key].nodesMap && this.cache[key].nodesMap.has(nodeId)) {
        nodeToUpdate = this.cache[key].nodesMap.get(nodeId);
        cacheKey = key;
        break;
      }
    }
    
    if (!nodeToUpdate) {
      const error = new Error(`Node ${nodeId} not found`);
      this.eventBus.publish('data:error', { 
        message: `Failed to update node ${nodeId}`,
        error 
      });
      throw error;
    }
    
    // Check if node is encrypted and we're trying to update encrypted content
    if (nodeToUpdate.encrypted && updates.content && !nodeToUpdate._decrypted) {
      const error = new Error(`Cannot update encrypted content for node ${nodeId} without decryption`);
      this.eventBus.publish('data:error', { 
        message: `Failed to update node ${nodeId}`,
        error 
      });
      throw error;
    }
    
    // Check if we need to encrypt content that is being updated
    let updatedData = { ...updates };
    
    if (this.encryptionService && nodeToUpdate.encrypted) {
      // Determine what fields need to be encrypted
      const fieldsToEncrypt = [];
      
      if (updates.content && nodeToUpdate._detail_decrypted) {
        fieldsToEncrypt.push('content');
      }
      
      // If we need to encrypt fields, do it now
      if (fieldsToEncrypt.length > 0) {
        try {
          // Get the key used for decryption
          const key = this.encryptionService.getDecryptionKey(nodeId, 'detail');
          
          if (!key) {
            throw new Error('Decryption key not available for re-encryption');
          }
          
          // Encrypt each field
          fieldsToEncrypt.forEach(field => {
            updatedData[field] = this.encryptionService.encryptContent(updates[field], key);
          });
        } catch (error) {
          console.error(`Error encrypting updates for node ${nodeId}:`, error);
          this.eventBus.publish('data:error', { 
            message: `Failed to encrypt updates for node ${nodeId}`,
            error 
          });
          throw error;
        }
      }
    }
    
    // Update node data
    const updatedNode = {
      ...nodeToUpdate,
      ...updates,
      data: {
        ...nodeToUpdate.data,
        ...updatedData
      }
    };
    
    // Update cache
    this.cache[cacheKey].nodesMap.set(nodeId, updatedNode);
    
    // For GitHub-based storage, we need to update the entire components or subcomponents file
    // since we don't have individual files for each node
    try {
      // Get all components or subcomponents
      const isComponent = updatedNode.type === 'component';
      
      // Load the current data
      const allNodes = isComponent 
        ? await this.githubService.fetchComponents() 
        : await this.githubService.fetchSubcomponents();
      
      if (!allNodes) {
        const error = new Error(`Failed to load ${isComponent ? 'components' : 'subcomponents'} data`);
        this.eventBus.publish('data:error', { 
          message: `Failed to update node ${nodeId}`,
          error 
        });
        throw error;
      }
      
      // Process data to ensure we have an array
      const nodesArray = Array.isArray(allNodes) 
        ? allNodes 
        : this.extractComponentsFromObject(allNodes);
      
      // Update the specific node in the array
      const nodeIndex = nodesArray.findIndex(node => node.id === nodeId);
      
      if (nodeIndex >= 0) {
        nodesArray[nodeIndex] = updatedNode.data;
      } else {
        // Node not found in file, add it
        nodesArray.push(updatedNode.data);
      }
      
      // Save the updated array back to GitHub
      const path = isComponent 
        ? this.settings.dataPaths.components 
        : this.settings.dataPaths.subcomponents;
      
      await this.githubService.saveFile(
        path,
        nodesArray,
        `Update ${isComponent ? 'component' : 'subcomponent'} ${nodeId}`
      );
      
      // Publish update event
      this.eventBus.publish('data:nodeUpdated', { 
        nodeId,
        node: updatedNode
      });
      
      return updatedNode;
    } catch (error) {
      console.error(`Error updating node ${nodeId}:`, error);
      this.eventBus.publish('data:error', { 
        message: `Failed to update node ${nodeId}`,
        error 
      });
      throw error;
    }
  }

  /**
   * Encrypt a node
   * @param {string} nodeId - Node identifier
   * @param {Object} options - Encryption options
   * @returns {Promise<Object>} Encrypted node
   */
  async encryptNode(nodeId, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!this.encryptionService) {
      throw new Error('Encryption service not available');
    }
    
    // Find the node
    let nodeToEncrypt = null;
    let cacheKey = null;
    
    for (const key in this.cache) {
      if (this.cache[key].nodesMap && this.cache[key].nodesMap.has(nodeId)) {
        nodeToEncrypt = this.cache[key].nodesMap.get(nodeId);
        cacheKey = key;
        break;
      }
    }
    
    if (!nodeToEncrypt) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    try {
      // Encrypt the node
      const encryptedNode = this.encryptionService.encryptNode(nodeToEncrypt.data, options);
      
      // Update the node in our cache
      const updatedNode = {
        ...nodeToEncrypt,
        encrypted: true,
        access_level: options.accessLevel || nodeToEncrypt.access_level || 'password',
        data: encryptedNode
      };
      
      this.cache[cacheKey].nodesMap.set(nodeId, updatedNode);
      
      // Save to GitHub
      await this.updateNode(nodeId, { 
        encrypted: true, 
        access_level: options.accessLevel || nodeToEncrypt.access_level || 'password',
        ...encryptedNode 
      });
      
      // Return the updated node
      return updatedNode;
    } catch (error) {
      console.error(`Error encrypting node ${nodeId}:`, error);
      this.eventBus.publish('data:error', { 
        message: `Failed to encrypt node ${nodeId}`,
        error 
      });
      throw error;
    }
  }

  /**
   * Get version history for a node
   * @param {string} nodeId - Node identifier
   * @returns {Promise<Array>} Version history
   */
  async getNodeHistory(nodeId) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Find the node first to determine its type
      const node = await this.getNodeDetails(nodeId);
      
      if (!node) {
        const error = new Error(`Node ${nodeId} not found`);
        this.eventBus.publish('data:error', { 
          message: `Failed to get history for node ${nodeId}`,
          error 
        });
        throw error;
      }
      
      // Determine file path based on node type
      const path = node.type === 'component'
        ? this.settings.dataPaths.components
        : this.settings.dataPaths.subcomponents;
      
      // Get commit history from GitHub
      const history = await this.githubService.getFileHistory(path);
      
      return history.map(commit => ({
        id: commit.sha,
        date: commit.commit.author.date,
        author: commit.commit.author.name,
        message: commit.commit.message
      }));
    } catch (error) {
      console.error(`Error getting history for node ${nodeId}:`, error);
      this.eventBus.publish('data:error', { 
        message: `Failed to get history for node ${nodeId}`,
        error 
      });
      throw error;
    }
  }

  /**
   * Clear the data cache
   */
  clearCache() {
    this.cache = {};
    this.lastLoadTime = null;
    console.log('Data cache cleared');
    this.eventBus.publish('data:cacheCleared', {});
  }
}

// Export singleton instance
export default registry.register(
  'data.DataService',
  new DataService(),
  [
    'api.GitHubService', 
    'utils.EventBus',
    'encryption.EncryptionService',
    'encryption.NodeProtectionManager'
  ],
  {
    description: 'Data service for loading and managing visualization data',
    usage: 'Central service for accessing visualization data from GitHub'
  }
);

