/**
 * Authentication Utilities
 * 
 * Provides utility functions for authentication-related operations,
 * including token validation, permission checking, and OAuth helpers.
 */

import { PermissionLevels } from '../../types/auth/AuthTypes';
import jwtDecode from 'jwt-decode';

/**
 * Utility class for authentication operations
 */
class AuthUtilities {
  /**
   * Check if a token is valid and not expired
   * @param {Object} token - The token object to validate
   * @returns {boolean} - Whether the token is valid
   */
  isTokenValid(token) {
    if (!token || !token.accessToken) {
      return false;
    }
    
    // Check expiration
    if (token.expiresAt) {
      const now = Date.now();
      // Add 5-second buffer to avoid edge cases
      if (now >= token.expiresAt - 5000) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if a token is about to expire
   * @param {Object} token - The token object to check
   * @param {number} [thresholdMs=300000] - Threshold in milliseconds (default 5 minutes)
   * @returns {boolean} - Whether the token is about to expire
   */
  isTokenExpiringSoon(token, thresholdMs = 300000) {
    if (!token || !token.expiresAt) {
      return false;
    }
    
    const now = Date.now();
    return (token.expiresAt - now) < thresholdMs;
  }
  
  /**
   * Decode JWT token and extract information
   * @param {string} token - JWT token string
   * @returns {Object|null} - Decoded token payload or null if invalid
   */
  decodeToken(token) {
    if (!token) return null;
    
    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }
  
  /**
   * Calculate token expiration time
   * @param {string} token - JWT token string
   * @param {number} [defaultExpirySeconds=3600] - Default expiry if not in token
   * @returns {number} - Expiration timestamp in milliseconds
   */
  calculateTokenExpiration(token, defaultExpirySeconds = 3600) {
    let expiresAt;
    
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.exp) {
        // JWT exp is in seconds
        expiresAt = decoded.exp * 1000;
      } else {
        // Fallback to default expiration
        expiresAt = Date.now() + (defaultExpirySeconds * 1000);
      }
    } catch (error) {
      // Fallback to default expiration
      expiresAt = Date.now() + (defaultExpirySeconds * 1000);
    }
    
    return expiresAt;
  }
  
  /**
   * Check if user has a specific permission
   * @param {Object} user - User object
   * @param {string} permission - Permission to check
   * @returns {boolean} - Whether user has the permission
   */
  hasPermission(user, permission) {
    if (!user || !user.permissions) {
      return false;
    }
    
    // Check direct permission
    if (user.permissions[permission] === true) {
      return true;
    }
    
    // Check for wildcard permissions (e.g., "admin:*")
    const permissionParts = permission.split(':');
    if (permissionParts.length > 1) {
      const wildcardPermission = `${permissionParts[0]}:*`;
      if (user.permissions[wildcardPermission] === true) {
        return true;
      }
    }
    
    // Check if user is admin (has all permissions)
    if (user.isAdmin === true) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if user has all specified permissions
   * @param {Object} user - User object
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - Whether user has all permissions
   */
  hasAllPermissions(user, permissions) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return true;
    }
    
