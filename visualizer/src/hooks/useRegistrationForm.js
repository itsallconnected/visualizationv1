/**
 * Registration Form Hook
 * 
 * Custom React hook for managing registration form state, validation,
 * multi-step flow, and submission handling.
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Form field validation rules
 */
const validators = {
  name: (value) => {
    if (!value || value.trim() === '') return 'Name is required';
    if (value.length < 2) return 'Name must be at least 2 characters';
    if (value.length > 100) return 'Name cannot exceed 100 characters';
    return null;
  },
  
  email: (value) => {
    if (!value || value.trim() === '') return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return null;
  },
  
  company: (value) => {
    if (value && value.length > 100) return 'Company name cannot exceed 100 characters';
    return null;
  },
  
  phone: (value) => {
    if (value) {
      const phoneRegex = /^\+?[0-9\s\(\)\-]{8,20}$/;
      if (!phoneRegex.test(value)) return 'Please enter a valid phone number';
    }
    return null;
  },
  
  terms: (value) => {
    if (!value) return 'You must accept the terms and conditions';
    return null;
  }
};

/**
 * Custom hook for registration form functionality
 * 
 * @param {Object} options - Hook configuration options
 * @param {string} [options.redirectTo='/'] - Path to redirect after successful registration
 * @param {Function} [options.onSuccess] - Callback after successful registration
 * @param {Function} [options.onError] - Callback after registration error
 * @returns {Object} Form state and handlers
 */
