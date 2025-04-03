// VersionApi.js
// API client for version control and history operations using GitHub repository

import registry from '../ModuleRegistry';
import AuthApi from './AuthApi';
import ErrorHandler from '../utils/ErrorHandler';
import APP_SETTINGS from '../config/app-settings';

/**
 * VersionApi provides methods for version control and history operations.
 * It utilizes GitHub's commit history as a versioning system.
 */
class VersionApi {
  constructor() {
    this.githubService = null;
    this.dataService = null;
    this.authApi = null;
    this.initialized = false;
  }

  /**
   * Initialize the API
   */
  async initialize() {
    if (this.initialized) return;
    
    this.githubService = registry.getModule('api.GitHubService');
    this.dataService = registry.getModule('data.DataService');
    this.authApi = registry.getModule('api.AuthApi');
    
    if (!this.githubService) {
      throw new Error('GitHubService not found in registry');
    }
    
    if (!this.dataService) {
      throw new Error('DataService not found in registry');
    }
    
    if (!this.authApi) {
      throw new Error('AuthApi not found in registry');
    }
    
    this.initialized = true;
  }

  /**
   * Get version history for a content item from GitHub commit history
   * 
   * @param {string} contentType - Type of content (e.g., 'node', 'relationship')
   * @param {string} contentId - ID of the content item
   * @param {Object} [options] - Request options
   * @param {number} [options.limit=20] - Maximum number of versions per page
   * @param {number} [options.page=1] - Page number
   * @returns {Promise<Object>} Paginated list of versions
   */
  async getVersionHistory(contentType, contentId, options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!contentType || !contentId) {
        throw ErrorHandler.createError(
          'Content type and ID are required',
          'ValidationError',
          'MISSING_CONTENT_PARAMS'
        );
      }

      // Determine the file path based on content type
      const filePath = this._getContentFilePath(contentType);
      
      if (!filePath) {
        throw ErrorHandler.createError(
          `Unsupported content type: ${contentType}`,
          'ValidationError',
          'UNSUPPORTED_CONTENT_TYPE'
        );
      }
      
      // Get file history from GitHub
      const history = await this.githubService.getFileHistory(filePath, {
        per_page: options.limit || 20,
        page: options.page || 1
      });
      
      // Filter commits that affected the specific content item
      // This requires examining each commit to see if it modified the specified content
      const contentVersions = await this._filterCommitsByContent(history, contentType, contentId);
      
