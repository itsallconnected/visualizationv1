import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navigation from '../../../components/Navigation';
import EventBus from '../../../utils/EventBus';

// Mock EventBus
jest.mock('../../../utils/EventBus', () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn(),
}));

// Mock router functionality
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/dashboard' }),
}));

// Mock navigation items for testing
const mockNavigationItems = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard-icon' },
  { id: 'visualization', label: 'Visualization', path: '/visualization', icon: 'visualization-icon' },
  { id: 'nodes', label: 'Nodes', path: '/nodes', icon: 'nodes-icon' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: 'settings-icon' },
];

describe('Navigation Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock window.matchMedia for responsive tests
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
    
    // Reset window width
    global.innerWidth = 1024;
  });

  it('renders main navigation with correct items', () => {
    render(<Navigation items={mockNavigationItems} />);
    
    // Check if all nav items are rendered
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Visualization')).toBeInTheDocument();
    expect(screen.getByText('Nodes')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active navigation item', () => {
    render(<Navigation items={mockNavigationItems} />);
    
    // Dashboard should be active based on the mocked location
    const dashboardItem = screen.getByText('Dashboard').closest('.nav-item');
    expect(dashboardItem).toHaveClass('active');
    
    // Other items should not be active
    const visualizationItem = screen.getByText('Visualization').closest('.nav-item');
    expect(visualizationItem).not.toHaveClass('active');
  });

  it('collapses and expands the sidebar', () => {
    render(<Navigation items={mockNavigationItems} />);
    
    // Find the sidebar toggle button
    const sidebarToggle = screen.getByTestId('sidebar-toggle');
    
    // Sidebar should not be collapsed initially
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).not.toHaveClass('collapsed');
    
    // Click toggle to collapse
    fireEvent.click(sidebarToggle);
    
    // Sidebar should now be collapsed
    expect(sidebar).toHaveClass('collapsed');
    
    // Click toggle again to expand
    fireEvent.click(sidebarToggle);
    
    // Sidebar should no longer be collapsed
    expect(sidebar).not.toHaveClass('collapsed');
  });

  it('publishes navigation events when clicking items', () => {
    render(<Navigation items={mockNavigationItems} />);
    
    // Click on the Visualization item
    fireEvent.click(screen.getByText('Visualization'));
    
    // Check if EventBus published the navigation event
    expect(EventBus.publish).toHaveBeenCalledWith('navigation:changed', {
      id: 'visualization',
      path: '/visualization'
    });
  });

  it('renders user profile section when provided', () => {
    const userProfile = {
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'avatar-url',
    };
    
    render(<Navigation items={mockNavigationItems} userProfile={userProfile} />);
    
    // User profile section should be visible
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('shows mobile menu toggle on small screens', () => {
    // Mock window as mobile size
    global.innerWidth = 600;
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width: 768px'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    render(<Navigation items={mockNavigationItems} />);
    
    // Mobile toggle should be visible
    const mobileToggle = screen.getByTestId('mobile-nav-toggle');
    expect(mobileToggle).toBeVisible();
    
    // Sidebar should be hidden initially on mobile
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).not.toHaveClass('open');
    
    // Click mobile toggle to show sidebar
    fireEvent.click(mobileToggle);
    
    // Sidebar should now be open
    expect(sidebar).toHaveClass('open');
  });

  it('closes sidebar when clicking outside on mobile', () => {
    // Mock window as mobile size
    global.innerWidth = 600;
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query.includes('max-width: 768px'),
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    
    render(<Navigation items={mockNavigationItems} />);
    
    // Open the sidebar first
    const mobileToggle = screen.getByTestId('mobile-nav-toggle');
    fireEvent.click(mobileToggle);
    
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveClass('open');
    
    // Simulate click outside (body)
    fireEvent.mouseDown(document.body);
    
    // Sidebar should close
    expect(sidebar).not.toHaveClass('open');
  });

  it('groups navigation items when groups are provided', () => {
    const itemsWithGroups = [
      { 
        id: 'main',
        label: 'Main',
        type: 'group',
        items: [
          { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: 'dashboard-icon' },
          { id: 'visualization', label: 'Visualization', path: '/visualization', icon: 'visualization-icon' },
        ]
      },
      {
        id: 'data',
        label: 'Data Management',
        type: 'group',
        items: [
          { id: 'nodes', label: 'Nodes', path: '/nodes', icon: 'nodes-icon' },
          { id: 'connections', label: 'Connections', path: '/connections', icon: 'connections-icon' },
        ]
      }
    ];
    
    render(<Navigation items={itemsWithGroups} />);
    
    // Group headers should be rendered
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Data Management')).toBeInTheDocument();
    
    // Items within groups should be rendered
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Connections')).toBeInTheDocument();
  });

  it('handles navigation item with dropdown', () => {
    const itemsWithDropdown = [
      ...mockNavigationItems,
      { 
        id: 'admin', 
        label: 'Admin', 
        icon: 'admin-icon',
        type: 'dropdown',
        items: [
          { id: 'users', label: 'Users', path: '/admin/users' },
          { id: 'permissions', label: 'Permissions', path: '/admin/permissions' },
        ]
      }
    ];
    
    render(<Navigation items={itemsWithDropdown} />);
    
    // Dropdown trigger should exist
    expect(screen.getByText('Admin')).toBeInTheDocument();
    
    // Dropdown should be closed initially
    const dropdownContent = screen.queryByText('Users');
    expect(dropdownContent).not.toBeVisible();
    
    // Click to open dropdown
    fireEvent.click(screen.getByText('Admin'));
    
    // Dropdown items should now be visible
    expect(screen.getByText('Users')).toBeVisible();
    expect(screen.getByText('Permissions')).toBeVisible();
  });

  it('unsubscribes from events on unmount', () => {
    const { unmount } = render(<Navigation items={mockNavigationItems} />);
    
    // Unmount the component
    unmount();
    
    // Verify EventBus unsubscription
    expect(EventBus.unsubscribe).toHaveBeenCalled();
  });

  it('shows breadcrumb when active item has parents', () => {
    // Mock a hierarchical navigation structure
    const hierarchicalItems = [
      { 
        id: 'main',
        label: 'Main',
        path: '/',
        items: [
          { 
            id: 'data', 
            label: 'Data', 
            path: '/data',
            items: [
              { id: 'nodes', label: 'Nodes', path: '/data/nodes' }
            ]
          }
        ]
      }
    ];
    
    // Mock current location to be at the deepest item
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => jest.fn(),
      useLocation: () => ({ pathname: '/data/nodes' }),
    }));
    
    render(<Navigation items={hierarchicalItems} showBreadcrumb={true} />);
    
    // Breadcrumb should show the path
    const breadcrumb = screen.getByTestId('breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
    expect(breadcrumb).toHaveTextContent('Main / Data / Nodes');
  });

  it('saves collapsed state in localStorage', () => {
    // Mock localStorage
    const mockLocalStorage = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    });
    
    render(<Navigation items={mockNavigationItems} persistState={true} />);
    
    // Toggle sidebar
    const sidebarToggle = screen.getByTestId('sidebar-toggle');
    fireEvent.click(sidebarToggle);
    
    // Check if state is saved to localStorage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'navigation_sidebar_collapsed',
      'true'
    );
  });
}); 