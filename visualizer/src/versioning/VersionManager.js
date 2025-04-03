/**
 * VersionManager
 * 
 * Manages content version history, tracking, and reversion capabilities.
 * This service provides version management for nodes, relationships,
 * and other content in the AI Alignment Visualization tool.
 */

import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

class VersionManager {
  constructor() {
    this.isInitialized = false;
    this.versionApi = null;
    this.dataService = null;
    this.currentVersionMap = new Map(); // Maps content IDs to current version IDs
    this.versionHistoryCache = new Map(); // Caches version history by content ID
    this.diffCache = new Map(); // Caches diff results by version pair
    this.tags = new Set(); // All known version tags
    
    // Version-related event handlers
    this.eventHandlers = {
      'content:updated': this.handleContentUpdated.bind(this),
      'content:created': this.handleContentCreated.bind(this),
      'version:revert': this.handleVersionRevert.bind(this),
      'version:tag': this.handleVersionTag.bind(this),
      'version:untag': this.handleVersionUntag.bind(this),
    };
  }
  
  /**
   * Initialize the version manager
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    if (this.isInitialized) return true;
    
    try {
      // Get required dependencies
      this.versionApi = registry.getModule('api.VersionApi');
      this.dataService = registry.getModule('data.DataService');
      
      if (!this.versionApi) {
        console.error('Failed to initialize VersionManager: VersionApi not found');
        return false;
      }
      
      if (!this.dataService) {
        console.error('Failed to initialize VersionManager: DataService not found');
        return false;
      }
      
      // Subscribe to events
      Object.entries(this.eventHandlers).forEach(([event, handler]) => {
        EventBus.subscribe(event, handler);
      });
      
      // Load tags
      await this.loadTags();
      
      this.isInitialized = true;
      
      EventBus.publish('version:manager:initialized', {
        success: true
      });
      
      return true;
    } catch (error) {
      console.error('Failed to initialize VersionManager:', error);
      
      EventBus.publish('version:manager:initialized', {
        success: false,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Dispose of resources
   */
  dispose() {
    if (!this.isInitialized) return;
    
    // Unsubscribe from events
    Object.entries(this.eventHandlers).forEach(([event, handler]) => {
      EventBus.unsubscribe(event, handler);
    });
    
    // Clear caches
    this.versionHistoryCache.clear();
    this.diffCache.clear();
    this.currentVersionMap.clear();
    this.tags.clear();
    
    this.isInitialized = false;
  }
  
  /**
   * Get version history for a content item
   * @param {string} contentType - Content type (e.g., 'node', 'relationship')
   * @param {string} contentId - Content ID
   * @param {Object} [options] - Request options
   * @param {boolean} [options.forceRefresh=false] - Force refresh from API
   * @param {number} [options.limit=20] - Max versions per page
   * @param {number} [options.page=1] - Page number
   * @returns {Promise<Object>} Version history
   */
  async getVersionHistory(contentType, contentId, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const cacheKey = `${contentType}:${contentId}:${options.page || 1}:${options.limit || 20}`;
    
    if (!options.forceRefresh && this.versionHistoryCache.has(cacheKey)) {
      return this.versionHistoryCache.get(cacheKey);
    }
    
    try {
      const history = await this.versionApi.getVersionHistory(contentType, contentId, {
        limit: options.limit || 20,
        page: options.page || 1,
        cache: !options.forceRefresh
      });
      
      // Store in cache
      this.versionHistoryCache.set(cacheKey, history);
      
      // Update current version map if this is the first page
      if ((options.page || 1) === 1 && history.versions.length > 0) {
        this.currentVersionMap.set(`${contentType}:${contentId}`, history.versions[0].id);
      }
      
      return history;
    } catch (error) {
      console.error(`Failed to get version history for ${contentType}:${contentId}:`, error);
      
      // Return empty result on error
      return {
        versions: [],
        total: 0,
        page: options.page || 1,
        totalPages: 1,
        contentId,
        contentType,
        error
      };
    }
  }
  
