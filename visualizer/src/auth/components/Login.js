// Login.js
// Login form component for user authentication

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LoginButton from './LoginButton';
import useLoginForm from '../../hooks/useLoginForm';
import SocialLoginButtons from '../../components/common/SocialLoginButtons';
import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';
import APP_SETTINGS from '../../config/app-settings';

/**
 * Login component provides a GitHub OAuth authentication interface.
 * 
 * Features:
 * - GitHub OAuth authentication
 * - Error handling and display
 * - Redirection after successful auth
 * - Return URL preservation
 * - Loading state indication
 * 
 * @component
 * @returns {React.ReactElement} Login form
 */
const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  // Get the redirect path from location state, or default to home
  const from = location.state?.from?.pathname || '/';
  
  // Use login form hook for form state and submission handling
  const {
    loading,
    error,
    handleGitHubLogin,
    setError
  } = useLoginForm({
    redirectTo: from,
    onSuccess: () => {
      // Redirect on successful authentication
      navigate(from, { replace: true });
    }
  });
  
  // Subscribe to auth events
  useEffect(() => {
    const handleAuthError = (event) => {
      if (event && event.message) {
        setError(event.message);
      }
    };
    
    // Subscribe to error events
    const unsubscribeError = eventBus.subscribe('auth:error', handleAuthError);
    
    // Clean up subscriptions
    return () => {
      unsubscribeError();
    };
  }, [eventBus, setError]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Sign In</h2>
        
        {error && (
          <div className="auth-error-message" role="alert">
            {error}
          </div>
        )}
        
        {location.state?.message && (
          <div className="auth-info-message" role="status">
            {location.state.message}
          </div>
        )}
        
        <div className="auth-github-container">
          <p className="auth-description">
            {APP_SETTINGS.auth.loginMessage || 
              'Sign in with your GitHub account to access the visualization tool.'}
          </p>
          
          <SocialLoginButtons 
            providers={['github']}
            size="medium"
            fullWidth={true}
            onSuccess={() => navigate(from, { replace: true })}
            onError={(err) => setError(err.message || 'Failed to login with GitHub')}
          />
        </div>

        <div className="auth-info">
          <p>
            This application uses GitHub for authentication. 
            We'll only access public information and repositories you explicitly grant access to.
          </p>
        </div>
        
        {APP_SETTINGS.auth.allowSignup && (
          <div className="auth-alternative">
            <p>Don't have an account?</p>
            <Link to="/auth/register" className="auth-link">
              Create Account
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default registry.register(
  'auth.components.Login',
  Login,
  ['auth.AuthContext', 'utils.EventBus', 'hooks.useLoginForm', 'components.common.SocialLoginButtons'],
  {
    description: 'Authentication login form with GitHub OAuth',
    usage: 'Used as the main login page for user authentication'
  }
);

