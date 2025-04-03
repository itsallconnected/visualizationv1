/**
 * User Registration Service
 * 
 * Handles user registration workflow, tracking, and persistence.
 * Works with GitHub OAuth for creating new user accounts.
 */

import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';
import StorageManager from '../utils/StorageManager';
import ErrorHandler from '../utils/ErrorHandler';
import APP_SETTINGS from '../config/app-settings';

/**
 * Local storage keys for registration data
 */
const STORAGE_KEYS = {
  REGISTRATION_STATE: 'registration:state',
  REGISTRATION_STEP: 'registration:step',
  REGISTRATION_DATA: 'registration:data',
  REGISTRATION_STARTED: 'registration:started_at',
  REGISTRATION_ATTEMPTS: 'registration:attempts'
};

/**
 * Registration status enum
 */
const RegistrationStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  GITHUB_AUTHORIZED: 'github_authorized',
  PROFILE_COMPLETED: 'profile_completed',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * User registration service that manages the registration workflow
 */
class UserRegistration {
  constructor() {
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    this.storageManager = registry.getModule('utils.StorageManager') || StorageManager;
    this.errorHandler = registry.getModule('utils.ErrorHandler') || ErrorHandler;
    
    // Initialize storage space
    this.storage = this.storageManager.getNamespace('registration');
  }
  
