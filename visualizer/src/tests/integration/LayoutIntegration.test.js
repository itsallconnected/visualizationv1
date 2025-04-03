import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppLayout from '../../components/AppLayout';
import Sidebar from '../../components/Sidebar';
import ControlsToolbar from '../../components/ControlsToolbar';
import EventBus from '../../utils/EventBus';

// Mock the ModuleRegistry dependency
jest.mock('../../ModuleRegistry', () => ({
  register: (name, component) => component,
}));

// Mock the components we're not directly testing
jest.mock('../../components/Sidebar', () => {
  return function MockSidebar({ onToggleCollapse }) {
    return (
      <div data-testid="sidebar">
        <button onClick={onToggleCollapse} data-testid="sidebar-toggle">
          Toggle Sidebar
        </button>
        <div>Sidebar Content</div>
      </div>
    );
  };
});

jest.mock('../../components/ControlsToolbar', () => {
  return function MockControlsToolbar() {
    return (
      <div data-testid="controls-toolbar">
        <button data-testid="sidebar-control" onClick={() => {
          EventBus.publish('layout:control', { action: 'toggleSidebar' });
        }}>
          Toggle Sidebar from Toolbar
        </button>
        <button data-testid="layout-mode-control" onClick={() => {
          EventBus.publish('layout:control', { action: 'setLayoutMode', value: 'compact' });
        }}>
          Switch to Compact Mode
        </button>
      </div>
    );
  };
});

describe('Layout Integration', () => {
  // Mock the window functions and properties we need
  let originalInnerWidth;
  
  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    window.innerWidth = 1024;
    window.dispatchEvent = jest.fn().mockImplementation((event) => {
      if (event.type === 'resize') {
        // Manually trigger any resize handlers that were added via addEventListener
        if (window.onresize) {
          window.onresize(event);
        }
      }
    });
  });
  
  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    jest.clearAllMocks();
  });

  test('toolbar can control sidebar visibility', () => {
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Sidebar should initially be expanded
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    
    // Click toolbar button to toggle sidebar
    fireEvent.click(screen.getByTestId('sidebar-control'));
    
    // Sidebar should now be collapsed
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Click again to expand
    fireEvent.click(screen.getByTestId('sidebar-control'));
    
    // Sidebar should be expanded again
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
  });

  test('toolbar can change layout mode', () => {
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Layout should initially be in default mode
    expect(screen.getByTestId('app-layout')).toHaveClass('layout-mode-default');
    
    // Click button to change layout mode
    fireEvent.click(screen.getByTestId('layout-mode-control'));
    
    // Layout should now be in compact mode
    expect(screen.getByTestId('app-layout')).toHaveClass('layout-mode-compact');
  });

  test('sidebar collapse state is synchronized across components', () => {
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Sidebar should initially be expanded
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    
    // Collapse via sidebar's own toggle
    fireEvent.click(screen.getByTestId('sidebar-toggle'));
    
    // Sidebar should now be collapsed
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Expand via toolbar
    fireEvent.click(screen.getByTestId('sidebar-control'));
    
    // Sidebar should be expanded again
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
  });

  test('layout responds correctly to resize events', async () => {
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Initially desktop
    expect(screen.getByTestId('app-layout')).toHaveClass('desktop-layout');
    
    // Change to mobile width
    act(() => {
      window.innerWidth = 600;
      window.dispatchEvent(new Event('resize'));
    });
    
    // Should switch to mobile layout and collapse sidebar
    expect(screen.getByTestId('app-layout')).toHaveClass('mobile-layout');
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
    
    // Change back to desktop width
    act(() => {
      window.innerWidth = 1200;
      window.dispatchEvent(new Event('resize'));
    });
    
    // Should switch back to desktop layout (sidebar remains collapsed)
    expect(screen.getByTestId('app-layout')).toHaveClass('desktop-layout');
  });

  test('event-based layout controls work consistently', () => {
    // Create direct subscribers to test events being published correctly
    const layoutControlHandler = jest.fn();
    const sidebarToggledHandler = jest.fn();
    
    EventBus.subscribe('layout:control', layoutControlHandler);
    EventBus.subscribe('layout:sidebarToggled', sidebarToggledHandler);
    
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Trigger layout control via button click
    fireEvent.click(screen.getByTestId('sidebar-control'));
    
    // Check event handlers were called with correct arguments
    expect(layoutControlHandler).toHaveBeenCalledWith({ action: 'toggleSidebar' });
    expect(sidebarToggledHandler).toHaveBeenCalledWith({ collapsed: true });
    
    // Reset mocks
    layoutControlHandler.mockClear();
    sidebarToggledHandler.mockClear();
    
    // Trigger via direct event
    EventBus.publish('layout:control', { action: 'expandSidebar' });
    
    // Sidebar should be expanded
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
    expect(sidebarToggledHandler).toHaveBeenCalledWith({ collapsed: false });
    
    // Cleanup
    EventBus.unsubscribe('layout:control', layoutControlHandler);
    EventBus.unsubscribe('layout:sidebarToggled', sidebarToggledHandler);
  });

  test('layout components maintain reactivity when state changes', () => {
    render(
      <AppLayout
        sidebar={<Sidebar />}
        header={<ControlsToolbar />}
      >
        <div data-testid="content">Main Content</div>
      </AppLayout>
    );
    
    // Toggle sidebar multiple times
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByTestId('sidebar-control'));
      
      // Check the correct class is applied (alternating)
      if (i % 2 === 0) {
        expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-collapsed');
      } else {
        expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
      }
    }
    
    // Change layout mode
    fireEvent.click(screen.getByTestId('layout-mode-control'));
    
    // Check layout mode changed
    expect(screen.getByTestId('app-layout')).toHaveClass('layout-mode-compact');
    
    // Toggle sidebar should still work after layout mode change
    fireEvent.click(screen.getByTestId('sidebar-control'));
    
    // Should maintain compact mode and toggle sidebar
    expect(screen.getByTestId('app-layout')).toHaveClass('layout-mode-compact');
    expect(screen.getByTestId('app-layout')).toHaveClass('sidebar-expanded');
  });
}); 