/**
 * Login Form Hook
 * 
 * Custom React hook for managing login form state, validation,
 * and submission handling.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Form field validation rules
 */
const validators = {
  // Add other fields if needed for future authentication methods
};

/**
 * Custom hook for login form functionality
 * 
 * @param {Object} options - Hook configuration options
 * @param {string} [options.redirectTo='/'] - Path to redirect after successful login
 * @param {Function} [options.onSuccess] - Callback after successful login
 * @param {Function} [options.onError] - Callback after login error
 * @param {boolean} [options.rememberDefault=true] - Default value for remember checkbox
 * @returns {Object} Form state and handlers
 */
const useLoginForm = ({
  redirectTo = '/',
  onSuccess,
  onError,
  rememberDefault = true
} = {}) => {
  // Form state
  const [formState, setFormState] = useState({
    // Currently we only use GitHub OAuth, but this can be expanded for other auth methods
    email: '',
    password: '',
    remember: rememberDefault
  });
  
  // Form submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});
  
  // Validation state
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);
  
  // Get auth context and event bus
  const { login, isAuthenticated } = useAuth();
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  /**
   * Handle input field changes
   */
  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    
    setFormState(prev => ({
      ...prev,
      [name]: fieldValue
    }));
    
    // Mark field as touched
    if (!touched[name]) {
      setTouched(prev => ({
        ...prev,
        [name]: true
      }));
    }
  }, [touched]);
  
  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    
    // Mark all fields as touched for validation
    const allTouched = Object.keys(formState).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {});
    setTouched(allTouched);
    
    // Check if form is valid
    if (!isValid) {
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Log login attempt
      eventBus.publish('activity:log', {
        type: 'auth:loginAttempt',
        provider: 'github'
      });
      
      // Call auth login (currently only supports GitHub)
      await login({ remember: formState.remember });
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Set error state
      setError(err.message || 'Failed to login. Please try again.');
      
      // Log error
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
  }, [formState, isValid, login, eventBus, onSuccess, onError]);
  
  /**
   * Handle GitHub login button click
   */
  const handleGitHubLogin = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Log login attempt
      eventBus.publish('activity:log', {
        type: 'auth:loginAttempt',
        provider: 'github',
        method: 'oauth'
      });
      
      // Call auth login
      await login({ remember: formState.remember });
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Set error state
      setError(err.message || 'Failed to login with GitHub. Please try again.');
      
      // Log error
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
  }, [formState.remember, login, eventBus, onSuccess, onError]);

  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setFormState({
      email: '',
      password: '',
      remember: rememberDefault
    });
    setTouched({});
    setErrors({});
    setError('');
  }, [rememberDefault]);
  
  /**
   * Validate form data
   */
  useEffect(() => {
    // Currently skipping validation for GitHub OAuth flow
    // This can be expanded for username/password login in the future
    setIsValid(true);
    
    // Validate each touched field
    const newErrors = {};
    
    Object.keys(touched).forEach(field => {
      if (!touched[field]) return;
      
      const validator = validators[field];
      if (validator) {
        const error = validator(formState[field], formState);
        if (error) {
          newErrors[field] = error;
        }
      }
    });
    
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0);
  }, [formState, touched]);
  
  /**
   * Track authentication state
   */
  useEffect(() => {
    // Reset error if authenticated
    if (isAuthenticated) {
      setError('');
    }
  }, [isAuthenticated]);
  
  return {
    // Form state
    formState,
    loading,
    error,
    errors,
    touched,
    isValid,
    
    // Form handlers
    handleChange,
    handleSubmit,
    handleGitHubLogin,
    resetForm,
    
    // Set form state directly
    setFormState,
    setError
  };
};

// Register with ModuleRegistry
export default registry.register(
  'hooks.useLoginForm',
  useLoginForm,
  ['auth.AuthContext', 'utils.EventBus'],
  {
    description: 'React hook for login form management',
    usage: `
      const {
        formState,
        loading,
        error,
        errors,
        handleChange,
        handleSubmit,
        handleGitHubLogin
      } = useLoginForm({
        redirectTo: '/dashboard',
        onSuccess: () => console.log('Login successful')
      });
    `
  }
); 