/**
 * Login Redirect Component
 * 
 * Handles redirecting users to login when authentication is required,
 * and returning them to their original location after successful login.
 * Supports secure redirect validation and cross-tab synchronization.
 */

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import registry from '../../ModuleRegistry';

// Safe redirect validation
const isValidRedirectPath = (path) => {
  // Only allow relative URLs that start with / and don't try to break out
  return path && 
         typeof path === 'string' && 
         path.startsWith('/') && 
         !path.includes('//') && 
         !path.includes('../');
};

/**
 * LoginRedirect component
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.loginPath='/login'] - Path to login page
 * @param {string} [props.defaultRedirect='/'] - Default path to redirect after login
 * @param {string} [props.redirectParam='redirect'] - URL parameter for redirect path
 * @param {boolean} [props.preserveQueryParams=true] - Whether to preserve query parameters in redirect
 * @param {React.ReactNode} [props.children] - Content to display while redirecting
 * @returns {React.ReactElement} The LoginRedirect component
 */
const LoginRedirect = ({
  loginPath = '/login',
  defaultRedirect = '/',
  redirectParam = 'redirect',
  preserveQueryParams = true,
  children
}) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [redirectTarget, setRedirectTarget] = useState(null);
  const eventBus = registry.getModule('utils.EventBus');
  
  useEffect(() => {
    // Don't proceed while auth is loading
    if (loading) return;
    
    // If user is already authenticated, no need to redirect
    if (isAuthenticated) {
      // Check if we have a redirect target in query params
      const params = new URLSearchParams(location.search);
      const redirectTo = params.get(redirectParam);
      
      if (redirectTo && isValidRedirectPath(redirectTo)) {
        setRedirectTarget(redirectTo);
        
        // Log the redirection
        if (eventBus) {
          eventBus.publish('navigation:authenticatedRedirect', {
            from: location.pathname,
            to: redirectTo,
            timestamp: Date.now()
          });
        }
      } else {
        // If no valid redirect, use default
        setRedirectTarget(defaultRedirect);
      }
      
      return;
    }
    
    // User needs to log in - prepare the redirect URL
    // Store current location as the return URL
    const returnUrl = location.pathname !== loginPath ? location.pathname : defaultRedirect;
    
    // Add query params if needed
    let redirectUrl = `${loginPath}?${redirectParam}=${encodeURIComponent(returnUrl)}`;
    
    // Preserve existing query params if configured
    if (preserveQueryParams && location.search && location.pathname !== loginPath) {
      // Remove any existing redirect param to avoid loops
      const params = new URLSearchParams(location.search);
      params.delete(redirectParam);
      
      // If we still have params, add them to the redirect URL
      const remainingParams = params.toString();
      if (remainingParams) {
        // Store as a special param to restore later
        redirectUrl += `&originalParams=${encodeURIComponent(remainingParams)}`;
      }
    }
    
    // Store in session storage for cross-tab consistency
    sessionStorage.setItem('auth_redirect', returnUrl);
    
    // Set the redirect target
    setRedirectTarget(redirectUrl);
    
    // Log the redirection
    if (eventBus) {
      eventBus.publish('navigation:loginRedirect', {
        from: location.pathname,
        to: redirectUrl,
        timestamp: Date.now()
      });
    }
  }, [isAuthenticated, loading, location, loginPath, defaultRedirect, redirectParam, preserveQueryParams, eventBus]);
  
  // Show loading state while determining redirect
  if (loading || redirectTarget === null) {
    return children || (
      <div className="login-redirect-loading" role="status" aria-live="polite">
        <p>Preparing to redirect...</p>
      </div>
    );
  }
  
  // Perform the redirection
  return <Navigate to={redirectTarget} replace />;
};

LoginRedirect.propTypes = {
  loginPath: PropTypes.string,
  defaultRedirect: PropTypes.string,
  redirectParam: PropTypes.string,
  preserveQueryParams: PropTypes.bool,
  children: PropTypes.node
};

// Register with ModuleRegistry
export default registry.register(
  'components.auth.LoginRedirect',
  LoginRedirect,
  ['auth.AuthContext', 'utils.EventBus'],
  {
    description: 'Component that handles login redirects with return path support',
    usage: `
      // Basic usage - redirect to login
      <LoginRedirect />
      
      // Custom login path
      <LoginRedirect loginPath="/auth/signin" />
      
      // Custom loading display
      <LoginRedirect>
        <CustomLoadingSpinner />
      </LoginRedirect>
    `
  }
); 