/**
 * useAuth Hook
 * 
 * A custom React hook that provides access to the authentication context and its functions.
 * This hook makes it easy to use authentication features in functional components.
 */

import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * Hook to access authentication context
 * 
 * @returns {Object} Authentication context object with state and functions
 * @example
 * const { user, isAuthenticated, login, logout } = useAuth();
 * 
 * if (isAuthenticated) {
 *   return <p>Welcome, {user.name}!</p>;
 * } else {
 *   return <button onClick={login}>Login</button>;
 * }
 */
const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * Hook to check if the current user has a specific permission
 * 
 * @param {string} permission - The permission to check
 * @returns {boolean} - Whether the user has the permission
 * @example
 * const canEditContent = usePermission('content:edit');
 * 
 * if (canEditContent) {
 *   return <EditButton onClick={handleEdit} />;
 * }
 */
export const usePermission = (permission) => {
  const { user, hasPermission } = useAuth();
  return hasPermission(permission);
};

/**
 * Hook to check if the current user has all of the specified permissions
 * 
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} - Whether the user has all permissions
 * @example
 * const canModerate = useAllPermissions(['content:approve', 'content:delete']);
 */
export const useAllPermissions = (permissions) => {
  const { user, hasAllPermissions } = useAuth();
  return hasAllPermissions(permissions);
};

/**
 * Hook to check if the current user has any of the specified permissions
 * 
 * @param {string[]} permissions - Array of permissions to check
 * @returns {boolean} - Whether the user has any of the permissions
 * @example
 * const canInteract = useAnyPermission(['content:create', 'content:edit']);
 */
export const useAnyPermission = (permissions) => {
  const { user, hasAnyPermission } = useAuth();
  return hasAnyPermission(permissions);
};

/**
 * Hook to get the current authentication state
 * 
 * @returns {Object} - Current authentication state
 * @example
 * const { isAuthenticated, status, loading } = useAuthState();
 * 
 * if (loading) {
 *   return <LoadingSpinner />;
 * }
 */
export const useAuthState = () => {
  const { user, isAuthenticated, status, loading, error, permissionLevel } = useAuth();
  return { user, isAuthenticated, status, loading, error, permissionLevel };
};

/**
 * Hook to get authentication actions
 * 
 * @returns {Object} - Authentication action functions
 * @example
 * const { login, logout, refreshToken } = useAuthActions();
 */
export const useAuthActions = () => {
  const { login, logout, refreshToken, verifySession, updateProfile } = useAuth();
  return { login, logout, refreshToken, verifySession, updateProfile };
};

export default useAuth; 