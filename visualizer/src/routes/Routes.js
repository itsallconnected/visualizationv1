/**
 * Application Routes Configuration
 * 
 * Defines all application routes with their protection requirements,
 * metadata, and hierarchy. Used for route rendering, navigation,
 * access control, and breadcrumb generation.
 */

import registry from '../ModuleRegistry';

/**
 * Route access levels
 */
export const RouteAccessLevel = {
  PUBLIC: 'public',     // Accessible to all users
  USER: 'user',         // Requires authentication
  CONTRIBUTOR: 'contributor', // Requires contributor role
  MODERATOR: 'moderator',     // Requires moderator role
  ADMIN: 'admin'        // Requires admin role
};

/**
 * Main application routes
 */
const routes = [
  {
    path: '/',
    exact: true,
    label: 'Home',
    icon: '🏠',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'components.Home',
    meta: {
      title: 'AI Alignment Visualization',
      description: 'Interactive visualization platform for AI alignment research'
    }
  },
  {
    path: '/visualization',
    label: 'Visualization',
    icon: '🔍',
    requireAuth: true,
    accessLevel: RouteAccessLevel.USER,
    component: 'components.VisualizationContainer',
    meta: {
      title: 'AI Alignment Visualization Explorer',
      description: 'Explore AI alignment components and relationships'
    }
  },
  {
    path: '/admin',
    label: 'Admin',
    icon: '⚙️',
    requireAuth: true,
    requiredRoles: ['admin', 'moderator'],
    requiredPermissions: ['admin:access'],
    accessLevel: RouteAccessLevel.ADMIN,
    component: 'admin.AdminPanel',
    meta: {
      title: 'Admin Panel',
      description: 'Administrative controls for AI Alignment Visualization platform'
    },
    children: [
      {
        path: '/admin/users',
        label: 'User Management',
        requireAuth: true,
        requiredRoles: ['admin'],
        requiredPermissions: ['admin:users'],
        component: 'admin.UserManagement',
        meta: {
          title: 'User Management',
          description: 'Manage user accounts and permissions'
        }
      },
      {
        path: '/admin/content',
        label: 'Content Moderation',
        requireAuth: true,
        requiredRoles: ['admin', 'moderator'],
        requiredPermissions: ['admin:content'],
        component: 'admin.ContentModeration',
        meta: {
          title: 'Content Moderation',
          description: 'Moderate and approve content submissions'
        }
      },
      {
        path: '/admin/settings',
        label: 'System Settings',
        requireAuth: true,
        requiredRoles: ['admin'],
        requiredPermissions: ['admin:settings'],
        component: 'admin.SystemConfiguration',
        meta: {
          title: 'System Settings',
          description: 'Configure system settings and parameters'
        }
      }
    ]
  },
  {
    path: '/modules',
    label: 'Modules',
    icon: '📦',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'components.ModuleOverview',
    meta: {
      title: 'Module Overview',
      description: 'Overview of system modules and components'
    }
  },
  {
    path: '/login',
    label: 'Login',
    icon: '🔑',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'auth.LoginPage',
    meta: {
      title: 'Login',
      description: 'Login to your account'
    }
  },
  {
    path: '/auth-callback',
    label: 'Auth Callback',
    icon: '🔄',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'auth.AuthCallback',
    meta: {
      title: 'Processing Authentication',
      description: 'Processing authentication data',
      robots: 'noindex,nofollow'
    }
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: '👤',
    requireAuth: true,
    accessLevel: RouteAccessLevel.USER,
    component: 'auth.UserProfile',
    meta: {
      title: 'Your Profile',
      description: 'Manage your account settings and profile'
    }
  },
  {
    path: '/unauthorized',
    label: 'Access Denied',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'auth.Unauthorized',
    meta: {
      title: 'Access Denied',
      description: 'You do not have permission to access this resource',
      robots: 'noindex,nofollow'
    }
  },
  {
    path: '*',
    label: 'Not Found',
    requireAuth: false,
    accessLevel: RouteAccessLevel.PUBLIC,
    component: 'common.NotFound',
    meta: {
      title: 'Page Not Found',
      description: 'The requested page could not be found',
      robots: 'noindex,nofollow'
    }
  }
];

/**
 * Get route configuration with instantiated components
 * 
 * @returns {Array} Route configuration with component instances
 */
export const getRoutes = () => {
  // Recursively process routes to instantiate components
  const processRoutes = (routeList) => {
    return routeList.map(route => {
      let componentInstance = null;
      
      // If component is a string reference, try to get from registry
      if (typeof route.component === 'string') {
        componentInstance = registry.getModule(route.component);
        if (!componentInstance) {
          console.warn(`Component ${route.component} not found in registry`);
        }
      } else {
        // Component already provided or not defined
        componentInstance = route.component;
      }
      
      // Process children if present
      const children = route.children ? processRoutes(route.children) : undefined;
      
      // Return processed route
      return {
        ...route,
        component: componentInstance,
        children
      };
    });
  };
  
  return processRoutes(routes);
};

/**
 * Get public routes (no auth required)
 * 
 * @returns {Array} Public routes
 */
export const getPublicRoutes = () => {
  return routes.filter(route => !route.requireAuth);
};

/**
 * Get protected routes (auth required)
 * 
 * @returns {Array} Protected routes
 */
export const getProtectedRoutes = () => {
  return routes.filter(route => route.requireAuth);
};

/**
 * Find route by path
 * 
 * @param {string} path - Route path
 * @returns {Object|null} Matching route or null if not found
 */
export const findRouteByPath = (path) => {
  // Helper function to check route and its children
  const findRoute = (routeList, targetPath) => {
    // Check for exact match in current level
    const exactMatch = routeList.find(route => route.path === targetPath);
    if (exactMatch) return exactMatch;
    
    // Check children of each route
    for (const route of routeList) {
      if (route.children) {
        const childMatch = findRoute(route.children, targetPath);
        if (childMatch) return childMatch;
      }
    }
    
    // Handle wildcard routes if no exact match found
    return routeList.find(route => route.path === '*');
  };
  
  return findRoute(routes, path);
};

// Export route configuration
export default routes;

// Register with ModuleRegistry
registry.register(
  'routes.RouteConfig',
  {
    routes,
    getRoutes,
    getPublicRoutes,
    getProtectedRoutes,
    findRouteByPath,
    RouteAccessLevel
  },
  [],
  {
    description: 'Application route configuration',
    usage: `
      // Get all routes
      const routes = getRoutes();
      
      // Get public routes
      const publicRoutes = getPublicRoutes();
      
      // Find route by path
      const homeRoute = findRouteByPath('/');
    `
  }
); 