import React, { useRef, useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * VisualizationContainer is the primary container for the 3D visualization.
 * 
 * This component manages the canvas element and acts as the bridge between the React application
 * and the THREE.js visualization. It handles:
 * - Canvas setup and resizing
 * - Loading visualization data from the data service
 * - Initializing and managing the visualization manager
 * - Visualization lifecycle events (loading, error handling, etc.)
 * - Responsive behavior for different screen sizes
 * - Support for multiple visualization modes (2D/3D)
 * - Interaction events between the UI and visualization
 * 
 * @component
 */
const VisualizationContainer = ({ 
  onContainerReady, 
  isLoading: externalLoading,
  loadingProgress: externalProgress,
  mode = '3d',
  showStats = false,
  onError = null
}) => {
  // Element references
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State
  const [dataLoading, setDataLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [visualizationMode, setVisualizationMode] = useState(mode);
  const [isInitialized, setIsInitialized] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Get required modules from registry
  const eventBus = registry.getModule('utils.EventBus') || EventBus;
  const errorHandler = registry.getModule('utils.ErrorHandler');
  
  // Combined loading state (external or internal)
  const isLoading = externalLoading !== undefined ? externalLoading : dataLoading;
  const progress = externalProgress !== undefined ? externalProgress : loadingProgress;

  /**
   * Update container dimensions and notify parent
   * Ensures the canvas always has the correct size based on its container
   */
  const updateDimensions = useCallback(() => {
    if (containerRef.current && canvasRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      
      // Only update if dimensions actually changed
      if (width !== dimensions.width || height !== dimensions.height) {
        // Update canvas size
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        // Save new dimensions
        setDimensions({ width, height });
        
        // Notify parent component that container dimensions have changed
        if (onContainerReady) {
          onContainerReady({
            containerElement: containerRef.current,
            canvasElement: canvasRef.current,
            width,
            height
          });
        }
        
        // Notify visualization manager about resize
        const visualizationManager = registry.getModule('visualization.VisualizationManager');
        if (visualizationManager && visualizationManager.isInitialized) {
          visualizationManager.handleResize(width, height);
        }
        
        // Publish resize event
        eventBus.publish('visualization:resized', { width, height });
      }
    }
  }, [dimensions.width, dimensions.height, onContainerReady, eventBus]);
  
  /**
   * Handle mode change events
   * Switches between 2D and 3D visualization modes
   */
  const handleModeChange = useCallback((data) => {
    const { mode: newMode } = data;
    
    if (newMode && (newMode === '2d' || newMode === '3d') && newMode !== visualizationMode) {
      setVisualizationMode(newMode);
      
      // Update visualization manager with new mode
      const visualizationManager = registry.getModule('visualization.VisualizationManager');
      if (visualizationManager && visualizationManager.isInitialized) {
        visualizationManager.setMode(newMode);
      }
    }
  }, [visualizationMode]);
  
  /**
   * Handle data loaded event
   */
  const handleDataLoaded = useCallback(() => {
    setDataLoading(false);
    setLoadingProgress(1.0);
    setIsInitialized(true);
  }, []);
  
  /**
   * Handle data error event
   */
  const handleDataError = useCallback((event) => {
    const message = event.message || 'Failed to load visualization data';
    setErrorMessage(message);
    setDataLoading(false);
    
    // Call error callback if provided
    if (onError) {
      onError(message, event.originalError);
    }
    
    // Log error with error handler if available
    if (errorHandler) {
      errorHandler.handleError(event.originalError || new Error(message), {
        context: 'VisualizationContainer',
        component: 'VisualizationContainer',
        message
      });
    }
  }, [onError, errorHandler]);

  // Initialize event listeners and handle window resizing
  useEffect(() => {
    // Initial update
    updateDimensions();
    
    // Add resize listener for responsive behavior
    window.addEventListener('resize', updateDimensions);
    
    // Subscribe to visualization events
    eventBus.subscribe('data:loaded', handleDataLoaded);
    eventBus.subscribe('data:error', handleDataError);
    eventBus.subscribe('visualization:modeChange', handleModeChange);
    
    // Set up visualization
    loadVisualizationData();
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', updateDimensions);
      
      // Unsubscribe from events
      eventBus.unsubscribe('data:loaded', handleDataLoaded);
      eventBus.unsubscribe('data:error', handleDataError);
      eventBus.unsubscribe('visualization:modeChange', handleModeChange);
      
      // Stop visualization if needed
      const visualizationManager = registry.getModule('visualization.VisualizationManager');
      if (visualizationManager && visualizationManager.isRunning) {
        visualizationManager.stop();
      }
    };
  }, [updateDimensions, handleDataLoaded, handleDataError, handleModeChange, eventBus]);
  
  // Update when mode prop changes
  useEffect(() => {
    if (mode !== visualizationMode) {
      setVisualizationMode(mode);
      
      // Update visualization manager with new mode
      const visualizationManager = registry.getModule('visualization.VisualizationManager');
      if (visualizationManager && visualizationManager.isInitialized) {
        visualizationManager.setMode(mode);
      }
    }
  }, [mode, visualizationMode]);
  
  /**
   * Load visualization data from data service
   */
  const loadVisualizationData = async () => {
    try {
      setDataLoading(true);
      setErrorMessage(null);
      setLoadingProgress(0);
      
      // Get the data service from the registry
      const dataService = registry.getModule('data.DataService');
      if (!dataService) {
        throw new Error('Data service not found in registry');
      }
      
      // Update progress
      setLoadingProgress(0.1);
      
      // Load data from service
      eventBus.publish('visualization:loadingStarted');
      const visualizationData = await dataService.loadData();
      
      // Update progress
      setLoadingProgress(0.5);
      
      // Get the visualization manager from registry
      const visualizationManager = registry.getModule('visualization.VisualizationManager');
      if (!visualizationManager) {
        throw new Error('Visualization manager not found in registry');
      }
      
      // Initialize the visualization if container is ready
      if (containerRef.current && !visualizationManager.isInitialized) {
        // Initialize with current container and mode
        await visualizationManager.initialize(containerRef.current, {
          mode: visualizationMode,
          showStats: showStats
        });
        
        // Update progress
        setLoadingProgress(0.7);
      }
      
      // Load the data into the visualization manager
      const success = await visualizationManager.loadData(
        visualizationData.nodes,
        visualizationData.links
      );
      
      if (!success) {
        throw new Error('Failed to load data into visualization');
      }
      
      // Update progress
      setLoadingProgress(0.9);
      
      // Start the visualization
      visualizationManager.start();
      
      // Final progress update
      setLoadingProgress(1.0);
      setDataLoading(false);
      setIsInitialized(true);
      
      // Publish success event
      eventBus.publish('visualization:loadingComplete', {
        nodeCount: visualizationData.nodes.length,
        linkCount: visualizationData.links.length
      });
    } catch (error) {
      console.error('Failed to load visualization data:', error);
      
      // Set error state
      setErrorMessage(`Failed to load visualization data: ${error.message}`);
      setDataLoading(false);
      setIsInitialized(false);
      
      // Call error callback if provided
      if (onError) {
        onError(error.message, error);
      }
      
      // Log error with error handler if available
      if (errorHandler) {
        errorHandler.handleError(error, {
          context: 'VisualizationContainer.loadVisualizationData',
          component: 'VisualizationContainer',
          message: 'Failed to load visualization data'
        });
      }
      
      // Publish error to event bus
      eventBus.publish('visualization:error', { 
        message: error.message,
        originalError: error
      });
    }
  };
  
  /**
   * Restart the visualization (reload data and reinitialize)
   */
  const restartVisualization = () => {
    // Stop current visualization if running
    const visualizationManager = registry.getModule('visualization.VisualizationManager');
    if (visualizationManager && visualizationManager.isRunning) {
      visualizationManager.stop();
    }
    
    // Clear error
    setErrorMessage(null);
    
    // Reload data
    loadVisualizationData();
  };

  return (
    <div 
      className={`visualization-container ${isInitialized ? 'initialized' : ''} mode-${visualizationMode}`} 
      ref={containerRef}
      data-testid="visualization-container"
      data-mode={visualizationMode}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay" aria-live="polite" aria-busy="true">
          <div className="loading-spinner"></div>
          <div className="loading-progress">
            {progress !== undefined 
              ? `${Math.round(progress * 100)}%` 
              : 'Loading...'
            }
          </div>
          <div className="loading-message">
            Loading visualization data...
          </div>
        </div>
      )}
      
      {/* Error message */}
      {errorMessage && (
        <div className="error-message" role="alert">
          <div className="error-icon">⚠️</div>
          <div className="error-text">{errorMessage}</div>
          <button 
            className="retry-button"
            onClick={restartVisualization}
          >
            Retry
          </button>
        </div>
      )}
      
      {/* Visualization canvas */}
      <canvas 
        ref={canvasRef} 
        className="visualization-canvas"
        data-testid="visualization-canvas"
        aria-label="Visualization canvas"
        tabIndex={isInitialized ? 0 : -1}
      />
      
      {/* Visualization stats if enabled */}
      {showStats && isInitialized && !isLoading && !errorMessage && (
        <div className="visualization-stats" aria-live="polite">
          {/* Stats will be injected by visualization manager */}
        </div>
      )}
    </div>
  );
};

