/**
 * GitHub Login Button Component
 * 
 * A reusable button component for GitHub OAuth authentication
 * that can be used anywhere in the application.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../AuthContext';
import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';

/**
 * GitHub login button with loading state and custom styling
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {string} [props.label] - Button text
 * @param {string} [props.className] - Additional CSS class names
 * @param {string} [props.size] - Button size (small, medium, large)
 * @param {Function} [props.onSuccess] - Callback after successful login
 * @param {Function} [props.onError] - Callback after login error
 * @param {boolean} [props.fullWidth] - Whether button should take full width
 * @returns {React.ReactElement} GitHub login button
 */
const LoginButton = ({
  label = 'Sign in with GitHub',
  className = '',
  size = 'medium',
  onSuccess,
  onError,
  fullWidth = false,
}) => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  // CSS classes based on size
  const sizeClass = size === 'small' 
    ? 'github-auth-button-small' 
    : size === 'large' 
      ? 'github-auth-button-large' 
      : '';
  
  // Button click handler
  const handleClick = async () => {
    try {
      setLoading(true);
      
      // Log the login attempt
      eventBus.publish('activity:log', {
        type: 'auth:loginAttempt',
        provider: 'github'
      });
      
      // Initiate GitHub OAuth flow
      await login();
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Log the error
      eventBus.publish('activity:log', {
        type: 'auth:loginError',
        provider: 'github',
        error: err.message
      });
      
      // Call error callback if provided
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      className={`github-auth-button ${sizeClass} ${fullWidth ? 'github-auth-button-full' : ''} ${className}`}
      onClick={handleClick}
      disabled={loading}
      aria-busy={loading}
      type="button"
    >
      <svg 
        className="github-icon" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      {loading ? 'Connecting...' : label}
    </button>
  );
};

LoginButton.propTypes = {
  label: PropTypes.string,
  className: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  fullWidth: PropTypes.bool,
};

export default registry.register(
  'auth.components.LoginButton',
  LoginButton,
  ['auth.AuthContext', 'utils.EventBus'],
  {
    description: 'Reusable GitHub authentication button',
    usage: 'Used for GitHub OAuth authentication across the application'
  }
); 