/**
 * Production environment configuration
 * 
 * This file contains environment-specific configuration overrides for production.
 * In production, we prioritize performance, security, and stability.
 */

export default {
  // Core system overrides for production
  'utils.ErrorHandler': {
    logToConsole: false,
    detailedErrors: false,
    captureStack: true,
    loggingEnabled: true,
    consoleOutputEnabled: false,
    remoteReportingEnabled: true,
    sampleRate: 0.1, // Only report 10% of errors to reduce load
    ignoreWarnings: true
  },
  
  'utils.ModuleLoader': {
    cacheEnabled: true,
    retryOptions: {
      maxRetries: 2,
      retryDelay: 1000,
      backoffFactor: 2.0
    },
    prefetchEnabled: true,
    prefetchCriticalModules: true
  },
  
  // Visualization system overrides for production
  'visualization.VisualizationManager': {
    performanceMode: true,
    debugMode: false,
    showStats: false,
    showFPS: false,
    wireframeMode: false,
    highlightTransparent: false,
    lodEnabled: true,
    maxVisibleNodes: 1000
  },
  
  'visualization.SceneManager': {
    antialiasing: true,
    showAxes: false,
    showGrid: false,
    shadows: false,
    backgroundColor: '#121212',
    optimizeForPerformance: true,
    useSharedGeometries: true
  },
  
  'visualization.InteractionManager': {
    debugClickEvents: false,
    highlightHovered: true,
    selectionOutlineColor: '#FF5722',
    hoverOutlineColor: '#00BCD4',
    throttleEvents: true,
    throttleDelay: 50
  },
  
  // Data system overrides for production
  'data.DataService': {
    useMockData: false,
    simulateLatency: false,
    cacheEnabled: true,
    cacheTTL: 3600, // 1 hour cache for production
    validateResponses: false, // Skip validation in production for performance
    batchRequests: true,
    compressionEnabled: true
  },
  
  // Authentication system overrides for production
  'auth.AuthService': {
    mockAuthentication: false,
    sessionTimeout: 60, // 60 minutes
    refreshTokens: true,
    secureCookies: true,
    bypassPermissionChecks: false,
    enforceStrictPermissions: true
  },
  
  // UI system overrides for production
  'components.AppLayout': {
    showDebugPanel: false,
    showDevTools: false,
    showGridOverlay: false,
    animationsEnabled: true,
    optimizeRendering: true,
    disableDeveloperWarnings: true
  },
  
  // Analytics configuration for production
  'analytics.AnalyticsService': {
    enabled: true,
    anonymizeIp: true,
    trackErrors: true,
    trackPerformance: true,
    trackNavigation: true,
    sampleRate: 1.0,
    consentRequired: true
  }
}; 