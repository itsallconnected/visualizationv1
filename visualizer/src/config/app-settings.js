/**
 * Application Settings and Configuration
 * 
 * This module provides centralized configuration for the AI Alignment Visualization application.
 * It handles environment-specific settings, feature flags, and configurable parameters
 * that can be modified without code changes.
 * 
 * Configuration categories:
 * - Application metadata and core settings
 * - Deployment and hosting configuration
 * - Authentication and security settings
 * - Feature toggles and capabilities
 * - Visualization appearance and behavior
 * - Data source configuration
 * - Performance and caching options
 * - Accessibility settings
 * - Analytics and telemetry
 * - Localization and internationalization
 */

/**
 * Get environment variable with fallback
 * @param {string} name - Environment variable name
 * @param {*} fallback - Fallback value if not defined
 * @returns {*} Environment variable value or fallback
 */
const env = (name, fallback) => {
  const value = process.env[`REACT_APP_${name}`] || process.env[name];
  return value !== undefined ? value : fallback;
};

/**
 * Parse boolean environment variable
 * @param {string} name - Environment variable name
 * @param {boolean} fallback - Fallback value if not defined
 * @returns {boolean} Parsed boolean value
 */
const envBool = (name, fallback) => {
  const value = env(name);
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
};

/**
 * Parse numeric environment variable
 * @param {string} name - Environment variable name
 * @param {number} fallback - Fallback value if not defined
 * @returns {number} Parsed numeric value
 */
