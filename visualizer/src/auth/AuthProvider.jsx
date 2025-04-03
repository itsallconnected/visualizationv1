/**
 * Authentication Provider Component
 * 
 * This component provides the authentication context to the application,
 * handling authentication state, user management, and session persistence.
 */

import React, { useEffect, useReducer, useCallback, useMemo } from 'react';
import { AuthContext } from './AuthContext';
import AuthService from './AuthService';
import authStorage from '../utils/auth/AuthStateStorage';
import authUtils from '../utils/auth/AuthUtilities';
import { AuthStatus, AuthEventTypes } from '../types/auth/AuthTypes';

/**
 * Initial authentication state
 */
const initialState = {
  user: null,
  isAuthenticated: false,
  status: AuthStatus.IDLE,
  loading: true,
  error: null,
  permissionLevel: 0,
  provider: 'github',
  mfaRequired: false,
  loginHistory: []
};

/**
 * Authentication state reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action to process
 * @returns {Object} - New state
 */
function authReducer(state, action) {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        status: AuthStatus.AUTHENTICATING,
        loading: true,
        error: null
      };
      
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        status: AuthStatus.AUTHENTICATED,
        loading: false,
        error: null,
        permissionLevel: action.payload.permissionLevel || 0,
        loginHistory: action.payload.loginHistory || state.loginHistory
      };
      
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        status: AuthStatus.ERROR,
        loading: false,
        error: action.payload
      };
      
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        status: AuthStatus.UNAUTHENTICATED,
        loading: false,
        error: null,
        permissionLevel: 0,
        loginHistory: state.loginHistory // Preserve login history
      };
      
    case 'SESSION_EXPIRED':
      return {
        ...state,
        status: AuthStatus.EXPIRED,
        isAuthenticated: false
      };
      
    case 'AUTH_STATE_CHANGED':
      return {
        ...state,
        ...action.payload,
        loading: false
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
      
    case 'SET_MFA_REQUIRED':
      return {
        ...state,
        mfaRequired: action.payload,
        status: action.payload ? AuthStatus.MFA_REQUIRED : state.status
      };
      
    case 'UPDATE_USER':
      return {
        ...state,
        user: {
          ...state.user,
          ...action.payload
        }
      };
      
    case 'UPDATE_PERMISSIONS':
      return {
        ...state,
        user: {
          ...state.user,
          permissions: action.payload.permissions
        },
        permissionLevel: action.payload.permissionLevel
      };
      
    case 'SET_PROVIDER':
      return {
        ...state,
        provider: action.payload
      };
      
    case 'TOKEN_REFRESH_START':
      return {
        ...state,
        status: AuthStatus.REFRESHING
      };
      
    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        status: AuthStatus.AUTHENTICATED
      };
      
    case 'TOKEN_REFRESH_FAILURE':
      return {
        ...state,
        status: AuthStatus.EXPIRED,
        error: action.payload
      };
      
    default:
      return state;
  }
}

/**
 * Authentication Provider Component
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} - Provider component
 */