  /**
   * Get a specific version
   * @param {string} versionId - Version ID
   * @returns {Promise<Object|null>} Version object or null if not found
   */
  async getVersion(versionId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await this.versionApi.getVersion(versionId);
    } catch (error) {
      console.error(`Failed to get version ${versionId}:`, error);
      return null;
    }
  }
  
  /**
   * Create a new version of content
   * @param {string} contentType - Content type
   * @param {string} contentId - Content ID
   * @param {Object} contentData - Content data
   * @param {string} [commitMessage] - Optional message describing changes
   * @returns {Promise<Object|null>} Created version or null on failure
   */
  async createVersion(contentType, contentId, contentData, commitMessage = '') {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const version = await this.versionApi.createVersion(
        contentType, 
        contentId, 
        contentData, 
        commitMessage
      );
      
      // Update current version map
      if (version) {
        this.currentVersionMap.set(`${contentType}:${contentId}`, version.id);
        
        // Clear cache for this content
        this.clearContentCache(contentType, contentId);
        
        // Publish event
        EventBus.publish('version:created', {
          versionId: version.id,
          contentType,
          contentId,
          version
        });
      }
      
      return version;
    } catch (error) {
      console.error(`Failed to create version for ${contentType}:${contentId}:`, error);
      
      // Publish error event
      EventBus.publish('version:creation:failed', {
        contentType,
        contentId,
        error
      });
      
      return null;
    }
  }
  
  /**
   * Revert to a specific version
   * @param {string} versionId - Version ID to revert to
   * @param {string} [reason] - Reason for reverting
   * @returns {Promise<boolean>} Success status
   */
  async revertToVersion(versionId, reason = '') {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const result = await this.versionApi.revertToVersion(versionId, reason);
      
      if (result.success && result.currentVersion) {
        // Get reverted version details
        const version = await this.getVersion(result.currentVersion.id);
        
        if (version) {
          // Update current version map
          this.currentVersionMap.set(
            `${version.contentType}:${version.contentId}`, 
            version.id
          );
          
          // Clear cache for this content
          this.clearContentCache(version.contentType, version.contentId);
          
          // Update content in data service - use the appropriate method based on content type
          if (version.contentType === 'node') {
            // For nodes, use updateNode method
            await this.dataService.updateNode(
              version.contentId,
              { 
                data: version.content,
                // Include metadata about the reversion
                versionInfo: {
                  revertedFrom: versionId,
                  revertedAt: new Date().toISOString(),
                  reason: reason || 'Manual version revert'
                }
              }
            );
          } else if (version.contentType === 'relationship') {
            // We would need a method for updating relationships if that exists
            console.warn(`Reverting ${version.contentType} content not directly supported`);
            
            // Publish event to notify about the update - other systems might handle it
            EventBus.publish('content:updated', {
              contentType: version.contentType,
              contentId: version.contentId,
              content: version.content,
              versionId: version.id
            });
          } else {
            // Generic content update - let clients handle this
            console.warn(`Reverting ${version.contentType} content not directly supported`);
            
            // Publish event to notify about the update - other systems might handle it
            EventBus.publish('content:updated', {
              contentType: version.contentType,
              contentId: version.contentId,
              content: version.content,
              versionId: version.id
            });
          }
          
          // Publish event
          EventBus.publish('version:reverted', {
            versionId,
            currentVersionId: version.id,
            contentType: version.contentType,
            contentId: version.contentId,
            reason
          });
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to revert to version ${versionId}:`, error);
      
      // Publish error event
      EventBus.publish('version:revert:failed', {
        versionId,
        error
      });
      
      return false;
    }
  }
  
  /**
   * Compare two versions to see differences
   * @param {string} versionId1 - First version ID
   * @param {string} versionId2 - Second version ID
   * @param {boolean} [forceRefresh=false] - Force refresh from API
   * @returns {Promise<Object|null>} Comparison result or null on failure
   */
  async compareVersions(versionId1, versionId2, forceRefresh = false) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Sort IDs for consistent caching
    const [firstId, secondId] = [versionId1, versionId2].sort();
    const cacheKey = `${firstId}:${secondId}`;
    
    if (!forceRefresh && this.diffCache.has(cacheKey)) {
      return this.diffCache.get(cacheKey);
    }
    
    try {
      const comparison = await this.versionApi.compareVersions(versionId1, versionId2);
      
      // Store in cache
      this.diffCache.set(cacheKey, comparison);
      
      return comparison;
    } catch (error) {
      console.error(`Failed to compare versions ${versionId1} and ${versionId2}:`, error);
      return null;
    }
  }
  
  /**
   * Tag a version
   * @param {string} versionId - Version ID
   * @param {string} tag - Tag name
   * @returns {Promise<boolean>} Success status
   */
  async tagVersion(versionId, tag) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const result = await this.versionApi.tagVersion(versionId, tag);
      
      if (result.success) {
        // Add to tags set
        this.tags.add(tag);
        
        // Publish event
        EventBus.publish('version:tagged', {
          versionId,
          tag,
          version: result.version
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to tag version ${versionId} with ${tag}:`, error);
      return false;
    }
  }
  
  /**
   * Remove a tag from a version
   * @param {string} versionId - Version ID
   * @param {string} tag - Tag to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeVersionTag(versionId, tag) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const result = await this.versionApi.removeVersionTag(versionId, tag);
      
      if (result.success) {
        // Publish event
        EventBus.publish('version:untagged', {
          versionId,
          tag,
          version: result.version
        });
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to remove tag ${tag} from version ${versionId}:`, error);
      return false;
    }
  }
  
  /**
   * Get all versions with a specific tag
   * @param {string} tag - Tag to filter by
   * @param {Object} [options] - Request options
   * @returns {Promise<Object>} Versions with the tag
   */
  async getVersionsByTag(tag, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await this.versionApi.getVersionsByTag(tag, options);
    } catch (error) {
      console.error(`Failed to get versions with tag ${tag}:`, error);
      
      // Return empty result on error
      return {
        versions: [],
        total: 0,
        page: options.page || 1,
        totalPages: 1,
        tag,
        error
      };
    }
  }
  
  /**
   * Get all known version tags
   * @param {boolean} [forceRefresh=false] - Force refresh from API
   * @returns {Promise<Array<string>>} Array of tags
   */
  async getTags(forceRefresh = false) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (forceRefresh || this.tags.size === 0) {
      await this.loadTags();
    }
    
    return Array.from(this.tags);
  }
  
  /**
   * Load all tags from API
   * @private
   */
  async loadTags() {
    try {
      const stats = await this.versionApi.getVersionStats();
      
      if (stats && stats.tags) {
        this.tags = new Set(stats.tags);
      }
    } catch (error) {
      console.error('Failed to load version tags:', error);
    }
  }
  
  /**
   * Clear cache for a specific content item
   * @param {string} contentType - Content type
   * @param {string} contentId - Content ID
   * @private
   */
  clearContentCache(contentType, contentId) {
    // Clear all cache entries for this content
    const prefix = `${contentType}:${contentId}:`;
    
    for (const key of this.versionHistoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.versionHistoryCache.delete(key);
      }
    }
  }
  
  /**
   * Handle content updated event
   * @param {Object} data - Event data
   * @private
   */
  async handleContentUpdated(data) {
    if (!data || !data.contentType || !data.contentId || !data.content) {
      return;
    }
    
    // Create version for updated content
    await this.createVersion(
      data.contentType, 
      data.contentId, 
      data.content, 
      data.commitMessage || 'Content updated'
    );
  }
  
  /**
   * Handle content created event
   * @param {Object} data - Event data
   * @private
   */
  async handleContentCreated(data) {
    if (!data || !data.contentType || !data.contentId || !data.content) {
      return;
    }
    
    // Create initial version
    await this.createVersion(
      data.contentType, 
      data.contentId, 
      data.content, 
      data.commitMessage || 'Initial version'
    );
  }
  
  /**
   * Handle version revert event
   * @param {Object} data - Event data
   * @private
   */
  async handleVersionRevert(data) {
    if (!data || !data.versionId) {
      return;
    }
    
    await this.revertToVersion(data.versionId, data.reason);
  }
  
  /**
   * Handle version tag event
   * @param {Object} data - Event data
   * @private
   */
  async handleVersionTag(data) {
    if (!data || !data.versionId || !data.tag) {
      return;
    }
    
    await this.tagVersion(data.versionId, data.tag);
  }
  
  /**
   * Handle version untag event
   * @param {Object} data - Event data
   * @private
   */
  async handleVersionUntag(data) {
    if (!data || !data.versionId || !data.tag) {
      return;
    }
    
    await this.removeVersionTag(data.versionId, data.tag);
  }
  
  /**
   * Get version statistics
   * @param {string} [contentType] - Optional content type filter
   * @returns {Promise<Object|null>} Version statistics or null on failure
   */
  async getVersionStats(contentType) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      return await this.versionApi.getVersionStats(contentType);
    } catch (error) {
      console.error('Failed to get version statistics:', error);
      return null;
    }
  }
}

const versionManager = new VersionManager();

// Export and register the module
export default registry.register(
  'versioning.VersionManager',
  versionManager,
  ['data.DataService', 'api.VersionApi', 'utils.EventBus'],
  {
    description: 'Manages version tracking, history, and version control operations',
    usage: `
      // Initialize version manager
      await VersionManager.initialize();
      
      // Get version history
      const history = await VersionManager.getVersionHistory('node', 'node-123');
      
      // Create a new version
      await VersionManager.createVersion('node', 'node-123', updatedNodeData, 'Updated description');
      
      // Revert to a previous version
      await VersionManager.revertToVersion('version-456', 'Rolling back changes');
      
      // Compare two versions
      const diff = await VersionManager.compareVersions('version-123', 'version-456');
      
      // Tag a version
      await VersionManager.tagVersion('version-789', 'stable-release');
      
      // Find versions with a specific tag
      const stableVersions = await VersionManager.getVersionsByTag('stable-release');
    `
  }
);

