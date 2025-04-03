/**
 * Route Types Definitions
 * 
 * This file defines TypeScript/JSDoc types for routes, route protection,
 * and role-based access control for use with Protected Route components.
 */

import registry from '../../ModuleRegistry';

/**
 * Permission level constants
 * 
 * Each level includes access to all lower levels
 * @enum {number}
 */
export const PermissionLevel = {
  /** Public access, no authentication required */
  PUBLIC: 0,
  
  /** Basic user access, requires authentication */
  USER: 10,
  
  /** Premium user access */
  PREMIUM: 20,
  
  /** Contributor access for content creation */
  CONTRIBUTOR: 30,
  
  /** Moderator access for approving content */
  MODERATOR: 40,
  
  /** Administrator access for system configuration */
  ADMIN: 50,
  
  /** Super admin access for all operations */
  SUPER_ADMIN: 100
};

/**
 * Route type constants
 * @enum {string}
 */
export const RouteType = {
  /** Public route, accessible without authentication */
  PUBLIC: 'public',
  
  /** Protected route, requires authentication */
  PROTECTED: 'protected',
  
  /** Admin route, requires administrative permissions */
  ADMIN: 'admin',
  
  /** Premium route, requires premium or higher access */
  PREMIUM: 'premium',
  
  /** Contributor route, requires contributor or higher access */
  CONTRIBUTOR: 'contributor'
};

/**
 * Map route types to minimum permission levels
 * @type {Object.<string, number>}
 */
export const routeTypeToPermissionLevel = {
  [RouteType.PUBLIC]: PermissionLevel.PUBLIC,
  [RouteType.PROTECTED]: PermissionLevel.USER,
  [RouteType.PREMIUM]: PermissionLevel.PREMIUM,
  [RouteType.CONTRIBUTOR]: PermissionLevel.CONTRIBUTOR,
  [RouteType.ADMIN]: PermissionLevel.ADMIN
};

/**
 * Route definition type
 * @typedef {Object} RouteDefinition
 * @property {string} path - URL path for the route
 * @property {React.ComponentType} component - React component to render
 * @property {string} [title] - Page title
 * @property {string} [routeType] - Type of route (public, protected, admin, etc.)
 * @property {number} [permissionLevel] - Required permission level to access
 * @property {string[]} [requiredPermissions] - Specific permissions required
 * @property {string[]} [requiredRoles] - Roles required to access
 * @property {boolean} [exact] - Whether route requires exact path match
 * @property {RouteDefinition[]} [routes] - Nested routes
 * @property {Object} [meta] - Additional metadata
 * @property {Function} [loadData] - Function to preload data for the route
 * @property {Function} [onEnter] - Callback when route is entered
 * @property {Function} [onExit] - Callback when route is exited
 */

/**
 * Protected route properties type
 * @typedef {Object} ProtectedRouteProps
 * @property {RouteDefinition} route - Route definition
 * @property {React.ComponentType} [fallback] - Component to render while checking auth
 * @property {string} [redirectTo='/login'] - Path to redirect if not authorized
 * @property {Function} [onAuthorized] - Callback after successful authorization
 * @property {Function} [onUnauthorized] - Callback when authorization fails
 * @property {boolean} [rememberPath=true] - Whether to remember path for post-login redirect
 */

/**
 * Breadcrumb item type
 * @typedef {Object} BreadcrumbItem
 * @property {string} path - URL path for the breadcrumb
 * @property {string} label - Display text
 * @property {boolean} [active] - Whether this is the active/current page
 * @property {string} [icon] - Optional icon name
 */

/**
 * Route context type
 * @typedef {Object} RouteContext
 * @property {RouteDefinition} route - Current route
 * @property {RouteDefinition[]} routes - All available routes
 * @property {BreadcrumbItem[]} breadcrumbs - Breadcrumb trail
 * @property {Function} navigate - Navigate to a different route
 * @property {Function} getBreadcrumbs - Get breadcrumbs for a specific path
 * @property {Function} canAccess - Check if user can access a specific route
 */

/**
 * Route change event type
 * @typedef {Object} RouteChangeEvent
 * @property {string} previousPath - Path before change
 * @property {string} currentPath - New path
 * @property {RouteDefinition} previousRoute - Previous route definition
 * @property {RouteDefinition} currentRoute - Current route definition
 * @property {Object} params - URL parameters
 * @property {Object} query - Query parameters
 * @property {string} action - Navigation action (PUSH, POP, REPLACE)
 */

// Register with ModuleRegistry
registry.register(
  'types.auth.RouteTypes',
  {
    PermissionLevel,
    RouteType,
    routeTypeToPermissionLevel
  },
  [],
  {
    description: 'Type definitions for routes and route protection',
    provides: ['routeTypes', 'permissionLevels']
  }
);

// Default export for import convenience
export default {
  PermissionLevel,
  RouteType,
  routeTypeToPermissionLevel
}; 