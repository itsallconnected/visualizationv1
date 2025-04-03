import registry from '../ModuleRegistry';
import AUTH_CONFIG from '../config/auth-config';
import ErrorHandler from '../utils/ErrorHandler';

/**
 * GitHub Authentication Service
 * 
 * This service provides GitHub-specific authentication functionality including
 * OAuth flow, repository access, and API interactions.
 */
class GitHubAuthService {
  constructor() {
    this.gitHubOAuth = null;
    this.eventBus = null;
    this.errorHandler = null;
    this.tokenKey = 'github_auth_token';
    this.webhookKey = 'github_webhook_id';
    this.userKey = 'github_user_data';
    
    // GitHub API endpoints
    this.apiBaseUrl = AUTH_CONFIG.github.apiUrl || 'https://api.github.com';
  }

  /**
   * Initialize the service
   */
  async initialize() {
    // Get dependencies from registry
    this.gitHubOAuth = registry.getModule('auth.GitHubOAuth');
    this.eventBus = registry.getModule('utils.EventBus');
    this.errorHandler = registry.getModule('utils.ErrorHandler');
    
    if (!this.gitHubOAuth) {
      console.error('GitHubOAuth module not available');
    }
    
    // Check for stored token and set it in OAuth client
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken && this.gitHubOAuth) {
      this.gitHubOAuth.setAccessToken(storedToken);
    }
    
