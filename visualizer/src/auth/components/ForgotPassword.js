// ForgotPassword.js
// Redirect to GitHub for password reset

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';
import APP_SETTINGS from '../../config/app-settings';

/**
 * ForgotPassword component redirects users to GitHub's password reset flow.
 * 
 * Since we're using GitHub OAuth for authentication, password management
 * is handled by GitHub. This component provides a simple interface to
 * direct users to GitHub's password reset page.
 * 
 * Features:
 * - GitHub password reset redirection
 * - Configurable messaging
 * - User guidance for OAuth authentication
 * - Error handling
 * - Integration with activity tracking
 * 
 * @component
 * @returns {React.ReactElement} Password reset component
 */
const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  /**
   * Redirect to GitHub password reset page
   */
  const redirectToGitHubReset = () => {
    try {
      setLoading(true);
      
      // Log the password reset attempt
      eventBus.publish('activity:log', {
        type: 'auth:passwordResetAttempt',
        provider: 'github'
      });
      
      // GitHub password reset URL
      const resetUrl = APP_SETTINGS.auth.githubPasswordResetUrl || 
                        'https://github.com/password_reset';
      
      // Redirect the user
      window.location.href = resetUrl;
    } catch (err) {
      setError('Failed to redirect to GitHub. Please try again.');
      setLoading(false);
      
      // Log the error
      eventBus.publish('activity:log', {
        type: 'auth:passwordResetError',
        error: err.message
      });
    }
  };
  
  /**
   * Handle navigation back to login
   */
  const handleBackToLogin = () => {
    navigate('/auth/login');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Reset Password</h2>
        
        {error && (
          <div className="auth-error-message" role="alert">
            {error}
          </div>
        )}
        
        <div className="auth-info-container">
          <p className="auth-description">
            {APP_SETTINGS.auth.passwordResetMessage || 
              'This application uses GitHub for authentication. To reset your password, you\'ll need to go to GitHub\'s password reset page.'}
          </p>
          
          <button 
            className="github-auth-button"
            onClick={redirectToGitHubReset}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? 'Redirecting...' : 'Reset password on GitHub'}
          </button>
          
          <div className="auth-explanation">
            <p>
              Since you're using your GitHub account to authenticate, 
              your password is managed by GitHub, not by this application.
            </p>
          </div>
        </div>

        <div className="auth-alternative">
          <p>Remember your password?</p>
          <Link to="/auth/login" className="auth-link">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default registry.register(
  'auth.components.ForgotPassword',
  ForgotPassword,
  ['utils.EventBus'],
  {
    description: 'Component for redirecting to GitHub password reset',
    usage: 'Used as the forgot password page in the authentication flow'
  }
);

