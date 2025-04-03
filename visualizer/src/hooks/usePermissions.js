/**
 * Permissions Hook
 * 
 * Custom React hook that provides access to the permission system,
 * allowing components to check user permissions and roles.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import registry from '../ModuleRegistry';
import { PermissionKey } from '../types/auth/PermissionTypes';
import EventBus from '../utils/EventBus';

/**
 * Hook for using the permission system in React components
 * @returns {Object} Permission checking methods and state
 */
const usePermissions = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [permissionMap, setPermissionMap] = useState({});
  const permissionManager = registry.getModule('auth.PermissionManager');
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  // Load user permissions when auth state changes
  useEffect(() => {
    let isMounted = true;
    
    const loadPermissions = async () => {
      setLoading(true);
      
      if (!isAuthenticated || !user || !permissionManager) {
        if (isMounted) {
          setPermissions([]);
          setPermissionMap({});
          setLoading(false);
        }
        return;
      }
      
      try {
        // Get user permissions from permission manager
        const userPermissions = await permissionManager.getUserPermissions(user);
        
        if (isMounted) {
          setPermissions(userPermissions || []);
          
          // Create a map for quick lookups
          const permMap = {};
          (userPermissions || []).forEach(perm => {
            permMap[perm] = true;
          });
          setPermissionMap(permMap);
        }
      } catch (error) {
        console.error('Error loading permissions:', error);
        if (eventBus) {
          eventBus.publish('permissions:error', {
            source: 'usePermissions',
            error
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // Only load permissions if authentication loading is complete
    if (!authLoading) {
      loadPermissions();
    }
    
    // Listen for permission changes
    if (eventBus) {
      eventBus.subscribe('auth:permissionChanged', loadPermissions);
      eventBus.subscribe('auth:userUpdated', loadPermissions);
    }
    
    return () => {
      isMounted = false;
      
      // Clean up event listeners
      if (eventBus) {
        eventBus.unsubscribe('auth:permissionChanged', loadPermissions);
        eventBus.unsubscribe('auth:userUpdated', loadPermissions);
      }
    };
  }, [user, isAuthenticated, authLoading, permissionManager, eventBus]);
  
  /**
   * Check if user has a specific permission
   * @param {string} permissionId - Permission to check
   * @returns {boolean} Whether user has permission
   */
  const hasPermission = useCallback((permissionId) => {
    if (!isAuthenticated || !permissionId) {
      return false;
    }
    
    // Shortcut for existing permission map
    if (permissionMap[permissionId]) {
      return true;
    }
    
    // Admin has all permissions
    if (user && user.isAdmin) {
      return true;
    }
    
    // Fallback to permission manager for dynamic checking
    if (permissionManager) {
      // This only checks cache, not making an async call
      const cached = permissionManager.permissionsCache?.get(`${user?.id}:${permissionId}`);
      if (cached !== undefined) {
        return cached;
      }
      
      // Optimistic return false, will update when async check completes
      permissionManager.hasPermission(permissionId, user)
        .then(result => {
          if (result && !permissionMap[permissionId]) {
            setPermissionMap(prevMap => ({
              ...prevMap,
              [permissionId]: true
            }));
          }
        })
        .catch(error => console.error('Permission check error:', error));
      
      return false;
    }
    
    return false;
  }, [isAuthenticated, user, permissionMap, permissionManager]);
  
  /**
   * Check if user has any of the specified permissions
   * @param {string[]} permissionIds - Permissions to check
   * @returns {boolean} Whether user has any permission
   */
  const hasAnyPermission = useCallback((permissionIds) => {
    if (!isAuthenticated || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return false;
    }
    
    // Admin has all permissions
    if (user && user.isAdmin) {
      return true;
    }
    
    // Check if user has any of the permissions
    return permissionIds.some(permId => hasPermission(permId));
  }, [isAuthenticated, user, hasPermission]);
  
  /**
   * Check if user has all of the specified permissions
   * @param {string[]} permissionIds - Permissions to check
   * @returns {boolean} Whether user has all permissions
   */
  const hasAllPermissions = useCallback((permissionIds) => {
    if (!isAuthenticated || !Array.isArray(permissionIds) || permissionIds.length === 0) {
      return false;
    }
    
    // Admin has all permissions
    if (user && user.isAdmin) {
      return true;
    }
    
    // Check if user has all of the permissions
    return permissionIds.every(permId => hasPermission(permId));
  }, [isAuthenticated, user, hasPermission]);
  
  /**
   * Check if user has a specific role
   * @param {string} roleId - Role to check
   * @returns {boolean} Whether user has role
   */
  const hasRole = useCallback((roleId) => {
    if (!isAuthenticated || !roleId || !user) {
      return false;
    }
    
    // Admin has all roles
    if (user.isAdmin) {
      return true;
    }
    
    // Check if user has the role
    if (Array.isArray(user.roles)) {
      return user.roles.includes(roleId);
    }
    
    // Fallback to permission manager for dynamic checking
    if (permissionManager) {
      // This only checks cache, not making an async call
      const cached = permissionManager.permissionsCache?.get(`role:${user.id}:${roleId}`);
      if (cached !== undefined) {
        return cached;
      }
      
      // Optimistic return false, will update when async check completes
      permissionManager.hasRole(roleId, user)
        .catch(error => console.error('Role check error:', error));
        
      return false;
    }
    
    return false;
  }, [isAuthenticated, user, permissionManager]);
  
  /**
   * Check if user can perform an action on a content item
   * @param {string} action - Action to check (view, edit, delete)
   * @param {string} contentType - Type of content (node, relationship, etc.)
   * @param {Object} [contentItem] - Content item to check permissions for
   * @returns {boolean} Whether user can perform the action
   */
  const canPerformAction = useCallback((action, contentType, contentItem) => {
    if (!isAuthenticated || !action || !contentType) {
      return false;
    }
    
    // Admin can do anything
    if (user && user.isAdmin) {
      return true;
    }
    
    // Check permission for this action on this content type
    const permissionId = `${contentType}:${action}`;
    
    if (!hasPermission(permissionId)) {
      return false;
    }
    
    // If no content item provided, just check the base permission
    if (!contentItem) {
      return true;
    }
    
    // Check ownership permissions
    if (contentItem.createdBy && contentItem.createdBy === user?.id) {
      // Check owner-specific permission
      const ownerPermissionId = `${contentType}:${action}:own`;
      if (permissionMap[ownerPermissionId] !== undefined) {
        return !!permissionMap[ownerPermissionId];
      }
    }
    
    // Check encryption permissions
    if (contentItem.isEncrypted) {
      // Encrypted content may require additional permission
      const encryptedPermissionId = `${contentType}:${action}:encrypted`;
      if (permissionMap[encryptedPermissionId] !== undefined) {
        return !!permissionMap[encryptedPermissionId];
      }
    }
    
    // Default to base permission result
    return true;
  }, [isAuthenticated, user, hasPermission, permissionMap]);
  
  /**
   * Common pre-defined permission checks for convenience
   */
  const canViewContent = useMemo(() => hasPermission(PermissionKey.VIEW_CONTENT), [hasPermission]);
  const canCreateContent = useMemo(() => hasPermission(PermissionKey.CREATE_CONTENT), [hasPermission]);
  const canEditContent = useMemo(() => hasPermission(PermissionKey.EDIT_CONTENT), [hasPermission]);
  const canDeleteContent = useMemo(() => hasPermission(PermissionKey.DELETE_CONTENT), [hasPermission]);
  const canApproveContent = useMemo(() => hasPermission(PermissionKey.APPROVE_CONTENT), [hasPermission]);
  const canAccessAdmin = useMemo(() => hasPermission(PermissionKey.ACCESS_ADMIN_PANEL), [hasPermission]);
  
  /**
   * Check if user is member of a specific role group
   */
  const isAdmin = useMemo(() => user?.isAdmin || hasRole('admin'), [user, hasRole]);
  const isModerator = useMemo(() => isAdmin || hasRole('moderator'), [isAdmin, hasRole]);
  const isContributor = useMemo(() => isModerator || hasRole('contributor'), [isModerator, hasRole]);
  const isViewer = useMemo(() => isContributor || hasRole('viewer'), [isContributor, hasRole]);
  
  // Return all permission functions and state
  return {
    // State
    loading,
    permissions,
    permissionMap,
    
    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    canPerformAction,
    
    // Common permission shortcuts
    canViewContent,
    canCreateContent,
    canEditContent,
    canDeleteContent,
    canApproveContent,
    canAccessAdmin,
    
    // Role checks
    isAdmin,
    isModerator,
    isContributor,
    isViewer
  };
};

// Register with ModuleRegistry
registry.register(
  'hooks.usePermissions',
  usePermissions,
  ['auth.PermissionManager', 'auth.AuthContext', 'utils.EventBus'],
  {
    description: 'React hook for accessing permissions system',
    usage: `
      const { 
        hasPermission, 
        isAdmin,
        canCreateContent,
        loading 
      } = usePermissions();
      
      // Check specific permission
      if (hasPermission('content:edit')) {
        // User can edit content
      }
      
      // Check role
      if (isAdmin) {
        // User is an administrator
      }
      
      // Use convenience methods
      if (canCreateContent) {
        // Show content creation UI
      }
    `
  }
);

export default usePermissions; 