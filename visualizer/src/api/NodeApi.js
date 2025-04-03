// NodeApi.js
// API client for node data operations using GitHub repository

import registry from '../ModuleRegistry';
import ValidationHelpers from '../utils/ValidationHelpers';
import ErrorHandler from '../utils/ErrorHandler';
import APP_SETTINGS from '../config/app-settings';

/**
 * NodeApi provides methods for interacting with node data in the GitHub repository.
 * It handles CRUD operations for nodes, relationships, and hierarchies.
 */
class NodeApi {
  constructor() {
    this.dataService = null;
    this.githubService = null;
    this.initialized = false;
  }

  /**
   * Initialize the API
   */
  async initialize() {
    if (this.initialized) return;
    
    this.dataService = registry.getModule('data.DataService');
    this.githubService = registry.getModule('api.GitHubService');
    
    if (!this.dataService) {
      throw new Error('DataService not found in registry');
    }
    
    if (!this.githubService) {
      throw new Error('GitHubService not found in registry');
    }
    
    this.initialized = true;
  }

  /**
   * Get a node by ID
   * 
   * @param {string} nodeId - The ID of the node to retrieve
   * @param {Object} [options] - Request options
   * @param {boolean} [options.includeRelationships=false] - Whether to include relationships
   * @param {boolean} [options.includeChildren=false] - Whether to include child nodes
   * @returns {Promise<Object>} The node data
   */
  async getNode(nodeId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!nodeId) {
        throw ErrorHandler.createError(
          'Node ID is required',
          'ValidationError',
          'MISSING_NODE_ID'
        );
      }

      // First get the basic node
      const node = await this.dataService.getNodeDetails(nodeId);
      
      if (!node) {
        throw ErrorHandler.createError(
          `Node not found with ID: ${nodeId}`,
          'NotFoundError',
          'NODE_NOT_FOUND'
        );
      }
      
      // If not requesting additional data, return the node as is
      if (!options.includeRelationships && !options.includeChildren) {
        return node;
      }
      
      // Deep copy to avoid modifying the cached data
      const result = JSON.parse(JSON.stringify(node));
      
      // Get related data if requested
      if (options.includeChildren && node.children && node.children.length > 0) {
        result.childNodes = await Promise.all(
          node.children.map(childId => this.dataService.getNodeDetails(childId))
        );
      }
      
