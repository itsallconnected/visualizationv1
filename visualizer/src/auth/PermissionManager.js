// PermissionManager.js
// Permission management and role-based access control

import React from 'react';
import registry from '../ModuleRegistry';
import AuthService from './AuthService';
import ErrorHandler from '../utils/ErrorHandler';
import EventBus from '../utils/EventBus';
import APP_SETTINGS from '../config/app-settings';

// Implement component here

/**
 * PermissionManager provides comprehensive role-based access control (RBAC)
 * and permission management for the application.
 * 
 * This service handles:
 * - User permission verification
 * - Role-based access control
 * - Permission hierarchy and inheritance
 * - Caching permission data for performance
 * - Integration with authentication events
 */
class PermissionManager {
  /**
   * Initialize the permission manager
   */
  constructor() {
    // Permission cache to avoid frequent recalculations
    this.permissionsCache = new Map();
    this.cacheExpiry = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Role definitions with hierarchy
    this.roles = {
      admin: {
        name: 'Administrator',
        level: 100,
        inherits: ['moderator', 'contributor', 'viewer'],
        description: 'Full system access and control'
      },
      moderator: {
        name: 'Moderator',
        level: 75,
        inherits: ['contributor', 'viewer'],
        description: 'Content moderation and approval'
      },
      contributor: {
        name: 'Contributor',
        level: 50,
        inherits: ['viewer'],
        description: 'Can create and edit content'
      },
      viewer: {
        name: 'Viewer',
        level: 25,
        inherits: [],
        description: 'Read-only access'
      }
    };
    
    // Permission definitions
    this.permissions = this._initializePermissions();
    
    // Get service references
    this.authService = registry.getModule('auth.AuthService') || AuthService;
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    
    // Set up event listeners
    this._setupEventListeners();
  }
  
  /**
   * Create initial permission definitions
   * @returns {Object} Permission definitions
   * @private
   */
  _initializePermissions() {
    return {
      // Authentication permissions
      'auth:viewUsers': {
        roles: ['admin', 'moderator'],
        description: 'View user accounts'
      },
      'auth:createUsers': {
        roles: ['admin'],
        description: 'Create new user accounts'
      },
      'auth:editUsers': {
        roles: ['admin'],
        description: 'Edit user accounts'
      },
      'auth:deleteUsers': {
        roles: ['admin'],
        description: 'Delete user accounts'
      },
      'auth:assignRoles': {
        roles: ['admin'],
        description: 'Assign roles to users'
      },
      
      // Content permissions
      'content:view': {
        roles: ['admin', 'moderator', 'contributor', 'viewer'],
        description: 'View content'
      },
      'content:create': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Create new content'
      },
      'content:edit': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Edit existing content'
      },
      'content:delete': {
        roles: ['admin', 'moderator'],
        description: 'Delete content'
      },
      'content:approve': {
        roles: ['admin', 'moderator'],
        description: 'Approve content changes'
      },
      
