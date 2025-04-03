/**
 * Authentication Service Types
 * 
 * This file defines TypeScript interfaces and types specific to authentication services.
 * These types provide structure and type safety for auth service implementations and consumers.
 */

/**
 * Authentication Provider Type
 * Supported authentication providers
 */
export const AuthProviderType = {
  GITHUB: 'github',
  // Future providers
  // GOOGLE: 'google',
  // MICROSOFT: 'microsoft',
  // CUSTOM: 'custom',
};

/**
 * Authentication Method Type
 * Methods for authenticating users
 */
export const AuthMethodType = {
  OAUTH: 'oauth',
  PASSWORD: 'password',
  TOKEN: 'token',
  MFA: 'mfa',
  SSO: 'sso',
};

/**
 * Authentication Result Type
 * Result of authentication operations
 * 
 * @typedef {Object} AuthResult
 * @property {boolean} success - Whether the operation was successful
 * @property {Object} [user] - User data if authentication was successful
 * @property {Object} [error] - Error information if authentication failed
 * @property {string} [message] - Message describing the result
 * @property {string} [redirectUrl] - URL to redirect to after authentication
 */

/**
 * Token Data Type
 * Structure for authentication tokens
 * 
 * @typedef {Object} TokenData
 * @property {string} accessToken - The access token
 * @property {string} [refreshToken] - Refresh token for obtaining new access tokens
 * @property {string} [idToken] - Identity token containing user claims
 * @property {number} [expiresIn] - Token lifetime in seconds
 * @property {number} [expiresAt] - Timestamp when the token expires
 * @property {string} [tokenType] - Type of token (e.g., "Bearer")
 * @property {string} [scope] - Space-separated list of granted scopes
 */

/**
 * Auth Session Type
 * Structure for authentication session information
 * 
 * @typedef {Object} AuthSession
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {string} [provider] - Authentication provider
 * @property {Object} [user] - User information
 * @property {TokenData} [tokens] - Authentication tokens
 * @property {boolean} [valid] - Whether the session is valid
 * @property {number} [expiresAt] - Session expiration timestamp
 * @property {string} [deviceId] - Identifier for the current device
 */

/**
 * Login Options Type
 * Options for initiating authentication
 * 
 * @typedef {Object} LoginOptions
 * @property {string} [provider] - Authentication provider to use
 * @property {string} [redirectUrl] - URL to redirect after authentication
 * @property {string[]} [scopes] - OAuth scopes to request
 * @property {boolean} [rememberMe] - Whether to persist authentication
 * @property {boolean} [usePKCE] - Whether to use PKCE extension
 * @property {boolean} [silent] - Whether to attempt silent authentication
 * @property {Object} [extraParams] - Additional provider-specific parameters
 */

/**
 * OAuth Callback Parameters Type
 * Parameters received in OAuth callback
 * 
 * @typedef {Object} OAuthCallbackParams
 * @property {string} [code] - Authorization code
 * @property {string} [state] - State parameter for CSRF protection
 * @property {string} [error] - Error code if authentication failed
 * @property {string} [error_description] - Error description
 * @property {boolean} hasAuthCode - Whether the callback has an auth code
 * @property {boolean} hasError - Whether the callback indicates an error
 */

/**
 * User Profile Type
 * Structure for user profile information
 * 
 * @typedef {Object} UserProfile
 * @property {string} id - Unique user identifier
 * @property {string} username - User's username
 * @property {string} [name] - User's full name
 * @property {string} [email] - User's email address
 * @property {string} [avatar] - URL to user's avatar
 * @property {boolean} [isAdmin] - Whether the user has admin privileges
 * @property {string[]} [roles] - Array of roles assigned to the user
 * @property {Object} [permissions] - Map of permissions granted to the user
 * @property {boolean} isAuthenticated - Whether the user is authenticated
 * @property {string} provider - Authentication provider
 */

/**
 * Auth Error Type
 * Structure for authentication errors
 * 
 * @typedef {Object} AuthError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} [provider] - Authentication provider that generated the error
 * @property {Object} [originalError] - Original error object
 * @property {number} timestamp - When the error occurred
 */

/**
 * Authentication Service Interface
 * Defines the methods that authentication services must implement
 * 
 * @interface AuthService
 */
export const AuthServiceInterface = {
  /**
   * Initialize the authentication service
   * @returns {Promise<void>}
   */
  initialize: async () => {},
  
  /**
   * Initiate the login process
   * @param {LoginOptions} [options] - Login options
   * @returns {Promise<AuthResult>}
   */
  login: async (options) => ({}),
  
  /**
   * Handle authentication callback
   * @param {string|Object} callbackParams - Callback parameters or query string
   * @returns {Promise<AuthResult>}
   */
  handleAuthCallback: async (callbackParams) => ({}),
  
  /**
   * Sign out the current user
   * @returns {Promise<AuthResult>}
   */
  signOut: async () => ({}),
  
  /**
   * Get the current user
   * @returns {Promise<UserProfile|null>}
   */
  getCurrentUser: async () => ({}),
  
  /**
   * Get the current session
   * @returns {Promise<AuthSession>}
   */
  getCurrentSession: async () => ({}),
  
  /**
   * Refresh the authentication token
   * @returns {Promise<AuthResult>}
   */
  refreshToken: async () => ({}),
  
  /**
   * Get the access token
   * @returns {string|null}
   */
  getAccessToken: () => null,
  
  /**
   * Check if the current user has a permission
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>}
   */
  hasPermission: async (permission) => false,
  
  /**
   * Get user's permissions
   * @returns {Promise<Object>}
   */
  getUserPermissions: async () => ({}),
  
  /**
   * Clean up resources
   * @returns {void}
   */
  cleanup: () => {},
};

/**
 * GitHub Auth Service Configuration
 * 
 * @typedef {Object} GitHubAuthConfig
 * @property {string} clientId - GitHub OAuth client ID
 * @property {string} redirectUri - OAuth redirect URI
 * @property {string[]} scopes - Default authorization scopes
 * @property {string} oauthProxyUrl - URL to proxy for token exchange
 * @property {boolean} pkceEnabled - Whether PKCE is enabled
 * @property {boolean} allowSignup - Whether to allow users to sign up
 */

/**
 * GitHub User Data
 * 
 * @typedef {Object} GitHubUser
 * @property {number} id - GitHub user ID
 * @property {string} login - GitHub username
 * @property {string} [name] - User's full name
 * @property {string} [email] - User's email address
 * @property {string} avatar_url - URL to user's avatar
 * @property {string} html_url - GitHub profile URL
 * @property {boolean} [isAdmin] - Whether user has admin privileges
 * @property {Object} [permissions] - Repository permissions
 */

export default {
  AuthProviderType,
  AuthMethodType,
  AuthServiceInterface
}; 