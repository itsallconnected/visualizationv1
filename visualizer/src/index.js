// Entry point for the React application
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import APP_SETTINGS from './config/app-settings';
import registry from './ModuleRegistry';
import { AuthProvider } from './auth/AuthContext';

// Import core services first to ensure they're registered
import './utils/EventBus';
import './utils/ErrorHandler';
import './api/GitHubService';
import './auth/AuthService';
import './api/AuthApi';
import './api/ApiClient';

// Import data services that depend on API services
import './data/DataService';
import './data/NodeRepository';
import './data/GraphDataGenerator';

// Import registry validator in development environment
import { runValidation } from './testing/registry-validator';

/**
 * Initializes core services in the correct dependency order.
 * Returns a promise that resolves when all required services are initialized.
 */
const initializeServices = async () => {
  try {
    console.log('Initializing services...');
    const startTime = performance.now();
    
    // 1. Discover all registered modules
    const discoveredModules = registry.discoverModules();
    console.log(`Discovered ${Object.keys(discoveredModules).length} modules`);
    
    // 2. Validate registry in development mode
    if (APP_SETTINGS.app.environment === 'development') {
      console.log('Running registry validation check...');
      try {
        const validationPassed = runValidation();
        
        if (!validationPassed) {
          console.warn('Registry validation found issues. Application may not function correctly.');
        }
      } catch (validationError) {
        console.error('Registry validation error:', validationError);
      }
    }
    
    // 3. Define required services in initialization order
    const requiredServices = [
      'utils.EventBus',
      'utils.ErrorHandler',
      'api.GitHubService',
      'auth.AuthService',
      'api.AuthApi',
      'api.ApiClient',
      'data.DataService',
      'data.NodeRepository',
      'data.GraphDataGenerator'
    ];
    
    // 4. Check if all required services are registered
    const missingServices = requiredServices.filter(
      serviceName => !registry.getModule(serviceName)
    );
    
    if (missingServices.length > 0) {
      throw new Error(`Missing required services: ${missingServices.join(', ')}`);
    }
    
    // 5. Initialize services in the correct order
    
    // 5.1 EventBus first, as many services depend on it
    const eventBus = registry.getModule('utils.EventBus');
    console.log('EventBus ready');
    
    // 5.2 Error handler, which may need EventBus
    const errorHandler = registry.getModule('utils.ErrorHandler');
    if (errorHandler && errorHandler.initialize) {
      await errorHandler.initialize();
      console.log('ErrorHandler initialized');
    }
    
    // 5.3 Initialize GitHub service, which others depend on
    const githubService = registry.getModule('api.GitHubService');
    const githubInitialized = await githubService.initialize();
    if (!githubInitialized) {
      console.warn('GitHub service initialization had issues');
    } else {
      console.log('GitHub service initialized');
    }
    
    // 5.4 Initialize auth service
    const authService = registry.getModule('auth.AuthService');
    await authService.initialize();
    console.log('Authentication service initialized');
    
    // 5.5 Initialize auth API
    const authApi = registry.getModule('api.AuthApi');
    authApi.initialize();
    console.log('Auth API initialized');
    
    // 5.6 Initialize API client
    const apiClient = registry.getModule('api.ApiClient');
    if (apiClient && apiClient.initialize) {
      await apiClient.initialize();
      console.log('API client initialized');
    }
    
    // 5.7 Get token and pass to GitHub service if user is authenticated
    const token = authService.getAccessToken();
    if (token) {
      githubService.setAccessToken(token);
      console.log('Applied authentication token to GitHub service');
    }
    
    // 5.8 Initialize data service
    const dataService = registry.getModule('data.DataService');
    await dataService.initialize();
    console.log('Data service initialized');
    
    // 5.9 Initialize node repository
    const nodeRepository = registry.getModule('data.NodeRepository');
    if (nodeRepository) {
      await nodeRepository.initialize();
      console.log('Node repository initialized');
    }
    
    // 5.10 Initialize graph data generator
    const graphDataGenerator = registry.getModule('data.GraphDataGenerator');
    if (graphDataGenerator) {
      await graphDataGenerator.initialize();
      console.log('Graph data generator initialized');
    }
    
    // 6. Preload data if enabled (non-blocking)
    if (APP_SETTINGS.cache.enabled) {
      try {
        dataService.loadData()
          .then(() => console.log('Initial data preloaded'))
          .catch(err => console.warn('Initial data preload failed:', err));
      } catch (preloadError) {
        console.warn('Error starting data preload:', preloadError);
      }
    }
    
    const endTime = performance.now();
    console.log(`All services initialized successfully in ${(endTime - startTime).toFixed(2)}ms`);
    
    // 7. Register unload handlers for cleanup
    window.addEventListener('beforeunload', () => {
      // Clean up services that need it
      if (githubService.cleanup) githubService.cleanup();
      if (authService.cleanUp) authService.cleanUp();
    });
    
    return true;
  } catch (error) {
    console.error('Error initializing services:', error);
    
    // Try to notify via EventBus if available
    try {
      const eventBus = registry.getModule('utils.EventBus');
      if (eventBus) {
        eventBus.publish('app:initializationError', {
          message: error.message,
          error
        });
      }
    } catch (eventBusError) {
      // Just log if even EventBus fails
      console.error('Failed to publish error event:', eventBusError);
    }
    
    throw error;
  }
};

// Initialize services and then render the app
initializeServices().then(() => {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}).catch(error => {
  console.error('Fatal error during initialization:', error);
  
  // Render error state in the DOM
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <div className="fatal-error">
      <h1>Application Error</h1>
      <p>A fatal error occurred while initializing the application:</p>
      <p className="error-message">{error.message}</p>
      <details>
        <summary>Technical Details</summary>
        <pre>{error.stack}</pre>
      </details>
      <p>Please check the console for more details.</p>
    </div>
  );
}); 