  /**
   * Start a new user registration process
   * @param {Object} initialData - Initial user data (if available)
   * @returns {Object} Registration session info
   */
  async startRegistration(initialData = {}) {
    try {
      // Check for existing registration
      const existingState = this.getCurrentRegistrationState();
      if (existingState && existingState.status !== RegistrationStatus.CANCELLED && 
          existingState.status !== RegistrationStatus.FAILED) {
        // Continue existing registration
        return { 
          success: true, 
          isNew: false, 
          state: existingState 
        };
      }
      
      // Generate new registration session
      const registrationId = this._generateRegistrationId();
      const startTime = new Date().toISOString();
      
      // Track registration attempt
      this._trackRegistrationAttempt();
      
      // Create registration state
      const registrationState = {
        registrationId,
        status: RegistrationStatus.IN_PROGRESS,
        step: 'github_auth',
        startedAt: startTime,
        lastUpdatedAt: startTime,
        initialData,
        userData: {...initialData},
        completedSteps: [],
        errors: []
      };
      
      // Save to storage
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, registrationState);
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STARTED, startTime);
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STEP, 'github_auth');
      
      // Log event
      this.eventBus.publish('registration:started', {
        registrationId,
        timestamp: startTime
      });
      
      return {
        success: true,
        isNew: true,
        state: registrationState
      };
    } catch (error) {
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'startRegistration'
      });
      
      return {
        success: false,
        error: error.message || 'Failed to start registration'
      };
    }
  }
  
  /**
   * Update the registration state with new data from completed step
   * @param {string} step - Completed registration step
   * @param {Object} stepData - Data collected from the step
   * @returns {Object} Updated registration state
   */
  async updateRegistrationStep(step, stepData = {}) {
    try {
      const currentState = this.getCurrentRegistrationState();
      
      // Validate state exists
      if (!currentState) {
        throw new Error('No active registration found');
      }
      
      // Determine next step
      const nextStep = this._determineNextStep(step);
      
      // Update registration state
      const updatedState = {
        ...currentState,
        status: nextStep === 'complete' ? 
          RegistrationStatus.COMPLETED : 
          RegistrationStatus.IN_PROGRESS,
        step: nextStep,
        lastUpdatedAt: new Date().toISOString(),
        userData: {
          ...currentState.userData,
          ...stepData
        },
        completedSteps: [...currentState.completedSteps, step]
      };
      
      // Save to storage
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, updatedState);
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STEP, nextStep);
      
      // Log event
      this.eventBus.publish('registration:step:completed', {
        registrationId: currentState.registrationId,
        step,
        nextStep,
        timestamp: updatedState.lastUpdatedAt
      });
      
      return {
        success: true,
        state: updatedState,
        isComplete: nextStep === 'complete'
      };
    } catch (error) {
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'updateRegistrationStep',
        stepName: step
      });
      
      return {
        success: false,
        error: error.message || 'Failed to update registration step'
      };
    }
  }
  
  /**
   * Handle GitHub OAuth callback during registration
   * @param {Object} githubData - GitHub user data from authentication
   * @returns {Object} Updated registration state
   */
  async handleGitHubCallback(githubData) {
    try {
      const currentState = this.getCurrentRegistrationState();
      
      // Validate state exists
      if (!currentState) {
        throw new Error('No active registration found');
      }
      
      // Validate correct step
      if (currentState.step !== 'github_auth' && 
          !currentState.completedSteps.includes('github_auth')) {
        throw new Error('Invalid registration step state');
      }
      
      // Extract relevant GitHub data
      const userData = {
        githubId: githubData.id,
        username: githubData.login,
        name: githubData.name || githubData.login,
        email: githubData.email,
        avatar: githubData.avatar_url,
        profileUrl: githubData.html_url
      };
      
      // Update registration state
      const updatedState = {
        ...currentState,
        status: RegistrationStatus.GITHUB_AUTHORIZED,
        lastUpdatedAt: new Date().toISOString(),
        userData: {
          ...currentState.userData,
          ...userData
        },
        completedSteps: [...currentState.completedSteps, 'github_auth']
      };
      
      // Determine if additional profile info is needed
      const needsProfileInfo = APP_SETTINGS.auth.requireAdditionalProfileInfo || false;
      const nextStep = needsProfileInfo ? 'profile_info' : 'complete';
      
      updatedState.step = nextStep;
      
      // Save to storage
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, updatedState);
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STEP, nextStep);
      
      // Log event
      this.eventBus.publish('registration:github:authorized', {
        registrationId: currentState.registrationId,
        githubId: userData.githubId,
        username: userData.username,
        timestamp: updatedState.lastUpdatedAt
      });
      
      return {
        success: true,
        state: updatedState,
        needsProfileInfo,
        isComplete: nextStep === 'complete'
      };
    } catch (error) {
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'handleGitHubCallback'
      });
      
      return {
        success: false,
        error: error.message || 'Failed to process GitHub authorization'
      };
    }
  }
  
  /**
   * Complete the registration process
   * @param {Object} finalData - Final user data to include
   * @returns {Object} Completion status
   */
  async completeRegistration(finalData = {}) {
    try {
      const currentState = this.getCurrentRegistrationState();
      
      // Validate state exists
      if (!currentState) {
        throw new Error('No active registration found');
      }
      
      // Make sure we have GitHub data
      if (!currentState.userData.githubId) {
        throw new Error('GitHub authorization is required to complete registration');
      }
      
      // Create final user data
      const finalUserData = {
        ...currentState.userData,
        ...finalData,
        registrationCompleted: true,
        registrationCompletedAt: new Date().toISOString()
      };
      
      // Update registration state
      const completedState = {
        ...currentState,
        status: RegistrationStatus.COMPLETED,
        step: 'complete',
        lastUpdatedAt: new Date().toISOString(),
        userData: finalUserData,
        completedSteps: [...currentState.completedSteps, 'complete']
      };
      
      // Save to storage
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, completedState);
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STEP, 'complete');
      
      // Log event
      this.eventBus.publish('registration:completed', {
        registrationId: currentState.registrationId,
        userId: finalUserData.githubId,
        username: finalUserData.username,
        timestamp: completedState.lastUpdatedAt,
        duration: this._calculateDuration(
          new Date(currentState.startedAt),
          new Date(completedState.lastUpdatedAt)
        )
      });
      
      return {
        success: true,
        userData: finalUserData
      };
    } catch (error) {
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'completeRegistration'
      });
      
      // Mark registration as failed
      this._markRegistrationAsFailed(error.message);
      
      return {
        success: false,
        error: error.message || 'Failed to complete registration'
      };
    }
  }
  
  /**
   * Cancel the current registration process
   * @param {string} reason - Reason for cancellation
   * @returns {Object} Cancellation status
   */
  cancelRegistration(reason = 'user_cancelled') {
    try {
      const currentState = this.getCurrentRegistrationState();
      
      // If no active registration, just return success
      if (!currentState) {
        return { success: true, wasActive: false };
      }
      
      // Update registration state
      const cancelledState = {
        ...currentState,
        status: RegistrationStatus.CANCELLED,
        lastUpdatedAt: new Date().toISOString(),
        cancellationReason: reason
      };
      
      // Save to storage
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, cancelledState);
      
      // Log event
      this.eventBus.publish('registration:cancelled', {
        registrationId: currentState.registrationId,
        reason,
        timestamp: cancelledState.lastUpdatedAt,
        duration: this._calculateDuration(
          new Date(currentState.startedAt),
          new Date(cancelledState.lastUpdatedAt)
        )
      });
      
      return {
        success: true,
        wasActive: true
      };
    } catch (error) {
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'cancelRegistration'
      });
      
      return {
        success: false,
        error: error.message || 'Failed to cancel registration'
      };
    }
  }
  
  /**
   * Get the current registration state
   * @returns {Object|null} Current registration state or null if none
   */
  getCurrentRegistrationState() {
    return this.storage.getItem(STORAGE_KEYS.REGISTRATION_STATE);
  }
  
  /**
   * Get the current registration step
   * @returns {string|null} Current step or null if no active registration
   */
  getCurrentStep() {
    return this.storage.getItem(STORAGE_KEYS.REGISTRATION_STEP);
  }
  
  /**
   * Check if there is an active registration in progress
   * @returns {boolean} Whether registration is in progress
   */
  hasActiveRegistration() {
    const state = this.getCurrentRegistrationState();
    
    return state !== null && 
      [RegistrationStatus.IN_PROGRESS, RegistrationStatus.GITHUB_AUTHORIZED, 
       RegistrationStatus.AWAITING_CONFIRMATION, RegistrationStatus.PROFILE_COMPLETED].includes(state.status);
  }
  
  /**
   * Check if a registration was completed
   * @returns {boolean} Whether registration was completed
   */
  wasRegistrationCompleted() {
    const state = this.getCurrentRegistrationState();
    return state !== null && state.status === RegistrationStatus.COMPLETED;
  }
  
  /**
   * Reset all registration data
   */
  resetRegistration() {
    Object.values(STORAGE_KEYS).forEach(key => {
      this.storage.removeItem(key);
    });
    
    this.eventBus.publish('registration:reset', {
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Determine the next registration step
   * @private
   * @param {string} currentStep - Current step that was completed
   * @returns {string} Next step in the flow
   */
  _determineNextStep(currentStep) {
    // Default registration flow
    const steps = ['github_auth', 'profile_info', 'complete'];
    
    // Skip profile step if not required
    if (!APP_SETTINGS.auth.requireAdditionalProfileInfo) {
      const filteredSteps = steps.filter(step => step !== 'profile_info');
      const currentIndex = filteredSteps.indexOf(currentStep);
      return currentIndex >= 0 && currentIndex < filteredSteps.length - 1
        ? filteredSteps[currentIndex + 1]
        : 'complete';
    }
    
    // Standard flow
    const currentIndex = steps.indexOf(currentStep);
    return currentIndex >= 0 && currentIndex < steps.length - 1
      ? steps[currentIndex + 1]
      : 'complete';
  }
  
  /**
   * Generate a unique registration ID
   * @private
   * @returns {string} Unique ID for this registration
   */
  _generateRegistrationId() {
    return 'reg_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Calculate duration between two dates in seconds
   * @private
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {number} Duration in seconds
   */
  _calculateDuration(startDate, endDate) {
    return Math.round((endDate.getTime() - startDate.getTime()) / 1000);
  }
  
  /**
   * Track registration attempt for analytics
   * @private
   */
  _trackRegistrationAttempt() {
    const attempts = this.storage.getItem(STORAGE_KEYS.REGISTRATION_ATTEMPTS) || 0;
    this.storage.setItem(STORAGE_KEYS.REGISTRATION_ATTEMPTS, attempts + 1);
  }
  
  /**
   * Mark current registration as failed
   * @private
   * @param {string} errorMessage - Error message
   */
  _markRegistrationAsFailed(errorMessage) {
    const currentState = this.getCurrentRegistrationState();
    
    if (currentState) {
      const failedState = {
        ...currentState,
        status: RegistrationStatus.FAILED,
        lastUpdatedAt: new Date().toISOString(),
        errors: [...currentState.errors, {
          message: errorMessage,
          timestamp: new Date().toISOString(),
          step: currentState.step
        }]
      };
      
      this.storage.setItem(STORAGE_KEYS.REGISTRATION_STATE, failedState);
      
      this.eventBus.publish('registration:failed', {
        registrationId: currentState.registrationId,
        error: errorMessage,
        step: currentState.step,
        timestamp: failedState.lastUpdatedAt
      });
    }
  }
}

// Export and register the service
export default registry.register(
  'auth.UserRegistration',
  new UserRegistration(),
  ['utils.EventBus', 'utils.StorageManager', 'utils.ErrorHandler'],
  {
    description: 'User registration workflow management service',
    provides: ['registration', 'userRegistration'],
    usage: `
      // Start a new registration
      const registrationService = registry.getModule('auth.UserRegistration');
      const { success, state } = await registrationService.startRegistration();
      
      // After GitHub OAuth callback
      const { success, needsProfileInfo } = await registrationService.handleGitHubCallback(githubData);
      
      // Complete registration
      const { success, userData } = await registrationService.completeRegistration();
    `
  }
); 