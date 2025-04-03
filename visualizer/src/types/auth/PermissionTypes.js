/**
 * Permission Types
 * 
 * This file defines TypeScript interfaces and types for the permission system,
 * including roles, permissions, and access control structures.
 */

/**
 * Permission Level Enumeration
 * Defines standard permission levels
 */
export const PermissionLevel = {
  NONE: 0,       // No access
  VIEW: 10,      // View/read access
  CONTRIBUTE: 20, // Create content
  EDIT: 30,      // Modify content
  APPROVE: 40,   // Approve content changes
  ADMIN: 100     // Full system access
};

/**
 * Role Type
 * Defines a user role in the system
 * @typedef {Object} Role
 * @property {string} id - Unique role identifier
 * @property {string} name - Human-readable role name
 * @property {number} level - Numeric level for role hierarchy
 * @property {string[]} inherits - Array of role IDs this role inherits from
 * @property {string} description - Description of the role
 * @property {Object} [metadata] - Additional role metadata
 */

/**
 * Standard Role Identifiers
 * Common roles used throughout the application
 */
export const RoleIdentifier = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  CONTRIBUTOR: 'contributor',
  VIEWER: 'viewer'
};

/**
 * Permission Type
 * Defines a permission in the system
 * @typedef {Object} Permission
 * @property {string} id - Unique permission identifier
 * @property {string[]} roles - Array of role IDs granted this permission
 * @property {string} description - Human-readable description
 * @property {string} [group] - Group this permission belongs to
 * @property {boolean} [isCustom] - Whether this is a custom permission
 * @property {Object} [metadata] - Additional permission metadata
 */

/**
 * Permission Group
 * Groups related permissions
 */
export const PermissionGroup = {
  AUTH: 'auth',
  CONTENT: 'content',
  NODE: 'node',
  RELATIONSHIP: 'relationship',
  VISUALIZATION: 'visualization',
  ADMIN: 'admin',
  SECURITY: 'security'
};

/**
 * Standard Permission Keys
 * Pre-defined permissions used throughout the application
 */
export const PermissionKey = {
  // Authentication permissions
  VIEW_USERS: 'auth:viewUsers',
  CREATE_USERS: 'auth:createUsers',
  EDIT_USERS: 'auth:editUsers',
  DELETE_USERS: 'auth:deleteUsers',
  ASSIGN_ROLES: 'auth:assignRoles',
  
  // Content permissions
  VIEW_CONTENT: 'content:view',
  CREATE_CONTENT: 'content:create',
  EDIT_CONTENT: 'content:edit',
  DELETE_CONTENT: 'content:delete',
  APPROVE_CONTENT: 'content:approve',
  
  // Node permissions
  VIEW_NODES: 'node:view',
  CREATE_NODES: 'node:create',
  EDIT_NODES: 'node:edit',
  DELETE_NODES: 'node:delete',
  
  // Relationship permissions
  VIEW_RELATIONSHIPS: 'relationship:view',
  CREATE_RELATIONSHIPS: 'relationship:create',
  EDIT_RELATIONSHIPS: 'relationship:edit',
  DELETE_RELATIONSHIPS: 'relationship:delete',
  
  // Visualization permissions
  VIEW_VISUALIZATION: 'visualization:view',
  CONFIGURE_VISUALIZATION: 'visualization:configure',
  
  // Administration permissions
  ACCESS_ADMIN_PANEL: 'admin:accessPanel',
  SYSTEM_SETTINGS: 'admin:systemSettings',
  VIEW_LOGS: 'admin:viewLogs',
  
  // Security permissions
  ENCRYPT_CONTENT: 'security:encrypt',
  DECRYPT_CONTENT: 'security:decrypt',
  MANAGE_KEYS: 'security:manageKeys'
};

/**
 * Permission Map Type
 * Maps permission keys to boolean values
 * @typedef {Object.<string, boolean>} PermissionMap
 */

/**
 * User Permissions Type
 * Represents a user's permission set
 * @typedef {Object} UserPermissions
 * @property {string[]} roles - Array of role IDs assigned to the user
 * @property {string[]} permissions - Array of explicitly granted permission IDs
 * @property {Object.<string, boolean>} [permissionMap] - Calculated map of all effective permissions
 * @property {boolean} isAdmin - Whether user has admin privileges
 */

/**
 * Permission Check Result Type
 * Result of a permission check operation
 * @typedef {Object} PermissionCheckResult
 * @property {boolean} granted - Whether permission is granted
 * @property {string} [reason] - Reason for denial if not granted
 * @property {string[]} [grantedBy] - Roles or explicit grants providing the permission
 */

/**
 * Permission Gate Props Type
 * Props for the PermissionGate component
 * @typedef {Object} PermissionGateProps
 * @property {React.ReactNode} children - Child components to render when permitted
 * @property {string|string[]} permissions - Required permission(s)
 * @property {string|string[]} [roles] - Required role(s)
 * @property {'all'|'any'} [requirementType='any'] - Whether to require all or any permissions/roles
 * @property {React.ReactNode} [fallback] - Content to show when not permitted
 * @property {boolean} [noFallback=false] - Whether to render nothing when not permitted
 * @property {Function} [onDenied] - Callback when access is denied
 */

/**
 * Permission Manager Interface
 * Interface for the PermissionManager class
 * @typedef {Object} PermissionManagerInterface
 * @property {Function} hasPermission - Check if a user has a specific permission
 * @property {Function} hasAnyPermission - Check if a user has any of the specified permissions
 * @property {Function} hasAllPermissions - Check if a user has all of the specified permissions
 * @property {Function} hasRole - Check if a user has a specific role
 * @property {Function} hasAnyRole - Check if a user has any of the specified roles
 * @property {Function} hasAllRoles - Check if a user has all of the specified roles
 * @property {Function} canPerformAction - Check if a user can perform an action on a content item
 * @property {Function} getUserPermissions - Get a user's permissions
 * @property {Function} getRoles - Get available roles
 * @property {Function} getPermissions - Get available permissions
 * @property {Function} getRole - Get role details
 * @property {Function} getPermission - Get permission details
 * @property {Function} clearCache - Clear the permissions cache
 */

// Export the types
export const PermissionTypes = {
  PermissionLevel,
  RoleIdentifier,
  PermissionGroup,
  PermissionKey,
  // These exports are for documentation purposes in JSDoc
  // They don't actually export values but help with type definitions
  Role: {},
  Permission: {},
  PermissionMap: {},
  UserPermissions: {},
  PermissionCheckResult: {},
  PermissionGateProps: {},
  PermissionManagerInterface: {}
};

// Export default for module registry
export default PermissionTypes; 