    if (this.eventBus) {
      // Register for auth events
      this.eventBus.subscribe('auth:signOut', this.handleSignOut.bind(this));
    }
  }

  /**
   * Initiate GitHub login flow using OAuth
   * @returns {string} Authorization URL
   */
  initiateLogin() {
    if (!this.gitHubOAuth) {
      throw new Error('GitHub OAuth client not available');
    }
    
    try {
      // Generate authorization URL
      const authUrl = this.gitHubOAuth.generateAuthorizationUrl();
      
      // Publish event
      if (this.eventBus) {
        this.eventBus.publish('auth:loginInitiated', {
          provider: 'github'
        });
      }
      
      return authUrl;
    } catch (error) {
      this.handleError(error, 'Failed to initiate GitHub login');
      throw error;
    }
  }

  /**
   * Handle OAuth callback parameters
   * 
   * @param {string} code - Authorization code
   * @param {string} state - State parameter for CSRF verification
   * @returns {Promise<Object>} User data
   */
  async handleCallback(code, state) {
    if (!this.gitHubOAuth) {
      throw new Error('GitHub OAuth client not available');
    }
    
    try {
      // Exchange code for token
      const tokenInfo = await this.gitHubOAuth.exchangeCodeForToken(code, state);
      
      // Store token in local storage
      localStorage.setItem(this.tokenKey, tokenInfo.accessToken);
      
      // Get user profile
      const userData = await this.gitHubOAuth.getUserProfile();
      
      // Store user data
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      // Normalize and return user data
      const normalizedUser = this.normalizeUserData(userData);
      
      // Publish success event
      if (this.eventBus) {
        this.eventBus.publish('auth:signIn', {
          user: normalizedUser,
          provider: 'github',
          isAuthenticated: true
        });
      }
      
      return normalizedUser;
    } catch (error) {
      this.handleError(error, 'GitHub authentication failed');
      throw error;
    }
  }

  /**
   * Get the current user's profile
   * 
   * @returns {Promise<Object>} User profile data
   */
  async getCurrentUser() {
    const token = localStorage.getItem(this.tokenKey);
    
    if (!token || !this.gitHubOAuth) {
      return { isAuthenticated: false };
    }
    
    try {
      // Set token in OAuth client (in case it wasn't already)
      this.gitHubOAuth.setAccessToken(token);
      
      // Get fresh user profile from GitHub
      const userData = await this.gitHubOAuth.getUserProfile();
      
      // Update stored user data
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      // Return normalized user data
      return this.normalizeUserData(userData);
    } catch (error) {
      console.error('Error getting current GitHub user:', error);
      
      // Clear invalid token
      if (error.message.includes('Invalid or expired token')) {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        
        // Publish session expired event
        if (this.eventBus) {
          this.eventBus.publish('auth:sessionExpired', {
            message: 'GitHub authentication expired'
          });
        }
      }
      
      return { isAuthenticated: false };
    }
  }

  /**
   * Get user's repository permissions
   * 
   * @param {string} repository - Repository name (owner/repo)
   * @returns {Promise<Object>} Repository permissions
   */
  async getRepositoryPermissions(repository = AUTH_CONFIG.github.repository) {
    const token = localStorage.getItem(this.tokenKey);
    
    if (!token) {
      return {
        isAdmin: false,
        canEdit: false,
        canView: true // Public repos are viewable
      };
    }
    
    try {
      // Request repository data from GitHub API
      const response = await fetch(`${this.apiBaseUrl}/repos/${repository}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Token issue - clear and notify
          localStorage.removeItem(this.tokenKey);
          
          if (this.eventBus) {
            this.eventBus.publish('auth:sessionExpired', {
              message: 'GitHub authentication expired or insufficient permissions'
            });
          }
        }
        
        return {
          isAdmin: false,
          canEdit: false,
          canView: true
        };
      }
      
      const repoData = await response.json();
      
      // Update stored user data with permissions
      const userData = JSON.parse(localStorage.getItem(this.userKey) || '{}');
      userData.permissions = repoData.permissions || {};
      userData.isAdmin = repoData.permissions?.admin === true;
      userData.canEdit = repoData.permissions?.push === true || repoData.permissions?.admin === true;
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      // Return normalized permissions
      return {
        isAdmin: repoData.permissions?.admin === true,
        canEdit: repoData.permissions?.push === true || repoData.permissions?.admin === true,
        canView: true,
        raw: repoData.permissions
      };
    } catch (error) {
      console.error('Error checking GitHub repository permissions:', error);
      return {
        isAdmin: false,
        canEdit: false,
        canView: true
      };
    }
  }

  /**
   * Create repository webhook for events
   * 
   * @param {Object} options - Webhook configuration
   * @returns {Promise<Object>} Webhook data
   */
  async createWebhook(options) {
    if (!this.gitHubOAuth) {
      throw new Error('GitHub OAuth client not available');
    }
    
    try {
      const webhook = await this.gitHubOAuth.createRepositoryWebhook(options);
      
      // Store webhook ID
      if (webhook.id) {
        localStorage.setItem(this.webhookKey, webhook.id.toString());
      }
      
      return webhook;
    } catch (error) {
      this.handleError(error, 'Failed to create GitHub webhook');
      throw error;
    }
  }

  /**
   * Delete repository webhook
   * 
   * @param {string} webhookId - Webhook ID (if not provided, uses stored ID)
   * @param {string} repository - Repository name
   * @returns {Promise<boolean>} Success status
   */
  async deleteWebhook(webhookId, repository) {
    if (!this.gitHubOAuth) {
      throw new Error('GitHub OAuth client not available');
    }
    
    try {
      // If no webhook ID provided, use stored one
      const hookId = webhookId || localStorage.getItem(this.webhookKey);
      
      if (!hookId) {
        throw new Error('No webhook ID provided or stored');
      }
      
      const success = await this.gitHubOAuth.deleteRepositoryWebhook({
        webhookId: hookId,
        repository
      });
      
      // Clear stored webhook ID on success
      if (success) {
        localStorage.removeItem(this.webhookKey);
      }
      
      return success;
    } catch (error) {
      this.handleError(error, 'Failed to delete GitHub webhook');
      throw error;
    }
  }

  /**
   * Handle sign out event
   * @private
   */
  handleSignOut() {
    if (this.gitHubOAuth) {
      this.gitHubOAuth.setAccessToken(null);
    }
    
    // Clear stored data
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Normalize user data from GitHub API
   * 
   * @param {Object} userData - Raw user data from GitHub
   * @returns {Object} Normalized user data
   * @private
   */
  normalizeUserData(userData) {
    if (!userData) return { isAuthenticated: false };
    
    return {
      id: userData.id?.toString(),
      username: userData.login,
      name: userData.name,
      email: userData.email,
      avatar: userData.avatar_url,
      url: userData.html_url,
      bio: userData.bio,
      company: userData.company,
      location: userData.location,
      isAdmin: userData.isAdmin === true,
      canEdit: userData.canEdit === true,
      permissions: userData.permissions || {},
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
      isAuthenticated: true,
      provider: 'github',
      raw: userData
    };
  }

  /**
   * Handle and report errors
   * 
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @private
   */
  handleError(error, context) {
    console.error(`${context}:`, error);
    
    if (this.errorHandler) {
      this.errorHandler.handleError(error, {
        source: 'GitHubAuthService',
        context
      });
    }
    
    if (this.eventBus) {
      this.eventBus.publish('auth:error', {
        message: error.message || context,
        error,
        source: 'github'
      });
    }
  }
}

// Create singleton instance
const gitHubAuthService = new GitHubAuthService();

// Register with ModuleRegistry
export default registry.register(
  'services.GitHubAuthService',
  gitHubAuthService,
  ['auth.GitHubOAuth', 'utils.EventBus', 'utils.ErrorHandler'],
  {
    description: 'GitHub-specific authentication service',
    provides: ['githubAuth'],
    singleton: true
  }
); 