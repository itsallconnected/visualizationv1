// AuthService.js
// Core authentication functionality that uses GitHub OAuth

import registry from '../ModuleRegistry';
import ErrorHandler from '../utils/ErrorHandler';
import ValidationHelpers from '../utils/ValidationHelpers';
import EventBus from '../utils/EventBus';
import APP_SETTINGS from '../config/app-settings';

/**
 * AuthService provides core authentication functionality using GitHub OAuth.
 * It handles user authentication, session management, and provides methods for authentication operations.
 */
class AuthService {
  constructor() {
    this.sessionCheckInterval = null;
    this.sessionCheckEnabled = true;
    this.sessionCheckIntervalTime = 5 * 60 * 1000; // 5 minutes
    this.gitHubService = null;
    this.eventBus = null;
    this.tokenKey = 'github_auth_token';
    this.stateKey = 'github_auth_state';
    this.userKey = 'github_user_data';
    this.expiryKey = 'github_token_expiry';
    this.codeChallengeKey = 'github_code_challenge';
    this.codeVerifierKey = 'github_code_verifier';
    this.tokenRefreshAttempted = false;
    
    // Start session monitoring
    this._startSessionMonitoring();
  }

  /**
   * Initialize the service
   */
  async initialize() {
    this.gitHubService = registry.getModule('api.GitHubService');
    this.eventBus = registry.getModule('utils.EventBus');
    
    if (!this.gitHubService) {
      console.error('GitHubService not available, authentication functionality will be limited');
    }
    
    if (!this.eventBus) {
      console.error('EventBus not available, authentication events will not be published');
      this.eventBus = { publish: () => {} }; // Create dummy event publisher to avoid null checks
    }
    
    // Check URL for OAuth callback parameters
    if (window.location.search.includes('code=')) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        
        if (code && state) {
          await this.handleAuthCallback(code, state);
          
          // Clean up URL after handling callback
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Publish successful authentication event
          this.eventBus.publish('auth:signIn', { success: true });
        }
      } catch (error) {
        console.error('Error handling OAuth callback:', error);
        this.eventBus.publish('auth:error', { 
          message: 'Failed to complete authentication', 
          error 
        });
      }
    }
    
    // Use stored token if available
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken) {
      // Verify token is valid
      try {
        const userData = await this.getUserDataFromGitHub(storedToken);
        if (userData && userData.id) {
          console.log('Valid GitHub token found in storage');
          
          // Store user data
          localStorage.setItem(this.userKey, JSON.stringify(userData));
          
          // Pass token to GitHubService
          if (this.gitHubService) {
            this.gitHubService.setAccessToken(storedToken);
          }
          
          // Publish sign in event
          this.eventBus.publish('auth:restored', { 
            user: userData,
        isAuthenticated: true
          });
        }
    } catch (error) {
        console.warn('Stored GitHub token is invalid, clearing');
        this._clearAuthData();
        this.eventBus.publish('auth:sessionExpired', { 
          message: 'Stored authentication expired or invalid' 
        });
      }
    }
  }

  /**
   * Initiate GitHub OAuth flow
   * 
   * @returns {void} Redirects to GitHub login page
   */
  initiateGitHubLogin() {
    // Verify required settings
    if (!APP_SETTINGS.auth.clientId) {
      const error = new Error('GitHub OAuth client ID not configured');
      this.eventBus.publish('auth:error', { message: error.message, error });
      throw error;
    }
    
    if (!APP_SETTINGS.auth.redirectUri) {
      const error = new Error('GitHub OAuth redirect URI not configured');
      this.eventBus.publish('auth:error', { message: error.message, error });
      throw error;
    }
    
    // Clear any existing auth data before starting new flow
    this._clearAuthData();
    
    const clientId = APP_SETTINGS.auth.clientId;
    const redirectUri = APP_SETTINGS.auth.redirectUri;
    const scopes = APP_SETTINGS.auth.scopes.join(' ');
    
    // Generate a random state parameter for security
    const state = this._generateRandomState();
    localStorage.setItem(this.stateKey, state);
    
    // Generate PKCE code verifier and challenge
    const usePkce = APP_SETTINGS.auth.pkceEnabled !== false;
    let codeChallenge = null;
    
    if (usePkce) {
      const codeVerifier = this._generateCodeVerifier();
      codeChallenge = this._generateCodeChallenge(codeVerifier);
      
      // Store code verifier for later verification
      localStorage.setItem(this.codeVerifierKey, codeVerifier);
      localStorage.setItem(this.codeChallengeKey, codeChallenge);
    }
    
    // Publish login initiated event
    this.eventBus.publish('auth:loginInitiated');
    
    // Redirect to GitHub OAuth page
    let githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
    
    // Add code challenge if PKCE is enabled
    if (usePkce && codeChallenge) {
      githubAuthUrl += `&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    }
    
    window.location.href = githubAuthUrl;
  }

  /**
   * Handle the OAuth callback
   * 
   * @param {string} code - Authorization code from GitHub
   * @param {string} state - State parameter from GitHub
   * @returns {Promise<Object>} Authentication result
   */
  async handleAuthCallback(code, state) {
    try {
      // Verify state parameter
      const savedState = localStorage.getItem(this.stateKey);
      if (!savedState || savedState !== state) {
        const error = ErrorHandler.createError(
          'Invalid state parameter - possible CSRF attack attempt',
          'AuthorizationError',
          'INVALID_STATE'
        );
        this.eventBus.publish('auth:error', { message: error.message, error });
        throw error;
      }
      
      // Clear state from storage
      localStorage.removeItem(this.stateKey);
      
      if (!code) {
        const error = ErrorHandler.createError(
          'No authorization code provided',
          'AuthorizationError',
          'MISSING_CODE'
        );
        this.eventBus.publish('auth:error', { message: error.message, error });
        throw error;
      }
      
      // Retrieve PKCE code verifier if it exists
      const codeVerifier = localStorage.getItem(this.codeVerifierKey);
      
      // Exchange code for token via proxy service
      const token = await this.exchangeCodeForToken(code, codeVerifier);
      
      // Clean up PKCE values
      localStorage.removeItem(this.codeVerifierKey);
      localStorage.removeItem(this.codeChallengeKey);
      
      // Get user data from GitHub
      const userData = await this.getUserDataFromGitHub(token);
      
      // Save auth data
      localStorage.setItem(this.tokenKey, token);
      localStorage.setItem(this.userKey, JSON.stringify(userData));
      
      // Set token expiry (GitHub tokens don't expire unless revoked,
      // but we'll refresh session after 12 hours)
      const expiryTime = Date.now() + (12 * 60 * 60 * 1000);
      localStorage.setItem(this.expiryKey, expiryTime.toString());
      
      // Pass token to GitHubService
      if (this.gitHubService) {
        this.gitHubService.setAccessToken(token);
      }
      
      // Publish success event
      this.eventBus.publish('auth:signIn', { 
        user: userData,
        isAuthenticated: true
      });
      
      // Return user data
      return {
        username: userData.login,
        id: userData.id.toString(),
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar_url,
        isAuthenticated: true
      };
    } catch (error) {
      // Clear any partial auth data
      this._clearAuthData();
      
      // Normalize and rethrow error
      const normalizedError = this._normalizeAuthError(error, 'GitHub authentication failed');
      this.eventBus.publish('auth:error', { 
        message: normalizedError.message,
        error: normalizedError
      });
      throw normalizedError;
    }
  }

  /**
   * Exchange authorization code for access token
   * 
   * @param {string} code - Authorization code from GitHub
   * @param {string} codeVerifier - PKCE code verifier (if PKCE is enabled)
   * @returns {Promise<string>} Access token
   */
  async exchangeCodeForToken(code, codeVerifier = null) {
    try {
      // Use the proxy URL from settings to avoid exposing client secret
      const proxyUrl = APP_SETTINGS.auth.oauthProxyUrl;
      
      if (!proxyUrl) {
        throw new Error('OAuth proxy URL not configured');
      }
      
      // Prepare request body
      const requestBody = {
        code,
        client_id: APP_SETTINGS.auth.clientId,
        redirect_uri: APP_SETTINGS.auth.redirectUri
      };
      
      // Add code verifier if PKCE is being used
      if (codeVerifier) {
        requestBody.code_verifier = codeVerifier;
      }
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        let errorMessage = `Token exchange failed: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // Couldn't parse error JSON, use default message
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access token returned from server');
      }
      
      return data.access_token;
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  /**
   * Get user data from GitHub API
   * 
   * @param {string} token - GitHub access token
   * @returns {Promise<Object>} User data from GitHub
   */
  async getUserDataFromGitHub(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid or expired token');
        }
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`);
      }
      
      const userData = await response.json();
      
      // Get user email if not public and we have the right scope
      if (!userData.email && APP_SETTINGS.auth.scopes.includes('user:email')) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          const primaryEmail = emails.find(email => email.primary);
          if (primaryEmail) {
            userData.email = primaryEmail.email;
          }
        }
      }
      
      // Check repo permissions if possible to determine admin status
      if (APP_SETTINGS.app.githubRepo && APP_SETTINGS.auth.scopes.includes('repo')) {
        try {
          const repoResponse = await fetch(`https://api.github.com/repos/${APP_SETTINGS.app.githubRepo}`, {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          
          if (repoResponse.ok) {
            const repoData = await repoResponse.json();
            userData.permissions = repoData.permissions || {};
            userData.isAdmin = repoData.permissions?.admin === true;
            userData.canEdit = repoData.permissions?.push === true || repoData.permissions?.admin === true;
          }
        } catch (repoError) {
          console.warn('Could not fetch repository permissions:', repoError);
          // This is non-fatal, continue with limited permissions info
        }
      }
      
      return userData;
    } catch (error) {
      console.error('Error fetching GitHub user data:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   * 
   * @returns {Promise<Object>} Result of sign out
   */
  async signOut() {
    try {
      const userData = this.getUserDataFromStorage();
      
      // Clear token from local storage
      this._clearAuthData();
      
      // Clear token from GitHubService
      if (this.gitHubService) {
        this.gitHubService.setAccessToken(null);
      }
      
      // Publish event
      this.eventBus.publish('auth:signOut', {
        user: userData
      });
      
      return { success: true };
    } catch (error) {
      throw this._normalizeAuthError(error, 'Sign out failed');
    }
  }

  /**
   * Get user data from local storage
   * 
   * @returns {Object|null} User data or null if not found
   */
  getUserDataFromStorage() {
    try {
      const userDataStr = localStorage.getItem(this.userKey);
      if (userDataStr) {
        return JSON.parse(userDataStr);
      }
    } catch (error) {
      console.warn('Error parsing stored user data:', error);
    }
    
    return null;
  }

  /**
   * Get the current authenticated user
   * 
   * @returns {Promise<Object>} Current user info or null if not authenticated
   */
  async getCurrentUser() {
    try {
      const token = localStorage.getItem(this.tokenKey);
      
      if (!token) {
        return { isAuthenticated: false };
      }
      
      // First try to get user from storage for fast response
      const storedUser = this.getUserDataFromStorage();
      
      // Check if we need to validate token with GitHub
      const expiryStr = localStorage.getItem(this.expiryKey);
      const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
      const now = Date.now();
      
      // If token is close to expiry or no stored user, validate with GitHub
      if (!storedUser || now > expiry - (30 * 60 * 1000)) { // Within 30 minutes of expiry
        try {
          // Get fresh user data from GitHub
          const userData = await this.getUserDataFromGitHub(token);
          
          // Update storage
          localStorage.setItem(this.userKey, JSON.stringify(userData));
          
          // Set new expiry time
          const newExpiry = Date.now() + (12 * 60 * 60 * 1000);
          localStorage.setItem(this.expiryKey, newExpiry.toString());
          
          return {
            username: userData.login,
            id: userData.id.toString(),
            email: userData.email,
            name: userData.name,
            avatar: userData.avatar_url,
            isAdmin: userData.isAdmin,
            permissions: userData.permissions,
            isAuthenticated: true
          };
        } catch (apiError) {
          // If API call fails, token might be invalid
          this._clearAuthData();
          this.eventBus.publish('auth:sessionExpired', {
            message: 'Authentication session expired or invalid'
          });
          return { isAuthenticated: false };
        }
      }
      
      // Return user from storage
      return {
        username: storedUser.login,
        id: storedUser.id.toString(),
        email: storedUser.email,
        name: storedUser.name,
        avatar: storedUser.avatar_url,
        isAdmin: storedUser.isAdmin,
        permissions: storedUser.permissions,
        isAuthenticated: true
      };
    } catch (error) {
      // Not throwing here since this is often used to check if user is logged in
      console.error('Error getting current user:', error);
      localStorage.removeItem(this.tokenKey);
      return { isAuthenticated: false };
    }
  }

  /**
   * Get the current user's session
   * 
   * @returns {Promise<Object>} User session with tokens
   */
  async getCurrentSession() {
    try {
      const token = localStorage.getItem(this.tokenKey);
      
      if (!token) {
        return { isAuthenticated: false };
      }
      
      // Check if token has been validated recently
      const expiryStr = localStorage.getItem(this.expiryKey);
      const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
      const now = Date.now();
      
      // If token is near expiry, validate it
      if (now > expiry - (30 * 60 * 1000)) {
        try {
          // Verify token is still valid by making a test request
          await this.getUserDataFromGitHub(token);
          
          // Update expiry
          const newExpiry = now + (12 * 60 * 60 * 1000);
          localStorage.setItem(this.expiryKey, newExpiry.toString());
        } catch (error) {
          // Token is invalid
          this._clearAuthData();
          this.eventBus.publish('auth:sessionExpired', {
            message: 'Authentication session expired'
          });
          return { isAuthenticated: false };
        }
      }

      return {
        accessToken: token,
        expiresAt: expiry,
        isAuthenticated: true
      };
    } catch (error) {
      localStorage.removeItem(this.tokenKey);
      return { isAuthenticated: false };
    }
  }

  /**
   * Get the GitHub access token
   * 
   * @returns {string|null} GitHub access token or null if not authenticated
   */
  getAccessToken() {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Get user permissions for the current user
   * 
   * @returns {Promise<Object>} User permissions
   */
  async getUserPermissions() {
    // For GitHub auth, permissions are determined by the token scopes
    // and would need to be checked against the repo permissions
    
    const session = await this.getCurrentSession();
    
    if (!session.isAuthenticated) {
      return {
        isAdmin: false,
        canEdit: false,
        canView: true // Public repos can be viewed by anyone
      };
    }
    
    try {
      // Try to get permissions from stored user data first
      const userData = this.getUserDataFromStorage();
      if (userData && userData.permissions) {
        return {
          isAdmin: userData.permissions.admin === true,
          canEdit: userData.permissions.push === true || userData.permissions.admin === true,
          canView: true
        };
      }
      
      // If no stored permissions, check repo directly
      const repo = APP_SETTINGS.app.githubRepo;
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: {
          'Authorization': `token ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // Token is invalid or lacks permissions
          this._clearAuthData();
          this.eventBus.publish('auth:sessionExpired', {
            message: 'Authentication session expired or insufficient permissions'
          });
        }
        
        return {
          isAdmin: false,
          canEdit: false,
          canView: true
        };
      }
      
      const repoData = await response.json();
      
      // Update user data with permissions
      const storedUserData = this.getUserDataFromStorage();
      if (storedUserData) {
        storedUserData.permissions = repoData.permissions || {};
        storedUserData.isAdmin = repoData.permissions?.admin === true;
        localStorage.setItem(this.userKey, JSON.stringify(storedUserData));
      }
      
      return { 
        isAdmin: repoData.permissions?.admin === true,
        canEdit: repoData.permissions?.push === true || repoData.permissions?.admin === true,
        canView: true
      };
    } catch (error) {
      console.error('Error checking repo permissions:', error);
      return {
        isAdmin: false,
        canEdit: false,
        canView: true
      };
    }
  }

  /**
   * Generate a random state parameter for security
   * @private
   * @returns {string} Random state string
   */
  _generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Clear authentication data from storage
   * @private
   */
  _clearAuthData() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.stateKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.expiryKey);
    localStorage.removeItem(this.codeVerifierKey);
    localStorage.removeItem(this.codeChallengeKey);
  }

  /**
   * Start monitoring for session expiration
   * @private
   */
  _startSessionMonitoring() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    // Check session every 5 minutes
    this.sessionCheckInterval = setInterval(async () => {
      if (!this.sessionCheckEnabled) return;

      try {
        const token = localStorage.getItem(this.tokenKey);
        if (!token) return; // No active session to check
        
        const expiryStr = localStorage.getItem(this.expiryKey);
        const expiry = expiryStr ? parseInt(expiryStr, 10) : 0;
        const now = Date.now();
        
        // If token is expired or close to expiry, validate it
        if (now > expiry - (30 * 60 * 1000)) {
          try {
            await this.getUserDataFromGitHub(token);
            
            // Token is still valid, update expiry
            const newExpiry = now + (12 * 60 * 60 * 1000);
            localStorage.setItem(this.expiryKey, newExpiry.toString());
            
            // Publish token refresh event
            this.eventBus.publish('auth:tokenRefreshed', {
              expiresAt: newExpiry
            });
          } catch (error) {
            // Token is invalid
            this._clearAuthData();
            
            // Publish session expired event
            this.eventBus.publish('auth:sessionExpired', {
              message: 'Authentication session expired'
            });
            
            if (this.gitHubService) {
              this.gitHubService.setAccessToken(null);
            }
          }
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    }, this.sessionCheckIntervalTime);
  }

  /**
   * Normalize authentication errors
   * @private
   */
  _normalizeAuthError(error, defaultMessage = 'Authentication error') {
    // Default error type and code
    let errorType = 'AuthenticationError';
    let errorCode = 'AUTH_ERROR';
    let errorMessage = error.message || defaultMessage;
    
    // Try to determine more specific error type/code
    if (error.message) {
      if (error.message.includes('invalid_grant') || error.message.includes('password')) {
        errorType = 'AuthenticationError';
        errorCode = 'INVALID_CREDENTIALS';
      } else if (error.message.includes('not confirm') || error.message.includes('confirmation')) {
        errorType = 'ValidationError';
        errorCode = 'CONFIRMATION_REQUIRED';
      } else if (error.message.includes('not authorized') || error.message.includes('permission')) {
        errorType = 'AuthorizationError';
        errorCode = 'UNAUTHORIZED';
      } else if (error.message.includes('rate limit')) {
        errorType = 'RateLimitError';
        errorCode = 'RATE_LIMIT_EXCEEDED';
      } else if (error.message.includes('token') && (error.message.includes('invalid') || error.message.includes('expired'))) {
        errorType = 'TokenError';
        errorCode = 'INVALID_TOKEN';
      }
    }
    
    return ErrorHandler.createError(
      errorMessage,
      errorType,
      errorCode,
      { originalError: error }
    );
  }

  /**
   * Clean up resources
   */
  cleanUp() {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  /**
   * Generate a cryptographically secure random code verifier for PKCE
   * @private
   * @returns {string} Code verifier
   */
  _generateCodeVerifier() {
    // Generate random bytes
    const array = new Uint8Array(48);
    window.crypto.getRandomValues(array);
    
    // Convert to base64 and make URL safe
    return this._base64UrlEncode(array);
  }
  
  /**
   * Generate a code challenge from code verifier for PKCE
   * @private
   * @param {string} codeVerifier - Code verifier string
   * @returns {string} Code challenge
   */
  async _generateCodeChallenge(codeVerifier) {
    // SHA-256 hash the code verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    // Convert to base64 URL-safe string
    return this._base64UrlEncode(new Uint8Array(hashBuffer));
  }
  
  /**
   * Base64 URL-safe encode a byte array
   * @private
   * @param {Uint8Array} buffer - Byte array to encode
   * @returns {string} Base64 URL-safe encoded string
   */
  _base64UrlEncode(buffer) {
    // Convert the buffer to a base64 string
    let base64 = btoa(String.fromCharCode.apply(null, buffer));
    
    // Make base64 URL-safe: replace '+' with '-', '/' with '_', and remove '='
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Set up webhook for GitHub repository events
   * 
   * @param {string} repoFullName - Full repository name (owner/repo)
   * @param {Array<string>} events - Events to listen for
   * @param {string} webhookUrl - URL to receive webhook events
   * @returns {Promise<Object>} Webhook creation result
   */
  async setupRepositoryWebhook(repoFullName, events = ['push', 'pull_request'], webhookUrl) {
    try {
      const token = this.getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      if (!repoFullName) {
        repoFullName = APP_SETTINGS.app.githubRepo;
      }
      
      if (!repoFullName) {
        throw new Error('Repository not specified');
      }
      
      if (!webhookUrl) {
        throw new Error('Webhook URL not specified');
      }
      
      // Create webhook via GitHub API
      const response = await fetch(`https://api.github.com/repos/${repoFullName}/hooks`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: events,
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: APP_SETTINGS.auth.webhookSecret || '',
            insecure_ssl: '0'
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create webhook: ${errorData.message || response.statusText}`);
      }
      
      const webhookData = await response.json();
      
      // Store webhook ID for future reference
      localStorage.setItem('github_webhook_id', webhookData.id);
      
      return webhookData;
    } catch (error) {
      console.error('Error setting up repository webhook:', error);
      throw this._normalizeAuthError(error, 'Failed to set up repository webhook');
    }
  }
  
  /**
   * Delete a GitHub repository webhook
   * 
   * @param {string} webhookId - ID of the webhook to delete
   * @param {string} repoFullName - Full repository name (owner/repo)
   * @returns {Promise<boolean>} Success status
   */
  async deleteRepositoryWebhook(webhookId, repoFullName) {
    try {
      const token = this.getAccessToken();
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      if (!webhookId) {
        webhookId = localStorage.getItem('github_webhook_id');
      }
      
      if (!webhookId) {
        throw new Error('Webhook ID not specified');
      }
      
      if (!repoFullName) {
        repoFullName = APP_SETTINGS.app.githubRepo;
      }
      
      if (!repoFullName) {
        throw new Error('Repository not specified');
      }
      
      // Delete webhook via GitHub API
      const response = await fetch(`https://api.github.com/repos/${repoFullName}/hooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete webhook: ${response.statusText}`);
      }
      
      // Remove webhook ID from storage
      localStorage.removeItem('github_webhook_id');
      
      return true;
    } catch (error) {
      console.error('Error deleting repository webhook:', error);
      throw this._normalizeAuthError(error, 'Failed to delete repository webhook');
    }
  }
}

// Create singleton instance
const authService = new AuthService();

// Register with ModuleRegistry
export default registry.register(
  'auth.AuthService',
  authService,
  ['api.GitHubService', 'utils.EventBus', 'utils.ErrorHandler'],
  {
    description: 'Core authentication service using GitHub OAuth',
    singleton: true
  }
);