const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Initialize auth service
  const authService = useMemo(() => new AuthService(), []);
  
  /**
   * Handle auth callback (e.g., after GitHub redirect)
   */
  const handleAuthCallback = useCallback(async () => {
    if (window.location.search.includes('code=')) {
      dispatch({ type: 'LOGIN_START' });
      
      try {
        const result = await authService.handleAuthCallback(window.location.search);
        
        if (result.success) {
          // Add login to history
          authStorage.addLoginToHistory({
            provider: state.provider,
            method: 'oauth_callback',
            date: new Date().toISOString(),
            userAgent: navigator.userAgent,
            loginId: authUtils.generateRandomString(16)
          });
          
          // Get login history
          const loginHistory = authStorage.getLoginHistory();
          
          dispatch({ 
            type: 'LOGIN_SUCCESS', 
            payload: {
              user: result.user,
              permissionLevel: authUtils.calculatePermissionLevel(result.user),
              loginHistory
            }
          });
          
          // Clear the URL to remove auth parameters
          if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        } else {
          dispatch({ 
            type: 'LOGIN_FAILURE', 
            payload: result.error || 'Authentication failed' 
          });
        }
      } catch (error) {
        dispatch({ 
          type: 'LOGIN_FAILURE', 
          payload: authUtils.normalizeAuthError(error)
        });
      }
    }
  }, [authService, state.provider]);
  
  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      // Check for existing auth session
      const session = await authService.checkSession();
      
      if (session.valid) {
        // Get login history
        const loginHistory = authStorage.getLoginHistory();
        
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: {
            user: session.user,
            permissionLevel: authUtils.calculatePermissionLevel(session.user),
            loginHistory
          }
        });
      } else {
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: authUtils.normalizeAuthError(error)
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [authService]);
  
  /**
   * Handle cross-tab auth state changes
   */
  const handleStorageEvent = useCallback((event) => {
    if (event.type === AuthEventTypes.SIGN_IN) {
      // Another tab signed in
      if (event.payload) {
        const user = event.payload.user;
        dispatch({ 
          type: 'LOGIN_SUCCESS', 
          payload: {
            user,
            permissionLevel: authUtils.calculatePermissionLevel(user)
          }
        });
      }
    } else if (event.type === AuthEventTypes.SIGN_OUT) {
      // Another tab signed out
      dispatch({ type: 'LOGOUT' });
    } else if (event.type === AuthEventTypes.TOKEN_REFRESHED) {
      // Token was refreshed in another tab
      verifySession();
    } else if (event.type === AuthEventTypes.STATE_CHANGED) {
      // Other auth state change
      dispatch({ 
        type: 'AUTH_STATE_CHANGED', 
        payload: event.payload 
      });
    }
  }, []);
  
  /**
   * Set up listeners and initialize auth
   */
  useEffect(() => {
    // Initialize auth
    initializeAuth();
    
    // Handle callback if present
    handleAuthCallback();
    
    // Set up storage event listener
    const removeListener = authStorage.addListener(handleStorageEvent);
    
    // Clean up
    return () => {
      removeListener();
    };
  }, [initializeAuth, handleAuthCallback, handleStorageEvent]);
  
  /**
   * Set up session monitoring
   */
  useEffect(() => {
    let sessionTimer = null;
    
    if (state.isAuthenticated) {
      // Check session every minute
      sessionTimer = setInterval(() => {
        verifySession();
      }, 60000);
    }
    
    return () => {
      if (sessionTimer) {
        clearInterval(sessionTimer);
      }
    };
  }, [state.isAuthenticated]);
  
  /**
   * Login with GitHub
   */
  const login = useCallback(async (options = {}) => {
    dispatch({ type: 'LOGIN_START' });
    
    try {
      if (options.provider) {
        dispatch({ type: 'SET_PROVIDER', payload: options.provider });
      }
      
      // Initiate GitHub login
      const loginUrl = await authService.initiateGitHubLogin(options);
      
      // Redirect to GitHub
      window.location.href = loginUrl;
      
      return { success: true };
    } catch (error) {
      const normalizedError = authUtils.normalizeAuthError(error);
      dispatch({ type: 'LOGIN_FAILURE', payload: normalizedError });
      return { success: false, error: normalizedError };
    }
  }, [authService]);
  
  /**
   * Logout the current user
   */
  const logout = useCallback(async () => {
    try {
      await authService.signOut();
      dispatch({ type: 'LOGOUT' });
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      const normalizedError = authUtils.normalizeAuthError(error);
      dispatch({ type: 'SET_ERROR', payload: normalizedError });
      return { success: false, error: normalizedError };
    }
  }, [authService]);
  
  /**
   * Refresh the authentication token
   */
  const refreshToken = useCallback(async () => {
    if (!state.isAuthenticated) {
      return { success: false, error: 'Not authenticated' };
    }
    
    dispatch({ type: 'TOKEN_REFRESH_START' });
    
    try {
      const result = await authService.refreshToken();
      
      if (result.success) {
        dispatch({ type: 'TOKEN_REFRESH_SUCCESS' });
        return { success: true };
      } else {
        dispatch({ 
          type: 'TOKEN_REFRESH_FAILURE',
          payload: result.error || 'Failed to refresh token'
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      const normalizedError = authUtils.normalizeAuthError(error);
      dispatch({ type: 'TOKEN_REFRESH_FAILURE', payload: normalizedError });
      return { success: false, error: normalizedError };
    }
  }, [authService, state.isAuthenticated]);
  
  /**
   * Verify the current session
   */
  const verifySession = useCallback(async () => {
    if (!state.isAuthenticated) {
      return { valid: false };
    }
    
    try {
      const session = await authService.checkSession();
      
      if (!session.valid) {
        dispatch({ type: 'SESSION_EXPIRED' });
        return { valid: false };
      }
      
      return { valid: true };
    } catch (error) {
      console.error('Session verification error:', error);
      // Don't change auth state on verification error
      return { valid: false, error };
    }
  }, [authService, state.isAuthenticated]);
  
  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (profileData) => {
    if (!state.isAuthenticated || !state.user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    try {
      // Update user profile in storage
      const updatedUser = { ...state.user, ...profileData };
      
      // Update state
      dispatch({ type: 'UPDATE_USER', payload: profileData });
      
      // Update stored auth state
      authStorage.setAuthState({
        ...state,
        user: updatedUser
      });
      
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error };
    }
  }, [state]);
  
  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback((permission) => {
    if (!state.user) return false;
    return authUtils.hasPermission(state.user, permission);
  }, [state.user]);
  
  /**
   * Check if user has all specified permissions
   */
  const hasAllPermissions = useCallback((permissions) => {
    if (!state.user) return false;
    return authUtils.hasAllPermissions(state.user, permissions);
  }, [state.user]);
  
  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback((permissions) => {
    if (!state.user) return false;
    return authUtils.hasAnyPermission(state.user, permissions);
  }, [state.user]);
  
  /**
   * Update user permissions
   */
  const updatePermissions = useCallback((permissions) => {
    if (!state.user) return;
    
    const newPermissionLevel = authUtils.calculatePermissionLevel({
      ...state.user,
      permissions
    });
    
    dispatch({
      type: 'UPDATE_PERMISSIONS',
      payload: {
        permissions,
        permissionLevel: newPermissionLevel
      }
    });
  }, [state.user]);
  
  // Create authentication context value
  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
    refreshToken,
    verifySession,
    updateProfile,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    updatePermissions
  }), [
    state,
    login,
    logout,
    refreshToken,
    verifySession,
    updateProfile,
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    updatePermissions
  ]);
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider; 