const useRegistrationForm = ({
  redirectTo = '/',
  onSuccess,
  onError
} = {}) => {
  // Form state
  const [formState, setFormState] = useState({
    // GitHub data will be populated after OAuth flow
    githubId: '',
    username: '',
    avatarUrl: '',
    
    // Additional registration data
    name: '',
    email: '',
    company: '',
    phone: '',
    role: '',
    interests: [],
    terms: false
  });
  
  // Current step in registration flow
  const [currentStep, setCurrentStep] = useState('github');
  
  // Form submission state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({});
  
  // Validation state
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);
  
  // Get auth context and registration service
  const { login, isAuthenticated } = useAuth();
  const userRegistration = registry.getModule('auth.UserRegistration');
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  
  /**
   * Initialize registration process
   */
  const initRegistration = useCallback(async () => {
    if (!userRegistration) return;
    
    try {
      const result = await userRegistration.startRegistration();
      
      if (!result.success) {
        setError(result.error || 'Failed to start registration process');
      }
    } catch (error) {
      setError(error.message || 'Failed to initialize registration');
    }
  }, [userRegistration]);
  
  /**
   * Handle GitHub OAuth data received after callback
   */
  const handleGitHubData = useCallback(async (githubData) => {
    if (!userRegistration) return;
    
    try {
      setLoading(true);
      
      if (!githubData || !githubData.id) {
        throw new Error('Invalid GitHub data received');
      }
      
      // Update form state with GitHub data
      setFormState(prev => ({
        ...prev,
        githubId: githubData.id,
        username: githubData.login,
        name: githubData.name || githubData.login || prev.name,
        email: githubData.email || prev.email,
        avatarUrl: githubData.avatar_url
      }));
      
      // Update registration state in service
      const result = await userRegistration.handleGitHubCallback(githubData);
      
      if (result.success) {
        // Move to profile step if needed, otherwise complete
        if (result.needsProfileInfo) {
          setCurrentStep('profile');
        } else {
          await completeRegistration();
        }
      } else {
        throw new Error(result.error || 'Failed to process GitHub data');
      }
    } catch (error) {
      setError(error.message || 'Failed to process GitHub authentication');
      
      // Log error
      eventBus.publish('activity:log', {
        type: 'auth:registerError',
        provider: 'github',
        error: error.message
      });
      
      // Call error callback if provided
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [userRegistration, completeRegistration, eventBus, onError]);
  
  /**
   * Complete registration process
   */
  const completeRegistration = useCallback(async () => {
    if (!userRegistration) return;
    
    try {
      setLoading(true);
      
      // Complete registration with current form data
      const result = await userRegistration.completeRegistration(formState);
      
      if (result.success) {
        setCurrentStep('complete');
        
        // Call success callback if provided
        if (onSuccess) {
          onSuccess(result.userData);
        }
        
        // Log success
        eventBus.publish('activity:log', {
          type: 'auth:registerSuccess',
          provider: 'github',
          username: formState.username
        });
      } else {
        throw new Error(result.error || 'Failed to complete registration');
      }
    } catch (error) {
      setError(error.message || 'Failed to complete registration');
      
      // Log error
      eventBus.publish('activity:log', {
        type: 'auth:registerError',
        provider: 'github',
        error: error.message
      });
      
      // Call error callback if provided
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [userRegistration, formState, onSuccess, onError, eventBus]);
  
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
   * Handle interests selection (checkboxes)
   */
  const handleInterestsChange = useCallback((interest, isChecked) => {
    setFormState(prev => {
      const currentInterests = [...prev.interests];
      
      if (isChecked && !currentInterests.includes(interest)) {
        currentInterests.push(interest);
      } else if (!isChecked && currentInterests.includes(interest)) {
        const index = currentInterests.indexOf(interest);
        currentInterests.splice(index, 1);
      }
      
      return {
        ...prev,
        interests: currentInterests
      };
    });
    
    // Mark field as touched
    if (!touched.interests) {
      setTouched(prev => ({
        ...prev,
        interests: true
      }));
    }
  }, [touched]);
  
  /**
   * Handle form submission for current step
   */
  const handleSubmit = useCallback(async (event) => {
    if (event) event.preventDefault();
    
    // Mark relevant fields as touched for validation
    let fieldsToValidate = [];
    
    if (currentStep === 'profile') {
      fieldsToValidate = ['name', 'email', 'terms'];
    }
    
    const stepTouched = fieldsToValidate.reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {...touched});
    
    setTouched(stepTouched);
    
    // Check step-specific validation
    let stepValid = true;
    
    if (currentStep === 'profile') {
      stepValid = !validators.name(formState.name) && 
                   !validators.email(formState.email) &&
                   !validators.terms(!formState.terms);
    }
    
    if (!stepValid) {
      return;
    }
    
    // Process current step
    try {
      setLoading(true);
      setError('');
      
      if (currentStep === 'github') {
        // Start GitHub OAuth flow
        login();
      } else if (currentStep === 'profile') {
        // Submit profile data and complete registration
        const stepResult = await userRegistration.updateRegistrationStep('profile_info', formState);
        
        if (stepResult.success) {
          await completeRegistration();
        } else {
          throw new Error(stepResult.error || 'Failed to update profile information');
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred during registration');
      
      // Log error
      eventBus.publish('activity:log', {
        type: 'auth:registerError',
        provider: 'github',
        step: currentStep,
        error: err.message
      });
      
      // Call error callback if provided
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [currentStep, formState, touched, login, userRegistration, completeRegistration, eventBus, onError]);
  
  /**
   * Handle GitHub login button click
   */
  const handleGitHubRegister = useCallback(() => {
    eventBus.publish('activity:log', {
      type: 'auth:registerAttempt',
      provider: 'github'
    });
    
    // Initiate GitHub login
    login();
  }, [login, eventBus]);
  
  /**
   * Move to the next step in registration
   */
  const nextStep = useCallback(() => {
    const steps = ['github', 'profile', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);
  
  /**
   * Move to the previous step in registration
   */
  const prevStep = useCallback(() => {
    const steps = ['github', 'profile', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);
  
  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setFormState({
      githubId: '',
      username: '',
      avatarUrl: '',
      name: '',
      email: '',
      company: '',
      phone: '',
      role: '',
      interests: [],
      terms: false
    });
    setTouched({});
    setErrors({});
    setError('');
    setCurrentStep('github');
  }, []);
  
  /**
   * Cancel registration process
   */
  const cancelRegistration = useCallback(() => {
    if (userRegistration) {
      userRegistration.cancelRegistration('user_cancelled');
    }
    resetForm();
  }, [userRegistration, resetForm]);
  
  /**
   * Validate form data
   */
  useEffect(() => {
    // Validate each touched field
    const newErrors = {};
    
    Object.keys(touched).forEach(field => {
      if (!touched[field]) return;
      
      const validator = validators[field];
      if (validator) {
        const error = validator(formState[field]);
        if (error) {
          newErrors[field] = error;
        }
      }
    });
    
    setErrors(newErrors);
    
    // For profile step validity
    if (currentStep === 'profile') {
      const profileStepValid = !validators.name(formState.name) && 
                               !validators.email(formState.email) &&
                               formState.terms === true;
                               
      setIsValid(profileStepValid);
    } else {
      setIsValid(Object.keys(newErrors).length === 0);
    }
  }, [formState, touched, currentStep]);
  
  /**
   * Initialize registration on mount
   */
  useEffect(() => {
    initRegistration();
  }, [initRegistration]);
  
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
    currentStep,
    loading,
    error,
    errors,
    touched,
    isValid,
    
    // Form handlers
    handleChange,
    handleInterestsChange,
    handleSubmit,
    handleGitHubRegister,
    
    // Step navigation
    nextStep,
    prevStep,
    
    // Other actions
    resetForm,
    cancelRegistration,
    completeRegistration,
    handleGitHubData,
    
    // Set form state directly
    setFormState,
    setError
  };
};

// Register with ModuleRegistry
export default registry.register(
  'hooks.useRegistrationForm',
  useRegistrationForm,
  ['auth.AuthContext', 'auth.UserRegistration', 'utils.EventBus'],
  {
    description: 'React hook for registration form management',
    usage: `
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
        prevStep
      } = useRegistrationForm({
        redirectTo: '/dashboard',
        onSuccess: () => console.log('Registration successful')
      });
    `
  }
); 