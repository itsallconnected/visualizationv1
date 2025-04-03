/**
 * Registration API Client
 * 
 * Provides API methods for user registration, profile completion,
 * and registration verification. Works with GitHub OAuth for account creation.
 */

import registry from '../../ModuleRegistry';
import ApiClient from '../ApiClient';
import EventBus from '../../utils/EventBus';
import ErrorHandler from '../../utils/ErrorHandler';

/**
 * Registration API endpoints
 */
const ENDPOINTS = {
  REGISTER: '/auth/register',
  VERIFY: '/auth/verify-registration',
  COMPLETE_PROFILE: '/auth/complete-profile',
  CHECK_USERNAME: '/auth/check-username',
  CHECK_EMAIL: '/auth/check-email'
};

/**
 * API client for registration-related operations
 */
class RegistrationApi {
  constructor() {
    this.apiClient = registry.getModule('api.ApiClient') || ApiClient;
    this.eventBus = registry.getModule('utils.EventBus') || EventBus;
    this.errorHandler = registry.getModule('utils.ErrorHandler') || ErrorHandler;
  }
  
  /**
   * Register a new user with GitHub OAuth data
   * @param {Object} githubData - GitHub profile data
   * @param {Object} [additionalData={}] - Additional registration data
   * @returns {Promise<Object>} Registration result
   */
  async registerWithGitHub(githubData, additionalData = {}) {
    try {
      if (!githubData || !githubData.id) {
        throw new Error('Invalid GitHub profile data');
      }
      
      // Log the registration attempt
      this.eventBus.publish('api:registration:attempt', {
        provider: 'github',
        timestamp: new Date().toISOString()
      });
      
      // In this GitHub OAuth implementation, we're using stateless authentication
      // So we'll simulate a successful registration response
      
      // In a real backend implementation, we would make an API call:
      // const response = await this.apiClient.post(ENDPOINTS.REGISTER, {
      //   provider: 'github',
      //   providerData: githubData,
      //   ...additionalData
      // });
      
      // Instead, we'll simulate a successful response
      const userId = `user_${githubData.id}`;
      const username = githubData.login;
      
      // Log the successful registration
      this.eventBus.publish('api:registration:success', {
        provider: 'github',
        username,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Create a simulated successful response
      return {
        success: true,
        user: {
          id: userId,
          username,
          email: githubData.email,
          name: githubData.name || username,
          avatarUrl: githubData.avatar_url,
          provider: 'github',
          providerUserId: githubData.id,
          registrationDate: new Date().toISOString(),
          isVerified: true // GitHub OAuth users are considered verified
        },
        token: `simulated_token_${githubData.id}`,
        message: 'Registration successful'
      };
    } catch (error) {
      // Handle and log error
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'registerWithGitHub'
      });
      
      // Log the registration error
      this.eventBus.publish('api:registration:error', {
        provider: 'github',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }
  
  /**
   * Complete user profile after initial registration
   * @param {string} userId - User ID
   * @param {Object} profileData - Profile completion data
   * @returns {Promise<Object>} Profile update result
   */
  async completeProfile(userId, profileData) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      // Log the profile completion attempt
      this.eventBus.publish('api:profile:update:attempt', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      // In a real backend implementation, we would make an API call:
      // const response = await this.apiClient.post(ENDPOINTS.COMPLETE_PROFILE, {
      //   userId,
      //   ...profileData
      // });
      
      // Instead, we'll simulate a successful response
      
      // Log the successful profile update
      this.eventBus.publish('api:profile:update:success', {
        userId,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        user: {
          id: userId,
          ...profileData,
          profileCompleted: true,
          profileCompletedAt: new Date().toISOString()
        },
        message: 'Profile updated successfully'
      };
    } catch (error) {
      // Handle and log error
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'completeProfile',
        userId
      });
      
      // Log the profile update error
      this.eventBus.publish('api:profile:update:error', {
        userId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message || 'Failed to update profile'
      };
    }
  }
  
  /**
   * Verify a registration using a verification code
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Verification result
   */
  async verifyRegistration(code) {
    try {
      if (!code) {
        throw new Error('Verification code is required');
      }
      
      // Log the verification attempt
      this.eventBus.publish('api:verification:attempt', {
        code,
        timestamp: new Date().toISOString()
      });
      
      // In a real backend implementation, we would make an API call:
      // const response = await this.apiClient.post(ENDPOINTS.VERIFY, { code });
      
      // Instead, we'll simulate a verification response
      // For demonstration, we'll consider all codes starting with "valid" as valid
      const isValid = code.toLowerCase().startsWith('valid');
      
      if (isValid) {
        // Log successful verification
        this.eventBus.publish('api:verification:success', {
          code,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          message: 'Registration verified successfully'
        };
      } else {
        throw new Error('Invalid verification code');
      }
    } catch (error) {
      // Handle and log error
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'verifyRegistration',
        code
      });
      
      // Log the verification error
      this.eventBus.publish('api:verification:error', {
        code,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        error: error.message || 'Verification failed'
      };
    }
  }
  
  /**
   * Check if a username is available
   * @param {string} username - Username to check
   * @returns {Promise<Object>} Availability result
   */
  async checkUsernameAvailability(username) {
    try {
      if (!username) {
        throw new Error('Username is required');
      }
      
      // In a real backend implementation, we would make an API call:
      // const response = await this.apiClient.get(
      //   `${ENDPOINTS.CHECK_USERNAME}?username=${encodeURIComponent(username)}`
      // );
      
      // Simulate response based on username
      // For demonstration, we'll consider usernames containing "taken" as unavailable
      const isAvailable = !username.toLowerCase().includes('taken');
      
      return {
        success: true,
        available: isAvailable,
        message: isAvailable ? 'Username is available' : 'Username is already taken'
      };
    } catch (error) {
      // Handle and log error
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'checkUsernameAvailability',
        username
      });
      
      return {
        success: false,
        error: error.message || 'Failed to check username availability'
      };
    }
  }
  
  /**
   * Check if an email is available
   * @param {string} email - Email to check 
   * @returns {Promise<Object>} Availability result
   */
  async checkEmailAvailability(email) {
    try {
      if (!email) {
        throw new Error('Email is required');
      }
      
      // In a real backend implementation, we would make an API call:
      // const response = await this.apiClient.get(
      //   `${ENDPOINTS.CHECK_EMAIL}?email=${encodeURIComponent(email)}`
      // );
      
      // Simulate response based on email
      // For demonstration, we'll consider emails containing "taken" as unavailable
      const isAvailable = !email.toLowerCase().includes('taken');
      
      return {
        success: true,
        available: isAvailable,
        message: isAvailable ? 'Email is available' : 'Email is already registered'
      };
    } catch (error) {
      // Handle and log error
      this.errorHandler.handleError(error, {
        context: 'registration',
        action: 'checkEmailAvailability',
        email
      });
      
      return {
        success: false,
        error: error.message || 'Failed to check email availability'
      };
    }
  }
}

// Export and register the service
export default registry.register(
  'api.auth.RegistrationApi',
  new RegistrationApi(),
  ['api.ApiClient', 'utils.EventBus', 'utils.ErrorHandler'],
  {
    description: 'API client for user registration operations',
    provides: ['registration.api'],
    usage: `
      // Register with GitHub OAuth data
      const registrationApi = registry.getModule('api.auth.RegistrationApi');
      const { success, user } = await registrationApi.registerWithGitHub(githubData);
      
      // Complete user profile
      const { success } = await registrationApi.completeProfile(userId, profileData);
      
      // Check username availability
      const { available } = await registrationApi.checkUsernameAvailability('username');
    `
  }
); 