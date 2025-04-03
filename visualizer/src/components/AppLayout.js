import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';

/**
 * Main application layout component that serves as the container for all UI elements.
 * 
 * The AppLayout component provides a flexible, responsive layout structure with:
 * - Optional header, footer, and sidebar components
 * - Configurable sidebar position (left or right)
 * - Collapsible sidebar with toggle controls
 * - Multiple layout modes for different viewing contexts
 * - Mobile responsiveness with automatic sidebar collapsing
 * - Integration with the application-wide event system
 * 
 * @component
 */
const AppLayout = ({
  children,
  sidebar,
  header,
  footer,
  sidebarPosition = 'left',
  sidebarCollapsible = true,
  initialSidebarCollapsed = false,
  fullWidth = false,
  className = '',
  layoutMode = 'default',
  showSidebarToggle = true,
  sidebarWidth = 250,
}) => {
  // Component state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [currentLayoutMode, setLayoutMode] = useState(layoutMode);
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  /**
   * Handle window resize events to enable responsive behavior
   * Automatically collapses sidebar on mobile devices
   */
  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const mobile = width < 768;
    
    setWindowSize({ width, height });
    setIsMobile(mobile);
    
    // Automatically collapse sidebar on mobile
    if (mobile && !sidebarCollapsed) {
      setSidebarCollapsed(true);
      
      // Notify sidebar has been auto-collapsed
      EventBus.publish('layout:sidebarCollapsed', { 
        reason: 'mobile',
        windowWidth: width 
      });
    }
  }, [sidebarCollapsed]);

  /**
   * Handle layout control events from the event bus
   * Supports sidebar collapsing/expanding and layout mode changes
   */
  const handleLayoutEvent = useCallback((data) => {
    const { action, value } = data;
    
    switch (action) {
      case 'collapseSidebar':
        if (!sidebarCollapsed) {
          setSidebarCollapsed(true);
          EventBus.publish('layout:sidebarCollapsed', { source: 'event' });
        }
        break;
        
      case 'expandSidebar':
        if (sidebarCollapsed) {
          setSidebarCollapsed(false);
          EventBus.publish('layout:sidebarExpanded', { source: 'event' });
        }
        break;
        
      case 'toggleSidebar':
        setSidebarCollapsed(prev => {
          const newState = !prev;
          EventBus.publish(
            newState ? 'layout:sidebarCollapsed' : 'layout:sidebarExpanded', 
            { source: 'event' }
          );
          return newState;
        });
        break;
        
      case 'setLayoutMode':
        if (value && value !== currentLayoutMode) {
          setLayoutMode(value);
          EventBus.publish('layout:modeChanged', { 
            previousMode: currentLayoutMode,
            currentMode: value 
          });
        }
        break;
        
      default:
        break;
    }
  }, [sidebarCollapsed, currentLayoutMode]);

  // Initialize event listeners and handle window resizing
  useEffect(() => {
    // Add resize listener for responsive behavior
    window.addEventListener('resize', handleResize);
    
    // Initial size check
    handleResize();
    
    // Subscribe to layout control events
    EventBus.subscribe('layout:control', handleLayoutEvent);
    
    // Notify that layout has been mounted
    EventBus.publish('layout:mounted', { 
      windowSize,
      isMobile,
      sidebarCollapsed 
    });
    
    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      EventBus.unsubscribe('layout:control', handleLayoutEvent);
      
      // Notify that layout is being unmounted
      EventBus.publish('layout:unmounted');
    };
  }, [handleResize, handleLayoutEvent, windowSize, isMobile, sidebarCollapsed]);

  /**
   * Toggle sidebar collapsed state and notify via event bus
   */
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newState = !prev;
      
      // Publish sidebar toggle event
      EventBus.publish('layout:sidebarToggled', {
        collapsed: newState,
        source: 'button'
      });
      
      return newState;
    });
  }, []);

  /**
   * Compute CSS classes for the layout based on current configuration
   * @returns {string} Combined CSS class names
   */
  const getLayoutClasses = () => {
    return [
      'app-layout',
      `layout-mode-${currentLayoutMode}`,
      `sidebar-${sidebarPosition}`,
      sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded',
      isMobile ? 'mobile-layout' : 'desktop-layout',
      fullWidth ? 'full-width' : '',
      className,
    ].filter(Boolean).join(' ');
  };

  /**
   * Render sidebar with optional toggle button
   * @returns {React.Element|null} Sidebar element or null if no sidebar
   */
  const renderSidebar = () => {
    if (!sidebar) return null;
    
    const sidebarStyle = {
      width: sidebarCollapsed ? 'auto' : `${sidebarWidth}px`,
    };
    
    return (
      <div 
        className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : 'expanded'}`}
        style={sidebarStyle}
        data-testid="app-sidebar"
      >
        {sidebarCollapsible && showSidebarToggle && (
          <button 
            className="sidebar-toggle" 
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-testid="sidebar-toggle"
          >
            {sidebarCollapsed
              ? sidebarPosition === 'left' ? '›' : '‹'
              : sidebarPosition === 'left' ? '‹' : '›'
            }
          </button>
        )}
        <div className="sidebar-content">
          {sidebar}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={getLayoutClasses()} 
      data-testid="app-layout"
      data-sidebar-position={sidebarPosition}
      data-layout-mode={currentLayoutMode}
    >
      {header && (
        <header className="app-header" data-testid="app-header">
          {header}
        </header>
      )}
      
      <div className="app-body">
        {sidebarPosition === 'left' && renderSidebar()}
        <main className="app-content" data-testid="app-content">
          {children}
        </main>
        {sidebarPosition === 'right' && renderSidebar()}
      </div>
      
      {footer && (
        <footer className="app-footer" data-testid="app-footer">
          {footer}
        </footer>
      )}
    </div>
  );
};

AppLayout.propTypes = {
  /** Main content of the application */
  children: PropTypes.node.isRequired,
  
  /** Optional sidebar component */
  sidebar: PropTypes.node,
  
  /** Optional header component */
  header: PropTypes.node,
  
  /** Optional footer component */
  footer: PropTypes.node,
  
  /** Position of the sidebar: 'left' or 'right' */
  sidebarPosition: PropTypes.oneOf(['left', 'right']),
  
  /** Whether the sidebar can be collapsed */
  sidebarCollapsible: PropTypes.bool,
  
  /** Initial collapsed state of the sidebar */
  initialSidebarCollapsed: PropTypes.bool,
  
  /** Whether the layout should use full width */
  fullWidth: PropTypes.bool,
  
  /** Additional CSS class names */
  className: PropTypes.string,
  
  /** Current layout mode (e.g., 'default', 'focused', 'presentation') */
  layoutMode: PropTypes.string,
  
  /** Whether to show the sidebar toggle button */
  showSidebarToggle: PropTypes.bool,
  
  /** Width of the sidebar in pixels when expanded */
  sidebarWidth: PropTypes.number,
};

// Register with the module registry
export default registry.register(
  'components.AppLayout',
  AppLayout,
  ['utils.EventBus'], // Add EventBus dependency
  {
    description: 'Main application layout component that provides structure and responsive behavior',
    usage: 'Wrap your main application content with this component and provide optional sidebar, header, and footer',
    examples: [
      {
        name: 'Basic usage',
        code: `
          <AppLayout 
            sidebar={<Sidebar />}
            header={<Header />}
            footer={<Footer />}
          >
            Main content goes here
          </AppLayout>
        `
      },
      {
        name: 'Right sidebar',
        code: `
          <AppLayout 
            sidebar={<Sidebar />}
            sidebarPosition="right"
          >
            Main content goes here
          </AppLayout>
        `
      }
    ]
  }
); 