VisualizationContainer.propTypes = {
  /** Callback function when container is ready with dimensions */
  onContainerReady: PropTypes.func,
  
  /** Override for internal loading state */
  isLoading: PropTypes.bool,
  
  /** Override for internal loading progress */
  loadingProgress: PropTypes.number,
  
  /** Visualization mode: '2d' or '3d' */
  mode: PropTypes.oneOf(['2d', '3d']),
  
  /** Whether to show performance stats */
  showStats: PropTypes.bool,
  
  /** Callback for handling errors */
  onError: PropTypes.func
};

VisualizationContainer.defaultProps = {
  onContainerReady: () => {},
  isLoading: undefined,
  loadingProgress: undefined,
  mode: '3d',
  showStats: false,
  onError: null
};

// Register with module registry
export default registry.register(
  'components.VisualizationContainer',
  VisualizationContainer,
  [
    'data.DataService', 
    'visualization.VisualizationManager', 
    'utils.EventBus',
    'utils.ErrorHandler'
  ],
  {
    description: 'Container for the 3D visualization that manages canvas setup, resize handling, and visualization lifecycle',
    usage: 'Used as the main container for the visualization area in the application',
    examples: [
      {
        name: 'Basic usage',
        code: `<VisualizationContainer />`
      },
      {
        name: 'With 2D mode and stats',
        code: `
          <VisualizationContainer 
            mode="2d"
            showStats={true}
            onContainerReady={handleContainerReady}
            onError={handleVisualizationError}
          />
        `
      }
    ]
  }
); 