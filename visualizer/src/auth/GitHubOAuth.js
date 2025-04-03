import registry from '../ModuleRegistry';
import APP_SETTINGS from '../config/app-settings';
import OAuthUtils from '../utils/auth/OAuthUtils';

/**
 * GitHubOAuth provides a dedicated client for GitHub OAuth authentication.
 * It handles the GitHub-specific OAuth flow and API interactions.
 */
class GitHubOAuth {
  constructor() {
    this.accessToken = null;
    this.apiBaseUrl = 'https://api.github.com';
    this.authorizeEndpoint = 'https://github.com/login/oauth/authorize';
    this.tokenEndpoint = APP_SETTINGS.auth.oauthProxyUrl;
    this.stateKey = 'github_auth_state';
    this.codeVerifierKey = 'github_code_verifier';
  }

  /**
   * Generate the GitHub authorization URL
   * 
   * @returns {string} Authorization URL
   */
  generateAuthorizationUrl() {
    // Verify required settings
    if (!APP_SETTINGS.auth.clientId) {
      throw new Error('GitHub OAuth client ID not configured');
    }
    
    if (!APP_SETTINGS.auth.redirectUri) {
      throw new Error('GitHub OAuth redirect URI not configured');
    }
    
    // Generate state parameter for CSRF protection
    const state = OAuthUtils.generateRandomState();
    localStorage.setItem(this.stateKey, state);
    
    // Generate PKCE code verifier and challenge if enabled
    const usePkce = APP_SETTINGS.auth.pkceEnabled !== false;
    let codeChallenge = null;
    
    if (usePkce) {
      // Generate and store code verifier
      const codeVerifier = OAuthUtils.generateCodeVerifier();
      localStorage.setItem(this.codeVerifierKey, codeVerifier);
      
      // Generate code challenge
      OAuthUtils.generateCodeChallenge(codeVerifier)
        .then(challenge => {
          codeChallenge = challenge;
          
          // Create and return URL with code challenge
          return OAuthUtils.createAuthorizationUrl({
            authorizeEndpoint: this.authorizeEndpoint,
            clientId: APP_SETTINGS.auth.clientId,
            redirectUri: APP_SETTINGS.auth.redirectUri,
            scope: APP_SETTINGS.auth.scopes,
            state: state,
            codeChallenge: challenge
          });
        });
    }
    
    // If PKCE is not enabled or while challenge is being computed
    return OAuthUtils.createAuthorizationUrl({
      authorizeEndpoint: this.authorizeEndpoint,
      clientId: APP_SETTINGS.auth.clientId,
      redirectUri: APP_SETTINGS.auth.redirectUri,
      scope: APP_SETTINGS.auth.scopes,
      state: state,
      codeChallenge: codeChallenge
    });
  }

