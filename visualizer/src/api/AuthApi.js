// AuthApi.js
// API client for GitHub-based authentication and user management

import registry from '../ModuleRegistry';
import ErrorHandler from '../utils/ErrorHandler';

/**
 * AuthApi provides methods for GitHub-based authentication and user management.
 * It serves as a thin wrapper around AuthService to maintain API consistency.
 */
class AuthApi {
  constructor() {
    this.authService = null;
  }
  
  /**
   * Initialize the API by getting a reference to the auth service
   */
  initialize() {
    this.authService = registry.getModule('auth.AuthService');
    if (!this.authService) {
      console.error('AuthService not found in registry. AuthApi will not work properly.');
    }
  }
  
  /**
   * Initiate GitHub OAuth flow
   * Redirects to GitHub login page
   */
  initiateLogin() {
    if (!this.authService) {
      throw new Error('AuthService not initialized');
    }
    
    this.authService.initiateGitHubLogin();
  }
  
  /**
   * Handle GitHub OAuth callback
   * 
   * @param {string} code - Authorization code from GitHub
   * @param {string} state - State parameter from GitHub
   * @returns {Promise<Object>} Authentication result with user data
   */
  async handleAuthCallback(code, state) {
    if (!this.authService) {
      throw ErrorHandler.createError(
        'AuthService not initialized',
        'InitializationError',
        'AUTH_SERVICE_NOT_INITIALIZED'
      );
    }
    
    return this.authService.handleAuthCallback(code, state);
  }
  
  /**
   * Sign out the current user
   * 
   * @returns {Promise<Object>} Result of sign out
   */
  async signOut() {
    if (!this.authService) {
      throw ErrorHandler.createError(
        'AuthService not initialized',
        'InitializationError',
        'AUTH_SERVICE_NOT_INITIALIZED'
      );
    }
    
    return this.authService.signOut();
  }
  
  /**
   * Get the current user
   * 
   * @returns {Promise<Object>} Current user info or null if not authenticated
   */
  async getCurrentUser() {
    if (!this.authService) {
      return { isAuthenticated: false };
    }
    
    return this.authService.getCurrentUser();
  }
  
  /**
   * Get the current user's session
   * 
   * @returns {Promise<Object>} User session with tokens
   */
  async getCurrentSession() {
    if (!this.authService) {
      return { isAuthenticated: false };
    }
    
    return this.authService.getCurrentSession();
  }
  
  /**
   * Get the access token
   * 
   * @returns {string|null} Access token or null if not authenticated
   */
  getAccessToken() {
    if (!this.authService) {
      return null;
    }
    
    return this.authService.getAccessToken();
  }
  
  /**
   * Get user permissions
   * 
   * @returns {Promise<Object>} User permissions
   */
  async getUserPermissions() {
    if (!this.authService) {
      return {
        isAdmin: false,
        canEdit: false,
        canView: true
      };
    }
    
    return this.authService.getUserPermissions();
  }
}

// Create singleton instance
const authApi = new AuthApi();

// Register with ModuleRegistry
export default registry.register(
  'api.AuthApi',
  authApi,
  ['auth.AuthService', 'utils.ErrorHandler'],
  {
    description: 'API client for GitHub-based authentication',
    singleton: true
  }
); 