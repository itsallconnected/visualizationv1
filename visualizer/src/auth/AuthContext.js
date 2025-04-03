/**
 * Authentication Context
 * 
 * This file creates and exports the React context for authentication.
 * The actual provider implementation is in AuthProvider.jsx.
 */

import { createContext } from 'react';
import { AuthStatus } from '../types/auth/AuthTypes';

/**
 * Default context value with no authentication
 */
const defaultContext = {
  user: null,
  isAuthenticated: false,
  status: AuthStatus.IDLE,
  loading: false,
  error: null,
  permissionLevel: 0,
  provider: 'github',
  mfaRequired: false,
  loginHistory: [],
  
  // Functions - these will be implemented by the provider
  login: () => Promise.reject(new Error('AuthProvider not initialized')),
  logout: () => Promise.reject(new Error('AuthProvider not initialized')),
  refreshToken: () => Promise.reject(new Error('AuthProvider not initialized')),
  verifySession: () => Promise.reject(new Error('AuthProvider not initialized')),
  updateProfile: () => Promise.reject(new Error('AuthProvider not initialized')),
  hasPermission: () => false,
  hasAllPermissions: () => false,
  hasAnyPermission: () => false,
  updatePermissions: () => {}
};

/**
 * Create the authentication context
 */
export const AuthContext = createContext(defaultContext);

/**
 * Export named context
 */
export default AuthContext; 