  /**
   * Exchange authorization code for access token
   * 
   * @param {string} code - Authorization code from GitHub
   * @param {string} state - State parameter from callback
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(code, state) {
    // Verify state parameter for CSRF protection
    const savedState = localStorage.getItem(this.stateKey);
    if (!savedState || savedState !== state) {
      throw new Error('Invalid state parameter - possible CSRF attack attempt');
    }
    
    // Clear state from storage
    localStorage.removeItem(this.stateKey);
    
    // Get code verifier if PKCE was used
    const codeVerifier = localStorage.getItem(this.codeVerifierKey);
    
    // Prepare request body
    const requestBody = {
      code,
      client_id: APP_SETTINGS.auth.clientId,
      redirect_uri: APP_SETTINGS.auth.redirectUri
    };
    
    // Add code verifier if PKCE was used
    if (codeVerifier) {
      requestBody.code_verifier = codeVerifier;
      localStorage.removeItem(this.codeVerifierKey);
    }
    
    // Exchange code for token
    const response = await fetch(this.tokenEndpoint, {
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
    
    const tokenData = await response.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token returned from server');
    }
    
    // Store token and return normalized token info
    this.accessToken = tokenData.access_token;
    return OAuthUtils.extractTokenInfo(tokenData);
  }

  /**
   * Set the access token for API calls
   * 
   * @param {string} token - GitHub access token
   */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * Get the current user's profile from GitHub
   * 
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile() {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    // Get user data from GitHub API
    const response = await fetch(`${this.apiBaseUrl}/user`, {
      headers: {
        'Authorization': `token ${this.accessToken}`,
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
    
    // Get email if not public and we have the scope
    if (!userData.email && APP_SETTINGS.auth.scopes.includes('user:email')) {
      await this.fetchUserEmails(userData);
    }
    
    // Check repository permissions if applicable
    if (APP_SETTINGS.app.githubRepo && APP_SETTINGS.auth.scopes.includes('repo')) {
      await this.fetchRepositoryPermissions(userData);
    }
    
    return userData;
  }

  /**
   * Fetch user emails from GitHub API
   * 
   * @param {Object} userData - User data object to update
   * @returns {Promise<void>}
   * @private
   */
  async fetchUserEmails(userData) {
    try {
      const emailsResponse = await fetch(`${this.apiBaseUrl}/user/emails`, {
        headers: {
          'Authorization': `token ${this.accessToken}`,
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
    } catch (error) {
      console.warn('Could not fetch user emails:', error);
      // Non-fatal, continue without email
    }
  }

  /**
   * Fetch repository permissions for the user
   * 
   * @param {Object} userData - User data object to update
   * @returns {Promise<void>}
   * @private
   */
  async fetchRepositoryPermissions(userData) {
    try {
      const repoResponse = await fetch(
        `${this.apiBaseUrl}/repos/${APP_SETTINGS.app.githubRepo}`,
        {
          headers: {
            'Authorization': `token ${this.accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        userData.permissions = repoData.permissions || {};
        userData.isAdmin = repoData.permissions?.admin === true;
        userData.canEdit = repoData.permissions?.push === true || repoData.permissions?.admin === true;
      }
    } catch (error) {
      console.warn('Could not fetch repository permissions:', error);
      // Non-fatal, continue with limited permissions info
    }
  }

  /**
   * Create a repository webhook
   * 
   * @param {Object} options - Webhook options
   * @returns {Promise<Object>} Webhook data
   */
  async createRepositoryWebhook(options) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    const {
      repository = APP_SETTINGS.app.githubRepo,
      events = ['push', 'pull_request'],
      url,
      secret = APP_SETTINGS.auth.webhookSecret || '',
      contentType = 'json'
    } = options;
    
    if (!repository) {
      throw new Error('Repository not specified');
    }
    
    if (!url) {
      throw new Error('Webhook URL not specified');
    }
    
    // Create webhook via GitHub API
    const response = await fetch(`${this.apiBaseUrl}/repos/${repository}/hooks`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: events,
        config: {
          url: url,
          content_type: contentType,
          secret: secret,
          insecure_ssl: '0'
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to create webhook: ${errorData.message || response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Delete a repository webhook
   * 
   * @param {Object} options - Options
   * @returns {Promise<boolean>} Success status
   */
  async deleteRepositoryWebhook(options) {
    if (!this.accessToken) {
      throw new Error('Not authenticated');
    }
    
    const { repository = APP_SETTINGS.app.githubRepo, webhookId } = options;
    
    if (!repository) {
      throw new Error('Repository not specified');
    }
    
    if (!webhookId) {
      throw new Error('Webhook ID not specified');
    }
    
    // Delete webhook via GitHub API
    const response = await fetch(
      `${this.apiBaseUrl}/repos/${repository}/hooks/${webhookId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${this.accessToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }
    
    return true;
  }
}

// Create singleton instance
const gitHubOAuth = new GitHubOAuth();

// Register with ModuleRegistry
export default registry.register(
  'auth.GitHubOAuth',
  gitHubOAuth,
  ['utils.auth.OAuthUtils'],
  {
    description: 'GitHub OAuth client for authentication',
    provides: ['githubOAuth'],
    singleton: true
  }
); 