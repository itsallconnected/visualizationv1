/**
 * Authentication Types
 * 
 * This file defines TypeScript interfaces and types for the authentication system.
 * These types provide structure and type safety for authentication state management.
 */

/**
 * Authentication Status
 * Possible states for authentication process
 */
export const AuthStatus = {
  IDLE: 'idle',
  AUTHENTICATING: 'authenticating',
  AUTHENTICATED: 'authenticated',
  UNAUTHENTICATED: 'unauthenticated',
  ERROR: 'error',
  REFRESHING: 'refreshing',
  EXPIRED: 'expired',
  MFA_REQUIRED: 'mfa_required'
};

/**
 * Authentication Event Types
 * Events that can occur in the authentication lifecycle
 */
export const AuthEventTypes = {
  SIGN_IN: 'auth:signIn',
  SIGN_OUT: 'auth:signOut',
  SESSION_EXPIRED: 'auth:sessionExpired',
  TOKEN_REFRESHED: 'auth:tokenRefreshed',
  ERROR: 'auth:error',
  MFA_REQUIRED: 'auth:mfaRequired',
  LOGIN_INITIATED: 'auth:loginInitiated',
  STATE_CHANGED: 'auth:stateChanged',
  PROFILE_UPDATED: 'auth:profileUpdated',
  PERMISSIONS_CHANGED: 'auth:permissionsChanged'
};

/**
 * User Profile Type
 * Structure for user profile information
 * 
 * @typedef {Object} UserProfile
 * @property {string} id - Unique user identifier
 * @property {string} username - User's username
 * @property {string} [name] - User's full name (if available)
 * @property {string} [email] - User's email address (if available)
 * @property {string} [avatar] - URL to user's avatar image
 * @property {boolean} isAdmin - Whether user has admin privileges
 * @property {string[]} [roles] - Array of role identifiers assigned to user
 * @property {Object} [permissions] - Map of permissions user has been granted
 * @property {Object} [metadata] - Additional user metadata
 * @property {Date} [lastLogin] - Timestamp of user's last login
 * @property {Date} [created] - Timestamp when user was created
 * @property {string} provider - Authentication provider (e.g., 'github')
 */

/**
 * Authentication State Type
 * Structure for authentication context state
 * 
 * @typedef {Object} AuthState
 * @property {UserProfile|null} user - Current user profile or null if not authenticated
 * @property {boolean} isAuthenticated - Whether user is currently authenticated
 * @property {string} status - Current authentication status from AuthStatus
 * @property {boolean} loading - Whether authentication operation is in progress
 * @property {Error|string|null} error - Error information if authentication failed
 * @property {number} permissionLevel - User's computed permission level
 * @property {string} provider - Current authentication provider
 * @property {boolean} mfaRequired - Whether multi-factor authentication is required
 * @property {Array} loginHistory - History of recent logins
 */

/**
 * Permission Level Definitions
 * Numeric values representing permission levels in the system
 */
export const PermissionLevels = {
  NONE: 0,       // No permissions (unauthenticated)
  VIEWER: 10,    // Basic viewing permissions
  CONTRIBUTOR: 20, // Can create and edit content
  MODERATOR: 30, // Can review and approve content
  ADMIN: 100     // Full administrative access
};

/**
 * Auth Token Structure
 * 
 * @typedef {Object} AuthToken
 * @property {string} accessToken - The access token for API calls
 * @property {string} [refreshToken] - Token to refresh the access token
 * @property {number} expiresAt - Timestamp when token expires
 * @property {string} tokenType - Type of token (e.g., 'Bearer')
 * @property {string[]} scope - Array of authorized scopes
 */

/**
 * Login Options
 * 
 * @typedef {Object} LoginOptions
 * @property {boolean} [remember=false] - Whether to persist login across sessions
 * @property {string} [redirectUrl] - URL to redirect after successful login
 * @property {string[]} [scopes] - Requested permission scopes
 * @property {boolean} [usePKCE=true] - Whether to use PKCE extension
 * @property {Object} [extraParams] - Additional provider-specific parameters
 */

/**
 * Authentication Configuration
 * 
 * @typedef {Object} AuthConfig
 * @property {string} provider - Auth provider name
 * @property {string} clientId - OAuth client ID
 * @property {string} redirectUri - OAuth redirect URI
 * @property {string[]} scopes - Default authorization scopes
 * @property {string} authorizationEndpoint - Provider's authorization endpoint
 * @property {string} tokenEndpoint - Provider's token endpoint
 * @property {string} userInfoEndpoint - Provider's user info endpoint
 * @property {string} logoutEndpoint - Provider's logout endpoint
 * @property {boolean} usePKCE - Whether PKCE is enabled 
 * @property {Object} storage - Storage configuration
 */

export default {
  AuthStatus,
  AuthEventTypes,
  PermissionLevels
}; 