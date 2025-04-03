import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Provides controls for the visualization
 * Includes zoom, view switching, layout options, and tools
 */
const ControlsToolbar = ({
  position = 'bottom',
  defaultLayout = 'hierarchical',
  showLabels = true
}) => {
  // State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeLayout, setActiveLayout] = useState(defaultLayout);
  const [activeTool, setActiveTool] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState('3d');
  const [availableTools, setAvailableTools] = useState([]);
  const [availableLayouts, setAvailableLayouts] = useState([]);
  
  // References to services
  const visualizationManager = registry.get('visualization.VisualizationManager');
  const layoutEngine = registry.get('visualization.LayoutEngine');
  
  // Initialize toolbar
  useEffect(() => {
    // Get available layouts
    if (layoutEngine) {
      const layouts = layoutEngine.getAvailableLayouts();
      setAvailableLayouts(layouts);
    } else {
      // Default layouts if no layout engine
      setAvailableLayouts([
        { id: 'hierarchical', name: 'Hierarchical', icon: '🌳' },
        { id: 'force', name: 'Force-Directed', icon: '🔄' },
        { id: 'radial', name: 'Radial', icon: '🔘' },
        { id: 'grid', name: 'Grid', icon: '🔲' }
      ]);
    }
    
    // Get available tools
    const tools = getAvailableTools();
    setAvailableTools(tools);
    
    // Subscribe to events
    const handleZoomChange = (data) => {
      setZoomLevel(data.level);
    };
    
    const handleLayoutChange = (data) => {
      setActiveLayout(data.layout);
    };
    
    const handleToolActivation = (data) => {
      setActiveTool(data.tool);
    };
    
    const handleViewModeChange = (data) => {
      setViewMode(data.mode);
    };
    
    EventBus.subscribe('visualization:zoom', handleZoomChange);
    EventBus.subscribe('visualization:layout', handleLayoutChange);
    EventBus.subscribe('visualization:tool', handleToolActivation);
    EventBus.subscribe('visualization:view', handleViewModeChange);
    
    // Cleanup subscriptions
    return () => {
      EventBus.unsubscribe('visualization:zoom', handleZoomChange);
      EventBus.unsubscribe('visualization:layout', handleLayoutChange);
      EventBus.unsubscribe('visualization:tool', handleToolActivation);
      EventBus.unsubscribe('visualization:view', handleViewModeChange);
    };
  }, []);
  
  /**
   * Get available tools
   * @returns {Array} - Available tools
   */
  const getAvailableTools = () => {
    // Default tools
    return [
      { id: 'select', name: 'Select', icon: '👆', description: 'Select nodes and expand/collapse hierarchies' },
      { id: 'pan', name: 'Pan', icon: '🖐️', description: 'Pan the visualization' },
      { id: 'connect', name: 'Connect', icon: '🔗', description: 'Create connections between nodes' },
      { id: 'group', name: 'Group', icon: '📦', description: 'Group nodes together' },
      { id: 'filter', name: 'Filter', icon: '🔍', description: 'Filter nodes by properties' },
      { id: 'focus', name: 'Focus', icon: '🎯', description: 'Focus on selected nodes' }
    ];
  };
  
  /**
   * Handle zoom in
   */
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 0.1, 2.0);
    setZoomLevel(newZoom);
    
    // Notify visualization
    EventBus.publish('controls:zoom', { level: newZoom });
  };
  
  /**
   * Handle zoom out
   */
  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.1, 0.5);
    setZoomLevel(newZoom);
    
    // Notify visualization
    EventBus.publish('controls:zoom', { level: newZoom });
  };
  
  /**
   * Handle zoom reset
   */
  const handleZoomReset = () => {
    setZoomLevel(1.0);
    
    // Notify visualization
    EventBus.publish('controls:zoom', { level: 1.0 });
  };
  
  /**
   * Handle layout change
   * @param {string} layoutId - Layout ID
   */
  const handleLayoutChange = (layoutId) => {
    if (layoutId === activeLayout) return;
    
    setActiveLayout(layoutId);
    
    // Notify visualization
    EventBus.publish('controls:layout', { layout: layoutId });
  };
  
  /**
   * Handle tool selection
   * @param {string} toolId - Tool ID
   */
  const handleToolSelect = (toolId) => {
    if (toolId === activeTool) {
      // Deselect tool if already active
      setActiveTool(null);
      EventBus.publish('controls:tool', { tool: null });
    } else {
      setActiveTool(toolId);
      EventBus.publish('controls:tool', { tool: toolId });
    }
  };
  
  /**
   * Handle view mode toggle
   */
  const handleViewModeToggle = () => {
    const newMode = viewMode === '3d' ? '2d' : '3d';
    setViewMode(newMode);
    
    // Notify visualization
    EventBus.publish('controls:view', { mode: newMode });
  };
  
  /**
   * Handle toolbar expansion toggle
   */
  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };
  
  /**
   * Handle fullscreen toggle
   */
  const handleFullscreenToggle = () => {
    EventBus.publish('controls:fullscreen', { toggle: true });
  };
  
  /**
   * Render zoom controls
   * @returns {React.Element} - Zoom controls
   */
  const renderZoomControls = () => {
    return (
      <div className="controls__group controls__group--zoom">
        <button 
          className="controls__button" 
          onClick={handleZoomOut}
          title="Zoom out"
        >
          <span className="controls__icon">➖</span>
          {showLabels && <span className="controls__label">Zoom Out</span>}
        </button>
        
        <div className="controls__zoom-level" title="Current zoom level">
          {Math.round(zoomLevel * 100)}%
        </div>
        
        <button 
          className="controls__button" 
          onClick={handleZoomIn}
          title="Zoom in"
        >
          <span className="controls__icon">➕</span>
          {showLabels && <span className="controls__label">Zoom In</span>}
        </button>
        
        <button 
          className="controls__button" 
          onClick={handleZoomReset}
          title="Reset zoom"
        >
          <span className="controls__icon">🔄</span>
          {showLabels && <span className="controls__label">Reset</span>}
        </button>
      </div>
    );
  };
  
  /**
   * Render layout controls
   * @returns {React.Element} - Layout controls
   */
  const renderLayoutControls = () => {
    return (
      <div className="controls__group controls__group--layout">
        <div className="controls__group-label">Layout</div>
        <div className="controls__button-group">
          {availableLayouts.map(layout => (
            <button
              key={layout.id}
              className={`controls__button ${activeLayout === layout.id ? 'controls__button--active' : ''}`}
              onClick={() => handleLayoutChange(layout.id)}
              title={layout.name}
            >
              <span className="controls__icon">{layout.icon}</span>
              {showLabels && <span className="controls__label">{layout.name}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  /**
   * Render tool controls
   * @returns {React.Element} - Tool controls
   */
  const renderToolControls = () => {
    return (
      <div className="controls__group controls__group--tools">
        <div className="controls__group-label">Tools</div>
        <div className="controls__button-group">
          {availableTools.map(tool => (
            <button
              key={tool.id}
              className={`controls__button ${activeTool === tool.id ? 'controls__button--active' : ''}`}
              onClick={() => handleToolSelect(tool.id)}
              title={tool.description}
            >
              <span className="controls__icon">{tool.icon}</span>
              {showLabels && <span className="controls__label">{tool.name}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  };
  
  /**
   * Render view mode toggle
   * @returns {React.Element} - View mode toggle
   */
  const renderViewModeToggle = () => {
    return (
      <div className="controls__group controls__group--view-mode">
        <button
          className="controls__button"
          onClick={handleViewModeToggle}
          title={`Switch to ${viewMode === '3d' ? '2D' : '3D'} view`}
        >
          <span className="controls__icon">{viewMode === '3d' ? '🔲' : '🧊'}</span>
          {showLabels && (
            <span className="controls__label">
              {viewMode === '3d' ? '2D View' : '3D View'}
            </span>
          )}
        </button>
      </div>
    );
  };
  
  /**
   * Render additional controls
   * @returns {React.Element} - Additional controls
   */
  const renderAdditionalControls = () => {
    return (
      <div className="controls__group controls__group--additional">
        <button
          className="controls__button"
          onClick={handleFullscreenToggle}
          title="Toggle fullscreen"
        >
          <span className="controls__icon">⛶</span>
          {showLabels && <span className="controls__label">Fullscreen</span>}
        </button>
      </div>
    );
  };
  
  /**
   * Render expansion toggle
   * @returns {React.Element} - Expansion toggle
   */
  const renderExpansionToggle = () => {
    return (
      <button
        className="controls__expand-toggle"
        onClick={handleExpandToggle}
        title={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
      >
        {position === 'bottom' || position === 'top' ? (
          isExpanded ? '▼' : '▲'
        ) : position === 'left' ? (
          isExpanded ? '◀' : '▶'
        ) : (
          isExpanded ? '▶' : '◀'
        )}
      </button>
    );
  };
  
  return (
    <div className={`controls controls--${position} ${isExpanded ? 'controls--expanded' : 'controls--collapsed'}`}>
      {renderExpansionToggle()}
      
      {isExpanded && (
        <div className="controls__container">
          {renderZoomControls()}
          {renderLayoutControls()}
          {renderToolControls()}
          {renderViewModeToggle()}
          {renderAdditionalControls()}
        </div>
      )}
    </div>
  );
};

ControlsToolbar.propTypes = {
  position: PropTypes.oneOf(['top', 'right', 'bottom', 'left']),
  defaultLayout: PropTypes.string,
  showLabels: PropTypes.bool
};

export default registry.register(
  'components.ControlsToolbar',
  ControlsToolbar,
  [
    'visualization.VisualizationManager',
    'visualization.LayoutEngine',
    'utils.EventBus'
  ],
  {
    description: 'Provides controls for the visualization',
    usage: 'Used to provide zoom, layout and tool controls for visualization interaction'
  }
); 