    return permissions.every(permission => this.hasPermission(user, permission));
  }
  
  /**
   * Check if user has any of the specified permissions
   * @param {Object} user - User object
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean} - Whether user has any of the permissions
   */
  hasAnyPermission(user, permissions) {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return false;
    }
    
    return permissions.some(permission => this.hasPermission(user, permission));
  }
  
  /**
   * Calculate permission level based on user roles
   * @param {Object} user - User object
   * @returns {number} - Permission level
   */
  calculatePermissionLevel(user) {
    if (!user) {
      return PermissionLevels.NONE;
    }
    
    if (user.isAdmin) {
      return PermissionLevels.ADMIN;
    }
    
    if (!user.roles || !Array.isArray(user.roles)) {
      return PermissionLevels.VIEWER;
    }
    
    const roles = user.roles.map(role => role.toLowerCase());
    
    if (roles.includes('moderator')) {
      return PermissionLevels.MODERATOR;
    }
    
    if (roles.includes('contributor')) {
      return PermissionLevels.CONTRIBUTOR;
    }
    
    return PermissionLevels.VIEWER;
  }
  
  /**
   * Extract role names from GitHub team memberships
   * @param {Array} teams - GitHub teams
   * @returns {string[]} - Array of role names
   */
  extractRolesFromGitHubTeams(teams) {
    if (!teams || !Array.isArray(teams)) {
      return ['viewer'];
    }
    
    const roleMap = {
      'ai-alignment-admins': 'admin',
      'ai-alignment-moderators': 'moderator',
      'ai-alignment-contributors': 'contributor',
      'ai-alignment-viewers': 'viewer'
    };
    
    const roles = teams
      .map(team => {
        const teamName = team.name.toLowerCase();
        // Check for direct mapping
        for (const [key, value] of Object.entries(roleMap)) {
          if (teamName.includes(key)) {
            return value;
          }
        }
        
        // Check for role keywords in team name
        if (teamName.includes('admin')) return 'admin';
        if (teamName.includes('moderator')) return 'moderator';
        if (teamName.includes('contributor')) return 'contributor';
        if (teamName.includes('viewer')) return 'viewer';
        
        return null;
      })
      .filter(Boolean);
    
    // Default to viewer if no roles found
    return roles.length > 0 ? roles : ['viewer'];
  }
  
  /**
   * Get permissions based on role
   * @param {string} role - Role name
   * @returns {Object} - Map of permissions for the role
   */
  getPermissionsForRole(role) {
    const roleName = (role || '').toLowerCase();
    
    // Define permissions for each role
    const rolePermissions = {
      admin: {
        // Auth permissions
        'auth:viewUsers': true,
        'auth:createUsers': true,
        'auth:editUsers': true,
        'auth:deleteUsers': true,
        'auth:assignRoles': true,
        
        // Content permissions
        'content:view': true,
        'content:create': true,
        'content:edit': true,
        'content:delete': true,
        'content:approve': true,
        
        // Node permissions
        'node:view': true,
        'node:create': true,
        'node:edit': true,
        'node:delete': true,
        
        // Relationship permissions
        'relationship:view': true,
        'relationship:create': true,
        'relationship:edit': true,
        'relationship:delete': true,
        
        // Visualization permissions
        'visualization:view': true,
        'visualization:configure': true,
        
        // Administration permissions
        'admin:accessPanel': true,
        'admin:systemSettings': true,
        'admin:viewLogs': true,
        
        // Security permissions
        'security:encrypt': true,
        'security:decrypt': true,
        'security:manageKeys': true
      },
      
      moderator: {
        // Auth permissions
        'auth:viewUsers': true,
        
        // Content permissions
        'content:view': true,
        'content:create': true,
        'content:edit': true,
        'content:delete': true,
        'content:approve': true,
        
        // Node permissions
        'node:view': true,
        'node:create': true,
        'node:edit': true,
        'node:delete': true,
        
        // Relationship permissions
        'relationship:view': true,
        'relationship:create': true,
        'relationship:edit': true,
        'relationship:delete': true,
        
        // Visualization permissions
        'visualization:view': true,
        'visualization:configure': true,
        
        // Administration permissions
        'admin:viewLogs': true,
        
        // Security permissions
        'security:encrypt': true,
        'security:decrypt': true
      },
      
      contributor: {
        // Content permissions
        'content:view': true,
        'content:create': true,
        'content:edit': true,
        
        // Node permissions
        'node:view': true,
        'node:create': true,
        'node:edit': true,
        
        // Relationship permissions
        'relationship:view': true,
        'relationship:create': true,
        'relationship:edit': true,
        
        // Visualization permissions
        'visualization:view': true,
        
        // Security permissions
        'security:encrypt': true,
        'security:decrypt': true
      },
      
      viewer: {
        // Content permissions
        'content:view': true,
        
        // Node permissions
        'node:view': true,
        
        // Relationship permissions
        'relationship:view': true,
        
        // Visualization permissions
        'visualization:view': true,
        
        // Security permissions
        'security:decrypt': true
      }
    };
    
    return rolePermissions[roleName] || rolePermissions.viewer;
  }
  
  /**
   * Parse and validate authorization response
   * @param {string} queryString - URL query string from OAuth callback
   * @returns {Object} - Parsed response with validation results
   */
  parseAuthResponse(queryString) {
    if (!queryString) {
      return { valid: false, error: 'No query string provided' };
    }
    
    // Parse query parameters
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (error) {
      return {
        valid: false,
        error,
        errorDescription,
        parsed: { error, errorDescription }
      };
    }
    
    if (!code) {
      return {
        valid: false,
        error: 'No authorization code received',
        parsed: { state }
      };
    }
    
    if (!state) {
      return {
        valid: false,
        error: 'No state parameter received',
        parsed: { code }
      };
    }
    
    return {
      valid: true,
      parsed: { code, state }
    };
  }
  
  /**
   * Generate a random string for use in authentication flows
   * @param {number} [length=32] - Length of the string
   * @returns {string} - Random string
   */
  generateRandomString(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => 
      ('0' + (byte & 0xFF).toString(16)).slice(-2)
    ).join('');
  }
  
  /**
   * Generate PKCE challenge pair
   * @returns {Object} - Object containing code_verifier and code_challenge
   */
  generatePKCEPair() {
    const verifier = this.generateRandomString(64);
    
    // Generate the challenge from the verifier
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    
    return window.crypto.subtle.digest('SHA-256', data)
      .then(digest => {
        const hashArray = Array.from(new Uint8Array(digest));
        const hashBase64 = btoa(String.fromCharCode.apply(null, hashArray))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        
        return {
          codeVerifier: verifier,
          codeChallenge: hashBase64
        };
      });
  }
  
  /**
   * Extract error information from failed authentication
   * @param {Error|Object} error - Error object
   * @returns {Object} - Normalized error information
   */
  normalizeAuthError(error) {
    // If already normalized, return as is
    if (error && error.code && error.message) {
      return error;
    }
    
    let code = 'auth/unknown-error';
    let message = 'An unknown authentication error occurred';
    let originalError = null;
    
    if (error) {
      originalError = error;
      
      if (typeof error === 'string') {
        message = error;
      } else if (error instanceof Error) {
        message = error.message;
        
        // Extract error code if present
        if (error.code) {
          code = error.code;
        } else if (error.name) {
          code = `auth/${error.name.toLowerCase()}`;
        }
      } else if (typeof error === 'object') {
        if (error.message) {
          message = error.message;
        }
        
        if (error.code) {
          code = error.code;
        } else if (error.error) {
          code = `auth/${error.error}`;
          
          if (error.error_description) {
            message = error.error_description;
          }
        }
      }
    }
    
    return {
      code,
      message,
      originalError
    };
  }
  
  /**
   * Parse GitHub scopes string into array
   * @param {string} scopesString - Comma-separated scopes
   * @returns {string[]} - Array of scopes
   */
  parseScopes(scopesString) {
    if (!scopesString) return [];
    
    return scopesString
      .split(',')
      .map(scope => scope.trim())
      .filter(Boolean);
  }
  
  /**
   * Extract user data from GitHub user API response
   * @param {Object} githubUser - GitHub API user response
   * @returns {Object} - Normalized user profile
   */
  normalizeGitHubUser(githubUser) {
    if (!githubUser) return null;
    
    return {
      id: githubUser.id.toString(),
      username: githubUser.login,
      name: githubUser.name || githubUser.login,
      email: githubUser.email,
      avatar: githubUser.avatar_url,
      provider: 'github',
      metadata: {
        htmlUrl: githubUser.html_url,
        reposUrl: githubUser.repos_url,
        type: githubUser.type,
        location: githubUser.location,
        bio: githubUser.bio,
        publicRepos: githubUser.public_repos,
        followers: githubUser.followers,
        following: githubUser.following,
      },
      created: githubUser.created_at ? new Date(githubUser.created_at) : null,
      // Default to viewer role, will be updated based on team memberships
      roles: ['viewer'],
      // Default to viewer permissions, will be updated based on roles
      permissions: this.getPermissionsForRole('viewer'),
      isAdmin: false
    };
  }
}

// Create singleton instance
const authUtils = new AuthUtilities();

export default authUtils; 