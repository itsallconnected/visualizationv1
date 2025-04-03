/**
 * Visualization Interaction Integration Tests
 * Tests the interactions between visualization components and data management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import VisualizationContainer from '../../components/VisualizationContainer';
import NodeManagementPanel from '../../components/NodeManagementPanel';
import AppContext from '../../contexts/AppContext';
import DataManager from '../../services/DataManager';
import EncryptionService from '../../services/EncryptionService';
import EventBus from '../../utils/EventBus';

// Mock Three.js and related modules
jest.mock('three', () => {
  const actualThree = jest.requireActual('three');
  
  return {
    ...actualThree,
    // Mock needed classes and functions
    WebGLRenderer: jest.fn(() => ({
      setSize: jest.fn(),
      setPixelRatio: jest.fn(),
      setClearColor: jest.fn(),
      domElement: document.createElement('canvas'),
      render: jest.fn(),
      dispose: jest.fn(),
    })),
    Scene: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      children: [],
    })),
    PerspectiveCamera: jest.fn(() => ({
      aspect: 1,
      updateProjectionMatrix: jest.fn(),
      position: { set: jest.fn() },
      lookAt: jest.fn(),
    })),
    Raycaster: jest.fn(() => ({
      setFromCamera: jest.fn(),
      intersectObjects: jest.fn(() => []),
    })),
    Vector2: jest.fn(() => ({ x: 0, y: 0 })),
    Vector3: jest.fn(() => ({ x: 0, y: 0, z: 0 })),
    Box3: jest.fn(() => ({
      setFromObject: jest.fn(),
      getCenter: jest.fn(),
      getSize: jest.fn(),
    })),
    Mesh: jest.fn(),
    Object3D: jest.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      scale: { set: jest.fn() },
      rotation: { x: 0, y: 0, z: 0 },
    })),
    MeshBasicMaterial: jest.fn(),
    SphereGeometry: jest.fn(),
    CylinderGeometry: jest.fn(),
    Group: jest.fn(() => ({
      add: jest.fn(),
      remove: jest.fn(),
      children: [],
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
    })),
    Color: jest.fn(),
  };
});

// Mock OrbitControls
jest.mock('three/examples/jsm/controls/OrbitControls', () => ({
  OrbitControls: jest.fn(() => ({
    enableDamping: true,
    dampingFactor: 0.25,
    screenSpacePanning: true,
    minDistance: 5,
    maxDistance: 500,
    update: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispose: jest.fn(),
  })),
}));

// Mock CSS2DRenderer
jest.mock('three/examples/jsm/renderers/CSS2DRenderer', () => ({
  CSS2DRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    domElement: document.createElement('div'),
    render: jest.fn(),
  })),
  CSS2DObject: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0 },
  })),
}));

// Mock services and utilities
jest.mock('../../services/DataManager');
jest.mock('../../services/EncryptionService');
jest.mock('../../utils/EventBus', () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn(),
}));

// Sample test data
const mockNodes = [
  { id: 'node1', name: 'Node 1', position: { x: 0, y: 0, z: 0 }, type: 'concept' },
  { id: 'node2', name: 'Node 2', position: { x: 10, y: 0, z: 0 }, type: 'capability' },
  { id: 'node3', name: 'Node 3', position: { x: 0, y: 10, z: 0 }, type: 'risk' },
];

const mockConnections = [
  { id: 'conn1', source: 'node1', target: 'node2', type: 'depends-on' },
  { id: 'conn2', source: 'node1', target: 'node3', type: 'contains' },
];

// Mock context
const mockAppContext = {
  user: { id: 'user1', name: 'Test User', role: 'admin' },
  isAuthenticated: true,
  settings: {
    visualization: {
      defaultViewMode: '3d',
      showLabels: true,
      theme: 'light',
    },
  },
};

describe('Visualization Interaction', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup DataManager mocks
    DataManager.getNodes.mockResolvedValue(mockNodes);
    DataManager.getConnections.mockResolvedValue(mockConnections);
    DataManager.createNode.mockImplementation((node) => Promise.resolve({ ...node, id: 'new-node-id' }));
    DataManager.updateNode.mockImplementation((id, updates) => Promise.resolve({ id, ...updates }));
    DataManager.createConnection.mockImplementation((conn) => Promise.resolve({ ...conn, id: 'new-conn-id' }));
    
    // Setup EncryptionService mocks
    EncryptionService.decryptNode.mockImplementation(node => Promise.resolve(node));
    EncryptionService.encryptNode.mockImplementation(node => Promise.resolve(node));
    
    // Mock window resize events
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
    
    // Mock animations
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 0;
    });
  });
  
  afterEach(() => {
    window.requestAnimationFrame.mockRestore();
  });

  // Helper function to render with context
  const renderWithContext = (ui, options = {}) => {
    const context = {
      ...mockAppContext,
      ...options.context,
    };
    
    return render(
      <MemoryRouter>
        <AppContext.Provider value={context}>
          {ui}
        </AppContext.Provider>
      </MemoryRouter>
    );
  };

  it('loads and displays nodes on initialization', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
      expect(DataManager.getConnections).toHaveBeenCalled();
    });
    
    // Visualization should be initialized
    expect(screen.getByTestId('visualization-container')).toBeInTheDocument();
  });

  it('allows creating a new node through the panel', async () => {
    // Render both components
    renderWithContext(
      <>
        <VisualizationContainer />
        <NodeManagementPanel />
      </>
    );
    
    // Wait for initial data load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Click the "Add Node" button
    fireEvent.click(screen.getByTestId('add-node-button'));
    
    // Modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('node-creation-form')).toBeInTheDocument();
    });
    
    // Fill out the form
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Test Node' } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'concept' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test node description' } });
    
    // Submit the form
    fireEvent.click(screen.getByTestId('submit-node-button'));
    
    // Verify that node creation was called
    await waitFor(() => {
      expect(DataManager.createNode).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Test Node',
          type: 'concept',
          description: 'Test node description',
        })
      );
    });
    
    // Check that EventBus published node creation event
    expect(EventBus.publish).toHaveBeenCalledWith('node:created', expect.any(Object));
  });

  it('selects a node when clicked', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Simulate node selection by firing the event directly
    // In a real test, you'd simulate clicking on a node in the 3D scene
    // but we're mocking Three.js, so we'll fire the event directly
    act(() => {
      EventBus.publish.mockImplementationOnce((event, data, callback) => {
        if (event === 'node:selected') {
          if (callback) callback(data);
        }
      });
      
      EventBus.publish('node:selected', mockNodes[0]);
    });
    
    // Check that node details panel appears
    await waitFor(() => {
      expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
      expect(screen.getByText('Node 1')).toBeInTheDocument();
    });
  });

  it('creates a connection between two nodes', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Enter connection mode
    fireEvent.click(screen.getByTestId('connection-mode-button'));
    
    // The visualization should be in connection mode
    expect(screen.getByTestId('visualization-container')).toHaveClass('connection-mode');
    
    // Simulate selecting first node
    act(() => {
      EventBus.publish('node:connection:start', mockNodes[0]);
    });
    
    // Connection preview should appear
    expect(screen.getByTestId('connection-preview')).toBeInTheDocument();
    
    // Simulate selecting second node
    act(() => {
      EventBus.publish('node:connection:end', mockNodes[1]);
    });
    
    // Connection creation dialog should appear
    await waitFor(() => {
      expect(screen.getByTestId('connection-type-dialog')).toBeInTheDocument();
    });
    
    // Select connection type
    fireEvent.change(screen.getByLabelText(/connection type/i), { target: { value: 'influences' } });
    
    // Submit connection
    fireEvent.click(screen.getByTestId('create-connection-button'));
    
    // Connection should be created
    await waitFor(() => {
      expect(DataManager.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'node1',
          target: 'node2',
          type: 'influences',
        })
      );
    });
    
    // Event for connection creation should be published
    expect(EventBus.publish).toHaveBeenCalledWith('connection:created', expect.any(Object));
  });

  it('allows editing a node through the details panel', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Simulate node selection
    act(() => {
      EventBus.publish.mockImplementationOnce((event, data, callback) => {
        if (event === 'node:selected') {
          if (callback) callback(data);
        }
      });
      
      EventBus.publish('node:selected', mockNodes[0]);
    });
    
    // Wait for node details panel
    await waitFor(() => {
      expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
    });
    
    // Click edit button
    fireEvent.click(screen.getByTestId('edit-node-button'));
    
    // Edit form should appear
    await waitFor(() => {
      expect(screen.getByTestId('node-edit-form')).toBeInTheDocument();
    });
    
    // Change the name
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Updated Node Name' } });
    
    // Submit the edit
    fireEvent.click(screen.getByTestId('save-node-button'));
    
    // Verify that node update was called
    await waitFor(() => {
      expect(DataManager.updateNode).toHaveBeenCalledWith(
        'node1',
        expect.objectContaining({
          name: 'Updated Node Name',
        })
      );
    });
    
    // Node update event should be published
    expect(EventBus.publish).toHaveBeenCalledWith('node:updated', expect.any(Object));
  });

  it('responds to visualization control changes', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Toggle view mode (2D/3D)
    fireEvent.click(screen.getByTestId('toggle-view-mode'));
    
    // Check that view mode is changed (via EventBus)
    expect(EventBus.publish).toHaveBeenCalledWith('visualization:viewModeChanged', expect.any(String));
    
    // Toggle labels
    fireEvent.click(screen.getByTestId('toggle-labels'));
    
    // Check that labels toggle is changed
    expect(EventBus.publish).toHaveBeenCalledWith('visualization:labelsToggled', expect.any(Boolean));
    
    // Zoom to fit
    fireEvent.click(screen.getByTestId('zoom-to-fit'));
    
    // Check that zoom to fit is triggered
    expect(EventBus.publish).toHaveBeenCalledWith('visualization:zoomToFit');
  });

  it('switches between different spheres/views', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Get sphere navigator
    const sphereNavigator = screen.getByTestId('sphere-navigator');
    expect(sphereNavigator).toBeInTheDocument();
    
    // Click on a different sphere
    const sphereItems = screen.getAllByTestId('sphere-item');
    fireEvent.click(sphereItems[1]); // Click the second sphere
    
    // Check that sphere change is triggered
    expect(EventBus.publish).toHaveBeenCalledWith('visualization:sphereChanged', expect.any(String));
  });

  it('clears the scene when unmounted', async () => {
    const { unmount } = renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Unmount the component
    unmount();
    
    // Check that event subscriptions are cleaned up
    expect(EventBus.unsubscribe).toHaveBeenCalled();
  });

  it('handles window resize events', async () => {
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
    });
    
    // Trigger resize event
    act(() => {
      window.innerWidth = 800;
      window.innerHeight = 600;
      fireEvent(window, new Event('resize'));
    });
    
    // Visualization should adjust (this is hard to test specifically with mocks,
    // but we can verify the event was handled without errors)
    expect(screen.getByTestId('visualization-container')).toBeInTheDocument();
  });

  it('handles encrypted nodes correctly', async () => {
    // Override the decryption mock for this test
    EncryptionService.decryptNode.mockImplementation((node) => {
      if (node.id === 'node3') {
        return Promise.resolve({
          ...node,
          isEncrypted: true,
          name: 'Encrypted Node',
          // Other properties would be decrypted here
        });
      }
      return Promise.resolve(node);
    });
    
    renderWithContext(<VisualizationContainer />);
    
    // Wait for nodes to load
    await waitFor(() => {
      expect(DataManager.getNodes).toHaveBeenCalled();
      expect(EncryptionService.decryptNode).toHaveBeenCalled();
    });
    
    // Simulate selecting the encrypted node
    act(() => {
      EventBus.publish.mockImplementationOnce((event, data, callback) => {
        if (event === 'node:selected') {
          if (callback) callback(data);
        }
      });
      
      EventBus.publish('node:selected', { ...mockNodes[2], isEncrypted: true, name: 'Encrypted Node' });
    });
    
    // Check for encryption indicator in details panel
    await waitFor(() => {
      expect(screen.getByTestId('node-details-panel')).toBeInTheDocument();
      expect(screen.getByTestId('encryption-indicator')).toBeInTheDocument();
    });
  });
}); 