const envNum = (name, fallback) => {
  const value = env(name);
  if (value === undefined) return fallback;
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Build timestamp for version tracking
const BUILD_TIMESTAMP = new Date().toISOString();

const APP_SETTINGS = {
  /**
   * Application metadata
   * Core information about the application
   */
  app: {
    name: env('APP_NAME', 'AI Alignment Visualization'),
    version: env('APP_VERSION', '0.1.0'),
    buildNumber: env('BUILD_NUMBER', null),
    buildTimestamp: env('BUILD_TIMESTAMP', BUILD_TIMESTAMP),
    environment: env('ENV', process.env.NODE_ENV || 'development'),
    baseUrl: env('BASE_URL', window.location.origin),
    apiUrl: env('API_URL', null),
    docsUrl: env('DOCS_URL', 'https://github.com/username/ai-alignment-visualization/docs'),
    contactEmail: env('CONTACT_EMAIL', 'example@example.com'),
    copyrightYear: new Date().getFullYear(),
  },
  
  /**
   * Deployment info
   * Configuration for hosting and deployment services
   */
  deployment: {
    provider: env('DEPLOYMENT_PROVIDER', 'aws-amplify'),
    hostingOnly: envBool('HOSTING_ONLY', true),
    region: env('AWS_REGION', 'us-east-1'),
    cdnEnabled: envBool('CDN_ENABLED', true),
    serverlessEnabled: envBool('SERVERLESS_ENABLED', false),
    previewEnvironmentsEnabled: envBool('PREVIEW_ENVS_ENABLED', true),
  },
  
  /**
   * GitHub integration
   * Settings for GitHub repository and API access
   */
  github: {
    repository: env('GITHUB_REPO', 'username/ai-alignment-visualization'),
    branch: env('GITHUB_BRANCH', 'main'),
    apiUrl: env('GITHUB_API_URL', 'https://api.github.com'),
    contentPath: env('GITHUB_CONTENT_PATH', ''),
    accessTokenEnabled: envBool('GITHUB_TOKEN_ENABLED', false),
  },
  
  /**
   * Authentication configuration
   * Settings for user authentication and authorization
   */
  auth: {
    enabled: envBool('AUTH_ENABLED', true),
    provider: env('AUTH_PROVIDER', 'github'),
    clientId: env('GITHUB_CLIENT_ID'),
    redirectUri: env('AUTH_REDIRECT_URI', `${window.location.origin}/auth-callback`),
    scopes: env('AUTH_SCOPES', 'read:user,user:email,repo').split(','),
    oauthProxyUrl: env('OAUTH_PROXY_URL'),
    sessionTimeoutMinutes: envNum('SESSION_TIMEOUT', 60),
    refreshTokenEnabled: envBool('REFRESH_TOKEN_ENABLED', true),
    persistSession: envBool('PERSIST_SESSION', true),
    requiredRolesForEditing: env('REQUIRED_ROLES_EDITING', 'admin,editor').split(','),
  },
  
  /**
   * Feature flags
   * Toggles for enabling/disabling specific features
   */
  features: {
    // Content encryption
    encryption: {
      enabled: envBool('ENABLE_ENCRYPTION', false),
      algorithm: env('ENCRYPTION_ALGORITHM', 'AES-256'),
      iterations: envNum('ENCRYPTION_ITERATIONS', 1000),
      keyLength: envNum('ENCRYPTION_KEY_LENGTH', 256),
      saltLength: envNum('ENCRYPTION_SALT_LENGTH', 16),
      pbkdf2Enabled: envBool('PBKDF2_ENABLED', true),
    },
    
    // Version control
    versioning: {
      enabled: envBool('ENABLE_VERSIONING', false),
      keepVersionCount: envNum('VERSION_HISTORY_COUNT', 10),
      diffVisualization: envBool('DIFF_VISUALIZATION', true),
      autoSaveEnabled: envBool('AUTO_SAVE', true),
      autoSaveIntervalMinutes: envNum('AUTO_SAVE_INTERVAL', 5),
    },
    
    // Multi-sphere visualization
    multiSphere: {
      enabled: envBool('ENABLE_MULTI_SPHERE', false),
      maxSpheres: envNum('MAX_SPHERES', 100),
      crossSphereLinks: envBool('CROSS_SPHERE_LINKS', true),
      sphereNavigation: envBool('SPHERE_NAVIGATION', true),
      sphereGroups: envBool('SPHERE_GROUPS', true),
    },
    
    // Administration
    adminPanel: {
      enabled: envBool('ENABLE_ADMIN', false),
      analyticsEnabled: envBool('ADMIN_ANALYTICS', true),
      userManagementEnabled: envBool('USER_MANAGEMENT', true),
      contentModerationEnabled: envBool('CONTENT_MODERATION', true),
      systemConfigEnabled: envBool('SYSTEM_CONFIG', true),
    },
    
    // Editing and content management
    editing: {
      enabled: envBool('ENABLE_EDITING', true),
      markdownEnabled: envBool('MARKDOWN_ENABLED', true),
      richTextEnabled: envBool('RICH_TEXT_ENABLED', true),
      imageUploadEnabled: envBool('IMAGE_UPLOAD', false),
      attachmentsEnabled: envBool('ATTACHMENTS', false),
      maxAttachmentSizeMB: envNum('MAX_ATTACHMENT_SIZE', 5),
    },
    
    // Search functionality
    search: {
      enabled: envBool('ENABLE_SEARCH', true),
      fuzzySearchEnabled: envBool('FUZZY_SEARCH', true),
      advancedFilters: envBool('ADVANCED_FILTERS', true),
      fullTextSearch: envBool('FULL_TEXT_SEARCH', true),
      searchHistory: envBool('SEARCH_HISTORY', true),
      maxSearchResults: envNum('MAX_SEARCH_RESULTS', 100),
    },
    
    // Export functionality
    export: {
      enabled: envBool('ENABLE_EXPORT', true),
      formats: env('EXPORT_FORMATS', 'json,csv,png,svg').split(','),
      highResEnabled: envBool('HIGH_RES_EXPORT', true),
      metadataIncluded: envBool('EXPORT_METADATA', true),
    },
    
    // User preferences
    userPreferences: {
      enabled: envBool('USER_PREFERENCES', true),
      themeSwitching: envBool('THEME_SWITCHING', true),
      layoutCustomization: envBool('LAYOUT_CUSTOMIZATION', true),
      persistPreferences: envBool('PERSIST_PREFERENCES', true),
    },
    
    // Collaboration features
    collaboration: {
      enabled: envBool('ENABLE_COLLABORATION', false),
      commentsEnabled: envBool('COMMENTS_ENABLED', false),
      sharingEnabled: envBool('SHARING_ENABLED', false),
      changeRequestsEnabled: envBool('CHANGE_REQUESTS', false),
    },
  },
  
  /**
   * Accessibility settings
   * Configuration for accessibility features and compliance
   */
  accessibility: {
    highContrastModeSupport: envBool('HIGH_CONTRAST_SUPPORT', true),
    reducedMotionSupport: envBool('REDUCED_MOTION_SUPPORT', true),
    screenReaderOptimizations: envBool('SCREEN_READER_OPTIMIZATIONS', true),
    keyboardNavigationEnhanced: envBool('ENHANCED_KEYBOARD_NAV', true),
    textToSpeechEnabled: envBool('TEXT_TO_SPEECH', false),
    minFontSizePx: envNum('MIN_FONT_SIZE', 12),
    focusIndicatorsEnhanced: envBool('ENHANCED_FOCUS', true),
    ariaLiveRegions: envBool('ARIA_LIVE_REGIONS', true),
  },
  
  /**
   * Analytics and telemetry
   * Configuration for usage tracking and analytics
   */
  analytics: {
    enabled: envBool('ANALYTICS_ENABLED', false),
    provider: env('ANALYTICS_PROVIDER', 'none'), // 'none', 'ga', 'amplitude', 'custom'
    trackingId: env('ANALYTICS_TRACKING_ID', ''),
    anonymizeIp: envBool('ANONYMIZE_IP', true),
    consentRequired: envBool('CONSENT_REQUIRED', true),
    errorTracking: envBool('ERROR_TRACKING', true),
    performanceTracking: envBool('PERFORMANCE_TRACKING', true),
    userActionsTracking: envBool('USER_ACTIONS_TRACKING', false),
    sessionDurationTracking: envBool('SESSION_DURATION', true),
  },
  
  /**
   * Localization settings
   * Configuration for internationalization and localization
   */
  localization: {
    enabled: envBool('LOCALIZATION_ENABLED', false),
    defaultLocale: env('DEFAULT_LOCALE', 'en-US'),
    supportedLocales: env('SUPPORTED_LOCALES', 'en-US').split(','),
    translationPath: env('TRANSLATION_PATH', '/locales'),
    fallbackToDefault: envBool('FALLBACK_TO_DEFAULT', true),
    detectBrowserLocale: envBool('DETECT_BROWSER_LOCALE', true),
    localizedRoutes: envBool('LOCALIZED_ROUTES', false),
    dateTimeLocalization: envBool('DATETIME_LOCALIZATION', true),
  },
  
  /**
   * Visualization settings
   * Configuration for the visualization appearance and behavior
   */
  visualization: {
    // Appearance
    colors: {
      background: env('VIZ_BG_COLOR', '#121212'),
      node: {
        component_group: env('VIZ_COLOR_COMPONENT_GROUP', '#673AB7'),
        component: env('VIZ_COLOR_COMPONENT', '#4285F4'),
        subcomponent: env('VIZ_COLOR_SUBCOMPONENT', '#34A853'),
        capability: env('VIZ_COLOR_CAPABILITY', '#FBBC05'),
        function: env('VIZ_COLOR_FUNCTION', '#EA4335'),
        specification: env('VIZ_COLOR_SPECIFICATION', '#8F00FF'),
        integration: env('VIZ_COLOR_INTEGRATION', '#00BCD4'),
        technique: env('VIZ_COLOR_TECHNIQUE', '#FF9800'),
        application: env('VIZ_COLOR_APPLICATION', '#E91E63'),
        input: env('VIZ_COLOR_INPUT', '#4CAF50'),
        output: env('VIZ_COLOR_OUTPUT', '#9C27B0'),
      },
      link: {
        default: env('VIZ_COLOR_LINK_DEFAULT', '#FFFFFF'),
        contains: env('VIZ_COLOR_LINK_CONTAINS', '#AAAAAA'),
        implements: env('VIZ_COLOR_LINK_IMPLEMENTS', '#76FF03'),
        depends_on: env('VIZ_COLOR_LINK_DEPENDS', '#FF5722'),
        communicates_with: env('VIZ_COLOR_LINK_COMMUNICATES', '#03A9F4'),
        relates_to: env('VIZ_COLOR_LINK_RELATES', '#9E9E9E'),
      },
      text: env('VIZ_COLOR_TEXT', '#FFFFFF'),
      highlight: env('VIZ_COLOR_HIGHLIGHT', '#FFEB3B'),
      selection: env('VIZ_COLOR_SELECTION', '#00BFA5'),
      secondary: {
        background: env('VIZ_BG_COLOR_SECONDARY', '#1E1E1E'),
        text: env('VIZ_TEXT_COLOR_SECONDARY', '#E0E0E0'),
      },
    },
    
    // Node sizing
    nodeSize: {
      component_group: envNum('VIZ_SIZE_COMPONENT_GROUP', 14),
      component: envNum('VIZ_SIZE_COMPONENT', 12),
      subcomponent: envNum('VIZ_SIZE_SUBCOMPONENT', 10),
      capability: envNum('VIZ_SIZE_CAPABILITY', 8),
      function: envNum('VIZ_SIZE_FUNCTION', 7),
      specification: envNum('VIZ_SIZE_SPECIFICATION', 6),
      integration: envNum('VIZ_SIZE_INTEGRATION', 5),
      technique: envNum('VIZ_SIZE_TECHNIQUE', 4),
      application: envNum('VIZ_SIZE_APPLICATION', 3),
      input: envNum('VIZ_SIZE_INPUT', 2),
      output: envNum('VIZ_SIZE_OUTPUT', 2),
      minSize: envNum('VIZ_NODE_MIN_SIZE', 1),
      maxSize: envNum('VIZ_NODE_MAX_SIZE', 20),
      selectionScaleFactor: envNum('VIZ_SELECTION_SCALE', 1.2),
    },
    
    // Animation settings
    animation: {
      enabled: envBool('VIZ_ANIMATIONS', true),
      duration: envNum('VIZ_ANIMATION_DURATION', 500),
      easing: env('VIZ_ANIMATION_EASING', 'easeInOutCubic'),
      nodeEntrance: env('VIZ_NODE_ENTRANCE', 'fadeIn'),
      nodeExit: env('VIZ_NODE_EXIT', 'fadeOut'),
      staggerDelay: envNum('VIZ_STAGGER_DELAY', 50),
      maxConcurrentAnimations: envNum('VIZ_MAX_CONCURRENT_ANIMS', 50),
      performanceMode: envBool('VIZ_PERFORMANCE_MODE', true),
    },
    
    // Layout configuration
    layout: {
      algorithm: env('VIZ_LAYOUT_ALGORITHM', 'hierarchical'),
      nodeSpacing: envNum('VIZ_NODE_SPACING', 150),
      levelSeparation: envNum('VIZ_LEVEL_SEPARATION', 200),
      hierarchicalDirection: env('VIZ_HIERARCHICAL_DIR', 'UD'), // UD=Up-Down, DU=Down-Up, LR=Left-Right, RL=Right-Left
      forceConfig: {
        gravitationalConstant: envNum('VIZ_FORCE_GRAVITY', -500),
        centralGravity: envNum('VIZ_FORCE_CENTRAL_GRAVITY', 0.1),
        springLength: envNum('VIZ_FORCE_SPRING_LENGTH', 200),
        springConstant: envNum('VIZ_FORCE_SPRING_CONSTANT', 0.05),
        damping: envNum('VIZ_FORCE_DAMPING', 0.09),
      },
      clusterConfig: {
        enabled: envBool('VIZ_CLUSTERING', true),
        clusterByNodeType: envBool('VIZ_CLUSTER_BY_TYPE', true),
        clusterIfNodesExceed: envNum('VIZ_CLUSTER_THRESHOLD', 100),
      },
      adaptiveLayout: envBool('VIZ_ADAPTIVE_LAYOUT', true),
    },
    
    // Camera settings
    camera: {
      initialDistance: envNum('VIZ_CAMERA_DISTANCE', 1000),
      minDistance: envNum('VIZ_CAMERA_MIN_DISTANCE', 100),
      maxDistance: envNum('VIZ_CAMERA_MAX_DISTANCE', 5000),
      fov: envNum('VIZ_CAMERA_FOV', 75),
      rotationEnabled: envBool('VIZ_CAMERA_ROTATION', true),
      autoRotate: envBool('VIZ_AUTO_ROTATE', false),
      autoRotateSpeed: envNum('VIZ_AUTO_ROTATE_SPEED', 1.0),
      dampingFactor: envNum('VIZ_CAMERA_DAMPING', 0.05),
      panEnabled: envBool('VIZ_CAMERA_PAN', true),
      zoomEnabled: envBool('VIZ_CAMERA_ZOOM', true),
    },
    
    // Rendering options
    rendering: {
      antialiasing: envBool('VIZ_ANTIALIASING', true),
      shadows: envBool('VIZ_SHADOWS', false),
      hdr: envBool('VIZ_HDR', false),
      bloom: envBool('VIZ_BLOOM', false),
      outlineEffect: envBool('VIZ_OUTLINE', true),
      highQualityMode: envBool('VIZ_HIGH_QUALITY', false),
      maxFPS: envNum('VIZ_MAX_FPS', 60),
      useWebGL2: envBool('VIZ_WEBGL2', true),
      powerPreference: env('VIZ_POWER_PREFERENCE', 'default'), // 'default', 'high-performance', 'low-power'
      lodLevels: envNum('VIZ_LOD_LEVELS', 3),
    },
    
    // Interaction settings
    interaction: {
      hoverEffectEnabled: envBool('VIZ_HOVER_EFFECT', true),
      clickToSelect: envBool('VIZ_CLICK_SELECT', true),
      doubleClickToExpand: envBool('VIZ_DBLCLICK_EXPAND', true),
      zoomToNode: envBool('VIZ_ZOOM_TO_NODE', true),
      mouseWheelZoom: envBool('VIZ_MOUSE_WHEEL_ZOOM', true),
      pinchToZoom: envBool('VIZ_PINCH_ZOOM', true),
      dragToMove: envBool('VIZ_DRAG_MOVE', true),
      hoverDelay: envNum('VIZ_HOVER_DELAY', 200),
      selectionHighlight: envBool('VIZ_SELECTION_HIGHLIGHT', true),
      tooltipsEnabled: envBool('VIZ_TOOLTIPS', true),
      mouseOverHighlight: envBool('VIZ_MOUSEOVER_HIGHLIGHT', true),
    },
    
    // Labels and text
    labels: {
      showLabels: envBool('VIZ_SHOW_LABELS', true),
      font: env('VIZ_LABEL_FONT', 'Arial'),
      fontSize: envNum('VIZ_LABEL_FONT_SIZE', 12),
      fontWeight: env('VIZ_LABEL_FONT_WEIGHT', 'normal'),
      maxLabelLength: envNum('VIZ_MAX_LABEL_LENGTH', 30),
      truncationIndicator: env('VIZ_LABEL_TRUNCATION', '...'),
      nodeLabelPosition: env('VIZ_LABEL_POSITION', 'below'), // 'inside', 'below', 'above', 'right', 'left'
      background: envBool('VIZ_LABEL_BACKGROUND', true),
      showTypeLabels: envBool('VIZ_TYPE_LABELS', false),
      showTags: envBool('VIZ_SHOW_TAGS', true),
      maxTagsShown: envNum('VIZ_MAX_TAGS', 3),
    },
    
    // Performance
    performance: {
      maxVisibleNodes: envNum('VIZ_MAX_VISIBLE_NODES', 500),
      maxVisibleLinks: envNum('VIZ_MAX_VISIBLE_LINKS', 1000),
      lowPerformanceMode: envBool('VIZ_LOW_PERF_MODE', false),
      adaptiveDetail: envBool('VIZ_ADAPTIVE_DETAIL', true),
      lodThresholds: env('VIZ_LOD_THRESHOLDS', '100,500,1000').split(',').map(Number),
      workerEnabled: envBool('VIZ_WORKERS', true),
      useOffscreenCanvas: envBool('VIZ_OFFSCREEN_CANVAS', false),
      useBatchRendering: envBool('VIZ_BATCH_RENDERING', true),
      useOctree: envBool('VIZ_OCTREE', true),
    },
  },
  
  /**
   * Caching settings
   * Configuration for data caching and storage
   */
  cache: {
    enabled: envBool('CACHE_ENABLED', true),
    ttl: envNum('CACHE_TTL', 3600), // seconds
    storage: env('CACHE_STORAGE', 'localStorage'), // 'localStorage', 'sessionStorage', 'memory'
    maxCacheSize: envNum('MAX_CACHE_SIZE', 10), // MB
    persistBetweenSessions: envBool('PERSIST_CACHE', true),
    versionPrefix: env('CACHE_VERSION_PREFIX', 'v1'),
    purgeOnVersionChange: envBool('PURGE_ON_VERSION_CHANGE', true),
    cacheNodeData: envBool('CACHE_NODE_DATA', true),
    cacheVisualizationState: envBool('CACHE_VIZ_STATE', true),
    cacheBusting: envBool('CACHE_BUSTING', false),
  },
  
  /**
   * Error reporting configuration
   * Settings for error logging and reporting
   */
  errorReporting: {
    enabled: envBool('ERROR_REPORTING', true),
    captureInConsole: envBool('ERROR_CONSOLE', true),
    captureDetails: envBool('ERROR_DETAILS', false),
    reportToServer: envBool('ERROR_REPORTING_SERVER', false),
    errorEndpoint: env('ERROR_ENDPOINT', null),
    errorSampleRate: envNum('ERROR_SAMPLE_RATE', 1.0), // 1.0 = 100% of errors
    ignorePatterns: env('ERROR_IGNORE_PATTERNS', '').split(','),
    anonymizeErrorData: envBool('ANONYMIZE_ERRORS', true),
    notifyUser: envBool('ERROR_NOTIFY_USER', true),
    showErrorDetails: envBool('SHOW_ERROR_DETAILS', false),
  },
  
  /**
   * Data paths configuration
   * Paths to data sources and storage locations
   */
  dataPaths: {
    components: env('COMPONENTS_PATH', 'ai-alignment/components.json'),
    subcomponents: env('SUBCOMPONENTS_PATH', 'ai-alignment/subcomponents.json'),
    users: env('USERS_PATH', 'data/users'),
    spheres: env('SPHERES_PATH', 'data/spheres.json'),
    userContent: env('USER_CONTENT_PATH', 'data/user-content'),
    appConfig: env('APP_CONFIG_PATH', 'data/config'),
    translations: env('TRANSLATIONS_PATH', 'data/translations'),
    assets: env('ASSETS_PATH', 'data/assets'),
    backups: env('BACKUPS_PATH', 'data/backups'),
    templates: env('TEMPLATES_PATH', 'data/templates'),
  },
};

// Apply environment-specific overrides
if (APP_SETTINGS.app.environment === 'development') {
  // Development environment overrides
  APP_SETTINGS.cache.ttl = 60; // Shorter cache in development
  APP_SETTINGS.errorReporting.captureDetails = true;
  APP_SETTINGS.errorReporting.showErrorDetails = true;
  APP_SETTINGS.features.editing.enabled = true;
  APP_SETTINGS.analytics.enabled = false;
}

if (APP_SETTINGS.app.environment === 'test') {
  // Test environment overrides
  APP_SETTINGS.auth.enabled = false;
  APP_SETTINGS.cache.enabled = false;
  APP_SETTINGS.errorReporting.enabled = false;
  APP_SETTINGS.analytics.enabled = false;
  APP_SETTINGS.features.editing.enabled = true;
}

if (APP_SETTINGS.app.environment === 'production') {
  // Production environment overrides
  APP_SETTINGS.errorReporting.captureDetails = false;
  APP_SETTINGS.errorReporting.showErrorDetails = false;
  APP_SETTINGS.visualization.performance.adaptiveDetail = true;
  APP_SETTINGS.cache.ttl = 3600 * 24; // Longer cache in production (24 hours)
}

export default APP_SETTINGS; 