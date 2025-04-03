import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import registry from '../ModuleRegistry';
import EventBus from '../utils/EventBus';
import { useAuth } from '../auth/AuthContext';

/**
 * Sidebar component provides the main navigation for the application.
 * 
 * Features:
 * - Collapsible sidebar with toggle button
 * - Authentication-aware navigation items (items can require auth)
 * - Support for item grouping and hierarchy
 * - Icon and badge support for navigation items
 * - Keyboard navigation and ARIA attributes for accessibility
 * - Customizable appearance with various display options
 * - Integration with event system for external control
 * 
 * @component
 */
const Sidebar = ({ 
  navigationItems = [],
  onNavigate,
  currentPath,
  title = 'AI Alignment Visualization',
  theme = 'dark',
  showFooter = true,
  footerContent = null,
  allowExternalControl = true,
  showVersionInfo = true,
  versionInfo = { version: '2.0' }
}) => {
  // State
  const [collapsed, setCollapsed] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const { isAuthenticated, user } = useAuth();
  
  /**
   * Handle sidebar collapse event from external components
   */
  const handleExternalCollapse = useCallback((data) => {
    if (allowExternalControl) {
      setCollapsed(data.collapsed);
    }
  }, [allowExternalControl]);
  
  /**
   * Toggle sidebar collapsed state
   */
  const toggleCollapse = useCallback(() => {
    setCollapsed(prevState => {
      const newState = !prevState;
      
      // Notify the layout about sidebar toggle
      EventBus.publish('layout:control', { 
        action: newState ? 'collapseSidebar' : 'expandSidebar',
        source: 'sidebar'
      });
      
      return newState;
    });
  }, []);
  
  /**
   * Handle group toggle (for grouped navigation items)
   * @param {string} groupId - Group identifier
   */
  const toggleGroup = useCallback((groupId) => {
    setActiveGroup(prevGroup => prevGroup === groupId ? null : groupId);
  }, []);
  
  /**
   * Determine if a navigation item should be visible
   * @param {Object} item - Navigation item
   * @returns {boolean} - Whether the item should be visible
   */
  const shouldShowItem = useCallback((item) => {
    // Always show items marked with alwaysShow
    if (item.alwaysShow) return true;
    
    // Hide items that require auth if user is not authenticated
    if (item.requiresAuth && !isAuthenticated) return false;
    
    // Hide items with specific roles if user doesn't have that role
    if (item.requiredRoles && isAuthenticated && user?.roles) {
      const hasRequiredRole = item.requiredRoles.some(role => 
        user.roles.includes(role)
      );
      if (!hasRequiredRole) return false;
    }
    
    return true;
  }, [isAuthenticated, user]);
  
  // Subscribe to external sidebar toggle events
  useEffect(() => {
    if (allowExternalControl) {
      EventBus.subscribe('sidebar:collapse', handleExternalCollapse);
      
      return () => {
        EventBus.unsubscribe('sidebar:collapse', handleExternalCollapse);
      };
    }
  }, [allowExternalControl, handleExternalCollapse]);
  
  /**
   * Generate CSS classes for the sidebar
   * @returns {string} - CSS class names
   */
  const getSidebarClasses = () => {
    return [
      'sidebar',
      `sidebar-theme-${theme}`,
      collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'
    ].filter(Boolean).join(' ');
  };
  
  /**
   * Handle navigation item click
   * @param {Object} item - Navigation item
   * @param {Event} event - Click event
   */
  const handleItemClick = (item, event) => {
    // Prevent default behavior
    if (event) event.preventDefault();
    
    if (item.disabled) return;
    
    // If item has children but no path, toggle the group
    if (item.children && !item.path) {
      toggleGroup(item.id);
      return;
    }
    
    // Handle item with action
    if (item.action) {
      // If item has an action, call the navigation handler with the action
      onNavigate(item.path, item.action);
      
      // Publish navigation event
      EventBus.publish('navigation:action', {
        path: item.path,
        action: item.action,
        item
      });
    } else if (item.requiresAuth && !isAuthenticated) {
      // If item requires auth and user is not authenticated, redirect to login
      EventBus.publish('auth:loginRequired', {
        returnPath: item.path
      });
      
      // The App component will handle redirection to login
      onNavigate('/login', { returnTo: item.path });
    } else if (item.externalUrl) {
      // Handle external URLs
      window.open(item.externalUrl, item.target || '_blank', 'noopener,noreferrer');
      
      // Publish external navigation event
      EventBus.publish('navigation:external', {
        url: item.externalUrl,
        item
      });
    } else {
      // Normal navigation
      onNavigate(item.path);
      
      // Publish navigation event
      EventBus.publish('navigation:internal', {
        path: item.path,
        item
      });
      
      // Collapse sidebar on navigation in mobile view
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    }
  };
  
  /**
   * Handle keyboard navigation
   * @param {Object} item - Navigation item
   * @param {Event} event - Keyboard event
   */
  const handleKeyDown = (item, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item, event);
    }
  };
  
  /**
   * Render a badge for navigation items
   * @param {Object} badge - Badge configuration
   * @returns {React.Element|null} - Badge element or null
   */
  const renderBadge = (badge) => {
    if (!badge) return null;
    
    return (
      <span 
        className={`nav-badge ${badge.type ? `nav-badge-${badge.type}` : ''}`}
        title={badge.tooltip}
      >
        {badge.count !== undefined ? badge.count : badge.text}
      </span>
    );
  };
  
  /**
   * Render a single navigation item
   * @param {Object} item - Navigation item
   * @returns {React.Element} - Navigation item element
   */
  const renderNavigationItem = (item) => {
    const isActive = currentPath === item.path;
    const isGroupActive = item.id === activeGroup;
    const hasChildren = item.children && item.children.length > 0;
    
    // Don't render items that should be hidden
    if (!shouldShowItem(item)) return null;
    
    return (
      <li 
        key={item.id || item.path} 
        className={[
          isActive ? 'active' : '',
          isGroupActive ? 'group-active' : '',
          item.disabled ? 'disabled' : '',
          hasChildren ? 'has-children' : '',
          item.className || ''
        ].filter(Boolean).join(' ')}
        data-path={item.path}
        onMouseEnter={() => setHoveredItem(item.id || item.path)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        <div
          className="nav-item-container"
          onClick={(e) => handleItemClick(item, e)}
          onKeyDown={(e) => handleKeyDown(item, e)}
          tabIndex={item.disabled ? -1 : 0}
          role="button"
          aria-current={isActive ? 'page' : undefined}
          aria-expanded={hasChildren ? isGroupActive : undefined}
          aria-disabled={item.disabled}
          title={collapsed ? item.label : item.description || item.label}
        >
          {item.icon && <span className="nav-icon">{item.icon}</span>}
          {!collapsed && (
            <span className="nav-label">
              {item.label}
              {hasChildren && (
                <span className="nav-arrow">
                  {isGroupActive ? '▼' : '▶'}
                </span>
              )}
            </span>
          )}
          {!collapsed && item.badge && renderBadge(item.badge)}
        </div>
        
        {/* Render children if expanded */}
        {hasChildren && isGroupActive && !collapsed && (
          <ul className="nav-children">
            {item.children.map(child => renderNavigationItem({
              ...child,
              className: 'nav-child-item'
            }))}
          </ul>
        )}
      </li>
    );
  };
  
  /**
   * Render a tooltip for a nav item when sidebar is collapsed
   * @returns {React.Element|null} - Tooltip element or null
   */
  const renderTooltip = () => {
    if (!collapsed || !hoveredItem) return null;
    
    const item = navigationItems.find(i => (i.id || i.path) === hoveredItem);
    
    if (!item) return null;
    
    return (
      <div className="nav-tooltip" role="tooltip">
        {item.label}
        {item.description && (
          <div className="nav-tooltip-description">{item.description}</div>
        )}
      </div>
    );
  };
  
  /**
   * Render footer content based on props
   * @returns {React.Element|null} - Footer element or null
   */
  const renderFooter = () => {
    if (!showFooter) return null;
    
    return (
      <div className="sidebar-footer">
        {footerContent ? (
          footerContent
        ) : (
          <>
            {showVersionInfo && (
              <p className="version-info">
                Version {versionInfo.version}
                {versionInfo.buildNumber && ` (Build ${versionInfo.buildNumber})`}
              </p>
            )}
            <p className="auth-status">
              {isAuthenticated ? (
                <>
                  <span className="auth-icon">👤</span>
                  <span className="auth-text">
                    {collapsed ? '' : `Logged in as ${user?.displayName || 'User'}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="auth-icon">🔒</span>
                  <span className="auth-text">
                    {collapsed ? '' : 'Not logged in'}
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      className={getSidebarClasses()} 
      data-testid="sidebar" 
      aria-label="Main navigation"
      role="navigation"
    >
      <div className="sidebar-header">
        {!collapsed ? (
          <h2 className="sidebar-title">{title}</h2>
        ) : (
          <div className="sidebar-logo" title={title}>
            {title.charAt(0)}
          </div>
        )}
        <button 
          className="collapse-button" 
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          data-testid="sidebar-toggle"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-navigation">
        <ul className="nav-list" role="menubar">
          {navigationItems.map(renderNavigationItem)}
        </ul>
      </nav>

      {renderFooter()}
      {renderTooltip()}
    </div>
  );
};

Sidebar.propTypes = {
  /** Navigation items to display in the sidebar */
  navigationItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      path: PropTypes.string,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      description: PropTypes.string,
      requiresAuth: PropTypes.bool,
      requiredRoles: PropTypes.arrayOf(PropTypes.string),
      action: PropTypes.string,
      alwaysShow: PropTypes.bool,
      disabled: PropTypes.bool,
      badge: PropTypes.shape({
        text: PropTypes.string,
        count: PropTypes.number,
        type: PropTypes.string,
        tooltip: PropTypes.string
      }),
      externalUrl: PropTypes.string,
      target: PropTypes.string,
      children: PropTypes.array,
      className: PropTypes.string
    })
  ).isRequired,
  
  /** Callback function for navigation */
  onNavigate: PropTypes.func.isRequired,
  
  /** Current active path */
  currentPath: PropTypes.string.isRequired,
  
  /** Title to display in the header */
  title: PropTypes.string,
  
  /** Sidebar theme: 'light' or 'dark' */
  theme: PropTypes.oneOf(['light', 'dark']),
  
  /** Whether to show the footer */
  showFooter: PropTypes.bool,
  
  /** Custom footer content */
  footerContent: PropTypes.node,
  
  /** Whether to allow external control via events */
  allowExternalControl: PropTypes.bool,
  
  /** Whether to show version information */
  showVersionInfo: PropTypes.bool,
  
  /** Version information to display */
  versionInfo: PropTypes.shape({
    version: PropTypes.string.isRequired,
    buildNumber: PropTypes.string,
    releaseDate: PropTypes.string
  })
};

// Register with the module registry
export default registry.register(
  'components.Sidebar',
  Sidebar,
  ['utils.EventBus', 'auth.AuthContext'], 
  {
    description: 'Application sidebar component that provides navigation and collapsible sections',
    usage: 'Use inside AppLayout as the sidebar prop for main application navigation',
    examples: [
      {
        name: 'Basic usage',
        code: `
          <Sidebar
            navigationItems={[
              { path: '/', label: 'Home', icon: '🏠' },
              { path: '/visualization', label: 'Visualization', icon: '📊' },
              { path: '/settings', label: 'Settings', icon: '⚙️', requiresAuth: true }
            ]}
            onNavigate={(path) => navigate(path)}
            currentPath={location.pathname}
          />
        `
      },
      {
        name: 'With grouped items',
        code: `
          <Sidebar
            navigationItems={[
              { path: '/', label: 'Home', icon: '🏠' },
              { 
                id: 'visualization',
                label: 'Visualization', 
                icon: '📊',
                children: [
                  { path: '/visualization/network', label: 'Network View' },
                  { path: '/visualization/tree', label: 'Tree View' }
                ]
              }
            ]}
            onNavigate={(path) => navigate(path)}
            currentPath={location.pathname}
          />
        `
      }
    ]
  }
); 