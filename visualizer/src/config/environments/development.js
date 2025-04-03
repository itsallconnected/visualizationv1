/**
 * Development environment configuration
 * 
 * This file contains environment-specific configuration overrides for development.
 */

export default {
  // Core system overrides for development
  'utils.ErrorHandler': {
    logToConsole: true,
    detailedErrors: true,
    captureStack: true,
    loggingEnabled: true,
    consoleOutputEnabled: true,
    remoteReportingEnabled: false
  },
  
  'utils.ModuleLoader': {
    cacheEnabled: false,
    retryOptions: {
      maxRetries: 5,
      retryDelay: 500,
      backoffFactor: 1.2
    },
    prefetchEnabled: false
  },
  
  // Visualization system overrides for development
  'visualization.VisualizationManager': {
    performanceMode: false,
    debugMode: true,
    showStats: true,
    showFPS: true,
    wireframeMode: false,
    highlightTransparent: true
  },
  
  'visualization.SceneManager': {
    antialiasing: true,
    showAxes: true,
    showGrid: true,
    shadows: false, // Disable shadows in dev for better performance
    backgroundColor: '#121212'
  },
  
  'visualization.InteractionManager': {
    debugClickEvents: true,
    highlightHovered: true,
    selectionOutlineColor: '#FF5722',
    hoverOutlineColor: '#00BCD4'
  },
  
  // Data system overrides for development
  'data.DataService': {
    useMockData: false,
    simulateLatency: false,
    latencyRange: [100, 500],
    cacheEnabled: false,
    validateResponses: true
  },
  
  // Authentication system overrides for development
  'auth.AuthService': {
    mockAuthentication: true,
    mockUser: {
      id: 'dev-user-1',
      name: 'Development User',
      email: 'dev@example.com',
      role: 'admin'
    },
    bypassPermissionChecks: false
  },
  
  // UI system overrides for development
  'components.AppLayout': {
    showDebugPanel: true,
    showDevTools: true,
    showGridOverlay: false,
    animationsEnabled: true
  }
}; 