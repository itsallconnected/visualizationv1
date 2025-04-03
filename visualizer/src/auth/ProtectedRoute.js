import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * ProtectedRoute component restricts access to routes based on authentication
 * and permission requirements. It can redirect unauthenticated or unauthorized
 * users to the login page or a custom fallback component.
 * 
 * Features:
 * - Authentication verification
 * - Permission-based access control
 * - Role-based access control
 * - Custom loading components
 * - Configurable fallback behavior
 * - Redirect with return location
 * 
 * @component
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render when authorized
 * @param {string[]} [props.requiredPermissions] - Permissions required to access the route
 * @param {string[]} [props.requiredRoles] - Roles required to access the route
 * @param {boolean} [props.requireAuth=true] - Whether authentication is required
 * @param {string} [props.redirectTo='/login'] - Where to redirect unauthorized users
 * @param {React.ComponentType} [props.loadingComponent] - Component to render while checking auth
 * @param {React.ReactNode} [props.fallback] - Content to render instead of redirect
 * @param {Function} [props.onUnauthorized] - Callback when access is denied
 * @returns {React.ReactElement} The protected route component
 */
const ProtectedRoute = ({
  children,
  requiredPermissions,
  requiredRoles,
  requireAuth = true,
  redirectTo = '/login',
  loadingComponent: LoadingComponent,
  fallback,
  onUnauthorized
}) => {
  const { isAuthenticated, user, loading: authLoading, hasPermission, hasRole, hasAnyRole } = useAuth();
  const [permissionChecking, setPermissionChecking] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [permissionCheckComplete, setPermissionCheckComplete] = useState(false);
  const location = useLocation();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  // Verify permissions and roles
  useEffect(() => {
    const checkAccess = async () => {
      // Skip if authentication is still loading
      if (authLoading) return;
      
      // If auth is required and user is not authenticated, deny access
      if (requireAuth && !isAuthenticated) {
        setAuthorized(false);
        setPermissionCheckComplete(true);
        return;
      }
      
      // If no specific permissions/roles required, grant access
      if (!requiredPermissions && !requiredRoles) {
        setAuthorized(true);
        setPermissionCheckComplete(true);
        return;
      }
      
      setPermissionChecking(true);
      
      try {
        let hasRequiredPermissions = true;
        let hasRequiredRoles = true;
        
        // Check permissions if required
        if (requiredPermissions && requiredPermissions.length > 0) {
          // Use AuthContext's permission checking if available
          if (hasPermission) {
            hasRequiredPermissions = requiredPermissions.some(permission => 
              hasPermission(permission)
            );
          } else {
            // Fallback to PermissionManager if available
            const permissionManager = registry.getModule('auth.PermissionManager');
            if (permissionManager) {
              hasRequiredPermissions = await permissionManager.hasAnyPermission(requiredPermissions);
            } else {
              console.warn('No permission checking mechanism available');
              hasRequiredPermissions = false;
            }
          }
        }
        
        // Check roles if required
        if (requiredRoles && requiredRoles.length > 0) {
          // Use AuthContext's role checking if available
          if (hasAnyRole) {
            hasRequiredRoles = hasAnyRole(requiredRoles);
          } else if (hasRole) {
            hasRequiredRoles = requiredRoles.some(role => hasRole(role));
          } else {
            // Fallback to PermissionManager if available
            const permissionManager = registry.getModule('auth.PermissionManager');
            if (permissionManager) {
              hasRequiredRoles = await permissionManager.hasAnyRole(requiredRoles);
            } else {
              console.warn('No role checking mechanism available');
              hasRequiredRoles = false;
            }
          }
        }
        
        // User must satisfy both permissions and roles if both are specified
        setAuthorized(hasRequiredPermissions && hasRequiredRoles);
      } catch (error) {
        console.error('Error checking permissions:', error);
        setAuthorized(false);
        
        // Publish error event
        eventBus.publish('auth:permissionError', {
          error,
          requiredPermissions,
          requiredRoles,
          user
        });
      } finally {
        setPermissionChecking(false);
        setPermissionCheckComplete(true);
      }
    };
    
    checkAccess();
  }, [
    authLoading, isAuthenticated, requireAuth, 
    requiredPermissions, requiredRoles, 
    hasPermission, hasRole, hasAnyRole, user, eventBus
  ]);
  
  // Show loading state while checking
  if (authLoading || permissionChecking || !permissionCheckComplete) {
    return LoadingComponent ? <LoadingComponent /> : (
      <div className="loading-container" role="status" aria-live="polite">
        <div className="loading-spinner"></div>
        <p>{authLoading ? 'Checking authentication...' : 'Checking permissions...'}</p>
      </div>
    );
  }
  
  // If user is not authorized
  if (!authorized) {
    // Call onUnauthorized callback if provided
    if (onUnauthorized) {
      onUnauthorized({
        authenticated: isAuthenticated,
        user,
        requiredPermissions,
        requiredRoles
      });
    }
    
    // Log access attempt
    eventBus.publish('auth:accessDenied', {
      path: location.pathname,
      authenticated: isAuthenticated,
      user,
      requiredPermissions,
      requiredRoles
    });
    
    // Show fallback content if provided
    if (fallback) {
      return fallback;
    }
    
    // If not authenticated, redirect to login with return url
    if (requireAuth && !isAuthenticated) {
      return (
        <Navigate 
          to={redirectTo} 
          state={{ from: location, message: 'Please log in to access this page' }} 
          replace 
        />
      );
    }
    
    // If authenticated but missing permissions, show access denied
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have the required permissions to access this page.</p>
        {redirectTo && (
          <button onClick={() => window.history.back()}>
            Go Back
          </button>
        )}
      </div>
    );
  }
  
  // User is authorized, render children
  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredPermissions: PropTypes.arrayOf(PropTypes.string),
  requiredRoles: PropTypes.arrayOf(PropTypes.string),
  requireAuth: PropTypes.bool,
  redirectTo: PropTypes.string,
  loadingComponent: PropTypes.elementType,
  fallback: PropTypes.node,
  onUnauthorized: PropTypes.func
};

export default registry.register(
  'auth.ProtectedRoute',
  ProtectedRoute,
  ['auth.AuthContext', 'auth.PermissionManager', 'utils.EventBus'],
  {
    description: 'Route wrapper that restricts access based on authentication and permissions',
    usage: `
      // Basic usage - requires authentication
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
      
      // Require specific permissions
      <ProtectedRoute requiredPermissions={['admin:view']}>
        <AdminPanel />
      </ProtectedRoute>
      
      // Require specific roles
      <ProtectedRoute requiredRoles={['admin', 'moderator']}>
        <ModeratorDashboard />
      </ProtectedRoute>
      
      // Custom loading component
      <ProtectedRoute loadingComponent={CustomSpinner}>
        <SecureContent />
      </ProtectedRoute>
    `
  }
); 