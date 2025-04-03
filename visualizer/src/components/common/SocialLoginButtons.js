/**
 * Social Login Buttons Component
 * 
 * A set of styled buttons for social authentication providers
 * with consistent styling and behavior.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../auth/AuthContext';
import LoginButton from '../../auth/components/LoginButton';
import registry from '../../ModuleRegistry';

/**
 * Social login buttons with consistent styling
 * 
 * @component
 * @param {Object} props - Component properties
 * @param {string[]} [props.providers=['github']] - List of providers to display
 * @param {string} [props.size='medium'] - Button size (small, medium, large)
 * @param {boolean} [props.fullWidth=false] - Whether buttons should take full width
 * @param {string} [props.layout='vertical'] - Button layout (vertical or horizontal)
 * @param {Function} [props.onSuccess] - Callback after successful login
 * @param {Function} [props.onError] - Callback after login error
 * @returns {React.ReactElement} Social login buttons
 */
const SocialLoginButtons = ({
  providers = ['github'],
  size = 'medium',
  fullWidth = false,
  layout = 'vertical',
  onSuccess,
  onError,
  className = ''
}) => {
  const { login } = useAuth();
  
  // Provider-specific settings
  const providerConfig = {
    github: {
      label: 'Sign in with GitHub',
      className: 'github-auth-button',
      icon: (
        <svg 
          className="github-icon" 
          viewBox="0 0 24 24" 
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      )
    },
    // Additional providers can be added here
    google: {
      label: 'Sign in with Google',
      className: 'google-auth-button',
      icon: (
        <svg
          className="google-icon"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M12.545 12.151L12.545 12.151 12.545 12.151 9.455 12.151 9.455 14.303 12.545 14.303 12.545 14.303C12.21 15.157 11.386 15.759 10.424 15.759 9.13 15.759 8.082 14.71 8.082 13.417 8.082 12.123 9.13 11.075 10.424 11.075 11.014 11.075 11.553 11.286 11.971 11.647L13.537 10.081C12.685 9.302 11.607 8.848 10.424 8.848 7.902 8.848 5.854 10.895 5.854 13.417 5.854 15.939 7.902 17.986 10.424 17.986 12.945 17.986 14.993 15.939 14.993 13.417 14.993 12.975 14.927 12.548 14.811 12.151H12.545z" />
          <path d="M22 11.126H20.182V9.309H18.365V11.126H16.547V12.943H18.365V14.76H20.182V12.943H22V11.126Z" />
          <path d="M5.838 10.045V11.939H8.391C8.252 12.536 7.908 13.063 7.419 13.41 6.93 13.757 6.33 13.944 5.714 13.944 5.254 13.944 4.8 13.846 4.389 13.656 3.978 13.467 3.618 13.192 3.335 12.852 3.053 12.511 2.853 12.115 2.751 11.69 2.649 11.265 2.649 10.823 2.751 10.398 2.853 9.972 3.053 9.576 3.335 9.236 3.618 8.896 3.978 8.621 4.389 8.431 4.8 8.242 5.254 8.144 5.714 8.144 6.468 8.144 7.193 8.421 7.756 8.925L9.016 7.514C8.618 7.099 8.142 6.766 7.615 6.536 7.089 6.305 6.522 6.183 5.947 6.176 5.16 6.176 4.384 6.372 3.691 6.745 2.997 7.118 2.41 7.656 1.982 8.312 1.554 8.968 1.3 9.721 1.242 10.501 1.184 11.28 1.324 12.061 1.647 12.774 1.969 13.487 2.464 14.107 3.083 14.579 3.702 15.05 4.426 15.356 5.191 15.466 5.956 15.577 6.734 15.488 7.455 15.207 8.175 14.926 8.81 14.464 9.298 13.866 9.786 13.268 10.108 12.556 10.235 11.8 10.362 11.044 10.29 10.268 10.026 9.552H5.838V10.045Z" />
        </svg>
      )
    },
    // Other providers could be added here
  };
  
  /**
   * Handle login for a specific provider
   * @param {string} providerId - Provider ID to use for login
   */
  const handleLogin = async (providerId) => {
    try {
      // Currently we only support GitHub OAuth directly
      await login();
      
      if (onSuccess) {
        onSuccess(providerId);
      }
    } catch (error) {
      if (onError) {
        onError(error, providerId);
      }
    }
  };
  
  // Container class based on layout
  const containerClass = `social-login-buttons ${layout === 'horizontal' ? 'horizontal' : 'vertical'} ${className}`;
  
  return (
    <div className={containerClass}>
      {providers.map(providerId => {
        // Only render implemented providers
        if (providerId === 'github') {
          return (
            <LoginButton
              key={providerId}
              label={providerConfig[providerId]?.label || `Sign in with ${providerId}`}
              className={`${providerConfig[providerId]?.className || ''}`}
              size={size}
              fullWidth={fullWidth}
              onSuccess={() => onSuccess && onSuccess(providerId)}
              onError={(error) => onError && onError(error, providerId)}
            />
          );
        }
        
        // For other providers, use a generic button until implemented
        if (providerConfig[providerId]) {
          return (
            <button
              key={providerId}
              className={`social-auth-button ${providerConfig[providerId].className} ${size === 'small' ? 'small' : size === 'large' ? 'large' : ''} ${fullWidth ? 'full-width' : ''}`}
              onClick={() => handleLogin(providerId)}
              disabled={true} // Disable non-implemented providers
              type="button"
              aria-label={`Sign in with ${providerId}`}
            >
              {providerConfig[providerId].icon}
              {providerConfig[providerId].label || `Sign in with ${providerId}`}
              <span className="provider-status">(Coming soon)</span>
            </button>
          );
        }
        
        return null;
      })}
    </div>
  );
};

