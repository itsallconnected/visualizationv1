/**
 * Route Utilities
 * 
 * Provides utility functions for route management including permission calculation,
 * route matching, breadcrumb generation, and route metadata handling.
 */

import registry from '../../ModuleRegistry';

/**
 * Route utility functions for authentication and routing
 */
const RouteUtils = {
  /**
   * Calculate if a user has permission to access a route
   * @param {Object} user - User object with roles and permissions
   * @param {Object} route - Route configuration
   * @returns {boolean} Whether the user has permission to access the route
   */
  hasRouteAccess(user, route) {
    if (!route) {
      return false;
    }
    
    // If route doesn't require auth, always allow
    if (!route.requireAuth) {
      return true;
    }
    
    // If user is not authenticated, deny access
    if (!user || !user.isAuthenticated) {
      return false;
    }
    
    // Check role requirements
    if (route.requiredRoles && route.requiredRoles.length > 0) {
      // Get AuthUtilities for role checking
      const authUtils = registry.getModule('utils.auth.AuthUtilities');
      
      // Check if user has any of the required roles
      if (authUtils) {
        // If user has admin role, always allow
        if (user.roles && user.roles.includes('admin')) {
          return true;
        }
        
        if (!user.roles || !Array.isArray(user.roles)) {
          return false;
        }
        
        // Check for role match
        const hasRole = route.requiredRoles.some(role => 
          user.roles.includes(role)
        );
        
        if (!hasRole) {
          return false;
        }
      } else {
        console.warn('AuthUtilities not available for role checking');
        return false;
      }
    }
    
    // Check permission requirements
    if (route.requiredPermissions && route.requiredPermissions.length > 0) {
      // Get AuthUtilities for permission checking
      const authUtils = registry.getModule('utils.auth.AuthUtilities');
      
      // Check if user has any of the required permissions
      if (authUtils) {
        // Check for any matching permission
        const hasPermission = route.requiredPermissions.some(permission => 
          authUtils.hasPermission(user, permission)
        );
        
        if (!hasPermission) {
          return false;
        }
      } else {
        console.warn('AuthUtilities not available for permission checking');
        return false;
      }
    }
    
    // All checks passed
    return true;
  },
  
  /**
   * Match a path against route patterns
   * @param {string} path - Current path
   * @param {Object[]} routes - Routes configuration
   * @returns {Object|null} Matched route or null
   */
  matchRoute(path, routes) {
    if (!Array.isArray(routes) || !path) {
      return null;
    }
    
    // Start with exact matches
    const exactMatch = routes.find(route => route.path === path);
    if (exactMatch) {
      return exactMatch;
    }
    
    // Then try pattern matching
    for (const route of routes) {
      if (!route.path) continue;
      
      // Convert route path to regex pattern
      const pattern = route.path
        .replace(/:\w+/g, '([^/]+)') // :param -> capture group
        .replace(/\*/g, '.*'); // * -> any characters
      
      const regex = new RegExp(`^${pattern}$`);
      if (regex.test(path)) {
        return route;
      }
    }
    
    // Check for nested routes
    for (const route of routes) {
      if (route.children && Array.isArray(route.children)) {
        const childMatch = this.matchRoute(path, route.children);
        if (childMatch) {
          return {
            ...childMatch,
            parent: route
          };
        }
      }
    }
    
    return null;
  },
  
  /**
   * Generate breadcrumb trail for current path
   * @param {string} path - Current path
   * @param {Object[]} routes - Routes configuration
   * @returns {Object[]} Array of breadcrumb items
   */
  generateBreadcrumbs(path, routes) {
    if (!Array.isArray(routes) || !path) {
      return [];
    }
    
    const breadcrumbs = [];
    const pathSegments = path.split('/').filter(Boolean);
    
    // Always include home
    breadcrumbs.push({
      label: 'Home',
      path: '/',
      icon: '🏠'
    });
    
    // Special case: if path is just home, return early
    if (path === '/' || pathSegments.length === 0) {
      return breadcrumbs;
    }
    
    // Build up paths from segments and find matching routes
    let currentPath = '';
    let currentRoutes = routes;
    
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath += `/${segment}`;
      
      // Try to find a matching route for this path segment
      const matchedRoute = this.matchRoute(currentPath, currentRoutes);
      
      if (matchedRoute) {
        breadcrumbs.push({
          label: matchedRoute.label || segment,
          path: currentPath,
          icon: matchedRoute.icon || null
        });
        
        // For next iteration, use children routes if available
        if (matchedRoute.children && Array.isArray(matchedRoute.children)) {
          currentRoutes = matchedRoute.children;
        }
      } else {
        // No matching route, just use the segment as is
        breadcrumbs.push({
          label: segment,
          path: currentPath
        });
      }
    }
    
    return breadcrumbs;
  },
  
  /**
   * Filter routes based on user permissions
   * @param {Object[]} routes - Routes configuration
   * @param {Object} user - User object with roles and permissions
   * @returns {Object[]} Filtered routes
   */
  filterRoutesByPermission(routes, user) {
    if (!Array.isArray(routes)) {
      return [];
    }
    
    // If no user, filter to only public routes
    if (!user) {
      return routes.filter(route => !route.requireAuth);
    }
    
    // Filter routes
    return routes.filter(route => {
      // Check if user has access to this route
      const hasAccess = this.hasRouteAccess(user, route);
      
      if (!hasAccess) {
        return false;
      }
      
      // If route has children, filter those too
      if (route.children && Array.isArray(route.children)) {
        route.children = this.filterRoutesByPermission(route.children, user);
      }
      
      return true;
    });
  },
  
  /**
   * Check if a route is active
   * @param {string} currentPath - Current path
   * @param {string} routePath - Route path to check
   * @param {boolean} [exact=false] - Whether to require exact match
   * @returns {boolean} Whether the route is active
   */
  isRouteActive(currentPath, routePath, exact = false) {
    if (exact) {
      return currentPath === routePath;
    }
    
    // Consider a route active if it's the current path or a parent of it
    if (routePath === '/') {
      return currentPath === '/';
    }
    
    return currentPath.startsWith(routePath);
  },
  
  /**
   * Generate meta tags for a route
   * @param {Object} route - Route configuration
   * @returns {Object} Meta tag configuration
   */
  generateRouteMeta(route) {
    if (!route) {
      return {
        title: 'AI Alignment Visualization',
        description: 'Visualization platform for AI alignment research'
      };
    }
    
    return {
      title: route.title || route.label || 'AI Alignment Visualization',
      description: route.description || 'Visualization platform for AI alignment research',
      canonical: route.canonical || null,
      robots: route.robots || 'index,follow',
      ...route.meta
    };
  },
  
  /**
   * Initialize route analytics tracking
   * @param {Object} route - Route configuration
   * @param {Object} location - Location object
   */
  trackRouteAnalytics(route, location) {
    // Get EventBus if available
    const eventBus = registry.getModule('utils.EventBus');
    
    if (eventBus) {
      eventBus.publish('navigation:routeChange', {
        path: location.pathname,
        search: location.search,
        route: route ? {
          label: route.label,
          requireAuth: route.requireAuth,
          requiredRoles: route.requiredRoles,
          requiredPermissions: route.requiredPermissions
        } : null,
        timestamp: Date.now()
      });
    }
  },
  
  /**
   * Parse query parameters from location
   * @param {string} search - Query string from location
   * @returns {Object} Parsed query parameters
   */
  parseQueryParams(search) {
    if (!search) {
      return {};
    }
    
    return Object.fromEntries(
      new URLSearchParams(search).entries()
    );
  },
  
  /**
   * Build URL with query parameters
   * @param {string} path - Base path
   * @param {Object} params - Query parameters object
   * @returns {string} URL with query parameters
   */
  buildUrl(path, params = {}) {
    if (!params || Object.keys(params).length === 0) {
      return path;
    }
    
    const searchParams = new URLSearchParams();
    
    // Add all params
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        searchParams.append(key, value);
      }
    }
    
    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
  }
};

// Create instance
const routeUtils = RouteUtils;

// Register with ModuleRegistry
export default registry.register(
  'utils.auth.RouteUtils',
  routeUtils,
  ['utils.auth.AuthUtilities', 'utils.EventBus'],
  {
    description: 'Utilities for route access control and navigation',
    usage: `
      // Check if user has access to a route
      const hasAccess = RouteUtils.hasRouteAccess(user, route);
      
      // Generate breadcrumbs for current path
      const breadcrumbs = RouteUtils.generateBreadcrumbs(path, routes);
      
      // Filter routes based on user permissions
      const allowedRoutes = RouteUtils.filterRoutesByPermission(routes, user);
    `
  }
); 