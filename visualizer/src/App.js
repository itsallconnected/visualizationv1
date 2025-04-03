import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import registry from './ModuleRegistry';
import { useAuth } from './auth/AuthContext';

// Route constants
const ROUTES = {
  HOME: '/',
  VISUALIZATION: '/visualization',
  ADMIN: '/admin',
  MODULE_OVERVIEW: '/modules',
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth-callback',
};

function App() {
  const { isAuthenticated, user, loading: authLoading, error: authError } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [moduleRegistry, setModuleRegistry] = useState({ loaded: false, components: {} });
  const [registryError, setRegistryError] = useState(null);
  
  // Update path when URL changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    
    // Listen for URL changes
    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);
  
  // Load components from registry when the app starts
  useEffect(() => {
    try {
      // Get specific components we need - registry was already initialized in index.js
      const AppLayout = registry.getModule('components.AppLayout');
      const Sidebar = registry.getModule('components.Sidebar');
      const VisualizationContainer = registry.getModule('components.VisualizationContainer');
      const ModuleOverview = registry.getModule('components.ModuleOverview');
      
      if (!AppLayout) {
        setRegistryError('AppLayout component not found in registry');
      } else if (!Sidebar) {
        setRegistryError('Sidebar component not found in registry');
      } else if (!VisualizationContainer) {
        setRegistryError('VisualizationContainer component not found in registry');
      } else {
        setModuleRegistry({
          loaded: true,
          components: {
            AppLayout,
            Sidebar,
            VisualizationContainer,
            ModuleOverview: ModuleOverview || null,
          }
        });
      }
    } catch (error) {
      console.error('Error loading components from registry:', error);
      setRegistryError(`Error loading components: ${error.message}`);
    }
  }, []);
  
  // Handle navigation
  const handleNavigate = useCallback((path) => {
    // Update URL and state
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  }, []);
  
  // Check if route requires authentication and user is not authenticated
  const needsAuthentication = useCallback((path) => {
    return (path === ROUTES.VISUALIZATION || path === ROUTES.ADMIN) && !isAuthenticated;
  }, [isAuthenticated]);
  
  // Define navigation items for the sidebar
  const navigationItems = [
    { path: ROUTES.HOME, label: 'Home', icon: '🏠' },
    { path: ROUTES.VISUALIZATION, label: 'Visualization', icon: '🔍' },
    { path: ROUTES.ADMIN, label: 'Admin', icon: '⚙️', requiresAuth: true },
    { path: ROUTES.MODULE_OVERVIEW, label: 'Modules', icon: '📦' },
    ...(isAuthenticated 
      ? [{ path: '#signout', label: 'Sign Out', icon: '🚪', action: 'signOut' }]
      : [{ path: ROUTES.LOGIN, label: 'Login', icon: '🔑' }]),
  ];
  
  // If authentication is still loading, show loading indicator
  if (authLoading) {
    return <div className="loading">Checking authentication...</div>;
  }
  
  // If registry failed to load, show error
  if (registryError) {
    return <div className="error">
      <h2>Application Error</h2>
      <p>{registryError}</p>
      <p>Please check the console for more details.</p>
    </div>;
  }
  
  // If modules are not loaded yet, show loading
  if (!moduleRegistry.loaded) {
    return <div className="loading">Loading application modules...</div>;
  }
  
  // Get components from registry
  const { AppLayout, Sidebar, VisualizationContainer, ModuleOverview } = moduleRegistry.components;
  
  // If the current path requires authentication but user is not authenticated, redirect to login
  if (needsAuthentication(currentPath)) {
    // Save the requested path for redirect after login
    if (currentPath !== ROUTES.LOGIN) {
      sessionStorage.setItem('redirectAfterLogin', currentPath);
      handleNavigate(ROUTES.LOGIN);
    }
  }
  
  // Render different content based on current path
  const renderContent = () => {
    // Handle auth callback paths separately
    if (currentPath === ROUTES.AUTH_CALLBACK) {
      return <div className="loading">Processing authentication...</div>;
    }
    
    // Handle other routes
    switch (currentPath) {
      case ROUTES.VISUALIZATION:
        // Only show visualization if user is authenticated
        if (!isAuthenticated) {
          return <div className="auth-required">
            <h2>Authentication Required</h2>
            <p>Please log in to access the visualization.</p>
          </div>;
        }
        
        return VisualizationContainer ? (
          <VisualizationContainer 
            onContainerReady={() => console.log('Container ready')}
            user={user}
          />
        ) : (
          <div>Visualization component not found in registry</div>
        );
        
      case ROUTES.ADMIN:
        // Only show admin panel if user is authenticated
        if (!isAuthenticated) {
          return <div className="auth-required">
            <h2>Authentication Required</h2>
            <p>Please log in to access the admin panel.</p>
          </div>;
        }
        
        // Get admin panel component if it exists
        const AdminPanel = registry.getModule('admin.AdminPanel');
        
        if (AdminPanel) {
          return <AdminPanel user={user} />;
        }
        
        return <div>Admin Panel (Not fully implemented yet)</div>;
        
      case ROUTES.MODULE_OVERVIEW:
        return ModuleOverview ? (
          <ModuleOverview />
        ) : (
          <div>Module Overview component not found in registry</div>
        );
      
      case ROUTES.LOGIN:
        // If already authenticated, redirect to home
        if (isAuthenticated) {
          // Check if there's a redirect after login
          const redirectPath = sessionStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            sessionStorage.removeItem('redirectAfterLogin');
            handleNavigate(redirectPath);
            return <div className="loading">Redirecting...</div>;
          }
          
          // Otherwise go to home
          handleNavigate(ROUTES.HOME);
          return <div className="loading">Redirecting...</div>;
        }
        
        return <div className="login-container">
          <h2>GitHub Authentication</h2>
          <p>Click the button below to log in with GitHub:</p>
          {authError && <div className="auth-error">{authError}</div>}
          <button 
            className="github-login-btn"
            onClick={() => {
              // Get AuthService to handle GitHub OAuth login
              const authService = registry.getModule('auth.AuthService');
              if (authService) {
                authService.initiateGitHubLogin();
              } else {
                console.error('Auth service not found');
              }
            }}
          >
            Login with GitHub
          </button>
        </div>;
        
      default:
        return (
          <div className="home-page">
            <h1>AI Alignment Visualization</h1>
            <p>Welcome to the AI Alignment Visualization platform.</p>
            <p>Use the sidebar navigation to explore the application.</p>
            <div className="registry-info">
              <h2>Module Registry Info</h2>
              <p>Total registered modules: {Object.keys(registry.getAllModules()).length}</p>
            </div>
          </div>
        );
    }
  };
  
  // Handle special navigation actions
  const handleNavAction = useCallback((action) => {
    if (action === 'signOut') {
      const { signOut } = useAuth();
      if (signOut) {
        signOut().then(() => {
          // Redirect to home after sign out
          handleNavigate(ROUTES.HOME);
        }).catch(error => {
          console.error('Error signing out:', error);
        });
      } else {
        // Fallback if useAuth doesn't provide signOut
        const authService = registry.getModule('auth.AuthService');
        if (authService) {
          authService.signOut().then(() => {
            // Redirect to home after sign out
            handleNavigate(ROUTES.HOME);
          }).catch(error => {
            console.error('Error signing out:', error);
          });
        }
      }
    }
  }, [handleNavigate]);
  
  // Main application layout
  return AppLayout ? (
    <AppLayout
      sidebar={
        Sidebar ? (
          <Sidebar 
            navigationItems={navigationItems}
            onNavigate={(path, action) => {
              if (action) {
                handleNavAction(action);
              } else {
                handleNavigate(path);
              }
            }}
            currentPath={currentPath}
            user={user}
          />
        ) : (
          <div>Sidebar component not found in registry</div>
        )
      }
      user={user}
      isAuthenticated={isAuthenticated}
    >
      {renderContent()}
    </AppLayout>
  ) : (
    <div className="error">AppLayout component not found in registry</div>
  );
}

export default App; 