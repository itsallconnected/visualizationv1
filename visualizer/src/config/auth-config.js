/**
 * Authentication Configuration
 * 
 * Centralized configuration for authentication services including OAuth providers,
 * session management, and security settings.
 */

/**
 * Get environment variable with fallback
 * @param {string} name - Environment variable name
 * @param {*} fallback - Fallback value if not defined
 * @returns {*} Environment variable value or fallback
 */
const env = (name, fallback) => {
  const value = process.env[`REACT_APP_${name}`] || process.env[name];
  return value !== undefined ? value : fallback;
};

/**
 * Parse boolean environment variable
 * @param {string} name - Environment variable name
 * @param {boolean} fallback - Fallback value if not defined
 * @returns {boolean} Parsed boolean value
 */
const envBool = (name, fallback) => {
  const value = env(name);
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

/**
 * Parse numeric environment variable
 * @param {string} name - Environment variable name
 * @param {number} fallback - Fallback value if not defined
 * @returns {number} Parsed numeric value
 */
const envNum = (name, fallback) => {
  const value = env(name);
  if (value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

/**
 * Authentication configuration
 */
const AUTH_CONFIG = {
  // General authentication settings
  enabled: envBool('AUTH_ENABLED', true),
  provider: env('AUTH_PROVIDER', 'github'),
  sessionTimeoutMinutes: envNum('SESSION_TIMEOUT', 60),
  refreshTokenEnabled: envBool('REFRESH_TOKEN_ENABLED', true),
  persistSession: envBool('PERSIST_SESSION', true),
  requiredRolesForEditing: env('REQUIRED_ROLES_EDITING', 'admin,editor').split(','),
  loginMessage: env('LOGIN_MESSAGE', 'Sign in with your GitHub account to access the visualization tool.'),
  
  // GitHub OAuth configuration
  github: {
    clientId: env('GITHUB_CLIENT_ID'),
    redirectUri: env('AUTH_REDIRECT_URI', `${window.location.origin}/auth-callback`),
    scopes: env('AUTH_SCOPES', 'read:user,user:email,repo').split(','),
    oauthProxyUrl: env('OAUTH_PROXY_URL'),
    apiUrl: env('GITHUB_API_URL', 'https://api.github.com'),
    authorizeEndpoint: 'https://github.com/login/oauth/authorize',
    pkceEnabled: envBool('GITHUB_PKCE_ENABLED', true),
    webhookSecret: env('GITHUB_WEBHOOK_SECRET'),
    allowSignup: envBool('GITHUB_ALLOW_SIGNUP', true)
  },
  
  // User permissions system
  permissions: {
    // Core permission levels
    levels: {
      view: 0,      // Can view content
      comment: 1,   // Can comment on content
      edit: 2,      // Can edit content
      create: 3,    // Can create new content
      delete: 4,    // Can delete content
      manage: 5,    // Can manage permissions
      admin: 6      // Full administrative access
    },
    
    // Role definitions
    roles: {
      viewer: {
        label: 'Viewer',
        description: 'Can view public content',
        permissionLevel: 0,
        capabilities: ['content:view', 'visualization:view']
      },
      contributor: {
        label: 'Contributor',
        description: 'Can create and edit content',
        permissionLevel: 3,
        capabilities: [
          'content:view', 'content:create', 'content:edit',
          'node:view', 'node:create', 'node:edit',
          'relationship:view', 'relationship:create', 'relationship:edit',
          'visualization:view', 'security:encrypt', 'security:decrypt'
        ]
      },
      moderator: {
        label: 'Moderator',
        description: 'Can review and manage content',
        permissionLevel: 4,
        capabilities: [
          'content:view', 'content:create', 'content:edit', 'content:delete', 'content:approve',
          'node:view', 'node:create', 'node:edit', 'node:delete',
          'relationship:view', 'relationship:create', 'relationship:edit', 'relationship:delete',
          'visualization:view', 'visualization:configure',
          'security:encrypt', 'security:decrypt', 'security:manageKeys',
          'admin:viewLogs'
        ]
      },
      admin: {
        label: 'Administrator',
        description: 'Full system access',
        permissionLevel: 6,
        capabilities: [
          'auth:viewUsers', 'auth:createUsers', 'auth:editUsers', 'auth:deleteUsers', 'auth:assignRoles',
          'content:view', 'content:create', 'content:edit', 'content:delete', 'content:approve',
          'node:view', 'node:create', 'node:edit', 'node:delete',
          'relationship:view', 'relationship:create', 'relationship:edit', 'relationship:delete',
          'visualization:view', 'visualization:configure',
          'security:encrypt', 'security:decrypt', 'security:manageKeys',
          'admin:accessPanel', 'admin:systemSettings', 'admin:viewLogs'
        ]
      }
    }
  },
  
  // Security settings
  security: {
    tokenStorage: 'localStorage', // 'localStorage', 'sessionStorage', or 'memory'
    passwordMinLength: 12,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSymbols: true,
    maxFailedAttempts: 5,
    lockoutDurationMinutes: 5,
    csrfProtectionEnabled: true
  }
};

// Export the complete config object
export default AUTH_CONFIG; 