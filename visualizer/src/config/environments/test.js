/**
 * Test environment configuration
 * 
 * This file contains environment-specific configuration overrides for testing.
 * Test environment prioritizes deterministic behavior, mocks, and isolation.
 */

export default {
  // Core system overrides for testing
  'utils.ErrorHandler': {
    logToConsole: true,
    detailedErrors: true,
    captureStack: true,
    loggingEnabled: true,
    consoleOutputEnabled: true,
    remoteReportingEnabled: false,
    throwOnError: true, // Make errors more visible in tests
    captureWarnings: true
  },
  
  'utils.ModuleLoader': {
    cacheEnabled: false, // Disable cache in tests for deterministic behavior
    retryOptions: {
      maxRetries: 0, // No retries in tests to fail fast
      retryDelay: 0
    },
    prefetchEnabled: false,
    mockModuleImports: true // Use mock imports in test environment
  },
  
  // Visualization system overrides for testing
  'visualization.VisualizationManager': {
    performanceMode: false,
    debugMode: true,
    showStats: false,
    showFPS: false,
    wireframeMode: false,
    useHeadlessRenderer: true, // Use headless renderer for tests
    mockThreeJS: true // Use Three.js mocks in test environment
  },
  
  'visualization.SceneManager': {
    antialiasing: false,
    showAxes: false,
    showGrid: false,
    shadows: false,
    backgroundColor: '#121212',
    renderOnlyOnChange: true, // Only render when something changes
    skipEffects: true // Skip visual effects in tests
  },
  
  'visualization.InteractionManager': {
    debugClickEvents: true,
    highlightHovered: false,
    mockInteractions: true, // Use mock interactions for testing
    testingHelpers: true // Enable testing helper methods
  },
  
  // Data system overrides for testing
  'data.DataService': {
    useMockData: true, // Always use mock data in tests
    mockDataPath: './mockData',
    simulateLatency: false,
    cacheEnabled: false,
    useFixtures: true, // Use test fixtures instead of actual data
    validateResponses: true // Validate all responses in test environment
  },
  
  // Authentication system overrides for testing
  'auth.AuthService': {
    mockAuthentication: true,
    mockUser: {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin'
    },
    bypassPermissionChecks: true, // Skip permission checks in tests
    sessionTimeout: 3600 // Long timeout for tests
  },
  
  // UI system overrides for testing
  'components.AppLayout': {
    showDebugPanel: false,
    showDevTools: false,
    showGridOverlay: false,
    animationsEnabled: false, // Disable animations for deterministic testing
    useTestIdAttributes: true // Add test IDs for test selectors
  },
  
  // Test-specific configurations
  'test.TestEnvironment': {
    autoMockModules: true,
    isolateTests: true,
    clearStorageBetweenTests: true,
    muteConsoleInTests: false,
    snapshotFormat: 'pretty',
    failOnConsoleErrors: true,
    timers: 'fake', // Use fake timers in tests
    coverageThreshold: 80 // Minimum test coverage percentage
  }
}; 