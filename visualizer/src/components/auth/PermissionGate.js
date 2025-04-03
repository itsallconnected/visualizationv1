/**
 * Permission Gate Component
 * 
 * A component that conditionally renders its children based on 
 * whether the current user has the required permissions or roles.
 * Provides a declarative way to implement permission-based UI elements.
 */

import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import usePermissions from '../../hooks/usePermissions';
import { useAuth } from '../../auth/AuthContext';
import registry from '../../ModuleRegistry';

/**
 * PermissionGate - Render content only if user has required permissions/roles
 * 
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render when permitted
 * @param {string|string[]} [props.permissions] - Required permission(s)
 * @param {string|string[]} [props.roles] - Required role(s)
 * @param {'all'|'any'} [props.requirementType='any'] - Whether to require all or any permissions/roles
 * @param {React.ReactNode} [props.fallback] - Content to show when not permitted
 * @param {boolean} [props.noFallback=false] - Whether to render nothing when not permitted
 * @param {Function} [props.onDenied] - Callback when access is denied
 * @returns {React.ReactNode}
 */
const PermissionGate = ({
  children,
  permissions,
  roles,
  requirementType = 'any',
  fallback,
  noFallback = false,
  onDenied,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole, hasAllRoles, loading } = usePermissions();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const eventBus = registry.getModule('utils.EventBus');
  
  // Calculate whether access is granted
  const accessGranted = useMemo(() => {
    // If still loading, default to not showing content
    if (loading || authLoading) {
      return false;
    }
    
    // User must be authenticated
    if (!isAuthenticated) {
      return false;
    }
    
    // Default to granted if no specific permissions or roles required
    if ((!permissions || permissions.length === 0) && (!roles || roles.length === 0)) {
      return true;
    }
    
    let permissionsGranted = true;
    let rolesGranted = true;
    
    // Check permissions if specified
    if (permissions) {
      const permissionsList = Array.isArray(permissions) ? permissions : [permissions];
      
      if (permissionsList.length > 0) {
        permissionsGranted = requirementType === 'all' 
          ? hasAllPermissions(permissionsList)
          : hasAnyPermission(permissionsList);
      }
    }
    
    // Check roles if specified
    if (roles) {
      const rolesList = Array.isArray(roles) ? roles : [roles];
      
      if (rolesList.length > 0) {
        rolesGranted = requirementType === 'all'
          ? hasAllRoles(rolesList)
          : hasAnyRole(rolesList);
      }
    }
    
    // Both permission and role requirements must be satisfied
    return permissionsGranted && rolesGranted;
  }, [
    permissions, 
    roles, 
    requirementType, 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    hasRole, 
    hasAnyRole, 
    hasAllRoles, 
    isAuthenticated, 
    loading, 
    authLoading
  ]);
  
  // Call the onDenied callback when access is denied
  React.useEffect(() => {
    if (!accessGranted && !loading && !authLoading && onDenied) {
      // Get denied permissions/roles for reporting
      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      
      // Call the callback
      onDenied({
        permissions: requiredPermissions.filter(Boolean),
        roles: requiredRoles.filter(Boolean),
        requirementType
      });
      
      // Publish event if eventBus is available
      if (eventBus) {
        eventBus.publish('permissions:accessDenied', {
          component: 'PermissionGate',
          permissions: requiredPermissions.filter(Boolean),
          roles: requiredRoles.filter(Boolean),
          requirementType
        });
      }
    }
  }, [accessGranted, loading, authLoading, onDenied, permissions, roles, requirementType, eventBus]);
  
  // Render based on access
  if (accessGranted) {
    return children;
  }
  
  // Handle loading state - don't show fallback during initial loading
  if (loading || authLoading) {
    return null;
  }
  
  // Return fallback content or nothing
  if (noFallback) {
    return null;
  }
  
  return fallback || null;
};

PermissionGate.propTypes = {
  children: PropTypes.node.isRequired,
  permissions: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  roles: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string)
  ]),
  requirementType: PropTypes.oneOf(['all', 'any']),
  fallback: PropTypes.node,
  noFallback: PropTypes.bool,
  onDenied: PropTypes.func
};

// Register with ModuleRegistry
registry.register(
  'components.auth.PermissionGate',
  PermissionGate,
  ['hooks.usePermissions', 'auth.AuthContext', 'utils.EventBus'],
  {
    description: 'Component for conditional rendering based on permissions',
    usage: `
      // Render button only if user has edit permission
      <PermissionGate permissions="content:edit">
        <button>Edit</button>
      </PermissionGate>
      
      // Require multiple permissions (any of them)
      <PermissionGate
        permissions={['content:edit', 'content:create']}
        requirementType="any"
      >
        <EditPanel />
      </PermissionGate>
      
      // Restrict by role with fallback content
      <PermissionGate
        roles="admin"
        fallback={<p>Admin access required</p>}
      >
        <AdminControls />
      </PermissionGate>
    `
  }
);

export default PermissionGate; 