      return {
        versions: contentVersions,
        total: contentVersions.length, // Approximation, GitHub API doesn't provide total count
        page: options.page || 1,
        totalPages: contentVersions.length > 0 ? Math.ceil(contentVersions.length / (options.limit || 20)) : 1,
        contentId,
        contentType
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to get version history for ${contentType} with ID: ${contentId}`
      );
    }
  }

  /**
   * Get a specific version of content from a GitHub commit
   * 
   * @param {string} versionId - Version ID (commit SHA)
   * @returns {Promise<Object>} Version data with content
   */
  async getVersion(versionId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!versionId) {
        throw ErrorHandler.createError(
          'Version ID is required',
          'ValidationError',
          'MISSING_VERSION_ID'
        );
      }

      // Get the commit data from GitHub
      const commit = await this.githubService.getCommit(versionId);
      
      if (!commit) {
        throw ErrorHandler.createError(
          `Commit not found with SHA: ${versionId}`,
          'NotFoundError',
          'COMMIT_NOT_FOUND'
        );
      }
      
      // Extract content file changes from the commit
      const fileChanges = commit.files || [];
      
      // Get content data for each changed file
      const contentChanges = await Promise.all(
        fileChanges.map(async file => {
          try {
            // Get file content at this commit
            const fileContent = await this.githubService.getFileAtCommit(file.filename, versionId);
            
            return {
              path: file.filename,
              content: fileContent,
              contentType: this._getContentTypeFromPath(file.filename)
            };
          } catch (error) {
            console.error(`Error getting file ${file.filename} at commit ${versionId}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null entries and organize by content type
      const validChanges = contentChanges.filter(Boolean);
      const contentByType = {};
      
      validChanges.forEach(change => {
        if (!contentByType[change.contentType]) {
          contentByType[change.contentType] = [];
        }
        contentByType[change.contentType].push(change.content);
      });
      
      return {
        id: versionId,
        sha: versionId,
        createdAt: commit.commit.author.date,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email
        },
        message: commit.commit.message,
        fileChanges: fileChanges.map(file => ({
          path: file.filename,
          changes: file.changes,
          additions: file.additions,
          deletions: file.deletions
        })),
        content: contentByType
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to get version with ID: ${versionId}`
      );
    }
  }

  /**
   * Create a new version of content by committing changes to GitHub
   * 
   * @param {string} contentType - Type of content (e.g., 'node', 'relationship')
   * @param {string} contentId - ID of the content item
   * @param {Object} contentData - Content data to save
   * @param {string} [commitMessage] - Optional message describing the changes
   * @returns {Promise<Object>} Created version
   */
  async createVersion(contentType, contentId, contentData, commitMessage = '') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!contentType || !contentId || !contentData) {
        throw ErrorHandler.createError(
          'Content type, ID, and data are required',
          'ValidationError',
          'MISSING_VERSION_PARAMS'
        );
      }

      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required to create versions',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Determine the file path based on content type
      const filePath = this._getContentFilePath(contentType);
      
      if (!filePath) {
        throw ErrorHandler.createError(
          `Unsupported content type: ${contentType}`,
          'ValidationError',
          'UNSUPPORTED_CONTENT_TYPE'
        );
      }
      
      // Get current file content
      let currentContent = [];
      try {
        currentContent = await this.githubService.fetchFile(filePath);
      } catch (error) {
        // If file doesn't exist, we'll create it
        if (error.status !== 404) {
          throw error;
        }
      }
      
      // Update or add the content item
      let updatedContent;
      if (Array.isArray(currentContent)) {
        // Find and update the item if it exists
        const existingIndex = currentContent.findIndex(item => item.id === contentId);
        
        if (existingIndex >= 0) {
          updatedContent = [
            ...currentContent.slice(0, existingIndex),
            { ...currentContent[existingIndex], ...contentData },
            ...currentContent.slice(existingIndex + 1)
          ];
        } else {
          // Add new item
          updatedContent = [...currentContent, contentData];
        }
      } else if (typeof currentContent === 'object') {
        // For object storage format
        updatedContent = {
          ...currentContent,
          [contentId]: contentData
        };
      } else {
        // Create new array with single item
        updatedContent = [contentData];
      }
      
      // Create commit message if not provided
      const message = commitMessage || `Update ${contentType} ${contentId}`;
      
      // Save to GitHub
      const result = await this.githubService.saveFile(filePath, updatedContent, message);
      
      return {
        id: result.commit.sha,
        sha: result.commit.sha,
        createdAt: new Date().toISOString(),
        author: {
          name: session.user?.name || 'User',
          email: session.user?.email || 'user@example.com'
        },
        message,
        content: contentData
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to create version for ${contentType} with ID: ${contentId}`
      );
    }
  }

  /**
   * Revert content to a specific version by creating a new commit that reverts changes
   * 
   * @param {string} versionId - Version ID (commit SHA) to revert to
   * @param {string} [reason] - Reason for reverting
   * @returns {Promise<Object>} Result with new current version
   */
  async revertToVersion(versionId, reason = '') {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!versionId) {
        throw ErrorHandler.createError(
          'Version ID is required',
          'ValidationError',
          'MISSING_VERSION_ID'
        );
      }

      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required to revert versions',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Get the version data
      const version = await this.getVersion(versionId);
      
      if (!version) {
        throw ErrorHandler.createError(
          `Version not found with ID: ${versionId}`,
          'NotFoundError',
          'VERSION_NOT_FOUND'
        );
      }
      
      // Create commits for each file to revert it to this version
      const results = [];
      
      for (const file of version.fileChanges) {
        const content = await this.githubService.getFileAtCommit(file.path, versionId);
        
        const commitMessage = reason
          ? `Revert to version ${versionId.substring(0, 7)}: ${reason}`
          : `Revert to version ${versionId.substring(0, 7)}`;
        
        const result = await this.githubService.saveFile(file.path, content, commitMessage);
        
        results.push({
          path: file.path,
          commitSha: result.commit.sha
        });
      }
      
      // Return success with the new version info
      return {
        success: true,
        revertedTo: versionId,
        newCommits: results
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to revert to version with ID: ${versionId}`
      );
    }
  }

  /**
   * Compare two versions to see differences using GitHub's comparison API
   * 
   * @param {string} versionId1 - First version ID (commit SHA)
   * @param {string} versionId2 - Second version ID (commit SHA)
   * @returns {Promise<Object>} Differences between versions
   */
  async compareVersions(versionId1, versionId2) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!versionId1 || !versionId2) {
        throw ErrorHandler.createError(
          'Two version IDs are required for comparison',
          'ValidationError',
          'MISSING_VERSION_IDS'
        );
      }

      // Get the comparison from GitHub
      const comparison = await this.githubService.compareCommits(versionId1, versionId2);
      
      // Transform to a more useful format
      return {
        ahead_by: comparison.ahead_by,
        behind_by: comparison.behind_by,
        total_commits: comparison.total_commits,
        commits: comparison.commits.map(commit => ({
          id: commit.sha,
          message: commit.commit.message,
          author: {
            name: commit.commit.author.name,
            date: commit.commit.author.date
          }
        })),
        files: comparison.files.map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          contentType: this._getContentTypeFromPath(file.filename)
        }))
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to compare versions: ${versionId1} and ${versionId2}`
      );
    }
  }

  /**
   * Get version statistics for a content type
   * 
   * @param {string} contentType - Type of content (e.g., 'node', 'relationship')
   * @returns {Promise<Object>} Version statistics
   */
  async getVersionStats(contentType) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!contentType) {
        throw ErrorHandler.createError(
          'Content type is required',
          'ValidationError',
          'MISSING_CONTENT_TYPE'
        );
      }
      
      // Determine the file path based on content type
      const filePath = this._getContentFilePath(contentType);
      
      if (!filePath) {
        throw ErrorHandler.createError(
          `Unsupported content type: ${contentType}`,
          'ValidationError',
          'UNSUPPORTED_CONTENT_TYPE'
        );
      }

      // Get commit statistics from GitHub
      const stats = await this.githubService.getCommitStats(filePath);
      
      // Get contribution statistics
      const contributors = await this.githubService.getContributorsForFile(filePath);
      
      return {
        totalCommits: stats.total || 0,
        contributors: contributors.length,
        lastUpdated: stats.lastCommitDate,
        activeAuthors: contributors.slice(0, 5).map(c => ({
          name: c.author?.login || c.name,
          commitCount: c.total,
          lastCommit: c.weeks?.sort((a, b) => b.w - a.w)[0]?.w
        }))
      };
    } catch (error) {
      throw this._normalizeVersionError(
        error, 
        `Failed to get version statistics for ${contentType}`
      );
    }
  }

  /**
   * Get file path for a content type
   * @param {string} contentType - Content type
   * @returns {string|null} File path or null if not supported
   * @private
   */
  _getContentFilePath(contentType) {
    switch (contentType) {
      case 'node':
      case 'component':
        return APP_SETTINGS.dataPaths.components;
      case 'subcomponent':
        return APP_SETTINGS.dataPaths.subcomponents;
      default:
        return null;
    }
  }

  /**
   * Get content type from a file path
   * @param {string} path - File path
   * @returns {string} Content type
   * @private
   */
  _getContentTypeFromPath(path) {
    if (path === APP_SETTINGS.dataPaths.components) {
      return 'component';
    } else if (path === APP_SETTINGS.dataPaths.subcomponents) {
      return 'subcomponent';
    } else {
      // Default to generic type
      return 'content';
    }
  }

  /**
   * Filter commits by content item
   * @param {Array} commits - Commits from GitHub
   * @param {string} contentType - Content type
   * @param {string} contentId - Content ID
   * @returns {Promise<Array>} Filtered commits
   * @private
   */
  async _filterCommitsByContent(commits, contentType, contentId) {
    // This is a simplification - in a real implementation, we would need to
    // examine each commit's changes to see if they affected the specific content ID
    // For now, we'll check if the commit message contains the content ID
    return commits
      .filter(commit => commit.commit.message.includes(contentId))
      .map(commit => ({
        id: commit.sha,
        sha: commit.sha,
        createdAt: commit.commit.author.date,
        author: {
          name: commit.commit.author.name,
          email: commit.commit.author.email,
          avatar: commit.author?.avatar_url
        },
        message: commit.commit.message,
        url: commit.html_url
      }));
  }

  /**
   * Normalize errors for consistent response
   * @param {Error} error - Original error
   * @param {string} defaultMessage - Default error message
   * @returns {Error} Normalized error
   * @private
   */
  _normalizeVersionError(error, defaultMessage) {
    if (error.name === 'ValidationError' || error.name === 'NotFoundError' || error.name === 'AuthorizationError') {
      return error;
    }
    
    return ErrorHandler.createError(
      error.message || defaultMessage,
      'VersionApiError',
      error.code || 'VERSION_API_ERROR',
      { originalError: error }
    );
  }
}

// Create singleton instance
const versionApi = new VersionApi();

// Register with ModuleRegistry
export default registry.register(
  'api.VersionApi',
  versionApi,
  ['api.GitHubService', 'data.DataService', 'api.AuthApi', 'utils.ErrorHandler'],
  {
    description: 'API client for version control using GitHub history',
    usage: `
      // Get version history for a component
      const history = await VersionApi.getVersionHistory('component', 'comp-123');
      
      // Get a specific version (commit)
      const version = await VersionApi.getVersion('abc123commit');
      
      // Create a new version (commit)
      const newVersion = await VersionApi.createVersion('component', 'comp-123', updatedData, 'Update description');
      
      // Revert to a previous version
      await VersionApi.revertToVersion('abc123commit', 'Fix incorrect data');
      
      // Compare two versions
      const diff = await VersionApi.compareVersions('abc123commit', 'def456commit');
      
      // Get version statistics
      const stats = await VersionApi.getVersionStats('component');
    `
  }
);

