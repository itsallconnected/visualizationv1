// AdminApi.js
// API client for administration and system management using GitHub API

import registry from '../ModuleRegistry';
import AuthApi from './AuthApi';
import ValidationHelpers from '../utils/ValidationHelpers';
import ErrorHandler from '../utils/ErrorHandler';
import APP_SETTINGS from '../config/app-settings';

/**
 * AdminApi provides methods for administrative operations including
 * user management, permission assignment, content moderation, and system configuration.
 * For GitHub-based authentication, this API focuses on GitHub repository management.
 */
class AdminApi {
  constructor() {
    this.githubService = null;
    this.authApi = null;
    this.initialized = false;
  }

  /**
   * Initialize the API
   */
  async initialize() {
    if (this.initialized) return;
    
    this.githubService = registry.getModule('api.GitHubService');
    this.authApi = registry.getModule('api.AuthApi');
    
    if (!this.githubService) {
      throw new Error('GitHubService not found in registry');
    }
    
    if (!this.authApi) {
      throw new Error('AuthApi not found in registry');
    }
    
    this.initialized = true;
  }

  /**
   * Get all users who have contributed to the repository
   * 
   * @param {Object} [options] - Request options
   * @param {number} [options.limit=20] - Maximum number of users per page
   * @param {number} [options.page=1] - Page number
   * @returns {Promise<Object>} Paginated list of contributors
   */
  async getUsers(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Get repository contributors from GitHub
      const contributors = await this.githubService.fetchContributors({
        per_page: options.limit || 20,
        page: options.page || 1
      });

      return {
        users: contributors.map(contributor => ({
          id: contributor.id,
          login: contributor.login,
          avatarUrl: contributor.avatar_url,
          contributions: contributor.contributions,
          type: contributor.type,
          url: contributor.html_url
        })),
        total: contributors.length, // GitHub API doesn't provide total count
        page: options.page || 1,
        totalPages: 1 // Approximation, would need link header parsing for accuracy
      };
    } catch (error) {
      throw this._normalizeAdminError(error, 'Failed to get repository contributors');
    }
  }

  /**
   * Get a GitHub user by their login
   * 
   * @param {string} login - GitHub username
   * @returns {Promise<Object>} User details
   */
  async getUserById(login) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!login) {
        throw ErrorHandler.createError(
          'GitHub username is required',
          'ValidationError',
          'MISSING_USERNAME'
        );
      }

      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Get user details from GitHub
      const user = await this.githubService.fetchUser(login);

      return {
        id: user.id,
        login: user.login,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        location: user.location,
        company: user.company,
        url: user.html_url,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        type: user.type
      };
    } catch (error) {
      throw this._normalizeAdminError(error, `Failed to get user with login: ${login}`);
    }
  }

  /**
   * Get system configuration from the GitHub repository
   * 
   * @returns {Promise<Object>} System configuration
   */
  async getSystemConfig() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Get the config file from the GitHub repository
      const configPath = APP_SETTINGS.admin.configPath || 'config/system-config.json';
      const config = await this.githubService.fetchFile(configPath);

      return config || {};
    } catch (error) {
      // If file not found, return empty config
      if (error.status === 404) {
        return {};
      }
      throw this._normalizeAdminError(error, 'Failed to get system configuration');
    }
  }

  /**
   * Update system configuration in the GitHub repository
   * 
   * @param {Object} configData - Configuration data to update
   * @returns {Promise<Object>} Updated configuration
   */
  async updateSystemConfig(configData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      if (!configData || typeof configData !== 'object') {
        throw ErrorHandler.createError(
          'Configuration data is required',
          'ValidationError',
          'MISSING_CONFIG_DATA'
        );
      }

      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Save the config to the GitHub repository
      const configPath = APP_SETTINGS.admin.configPath || 'config/system-config.json';
      
      // Get current config to merge
      let currentConfig = {};
      try {
        currentConfig = await this.githubService.fetchFile(configPath);
      } catch (error) {
        // If file not found, create a new one
        if (error.status !== 404) {
          throw error;
        }
      }

      // Merge with new config
      const updatedConfig = {
        ...currentConfig,
        ...configData,
        updatedAt: new Date().toISOString()
      };

      // Save to GitHub
      await this.githubService.saveFile(
        configPath,
        updatedConfig,
        'Update system configuration'
      );

      return updatedConfig;
    } catch (error) {
      throw this._normalizeAdminError(error, 'Failed to update system configuration');
    }
  }

  /**
   * Get repository activity (commits) as audit logs
   * 
   * @param {Object} [options] - Request options
   * @param {number} [options.limit=30] - Maximum number of logs per page
   * @param {number} [options.page=1] - Page number
   * @returns {Promise<Object>} Paginated list of activity logs
   */
  async getAuditLogs(options = {}) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Get repository commits from GitHub as activity logs
      const commits = await this.githubService.fetchCommits({
        per_page: options.limit || 30,
        page: options.page || 1
      });

      return {
        logs: commits.map(commit => ({
          id: commit.sha,
          type: 'commit',
          action: 'push',
          userId: commit.author ? commit.author.id : null,
          userName: commit.commit.author.name,
          userEmail: commit.commit.author.email,
          timestamp: commit.commit.author.date,
          message: commit.commit.message,
          url: commit.html_url
        })),
        total: commits.length, // GitHub API doesn't provide total count
        page: options.page || 1,
        totalPages: 1 // Approximation, would need link header parsing for accuracy
      };
    } catch (error) {
      throw this._normalizeAdminError(error, 'Failed to get activity logs');
    }
  }

  /**
   * Get repository statistics
   * 
   * @returns {Promise<Object>} Repository statistics
   */
  async getRepositoryStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const session = await this.authApi.getCurrentSession();
      
      if (!session.isAuthenticated) {
        throw ErrorHandler.createError(
          'Authentication required for admin operations',
          'AuthorizationError',
          'AUTH_REQUIRED'
        );
      }

      // Check if user has admin permission
      const userPermissions = await this.authApi.getUserPermissions();
      if (!userPermissions.isAdmin) {
        throw ErrorHandler.createError(
          'Admin permission required',
          'AuthorizationError',
          'ADMIN_PERMISSION_REQUIRED'
        );
      }

      // Get repository information
      const repoInfo = await this.githubService.fetchRepositoryInfo();
      
      // Get contributor statistics
      const contributorStats = await this.githubService.fetchContributorStats();

      return {
        name: repoInfo.name,
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        openIssues: repoInfo.open_issues_count,
        watchers: repoInfo.watchers_count,
        defaultBranch: repoInfo.default_branch,
        createdAt: repoInfo.created_at,
        updatedAt: repoInfo.updated_at,
        pushedAt: repoInfo.pushed_at,
        size: repoInfo.size,
        contributorCount: contributorStats ? contributorStats.length : 0,
        totalCommits: contributorStats ? contributorStats.reduce((sum, user) => sum + user.total, 0) : 0
      };
    } catch (error) {
      throw this._normalizeAdminError(error, 'Failed to get repository statistics');
    }
  }

  /**
   * Normalize errors for consistent response
   * @param {Error} error - Original error
   * @param {string} defaultMessage - Default error message
   * @returns {Error} Normalized error
   * @private
   */
  _normalizeAdminError(error, defaultMessage) {
    if (error.name === 'AuthorizationError' || error.name === 'ValidationError') {
      return error;
    }
    
    return ErrorHandler.createError(
      error.message || defaultMessage,
      'AdminApiError',
      error.code || 'ADMIN_API_ERROR',
      { originalError: error }
    );
  }
}

// Create singleton instance
const adminApi = new AdminApi();

// Register with ModuleRegistry
export default registry.register(
  'api.AdminApi',
  adminApi,
  ['api.GitHubService', 'api.AuthApi', 'utils.ErrorHandler'],
  {
    description: 'API client for administration and system management using GitHub API',
    usage: `
      // Get repository contributors
      const users = await AdminApi.getUsers();
      
      // Get a GitHub user by login
      const user = await AdminApi.getUserById('username');
      
      // Get system configuration
      const config = await AdminApi.getSystemConfig();
      
      // Update system configuration
      await AdminApi.updateSystemConfig({ featureFlag: true });
      
      // Get audit logs (repository commits)
      const logs = await AdminApi.getAuditLogs();
      
      // Get repository statistics
      const stats = await AdminApi.getRepositoryStats();
    `
  }
);