      return result;
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to get node: ${error.message}`,
        'ApiError',
        'GET_NODE_FAILED',
        { originalError: error, nodeId }
      );
    }
  }

  /**
   * Get multiple nodes by their IDs
   * 
   * @param {Array<string>} nodeIds - Array of node IDs to retrieve
   * @param {Object} [options] - Request options
   * @returns {Promise<Array<Object>>} Array of node data
   */
  async getNodes(nodeIds, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
        throw ErrorHandler.createError(
          'Valid array of node IDs is required',
          'ValidationError',
          'INVALID_NODE_IDS'
        );
      }

      // Create an array of promises to get each node
      const nodePromises = nodeIds.map(id => this.getNode(id, options));
      
      // Wait for all promises to resolve
      const nodes = await Promise.all(nodePromises);
      
      return nodes;
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to get nodes: ${error.message}`,
        'ApiError',
        'GET_NODES_FAILED',
        { originalError: error, nodeIds }
      );
    }
  }

  /**
   * Get nodes by their parent ID
   * 
   * @param {string} parentId - The ID of the parent node
   * @param {Object} [options] - Request options
   * @returns {Promise<Array<Object>>} Array of child node data
   */
  async getChildNodes(parentId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!parentId) {
        throw ErrorHandler.createError(
          'Parent ID is required',
          'ValidationError',
          'MISSING_PARENT_ID'
        );
      }

      // First get the parent node
      const parentNode = await this.dataService.getNodeDetails(parentId);
      
      if (!parentNode) {
        throw ErrorHandler.createError(
          `Parent node not found with ID: ${parentId}`,
          'NotFoundError',
          'PARENT_NODE_NOT_FOUND'
        );
      }
      
      if (!parentNode.children || parentNode.children.length === 0) {
        return [];
      }
      
      // Get all child nodes
      const childNodes = await Promise.all(
        parentNode.children.map(childId => this.dataService.getNodeDetails(childId))
      );
      
      return childNodes.filter(Boolean); // Filter out any null nodes
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to get child nodes: ${error.message}`,
        'ApiError',
        'GET_CHILD_NODES_FAILED',
        { originalError: error, parentId }
      );
    }
  }

  /**
   * Get node relationships
   * 
   * @param {string} nodeId - The ID of the node
   * @param {Object} [options] - Request options
   * @param {string} [options.relationshipType] - Filter by relationship type
   * @returns {Promise<Array<Object>>} Array of relationships
   */
  async getNodeRelationships(nodeId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!nodeId) {
        throw ErrorHandler.createError(
          'Node ID is required',
          'ValidationError',
          'MISSING_NODE_ID'
        );
      }

      // Load all data to get access to links
      const data = await this.dataService.loadData();
      
      if (!data || !data.links) {
        return [];
      }
      
      // Filter links where the node is either source or target
      let relationships = data.links.filter(link => 
        link.source === nodeId || link.target === nodeId
      );
      
      // Filter by relationship type if specified
      if (options.relationshipType) {
        relationships = relationships.filter(rel => 
          rel.type === options.relationshipType
        );
      }
      
      // Add node details to relationships
      const enhancedRelationships = await Promise.all(
        relationships.map(async rel => {
          const otherNodeId = rel.source === nodeId ? rel.target : rel.source;
          const otherNode = await this.dataService.getNodeDetails(otherNodeId);
          
          return {
            id: `${rel.source}-${rel.type}-${rel.target}`,
            type: rel.type,
            sourceId: rel.source,
            targetId: rel.target,
            direction: rel.source === nodeId ? 'outgoing' : 'incoming',
            otherNode: otherNode || { id: otherNodeId },
            data: rel.data || {}
          };
        })
      );
      
      return enhancedRelationships;
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to get node relationships: ${error.message}`,
        'ApiError',
        'GET_RELATIONSHIPS_FAILED',
        { originalError: error, nodeId }
      );
    }
  }

  /**
   * Create a new node
   * 
   * @param {Object} nodeData - The node data to create
   * @returns {Promise<Object>} The created node
   */
  async createNode(nodeData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Validate required fields
      this._validateNodeData(nodeData);

      // Determine if this is a component or subcomponent
      const isComponent = ['component_group', 'component'].includes(nodeData.type);
      
      // Load the current data
      const allNodes = isComponent 
        ? await this.githubService.fetchComponents() 
        : await this.githubService.fetchSubcomponents();
      
      if (!allNodes) {
        throw ErrorHandler.createError(
          `Failed to load ${isComponent ? 'components' : 'subcomponents'} data`,
          'ApiError',
          'DATA_LOAD_FAILED'
        );
      }
      
      // Process data to ensure we have an array
      const nodesArray = Array.isArray(allNodes) 
        ? allNodes 
        : this.dataService.extractComponentsFromObject(allNodes);
      
      // Check if node with ID already exists
      if (nodesArray.some(node => node.id === nodeData.id)) {
        throw ErrorHandler.createError(
          `Node with ID ${nodeData.id} already exists`,
          'ValidationError',
          'DUPLICATE_NODE_ID'
        );
      }
      
      // Add the new node
      nodesArray.push(nodeData);
      
      // Save the updated array back to GitHub
      const path = isComponent 
        ? APP_SETTINGS.dataPaths.components 
        : APP_SETTINGS.dataPaths.subcomponents;
      
      await this.githubService.saveFile(
        path,
        nodesArray,
        `Add new ${isComponent ? 'component' : 'subcomponent'} ${nodeData.id}`
      );
      
      // Clear cache to ensure we get the updated data
      this.dataService.clearCache();
      
      // Return the newly created node in the standardized format
      const createdNode = {
        id: nodeData.id,
        type: nodeData.type,
        name: nodeData.name || nodeData.id,
        description: nodeData.description || '',
        parent: nodeData.parent || null,
        level: nodeData.level || (isComponent ? 1 : 2),
        children: [],
        data: nodeData
      };
      
      return createdNode;
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to create node: ${error.message}`,
        'ApiError',
        'CREATE_NODE_FAILED',
        { originalError: error, nodeData }
      );
    }
  }

  /**
   * Update an existing node
   * 
   * @param {string} nodeId - The ID of the node to update
   * @param {Object} nodeData - The updated node data
   * @returns {Promise<Object>} The updated node
   */
  async updateNode(nodeId, nodeData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!nodeId) {
        throw ErrorHandler.createError(
          'Node ID is required',
          'ValidationError',
          'MISSING_NODE_ID'
        );
      }

      // Use DataService to handle the update
      const updatedNode = await this.dataService.updateNode(nodeId, nodeData);
      
      return updatedNode;
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to update node: ${error.message}`,
        'ApiError',
        'UPDATE_NODE_FAILED',
        { originalError: error, nodeId, nodeData }
      );
    }
  }

  /**
   * Delete a node
   * 
   * @param {string} nodeId - The ID of the node to delete
   * @param {Object} [options] - Delete options
   * @param {boolean} [options.deleteChildren=false] - Whether to delete child nodes
   * @returns {Promise<Object>} The deletion result
   */
  async deleteNode(nodeId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!nodeId) {
        throw ErrorHandler.createError(
          'Node ID is required',
          'ValidationError',
          'MISSING_NODE_ID'
        );
      }

      // Get the node to be deleted
      const node = await this.dataService.getNodeDetails(nodeId);
      
      if (!node) {
        throw ErrorHandler.createError(
          `Node not found with ID: ${nodeId}`,
          'NotFoundError',
          'NODE_NOT_FOUND'
        );
      }
      
      // If requested to delete children and node has children
      if (options.deleteChildren && node.children && node.children.length > 0) {
        // Delete all children first
        await Promise.all(
          node.children.map(childId => this.deleteNode(childId, options))
        );
      } else if (node.children && node.children.length > 0) {
        throw ErrorHandler.createError(
          `Cannot delete node with children. Set deleteChildren=true to delete children or remove them first.`,
          'ValidationError',
          'NODE_HAS_CHILDREN'
        );
      }
      
      // Determine if this is a component or subcomponent
      const isComponent = ['component_group', 'component'].includes(node.type);
      
      // Load the current data
      const allNodes = isComponent 
        ? await this.githubService.fetchComponents() 
        : await this.githubService.fetchSubcomponents();
      
      // Process data to ensure we have an array
      const nodesArray = Array.isArray(allNodes) 
        ? allNodes 
        : this.dataService.extractComponentsFromObject(allNodes);
      
      // Remove the node from the array
      const updatedNodes = nodesArray.filter(n => n.id !== nodeId);
      
      if (updatedNodes.length === nodesArray.length) {
        throw ErrorHandler.createError(
          `Node with ID ${nodeId} not found in data file`,
          'NotFoundError',
          'NODE_NOT_IN_FILE'
        );
      }
      
      // Save the updated array back to GitHub
      const path = isComponent 
        ? APP_SETTINGS.dataPaths.components 
        : APP_SETTINGS.dataPaths.subcomponents;
      
      await this.githubService.saveFile(
        path,
        updatedNodes,
        `Delete ${isComponent ? 'component' : 'subcomponent'} ${nodeId}`
      );
      
      // Clear cache to ensure we get updated data
      this.dataService.clearCache();
      
      return { success: true, id: nodeId };
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to delete node: ${error.message}`,
        'ApiError',
        'DELETE_NODE_FAILED',
        { originalError: error, nodeId }
      );
    }
  }

  /**
   * Create a relationship between nodes
   * 
   * @param {string} sourceNodeId - The source node ID
   * @param {string} targetNodeId - The target node ID
   * @param {string} relationshipType - The type of relationship
   * @param {Object} [metadata] - Additional metadata for the relationship
   * @returns {Promise<Object>} The created relationship
   */
  async createRelationship(sourceNodeId, targetNodeId, relationshipType, metadata = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!sourceNodeId || !targetNodeId || !relationshipType) {
        throw ErrorHandler.createError(
          'Source node ID, target node ID, and relationship type are required',
          'ValidationError',
          'MISSING_RELATIONSHIP_PARAMS'
        );
      }

      // Get source node
      const sourceNode = await this.dataService.getNodeDetails(sourceNodeId);
      
      if (!sourceNode) {
        throw ErrorHandler.createError(
          `Source node not found with ID: ${sourceNodeId}`,
          'NotFoundError',
          'SOURCE_NODE_NOT_FOUND'
        );
      }
      
      // Get target node to verify it exists
      const targetNode = await this.dataService.getNodeDetails(targetNodeId);
      
      if (!targetNode) {
        throw ErrorHandler.createError(
          `Target node not found with ID: ${targetNodeId}`,
          'NotFoundError',
          'TARGET_NODE_NOT_FOUND'
        );
      }
      
      // Create the relationship object
      const relationship = {
        target: targetNodeId,
        type: relationshipType,
        ...metadata
      };
      
      // Update the source node with the new relationship
      const nodeData = sourceNode.data || {};
      
      if (!nodeData.relationships) {
        nodeData.relationships = [];
      }
      
      // Check if relationship already exists
      const existingRelIndex = nodeData.relationships.findIndex(
        rel => rel.target === targetNodeId && rel.type === relationshipType
      );
      
      if (existingRelIndex >= 0) {
        // Update existing relationship
        nodeData.relationships[existingRelIndex] = relationship;
      } else {
        // Add new relationship
        nodeData.relationships.push(relationship);
      }
      
      // Save the updated node
      await this.updateNode(sourceNodeId, { data: nodeData });
      
      // Return the created relationship with an ID
      return {
        id: `${sourceNodeId}-${relationshipType}-${targetNodeId}`,
        sourceId: sourceNodeId,
        targetId: targetNodeId,
        type: relationshipType,
        metadata
      };
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to create relationship: ${error.message}`,
        'ApiError',
        'CREATE_RELATIONSHIP_FAILED',
        { 
          originalError: error, 
          sourceNodeId, 
          targetNodeId, 
          relationshipType 
        }
      );
    }
  }

  /**
   * Delete a relationship
   * 
   * @param {string} relationshipId - The ID of the relationship to delete (format: sourceId-type-targetId)
   * @returns {Promise<Object>} The deletion result
   */
  async deleteRelationship(relationshipId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!relationshipId) {
        throw ErrorHandler.createError(
          'Relationship ID is required',
          'ValidationError',
          'MISSING_RELATIONSHIP_ID'
        );
      }

      // Parse relationship ID (format: sourceId-type-targetId)
      const parts = relationshipId.split('-');
      
      if (parts.length < 3) {
        throw ErrorHandler.createError(
          'Invalid relationship ID format. Expected: sourceId-type-targetId',
          'ValidationError',
          'INVALID_RELATIONSHIP_ID'
        );
      }
      
      const sourceNodeId = parts[0];
      const targetNodeId = parts[parts.length - 1];
      const relType = parts.slice(1, parts.length - 1).join('-');
      
      // Get the source node
      const sourceNode = await this.dataService.getNodeDetails(sourceNodeId);
      
      if (!sourceNode || !sourceNode.data || !sourceNode.data.relationships) {
        throw ErrorHandler.createError(
          `Source node not found or has no relationships: ${sourceNodeId}`,
          'NotFoundError',
          'SOURCE_NODE_NOT_FOUND'
        );
      }
      
      // Find and remove the relationship
      const relationships = sourceNode.data.relationships;
      const initialLength = relationships.length;
      
      const updatedRelationships = relationships.filter(
        rel => !(rel.target === targetNodeId && rel.type === relType)
      );
      
      if (updatedRelationships.length === initialLength) {
        throw ErrorHandler.createError(
          `Relationship not found: ${relationshipId}`,
          'NotFoundError',
          'RELATIONSHIP_NOT_FOUND'
        );
      }
      
      // Update the source node
      const updatedData = {
        ...sourceNode.data,
        relationships: updatedRelationships
      };
      
      await this.updateNode(sourceNodeId, { data: updatedData });
      
      return { success: true, id: relationshipId };
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to delete relationship: ${error.message}`,
        'ApiError',
        'DELETE_RELATIONSHIP_FAILED',
        { originalError: error, relationshipId }
      );
    }
  }

  /**
   * Search for nodes based on various criteria
   * 
   * @param {Object} searchParams - Search parameters
   * @param {string} [searchParams.query] - Text search query
   * @param {Array<string>} [searchParams.types] - Node types to include
   * @param {Object} [searchParams.filters] - Additional filters
   * @param {Object} [options] - Search options
   * @param {number} [options.limit=20] - Maximum number of results
   * @param {number} [options.offset=0] - Result offset for pagination
   * @returns {Promise<Object>} Search results with nodes and total count
   */
  async searchNodes(searchParams, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Load all data
      const data = await this.dataService.loadData();
      
      if (!data || !data.nodes) {
        return { nodes: [], total: 0 };
      }
      
      let filteredNodes = [...data.nodes];
      
      // Apply text search if query is provided
      if (searchParams.query) {
        const query = searchParams.query.toLowerCase();
        filteredNodes = filteredNodes.filter(node => 
          node.name.toLowerCase().includes(query) || 
          (node.description && node.description.toLowerCase().includes(query))
        );
      }
      
      // Filter by types if specified
      if (searchParams.types && searchParams.types.length > 0) {
        filteredNodes = filteredNodes.filter(node => 
          searchParams.types.includes(node.type)
        );
      }
      
      // Apply custom filters if provided
      if (searchParams.filters) {
        Object.entries(searchParams.filters).forEach(([key, value]) => {
          filteredNodes = filteredNodes.filter(node => {
            // Handle nested properties with dot notation
            if (key.includes('.')) {
              const parts = key.split('.');
              let obj = node;
              
              // Navigate through the object hierarchy
              for (let i = 0; i < parts.length - 1; i++) {
                if (!obj || typeof obj !== 'object') return false;
                obj = obj[parts[i]];
              }
              
              const finalKey = parts[parts.length - 1];
              return obj && obj[finalKey] === value;
            } else {
              return node[key] === value;
            }
          });
        });
      }
      
      // Get the total count before pagination
      const total = filteredNodes.length;
      
      // Apply pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      
      const paginatedNodes = filteredNodes.slice(offset, offset + limit);
      
      return {
        nodes: paginatedNodes,
        total
      };
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to search nodes: ${error.message}`,
        'ApiError',
        'SEARCH_NODES_FAILED',
        { originalError: error, searchParams }
      );
    }
  }

  /**
   * Get the complete hierarchy for a node and its descendants
   * 
   * @param {string} rootNodeId - The ID of the root node
   * @param {Object} [options] - Request options
   * @param {number} [options.maxDepth] - Maximum depth to traverse
   * @returns {Promise<Object>} Hierarchical structure of nodes
   */
  async getNodeHierarchy(rootNodeId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!rootNodeId) {
        throw ErrorHandler.createError(
          'Root node ID is required',
          'ValidationError',
          'MISSING_ROOT_NODE_ID'
        );
      }

      // Get the root node
      const rootNode = await this.dataService.getNodeDetails(rootNodeId);
      
      if (!rootNode) {
        throw ErrorHandler.createError(
          `Root node not found with ID: ${rootNodeId}`,
          'NotFoundError',
          'ROOT_NODE_NOT_FOUND'
        );
      }
      
      // Function to recursively build hierarchy
      const buildHierarchy = async (nodeId, currentDepth) => {
        // If max depth is specified, stop at that depth
        if (options.maxDepth !== undefined && currentDepth > options.maxDepth) {
          return null;
        }
        
        const node = await this.dataService.getNodeDetails(nodeId);
        
        if (!node) {
          return null;
        }
        
        // Create a copy to avoid modifying the cached node
        const result = { ...node };
        
        // If the node has children, recursively get them
        if (node.children && node.children.length > 0) {
          const childPromises = node.children.map(childId => 
            buildHierarchy(childId, currentDepth + 1)
          );
          
          result.children = (await Promise.all(childPromises)).filter(Boolean);
        } else {
          result.children = [];
        }
        
        // If requested, include relationships
        if (options.includeRelationships) {
          result.relationships = await this.getNodeRelationships(nodeId);
        }
        
        return result;
      };
      
      // Start building from the root node at depth 0
      return buildHierarchy(rootNodeId, 0);
    } catch (error) {
      throw ErrorHandler.createError(
        `Failed to get node hierarchy: ${error.message}`,
        'ApiError',
        'GET_HIERARCHY_FAILED',
        { originalError: error, rootNodeId }
      );
    }
  }

  /**
   * Validate node data
   * 
   * @param {Object} nodeData - The node data to validate
   * @private
   */
  _validateNodeData(nodeData) {
    if (!nodeData) {
      throw ErrorHandler.createError(
        'Node data is required',
        'ValidationError',
        'MISSING_NODE_DATA'
      );
    }

    const requiredProps = ['id', 'name', 'type'];
    
    for (const prop of requiredProps) {
      if (!nodeData[prop]) {
        throw ErrorHandler.createError(
          `Missing required property: ${prop}`,
          'ValidationError',
          'MISSING_REQUIRED_PROPERTY'
        );
      }
    }

    // Validate node type is one of the allowed types
    const validTypes = [
      'component_group',
      'component',
      'subcomponent',
      'capability',
      'function',
      'specification',
      'integration',
      'technique',
      'application',
      'input',
      'output'
    ];

    if (!validTypes.includes(nodeData.type)) {
      throw ErrorHandler.createError(
        `Invalid node type: ${nodeData.type}. Must be one of: ${validTypes.join(', ')}`,
        'ValidationError',
        'INVALID_NODE_TYPE'
      );
    }
  }
}

// Create singleton instance
const nodeApi = new NodeApi();

// Register with ModuleRegistry
export default registry.register(
  'api.NodeApi',
  nodeApi,
  ['data.DataService', 'api.GitHubService', 'utils.ValidationHelpers', 'utils.ErrorHandler'],
  {
    description: 'API client for node data operations using GitHub repository',
    usage: `
      // Get a node by ID
      const node = await NodeApi.getNode('node-123', { includeRelationships: true });
      
      // Get child nodes
      const children = await NodeApi.getChildNodes('parent-node-456');
      
      // Create a new node
      const newNode = await NodeApi.createNode({
        id: 'new-component-123',
        name: 'New Component',
        type: 'component',
        parent: 'parent-node-789',
        description: 'A new component'
      });
      
      // Update a node
      await NodeApi.updateNode('node-123', { description: 'Updated description' });
      
      // Create a relationship
      await NodeApi.createRelationship('source-node-123', 'target-node-456', 'implements');
      
      // Search for nodes
      const results = await NodeApi.searchNodes(
        { query: 'search term', types: ['component', 'subcomponent'] },
        { limit: 10 }
      );
    `
  }
);