SocialLoginButtons.propTypes = {
  providers: PropTypes.arrayOf(PropTypes.string),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  fullWidth: PropTypes.bool,
  layout: PropTypes.oneOf(['vertical', 'horizontal']),
  onSuccess: PropTypes.func,
  onError: PropTypes.func,
  className: PropTypes.string,
};

// Add styles to support the component
const styles = `
.social-login-buttons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.social-login-buttons.horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.social-auth-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border: none;
  position: relative;
}

.social-auth-button.small {
  padding: 8px 12px;
  font-size: 14px;
}

.social-auth-button.small svg {
  width: 16px;
  height: 16px;
}

.social-auth-button.large {
  padding: 16px 20px;
  font-size: 18px;
}

.social-auth-button.large svg {
  width: 24px;
  height: 24px;
}

.social-auth-button.full-width {
  width: 100%;
}

.social-auth-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.social-auth-button svg {
  width: 20px;
  height: 20px;
  margin-right: 10px;
}

.provider-status {
  font-size: 12px;
  opacity: 0.7;
  margin-left: 8px;
}

/* GitHub button */
.github-auth-button {
  background-color: #24292e;
  color: #fff;
}

.github-auth-button:hover:not(:disabled) {
  background-color: #1b1f23;
}

.github-auth-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(36, 41, 46, 0.3);
}

.github-icon {
  fill: #fff;
}

/* Google button */
.google-auth-button {
  background-color: #fff;
  color: #757575;
  border: 1px solid #ddd;
}

.google-auth-button:hover:not(:disabled) {
  background-color: #f5f5f5;
}

.google-auth-button:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.3);
}

.google-icon {
  fill: #4285F4;
}
`;

// Add styles to document
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

export default registry.register(
  'components.common.SocialLoginButtons',
  SocialLoginButtons,
  ['auth.AuthContext', 'auth.components.LoginButton'],
  {
    description: 'Reusable social authentication buttons with consistent styling',
    usage: `
      // Basic usage with default GitHub button
      <SocialLoginButtons 
        onSuccess={(provider) => console.log(provider + ' login successful')}  
      />
      
      // Multiple providers with horizontal layout
      <SocialLoginButtons 
        providers={['github', 'google']} 
        layout="horizontal"
        size="large"
        fullWidth={true}
      />
    `
  }
); 