      // Node permissions
      'node:view': {
        roles: ['admin', 'moderator', 'contributor', 'viewer'],
        description: 'View node data'
      },
      'node:create': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Create new nodes'
      },
      'node:edit': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Edit existing nodes'
      },
      'node:delete': {
        roles: ['admin', 'moderator'],
        description: 'Delete nodes'
      },
      
      // Relationship permissions
      'relationship:view': {
        roles: ['admin', 'moderator', 'contributor', 'viewer'],
        description: 'View relationships'
      },
      'relationship:create': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Create new relationships'
      },
      'relationship:edit': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Edit existing relationships'
      },
      'relationship:delete': {
        roles: ['admin', 'moderator'],
        description: 'Delete relationships'
      },
      
      // Visualization permissions
      'visualization:view': {
        roles: ['admin', 'moderator', 'contributor', 'viewer'],
        description: 'View visualizations'
      },
      'visualization:configure': {
        roles: ['admin', 'moderator'],
        description: 'Configure visualization settings'
      },
      
      // Admin permissions
      'admin:accessPanel': {
        roles: ['admin'],
        description: 'Access admin panel'
      },
      'admin:systemSettings': {
        roles: ['admin'],
        description: 'Modify system settings'
      },
      'admin:viewLogs': {
        roles: ['admin', 'moderator'],
        description: 'View system logs'
      },
      
      // Security permissions
      'security:encrypt': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Encrypt content'
      },
      'security:decrypt': {
        roles: ['admin', 'moderator', 'contributor'],
        description: 'Decrypt content'
      },
      'security:manageKeys': {
        roles: ['admin'],
        description: 'Manage encryption keys'
      }
    };
  }
  
  /**
   * Set up event listeners for auth events
   * @private
   */
  _setupEventListeners() {
    if (this.eventBus) {
      // Handle authentication events
      this.eventBus.subscribeToMany([
        'auth:signIn',
        'auth:signOut',
        'auth:sessionExpired',
        'auth:userUpdated',
        'auth:permissionChanged'
      ], this._handleAuthEvent.bind(this));
      
      // Log initialization
      this.eventBus.publish('permissions:initialized', {
        roleCount: Object.keys(this.roles).length,
        permissionCount: Object.keys(this.permissions).length
      });
    }
  }
  
  /**
   * Handle authentication events
   * @param {Object} event - Event data
   * @private
   */
  _handleAuthEvent(event) {
    // Clear permissions cache on any auth state change
    this.clearCache();
    
    // Log events if in debug mode
    if (APP_SETTINGS.debug) {
      console.log(`PermissionManager: Handling auth event: ${event.type}`);
    }
  }
  
  /**
   * Clear the permissions cache
   */
  clearCache() {
    this.permissionsCache.clear();
    this.cacheExpiry.clear();
  }
  
  /**
   * Get available roles
   * @returns {Array<Object>} Array of role objects
   */
  getRoles() {
    return Object.entries(this.roles).map(([id, role]) => ({
      id,
      ...role
    }));
  }
  
  /**
   * Get available permissions
   * @returns {Array<Object>} Array of permission objects
   */
  getPermissions() {
    return Object.entries(this.permissions).map(([id, permission]) => ({
      id,
      ...permission
    }));
  }
  
  /**
   * Get role details
   * @param {string} roleId - Role identifier
   * @returns {Object|null} Role details or null if not found
   */
  getRole(roleId) {
    if (!roleId || !this.roles[roleId]) return null;
    
    return {
      id: roleId,
      ...this.roles[roleId]
    };
  }
  
  /**
   * Get permission details
   * @param {string} permissionId - Permission identifier
   * @returns {Object|null} Permission details or null if not found
   */
  getPermission(permissionId) {
    if (!permissionId || !this.permissions[permissionId]) return null;
    
    return {
      id: permissionId,
      ...this.permissions[permissionId]
    };
  }
  
  /**
   * Check if a user has a specific permission
   * @param {string} permissionId - Permission to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has the permission
   */
  async hasPermission(permissionId, user) {
    try {
      if (!permissionId) {
        throw ErrorHandler.createError(
          'Permission ID is required',
          'ValidationError',
          'MISSING_PERMISSION_ID'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Check permission cache first
      const cacheKey = `${userData.id}:${permissionId}`;
      if (this._checkCache(cacheKey)) {
        return this.permissionsCache.get(cacheKey);
      }
      
      let hasPermission = false;
      
      // Admin role has all permissions
      if (userData.isAdmin) {
        hasPermission = true;
      } 
      // Check if user has the permission directly
      else if (Array.isArray(userData.permissions) && userData.permissions.includes(permissionId)) {
        hasPermission = true;
      }
      // Check if user has a role that grants this permission
      else if (Array.isArray(userData.roles) && userData.roles.length > 0) {
        // Get all effective roles (including inherited roles)
        const effectiveRoles = this._getEffectiveRoles(userData.roles);
        
        // Check if any of the user's roles grant this permission
        const permission = this.permissions[permissionId];
        if (permission && Array.isArray(permission.roles)) {
          hasPermission = permission.roles.some(role => effectiveRoles.includes(role));
        }
      }
      
      // Cache the result
      this._cacheResult(cacheKey, hasPermission);
      
      return hasPermission;
    } catch (error) {
      console.error('Error checking permission:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkPermission',
        permissionId,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user has any of the specified permissions
   * @param {Array<string>} permissionIds - Permissions to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has any of the permissions
   */
  async hasAnyPermission(permissionIds, user) {
    try {
      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        throw ErrorHandler.createError(
          'Valid permission IDs array is required',
          'ValidationError',
          'INVALID_PERMISSION_IDS'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Admin role has all permissions
      if (userData.isAdmin) {
        return true;
      }
      
      // Check each permission
      for (const permissionId of permissionIds) {
        if (await this.hasPermission(permissionId, userData)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking permissions:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkAnyPermission',
        permissionIds,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user has all of the specified permissions
   * @param {Array<string>} permissionIds - Permissions to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has all of the permissions
   */
  async hasAllPermissions(permissionIds, user) {
    try {
      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        throw ErrorHandler.createError(
          'Valid permission IDs array is required',
          'ValidationError',
          'INVALID_PERMISSION_IDS'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Admin role has all permissions
      if (userData.isAdmin) {
        return true;
      }
      
      // Check each permission
      for (const permissionId of permissionIds) {
        if (!(await this.hasPermission(permissionId, userData))) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking permissions:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkAllPermissions',
        permissionIds,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user has a specific role
   * @param {string} roleId - Role to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has the role
   */
  async hasRole(roleId, user) {
    try {
      if (!roleId) {
        throw ErrorHandler.createError(
          'Role ID is required',
          'ValidationError',
          'MISSING_ROLE_ID'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Check role cache first
      const cacheKey = `role:${userData.id}:${roleId}`;
      if (this._checkCache(cacheKey)) {
        return this.permissionsCache.get(cacheKey);
      }
      
      let hasRole = false;
      
      // Check if user has the role directly
      if (Array.isArray(userData.roles) && userData.roles.includes(roleId)) {
        hasRole = true;
      }
      
      // Cache the result
      this._cacheResult(cacheKey, hasRole);
      
      return hasRole;
    } catch (error) {
      console.error('Error checking role:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkRole',
        roleId,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user has any of the specified roles
   * @param {Array<string>} roleIds - Roles to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has any of the roles
   */
  async hasAnyRole(roleIds, user) {
    try {
      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        throw ErrorHandler.createError(
          'Valid role IDs array is required',
          'ValidationError',
          'INVALID_ROLE_IDS'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Check each role
      for (const roleId of roleIds) {
        if (await this.hasRole(roleId, userData)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking roles:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkAnyRole',
        roleIds,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user has all of the specified roles
   * @param {Array<string>} roleIds - Roles to check
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user has all of the roles
   */
  async hasAllRoles(roleIds, user) {
    try {
      if (!Array.isArray(roleIds) || roleIds.length === 0) {
        throw ErrorHandler.createError(
          'Valid role IDs array is required',
          'ValidationError',
          'INVALID_ROLE_IDS'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return false;
      }
      
      // Check each role
      for (const roleId of roleIds) {
        if (!(await this.hasRole(roleId, userData))) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error checking roles:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkAllRoles',
        roleIds,
        error
      });
      return false;
    }
  }
  
  /**
   * Check if a user can perform an action on a content item
   * @param {string} action - Action to check (view, edit, delete)
   * @param {string} contentType - Type of content (node, relationship, etc.)
   * @param {Object} [contentItem] - Content item to check permissions for
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<boolean>} Whether user can perform the action
   */
  async canPerformAction(action, contentType, contentItem, user) {
    try {
      if (!action || !contentType) {
        throw ErrorHandler.createError(
          'Action and content type are required',
          'ValidationError',
          'MISSING_ACTION_PARAMS'
        );
      }
      
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        // Anonymous users can only view public content
        return action === 'view' && (!contentItem || !contentItem.isPrivate);
      }
      
      // Admin can do anything
      if (userData.isAdmin) {
        return true;
      }
      
      // Check basic permission first
      const permissionId = `${contentType}:${action}`;
      const hasBasePermission = await this.hasPermission(permissionId, userData);
      
      if (!hasBasePermission) {
        return false;
      }
      
      // If no content item provided, just check the base permission
      if (!contentItem) {
        return true;
      }
      
      // Additional checks based on content item
      
      // Check ownership permissions
      if (contentItem.createdBy && contentItem.createdBy === userData.id) {
        // Check owner-specific permission
        const ownerPermissionId = `${contentType}:${action}:own`;
        if (this.permissions[ownerPermissionId]) {
          return await this.hasPermission(ownerPermissionId, userData);
        }
        
        // If no owner-specific permission exists, use base permission
        return true;
      }
      
      // Check encryption permissions
      if (contentItem.isEncrypted) {
        // Encrypted content may require additional permission
        const encryptedPermissionId = `${contentType}:${action}:encrypted`;
        if (this.permissions[encryptedPermissionId]) {
          return await this.hasPermission(encryptedPermissionId, userData);
        }
      }
      
      // Default to base permission result
      return true;
    } catch (error) {
      console.error('Error checking action permission:', error);
      this.eventBus.publish('permissions:error', {
        action: 'checkActionPermission',
        actionType: action,
        contentType,
        error
      });
      return false;
    }
  }
  
  /**
   * Get a user's permissions
   * @param {string|Object} [user] - User ID or user object, defaults to current user
   * @returns {Promise<Array<string>>} Array of permission IDs
   */
  async getUserPermissions(user) {
    try {
      // Get user data
      const userData = await this._resolveUser(user);
      
      if (!userData || !userData.isAuthenticated) {
        return [];
      }
      
      // Check cache first
      const cacheKey = `allPermissions:${userData.id}`;
      if (this._checkCache(cacheKey)) {
        return this.permissionsCache.get(cacheKey);
      }
      
      // Start with directly assigned permissions
      const permissions = Array.isArray(userData.permissions) ? [...userData.permissions] : [];
      
      // Add permissions from roles
      if (Array.isArray(userData.roles) && userData.roles.length > 0) {
        // Get all effective roles (including inherited roles)
        const effectiveRoles = this._getEffectiveRoles(userData.roles);
        
        // Add permissions from each role
        Object.entries(this.permissions).forEach(([permissionId, permission]) => {
          if (Array.isArray(permission.roles) && 
              permission.roles.some(role => effectiveRoles.includes(role)) &&
              !permissions.includes(permissionId)) {
            permissions.push(permissionId);
          }
        });
      }
      
      // Special case: admin has all permissions
      if (userData.isAdmin) {
        Object.keys(this.permissions).forEach(permissionId => {
          if (!permissions.includes(permissionId)) {
            permissions.push(permissionId);
          }
        });
      }
      
      // Cache the result
      this._cacheResult(cacheKey, permissions);
      
      return permissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      this.eventBus.publish('permissions:error', {
        action: 'getUserPermissions',
        error
      });
      return [];
    }
  }
  
  /**
   * Get all effective roles for a user (including role inheritance)
   * @param {Array<string>} directRoles - Directly assigned roles
   * @returns {Array<string>} All effective roles
   * @private
   */
  _getEffectiveRoles(directRoles) {
    if (!Array.isArray(directRoles) || directRoles.length === 0) {
      return [];
    }
    
    const effectiveRoles = [...directRoles];
    
    // Process each direct role
    directRoles.forEach(roleId => {
      const role = this.roles[roleId];
      if (role && Array.isArray(role.inherits)) {
        // Add inherited roles
        role.inherits.forEach(inheritedRoleId => {
          if (!effectiveRoles.includes(inheritedRoleId)) {
            effectiveRoles.push(inheritedRoleId);
            
            // Recursively add nested inherited roles
            const nestedInherited = this._getInheritedRoles(inheritedRoleId);
            nestedInherited.forEach(nestedRoleId => {
              if (!effectiveRoles.includes(nestedRoleId)) {
                effectiveRoles.push(nestedRoleId);
              }
            });
          }
        });
      }
    });
    
    return effectiveRoles;
  }
  
  /**
   * Get all roles inherited by a given role
   * @param {string} roleId - Role ID to check
   * @returns {Array<string>} Inherited roles
   * @private
   */
  _getInheritedRoles(roleId) {
    const role = this.roles[roleId];
    if (!role || !Array.isArray(role.inherits) || role.inherits.length === 0) {
      return [];
    }
    
    const inheritedRoles = [...role.inherits];
    
    // Recursively get inherited roles
    role.inherits.forEach(inheritedRoleId => {
      const nestedInherited = this._getInheritedRoles(inheritedRoleId);
      nestedInherited.forEach(nestedRoleId => {
        if (!inheritedRoles.includes(nestedRoleId)) {
          inheritedRoles.push(nestedRoleId);
        }
      });
    });
    
    return inheritedRoles;
  }
  
  /**
   * Resolve a user reference to a full user object
   * @param {string|Object} user - User ID or user object
   * @returns {Promise<Object>} Resolved user object
   * @private
   */
  async _resolveUser(user) {
    // If user is not provided, get current user from auth service
    if (!user) {
      if (!this.authService) {
        return { isAuthenticated: false };
      }
      
      return await this.authService.getCurrentUser();
    }
    
    // If user is already an object with necessary properties, use it
    if (typeof user === 'object' && user !== null) {
      return user;
    }
    
    // If user is a string (ID), get user data from auth service
    if (typeof user === 'string' && this.authService) {
      try {
        return await this.authService.getUserById(user);
      } catch (error) {
        console.error(`Error resolving user ID ${user}:`, error);
        return { isAuthenticated: false };
      }
    }
    
    // Invalid user reference
    return { isAuthenticated: false };
  }
  
  /**
   * Check if a cache entry is valid
   * @param {string} key - Cache key
   * @returns {boolean} Whether cache entry is valid
   * @private
   */
  _checkCache(key) {
    if (!this.permissionsCache.has(key)) {
      return false;
    }
    
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      // Cache expired
      this.permissionsCache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Cache a permission check result
   * @param {string} key - Cache key
   * @param {*} result - Result to cache
   * @private
   */
  _cacheResult(key, result) {
    this.permissionsCache.set(key, result);
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
  }
}

// Create singleton instance
const permissionManager = new PermissionManager();

// Register with ModuleRegistry
export default registry.register(
  'auth.PermissionManager',
  permissionManager,
  ['auth.AuthService', 'utils.EventBus', 'utils.ErrorHandler'],
  {
    description: 'Provides role-based access control and permission management',
    usage: `
      // Check if user has a specific permission
      const canEditNode = await PermissionManager.hasPermission('node:edit');
      
      // Check if user has any of the required roles
      const isAdminOrModerator = await PermissionManager.hasAnyRole(['admin', 'moderator']);
      
      // Check if user can perform an action on content
      const canDeleteNode = await PermissionManager.canPerformAction('delete', 'node', nodeObject);
      
      // Get all permissions for a user
      const permissions = await PermissionManager.getUserPermissions(userId);
    `
  }
);

