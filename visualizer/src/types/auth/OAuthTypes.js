/**
 * OAuth Types
 * 
 * This file defines TypeScript interfaces and types for OAuth authentication.
 * These types help provide consistent data structures across the authentication system.
 */

/**
 * OAuth Provider Types
 * Supported OAuth providers in the application
 */
export const OAuthProviderTypes = {
  GITHUB: 'github',
  GOOGLE: 'google',
  MICROSOFT: 'microsoft'
};

/**
 * OAuth Authorization Parameters
 * Parameters used to create an OAuth authorization URL
 * 
 * @typedef {Object} OAuthAuthorizationParams
 * @property {string} clientId - OAuth client ID
 * @property {string} redirectUri - Redirect URI after authorization
 * @property {string|string[]} scope - OAuth scopes to request
 * @property {string} state - State parameter for CSRF protection
 * @property {string} [codeChallenge] - PKCE code challenge (optional)
 * @property {string} [responseType=code] - OAuth response type
 * @property {Object} [additionalParams] - Additional provider-specific parameters
 */

/**
 * OAuth Token Response
 * Structure of response from OAuth token endpoint
 * 
 * @typedef {Object} OAuthTokenResponse
 * @property {string} access_token - OAuth access token
 * @property {string} [token_type=bearer] - Token type
 * @property {number} [expires_in] - Token expiration time in seconds
 * @property {string} [refresh_token] - Refresh token (if available)
 * @property {string} [scope] - Granted scopes (space-separated)
 * @property {string} [id_token] - OpenID Connect ID token (if available)
 */

/**
 * Normalized Token Information
 * Internal representation of token data
 * 
 * @typedef {Object} TokenInfo
 * @property {string} accessToken - Access token
 * @property {string} tokenType - Token type
 * @property {string[]} scope - Array of granted scopes
 * @property {string|null} refreshToken - Refresh token or null
 * @property {number|null} expiresIn - Token lifetime in seconds
 * @property {number|null} expiresAt - Token expiration timestamp
 * @property {string|null} idToken - ID token or null
 */

/**
 * OAuth Callback Parameters
 * URL parameters from an OAuth callback/redirect
 * 
 * @typedef {Object} OAuthCallbackParams
 * @property {string|null} code - Authorization code
 * @property {string|null} state - State parameter
 * @property {string|null} error - Error code (if auth failed)
 * @property {string|null} errorDescription - Error description
 * @property {boolean} hasAuthCode - Whether an auth code is present
 * @property {boolean} hasError - Whether an error is present
 */

/**
 * OAuth Error Types
 * Common OAuth error codes
 */
export const OAuthErrorTypes = {
  INVALID_REQUEST: 'invalid_request',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  ACCESS_DENIED: 'access_denied',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
  INVALID_TOKEN: 'invalid_token',
  INVALID_GRANT: 'invalid_grant',
  INSUFFICIENT_SCOPE: 'insufficient_scope'
};

/**
 * GitHub Scope Types
 * Common GitHub OAuth scopes
 */
export const GitHubScopeTypes = {
  READ_USER: 'read:user',
  USER_EMAIL: 'user:email',
  REPO: 'repo',
  PUBLIC_REPO: 'public_repo',
  ADMIN_REPO_HOOK: 'admin:repo_hook',
  WRITE_REPO_HOOK: 'write:repo_hook',
  READ_REPO_HOOK: 'read:repo_hook',
  ADMIN_ORG: 'admin:org',
  WRITE_ORG: 'write:org',
  READ_ORG: 'read:org'
};

/**
 * User Permissions
 * Normalized user permission structure
 * 
 * @typedef {Object} UserPermissions
 * @property {boolean} isAdmin - Whether user has admin access
 * @property {boolean} canEdit - Whether user can edit content
 * @property {boolean} canView - Whether user can view content
 * @property {Object} repositoryPermissions - Raw repository permissions
 */

/**
 * Authentication Session
 * User authentication session information
 * 
 * @typedef {Object} AuthSession
 * @property {boolean} isAuthenticated - Whether the session is authenticated
 * @property {string|null} accessToken - Access token
 * @property {number|null} expiresAt - Token expiration timestamp
 * @property {string|null} refreshToken - Refresh token
 * @property {string|null} provider - Authentication provider
 */

/**
 * User Profile
 * Normalized user profile information
 * 
 * @typedef {Object} UserProfile
 * @property {string} id - User ID
 * @property {string} username - Username
 * @property {string|null} name - Full name
 * @property {string|null} email - Email address
 * @property {string|null} avatar - Avatar URL
 * @property {boolean} isAdmin - Whether user has admin privileges
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {Object} permissions - User permissions
 * @property {string[]} roles - User roles
 * @property {Object} rawProfile - Raw profile data from provider
 */

/**
 * OAuth Configuration
 * Application OAuth configuration
 * 
 * @typedef {Object} OAuthConfig
 * @property {boolean} enabled - Whether authentication is enabled
 * @property {string} provider - Authentication provider
 * @property {string} clientId - OAuth client ID
 * @property {string} redirectUri - OAuth redirect URI
 * @property {string[]} scopes - OAuth scopes
 * @property {string} oauthProxyUrl - URL for token exchange proxy
 * @property {boolean} pkceEnabled - Whether PKCE extension is enabled
 * @property {string|null} webhookSecret - Secret for webhooks
 * @property {number} sessionTimeoutMinutes - Session timeout in minutes
 */

/**
 * Repository Webhook
 * GitHub repository webhook configuration
 * 
 * @typedef {Object} RepositoryWebhook
 * @property {number} id - Webhook ID
 * @property {string} url - Webhook URL
 * @property {boolean} active - Whether webhook is active
 * @property {string[]} events - Events the webhook listens for
 * @property {Object} config - Webhook configuration
 */ 