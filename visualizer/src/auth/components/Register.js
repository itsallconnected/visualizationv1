// Register.js
// Registration redirect to GitHub OAuth flow

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import useRegistrationForm from '../../hooks/useRegistrationForm';
import UserRegistration from '../UserRegistration';
import RegistrationUtils from '../../utils/auth/RegistrationUtils';
import registry from '../../ModuleRegistry';
import EventBus from '../../utils/EventBus';
import APP_SETTINGS from '../../config/app-settings';

/**
 * Steps in the registration process
 * @type {Object}
 */
const STEPS = {
  GITHUB: 'github',
  PROFILE: 'profile',
  COMPLETE: 'complete'
};

/**
 * Registration component providing multi-step registration with
 * GitHub OAuth authentication and profile completion.
 * 
 * @component
 * @returns {React.ReactElement} Registration form
 */
const Register = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  const userRegistration = registry.getModule('auth.UserRegistration') || new UserRegistration();
  
  // Extract redirect path from location state or query parameter
  const redirectPath = 
    location.state?.from?.pathname || 
    new URLSearchParams(location.search).get('redirect') ||
    '/';
  
  // Use registration form hook
  const {
    formState,
    currentStep,
    loading,
    error,
    errors,
    handleChange,
    handleSubmit,
    handleGitHubRegister,
    nextStep,
    prevStep,
    isValid
  } = useRegistrationForm({
    redirectTo: redirectPath,
    onSuccess: () => {
      // Navigate after successful registration
      setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 2000); // Small delay to show success message
    },
    onError: (error) => {
      eventBus.publish('notification:error', {
        message: error.message || 'Registration failed. Please try again.',
        title: 'Registration Error'
      });
    }
  });
  
  // GitHub authentication code handling
  useEffect(() => {
    // Check if we have a GitHub authentication code in the URL
    if (window.location.search.includes('code=')) {
      // Parse GitHub data from AuthContext if available
      // Normally we'd get this from the auth system
      // This is a simplified example
      const simulatedGitHubData = {
        id: Date.now(), // Simulated unique ID
        login: `user_${Math.floor(Math.random() * 1000)}`,
        name: '',
        email: '',
        avatar_url: ''
      };
      
      // Handle GitHub data in the registration form
      handleGitHubData(simulatedGitHubData);
      
      // Clear the URL to remove auth parameters
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, [handleGitHubData]);
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && currentStep !== STEPS.COMPLETE) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath, currentStep]);
  
  // Get current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.GITHUB:
        return (
          <div className="register-section active github-section">
            <p className="auth-description">
              {APP_SETTINGS.auth.registerMessage || 
                "Create an account using your GitHub profile to access all features."}
            </p>
            
            <div className="github-info">
              <p>When you register with GitHub:</p>
              <ul className="github-benefits">
                <li>No need to create another password</li>
                <li>We only access your public profile information</li>
                <li>You can control permissions in your GitHub settings</li>
              </ul>
            </div>
            
            <button 
              onClick={handleGitHubRegister}
              className="github-auth-button"
              disabled={loading}
              aria-busy={loading}
              type="button"
              data-testid="register-button"
            >
              <svg 
                className="github-icon" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              {loading ? 'Connecting to GitHub...' : 'Continue with GitHub'}
            </button>
            
            {loading && (
              <div className="loading-indicator" aria-busy={loading} aria-live="polite">
                <div className="spinner"></div>
                <p>Connecting to GitHub...</p>
              </div>
            )}
          </div>
        );
        
      case STEPS.PROFILE:
        return (
          <div className="register-section active profile-section">
            <p className="auth-description">
              Complete your profile to finish creating your account.
            </p>
            
            <form className="profile-form" onSubmit={handleSubmit} data-testid="register-form">
              <div className="form-row">
                <label className="form-label" htmlFor="name">
                  Full Name <span className="required">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className={`form-input ${errors.name ? 'error' : ''}`}
                  value={formState.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                  required
                  autoFocus
                />
                {errors.name && <span className="input-error">{errors.name}</span>}
              </div>
              
              <div className="form-row">
                <label className="form-label" htmlFor="email">
                  Email Address <span className="required">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className={`form-input ${errors.email ? 'error' : ''}`}
                  value={formState.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  required
                />
                {errors.email && <span className="input-error">{errors.email}</span>}
                <span className="input-help">We'll never share your email with anyone else.</span>
              </div>
              
              <div className="form-row">
                <label className="form-label" htmlFor="company">
                  Organization/Company
                </label>
                <input
                  id="company"
                  name="company"
                  type="text"
                  className="form-input"
                  value={formState.company}
                  onChange={handleChange}
                  placeholder="Where do you work? (optional)"
                />
              </div>
              
              <div className="form-row">
                <label className="form-label" htmlFor="role">
                  Professional Role
                </label>
                <select
                  id="role"
                  name="role"
                  className="form-input"
                  value={formState.role}
                  onChange={handleChange}
                >
                  <option value="">Select your role (optional)</option>
                  <option value="researcher">Researcher</option>
                  <option value="engineer">Engineer</option>
                  <option value="data_scientist">Data Scientist</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="executive">Executive</option>
                  <option value="student">Student</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="form-row checkbox-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={formState.terms}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    I agree to the <Link to="/terms" target="_blank" className="auth-link">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="auth-link">Privacy Policy</Link>
                  </span>
                </label>
                {errors.terms && <span className="input-error">{errors.terms}</span>}
              </div>
              
              <div className="register-nav">
                <button
                  type="button"
                  className="btn btn-back"
                  onClick={prevStep}
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !isValid}
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </div>
            </form>
            
            {loading && (
              <div className="loading-indicator" aria-busy={loading} aria-live="polite">
                <div className="spinner"></div>
                <p>Creating your account...</p>
              </div>
            )}
          </div>
        );
        
      case STEPS.COMPLETE:
        return (
          <div className="register-section active confirmation-section">
            <div className="confirmation-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <h3 className="confirmation-title">Registration Complete!</h3>
            <p className="confirmation-message">
              Your account has been created successfully. Welcome to the AI Alignment Visualization platform!
            </p>
            <button
              onClick={() => navigate(redirectPath, { replace: true })}
              className="btn btn-primary"
            >
              Continue to Dashboard
            </button>
          </div>
        );
        
      default:
        return (
          <div className="register-section active error-section">
            <p>Invalid registration step. Please try again.</p>
            <button
              onClick={() => navigate('/auth/register', { replace: true })}
              className="btn btn-primary"
            >
              Restart Registration
            </button>
          </div>
        );
    }
  };
  
  // Render step indicator
  const renderStepIndicator = () => {
    // Only show for multi-step registration
    if (APP_SETTINGS.auth.requireAdditionalProfileInfo === false) {
      return null;
    }
    
    // Don't show on completion screen
    if (currentStep === STEPS.COMPLETE) {
      return null;
    }
    
    // Get steps based on requirements
    const steps = APP_SETTINGS.auth.requireAdditionalProfileInfo
      ? [
          { key: STEPS.GITHUB, label: 'GitHub' },
          { key: STEPS.PROFILE, label: 'Profile' }
        ]
      : [
          { key: STEPS.GITHUB, label: 'GitHub' }
        ];
    
    return (
      <div className="register-steps">
        {steps.map((step, index) => {
          const isCurrent = step.key === currentStep;
          const isCompleted = currentStep === STEPS.COMPLETE || 
            (steps.indexOf({ key: currentStep }) > index);
            
          return (
            <div 
              key={step.key}
              className={`step-item ${isCurrent ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="step-circle">
                {isCompleted ? '✓' : index + 1}
              </div>
              <div className="step-label">{step.label}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2 className="auth-title">Create Account</h2>
        
        {error && (
          <div className="auth-error-message" role="alert">
            {error}
          </div>
        )}
        
        {renderStepIndicator()}
        {renderStepContent()}
        
        <div className="auth-alternative">
          <p>Already have an account?</p>
          <Link to="/auth/login" className="auth-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default registry.register(
  'auth.components.Register',
  Register,
  ['auth.AuthContext', 'auth.UserRegistration', 'hooks.useRegistrationForm', 'utils.EventBus', 'utils.auth.RegistrationUtils'],
  {
    description: 'Registration component with GitHub OAuth and multi-step flow',
    usage: 'Used as the registration page for new users'
  }
);

