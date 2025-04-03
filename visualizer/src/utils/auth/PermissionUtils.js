/**
 * Permission Utilities
 * 
 * Provides utility functions for permission management, role-based access control,
 * and working with permission data outside of React components.
 */

import registry from '../../ModuleRegistry';
import { PermissionKey, RoleIdentifier } from '../../types/auth/PermissionTypes';

/**
 * Standard role hierarchy levels
 */
const ROLE_LEVELS = {
  [RoleIdentifier.ADMIN]: 100,
  [RoleIdentifier.MODERATOR]: 75,
  [RoleIdentifier.CONTRIBUTOR]: 50,
  [RoleIdentifier.VIEWER]: 25,
  anonymous: 0
};

/**
 * Role inheritance map
 */
const ROLE_INHERITANCE = {
  [RoleIdentifier.ADMIN]: [RoleIdentifier.MODERATOR, RoleIdentifier.CONTRIBUTOR, RoleIdentifier.VIEWER],
  [RoleIdentifier.MODERATOR]: [RoleIdentifier.CONTRIBUTOR, RoleIdentifier.VIEWER],
  [RoleIdentifier.CONTRIBUTOR]: [RoleIdentifier.VIEWER],
  [RoleIdentifier.VIEWER]: []
};

/**
 * Default permissions for standard roles
 */
const DEFAULT_ROLE_PERMISSIONS = {
  [RoleIdentifier.ADMIN]: [
    // All permissions
    '*'
  ],
  [RoleIdentifier.MODERATOR]: [
    // Content moderation
    PermissionKey.VIEW_CONTENT,
    PermissionKey.CREATE_CONTENT,
    PermissionKey.EDIT_CONTENT,
    PermissionKey.DELETE_CONTENT,
    PermissionKey.APPROVE_CONTENT,
    
    // Node management
    PermissionKey.VIEW_NODES,
    PermissionKey.CREATE_NODES,
    PermissionKey.EDIT_NODES,
    PermissionKey.DELETE_NODES,
    
    // Relationship management
    PermissionKey.VIEW_RELATIONSHIPS,
    PermissionKey.CREATE_RELATIONSHIPS,
    PermissionKey.EDIT_RELATIONSHIPS,
    PermissionKey.DELETE_RELATIONSHIPS,
    
    // User management (limited)
    PermissionKey.VIEW_USERS,
    
    // Security
    PermissionKey.ENCRYPT_CONTENT,
    PermissionKey.DECRYPT_CONTENT,
    
    // Admin (limited)
    PermissionKey.VIEW_LOGS,
    
    // Visualization
    PermissionKey.VIEW_VISUALIZATION,
    PermissionKey.CONFIGURE_VISUALIZATION
  ],
  [RoleIdentifier.CONTRIBUTOR]: [
    // Content management
    PermissionKey.VIEW_CONTENT,
    PermissionKey.CREATE_CONTENT,
    PermissionKey.EDIT_CONTENT,
    
    // Node management
    PermissionKey.VIEW_NODES,
    PermissionKey.CREATE_NODES,
    PermissionKey.EDIT_NODES,
    
    // Relationship management
    PermissionKey.VIEW_RELATIONSHIPS,
    PermissionKey.CREATE_RELATIONSHIPS,
    PermissionKey.EDIT_RELATIONSHIPS,
    
    // Security
    PermissionKey.ENCRYPT_CONTENT,
    PermissionKey.DECRYPT_CONTENT,
    
    // Visualization
    PermissionKey.VIEW_VISUALIZATION
  ],
  [RoleIdentifier.VIEWER]: [
    // View-only permissions
    PermissionKey.VIEW_CONTENT,
    PermissionKey.VIEW_NODES,
    PermissionKey.VIEW_RELATIONSHIPS,
    PermissionKey.VIEW_VISUALIZATION
  ]
};

/**
 * Permission system utilities
 */
