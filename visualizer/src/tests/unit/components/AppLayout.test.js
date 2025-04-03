import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppLayout from '../../../components/AppLayout';
import EventBus from '../../../utils/EventBus';

// Mock the ModuleRegistry dependency
jest.mock('../../../ModuleRegistry', () => ({
  register: (name, component) => component,
}));

describe('AppLayout Component', () => {
  // Set up spies for EventBus before each test
  let publishSpy;
  let subscribeSpy;
  let unsubscribeSpy;
  
  beforeEach(() => {
    // Create spies on EventBus methods
    publishSpy = jest.spyOn(EventBus, 'publish');
    subscribeSpy = jest.spyOn(EventBus, 'subscribe');
    unsubscribeSpy = jest.spyOn(EventBus, 'unsubscribe');
    
    // Clear any previous calls
    publishSpy.mockClear();
    subscribeSpy.mockClear();
    unsubscribeSpy.mockClear();
    
    // Mock window resize - important for mobile testing
    window.innerWidth = 1024; // Default to desktop width
    window.dispatchEvent = jest.fn();
  });
  
  afterEach(() => {
    // Clean up any mocks
    jest.restoreAllMocks();
  });

  test('renders children correctly', () => {
    render(
      <AppLayout>
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
    expect(screen.getByTestId('test-content')).toHaveTextContent('Test Content');
  });

  test('renders with sidebar when provided', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('test-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('test-sidebar')).toHaveTextContent('Sidebar Content');
    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  test('renders with header when provided', () => {
    render(
      <AppLayout
        header={<div data-testid="test-header">Header Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('test-header')).toBeInTheDocument();
    expect(screen.getByTestId('test-header')).toHaveTextContent('Header Content');
  });

  test('renders with footer when provided', () => {
    render(
      <AppLayout
        footer={<div data-testid="test-footer">Footer Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('test-footer')).toBeInTheDocument();
    expect(screen.getByTestId('test-footer')).toHaveTextContent('Footer Content');
  });

  test('sidebar toggle button collapses and expands sidebar', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    // Find toggle button
    const toggleButton = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(toggleButton).toBeInTheDocument();
    
    // Sidebar should be expanded initially
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    
    // Click to collapse
    fireEvent.click(toggleButton);
    
    // Sidebar should now be collapsed
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Event should have been published
    expect(publishSpy).toHaveBeenCalledWith('layout:sidebarToggled', { collapsed: true });
    
    // Button text should have changed
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
    
    // Click again to expand
    fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
    
    // Sidebar should be expanded again
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    
    // Event should have been published again
    expect(publishSpy).toHaveBeenCalledWith('layout:sidebarToggled', { collapsed: false });
  });

  test('responds to layout:control events', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    // Find the layout event handler
    expect(subscribeSpy).toHaveBeenCalledWith('layout:control', expect.any(Function));
    
    // Get the callback function
    const layoutCallback = subscribeSpy.mock.calls.find(
      call => call[0] === 'layout:control'
    )[1];
    
    // Test collapseSidebar action
    layoutCallback({ action: 'collapseSidebar' });
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Test expandSidebar action
    layoutCallback({ action: 'expandSidebar' });
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    
    // Test toggleSidebar action
    layoutCallback({ action: 'toggleSidebar' });
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Test setLayoutMode action
    layoutCallback({ action: 'setLayoutMode', value: 'compact' });
    expect(screen.getByTestId('app-layout')).toHaveClass('layout-mode-compact');
  });

  test('initializes with collapsed sidebar when initialSidebarCollapsed is true', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
        initialSidebarCollapsed={true}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
  });

  test('handles resize to mobile view', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    // Initially desktop
    expect(screen.getByTestId('app-layout')).toHaveClass('desktop-layout');
    
    // Change to mobile width
    window.innerWidth = 600;
    
    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
    
    // Should switch to mobile layout and collapse sidebar
    expect(screen.getByTestId('app-layout')).toHaveClass('mobile-layout');
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
  });

  test('positions sidebar on the right when sidebarPosition is right', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
        sidebarPosition="right"
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-right');
  });

  test('applies fullWidth class when fullWidth is true', () => {
    render(
      <AppLayout fullWidth>
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('app-layout')).toHaveClass('full-width');
  });

  test('applies custom className when provided', () => {
    render(
      <AppLayout className="custom-class">
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    expect(screen.getByTestId('app-layout')).toHaveClass('custom-class');
  });

  test('does not render sidebar toggle when sidebarCollapsible is false', () => {
    render(
      <AppLayout
        sidebar={<div data-testid="test-sidebar">Sidebar Content</div>}
        sidebarCollapsible={false}
      >
        <div data-testid="test-content">Test Content</div>
      </AppLayout>
    );
    
    // Toggle button should not exist
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
  });

  test('cleans up event listeners on unmount', () => {
    const { unmount } = render(
      <AppLayout>
        <div>Test Content</div>
      </AppLayout>
    );
    
    unmount();
    
    // Should unsubscribe from layout events and remove resize listener
    expect(unsubscribeSpy).toHaveBeenCalledWith('layout:control', expect.any(Function));
  });
}); 