const PermissionUtils = {
  /**
   * Get all effective roles for a user (including inherited roles)
   * @param {string[]} directRoles - Directly assigned roles
   * @returns {string[]} All effective roles
   */
  getEffectiveRoles(directRoles) {
    if (!Array.isArray(directRoles) || directRoles.length === 0) {
      return [];
    }
    
    const effectiveRoles = [...directRoles];
    const addedRoles = new Set(directRoles);
    
    // Add inherited roles
    directRoles.forEach(roleId => {
      if (ROLE_INHERITANCE[roleId]) {
        ROLE_INHERITANCE[roleId].forEach(inheritedRole => {
          if (!addedRoles.has(inheritedRole)) {
            effectiveRoles.push(inheritedRole);
            addedRoles.add(inheritedRole);
          }
        });
      }
    });
    
    return effectiveRoles;
  },
  
  /**
   * Check if a role has a higher level than another
   * @param {string} roleA - First role to compare
   * @param {string} roleB - Second role to compare
   * @returns {boolean} Whether roleA has higher level than roleB
   */
  isRoleHigherThan(roleA, roleB) {
    const levelA = ROLE_LEVELS[roleA] || 0;
    const levelB = ROLE_LEVELS[roleB] || 0;
    return levelA > levelB;
  },
  
  /**
   * Get default permissions for a role
   * @param {string} roleId - Role ID
   * @returns {string[]} Array of permission IDs
   */
  getDefaultPermissionsForRole(roleId) {
    return DEFAULT_ROLE_PERMISSIONS[roleId] || [];
  },
  
  /**
   * Calculate default permissions for multiple roles
   * @param {string[]} roles - Array of role IDs
   * @returns {string[]} Combined permissions from all roles
   */
  calculateDefaultPermissions(roles) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return [];
    }
    
    // Get all effective roles (including inherited roles)
    const effectiveRoles = this.getEffectiveRoles(roles);
    
    // If user has admin role, they have all permissions
    if (effectiveRoles.includes(RoleIdentifier.ADMIN)) {
      return ['*']; // Wildcard for all permissions
    }
    
    // Collect permissions from all roles
    const permissions = new Set();
    
    effectiveRoles.forEach(roleId => {
      const rolePermissions = this.getDefaultPermissionsForRole(roleId);
      rolePermissions.forEach(permission => {
        permissions.add(permission);
      });
    });
    
    return Array.from(permissions);
  },
  
  /**
   * Get the highest role from an array of roles
   * @param {string[]} roles - Array of role IDs
   * @returns {string|null} Highest role ID or null if no roles
   */
  getHighestRole(roles) {
    if (!Array.isArray(roles) || roles.length === 0) {
      return null;
    }
    
    let highestRole = roles[0];
    let highestLevel = ROLE_LEVELS[highestRole] || 0;
    
    for (let i = 1; i < roles.length; i++) {
      const roleLevel = ROLE_LEVELS[roles[i]] || 0;
      if (roleLevel > highestLevel) {
        highestLevel = roleLevel;
        highestRole = roles[i];
      }
    }
    
    return highestRole;
  },
  
  /**
   * Format permission ID for display
   * @param {string} permissionId - Permission ID (e.g. "content:edit")
   * @returns {string} Formatted permission name (e.g. "Edit Content")
   */
  formatPermissionName(permissionId) {
    if (!permissionId) return '';
    
    try {
      // Split by colon
      const parts = permissionId.split(':');
      
      if (parts.length < 2) {
        // Just capitalize if no colon
        return this.toTitleCase(permissionId);
      }
      
      // Format as "Verb Noun"
      const area = this.toTitleCase(parts[0]);
      const action = this.toTitleCase(parts[1]);
      
      // Handle special format for ownership and special permissions
      if (parts.length > 2) {
        if (parts[2] === 'own') {
          return `${action} Own ${area}`;
        }
        return `${action} ${area} (${this.toTitleCase(parts[2])})`;
      }
      
      return `${action} ${area}`;
    } catch (error) {
      console.error('Error formatting permission name:', error);
      return permissionId;
    }
  },
  
  /**
   * Format role ID for display
   * @param {string} roleId - Role ID (e.g. "admin")
   * @returns {string} Formatted role name (e.g. "Administrator")
   */
  formatRoleName(roleId) {
    if (!roleId) return '';
    
    const roleNames = {
      [RoleIdentifier.ADMIN]: 'Administrator',
      [RoleIdentifier.MODERATOR]: 'Moderator',
      [RoleIdentifier.CONTRIBUTOR]: 'Contributor',
      [RoleIdentifier.VIEWER]: 'Viewer'
    };
    
    return roleNames[roleId] || this.toTitleCase(roleId);
  },
  
  /**
   * Convert string to title case
   * @param {string} str - String to convert
   * @returns {string} Title-cased string
   * @private
   */
  toTitleCase(str) {
    if (!str) return '';
    
    return str
      .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
      .replace(/^./, match => match.toUpperCase()) // Capitalize first letter
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\w\S*/g, word => {
        // Don't capitalize small words in the middle
        const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 
                           'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via'];
        
        if (smallWords.includes(word.toLowerCase())) {
          return word.toLowerCase();
        }
        
        return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
      });
  },
  
  /**
   * Generate JSON structure for permission documentation
   * @returns {Object} Permission documentation object
   */
  generatePermissionDocs() {
    // Get all permission keys
    const permissionKeys = Object.values(PermissionKey);
    
    // Group permissions by area
    const permissionGroups = {};
    
    permissionKeys.forEach(key => {
      const [area] = key.split(':');
      if (!permissionGroups[area]) {
        permissionGroups[area] = [];
      }
      
      permissionGroups[area].push({
        id: key,
        name: this.formatPermissionName(key),
        roles: Object.entries(DEFAULT_ROLE_PERMISSIONS)
          .filter(([_, perms]) => perms.includes(key) || perms.includes('*'))
          .map(([roleId]) => ({
            id: roleId,
            name: this.formatRoleName(roleId)
          }))
      });
    });
    
    return {
      permissionGroups,
      roles: Object.keys(DEFAULT_ROLE_PERMISSIONS).map(roleId => ({
        id: roleId,
        name: this.formatRoleName(roleId),
        level: ROLE_LEVELS[roleId],
        inherits: ROLE_INHERITANCE[roleId].map(id => ({
          id,
          name: this.formatRoleName(id)
        }))
      }))
    };
  },
  
  /**
   * Check if a permission matches a pattern (supporting wildcards)
   * @param {string} permission - Permission to check
   * @param {string} pattern - Pattern to match against (supports *)
   * @returns {boolean} Whether pattern matches
   */
  matchesPermissionPattern(permission, pattern) {
    if (pattern === '*') {
      return true; // Wildcard matches everything
    }
    
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return permission.startsWith(prefix);
    }
    
    return permission === pattern;
  },
  
  /**
   * Calculate effective permissions based on user data
   * @param {Object} userData - User data with roles and direct permissions
   * @returns {string[]} Effective permissions
   */
  calculateEffectivePermissions(userData) {
    if (!userData) {
      return [];
    }
    
    // Admin has all permissions
    if (userData.isAdmin) {
      return ['*'];
    }
    
    // Start with directly assigned permissions
    const directPermissions = Array.isArray(userData.permissions) ? [...userData.permissions] : [];
    
    // Add role-based permissions
    if (Array.isArray(userData.roles) && userData.roles.length > 0) {
      const rolePermissions = this.calculateDefaultPermissions(userData.roles);
      
      // Add role permissions that aren't already directly assigned
      rolePermissions.forEach(perm => {
        if (!directPermissions.includes(perm)) {
          directPermissions.push(perm);
        }
      });
    }
    
    return directPermissions;
  }
};

// Create instance
const permissionUtils = PermissionUtils;

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.PermissionUtils',
  permissionUtils,
  [],
  {
    description: 'Utilities for permission management and access control',
    usage: `
      // Get effective roles including inheritance
      const roles = PermissionUtils.getEffectiveRoles(['contributor']);
      // Returns ['contributor', 'viewer']
      
      // Format permission for display
      const name = PermissionUtils.formatPermissionName('content:edit');
      // Returns "Edit Content"
      
      // Calculate permissions from roles
      const perms = PermissionUtils.calculateDefaultPermissions(['moderator']);
    `
  }
); 