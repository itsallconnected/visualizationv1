import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModalManager from '../../../components/ModalManager';
import EventBus from '../../../utils/EventBus';

// Mock EventBus
jest.mock('../../../utils/EventBus', () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  publish: jest.fn(),
}));

describe('ModalManager Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('subscribes to events on mount and unsubscribes on unmount', () => {
    const { unmount } = render(<ModalManager />);
    
    // Verify EventBus subscription
    expect(EventBus.subscribe).toHaveBeenCalledWith('modal:open', expect.any(Function));
    expect(EventBus.subscribe).toHaveBeenCalledWith('modal:close', expect.any(Function));
    
    // Unmount the component
    unmount();
    
    // Verify EventBus unsubscription
    expect(EventBus.unsubscribe).toHaveBeenCalledWith('modal:open', expect.any(Function));
    expect(EventBus.unsubscribe).toHaveBeenCalledWith('modal:close', expect.any(Function));
  });

  it('renders nothing when no modal is open', () => {
    render(<ModalManager />);
    
    // The modal overlay should not exist in the document
    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('opens a modal when receiving an open event', () => {
    render(<ModalManager />);
    
    // Simulate an open event
    const modalData = {
      title: 'Test Modal',
      content: 'This is a test modal content',
      actions: [
        { label: 'Cancel', onClick: jest.fn() },
        { label: 'Confirm', onClick: jest.fn(), primary: true }
      ]
    };
    
    // Get the openModal handler
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    // Call the handler with modal data
    openModalHandler(modalData);
    
    // Verify modal is rendered
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('This is a test modal content')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('closes a modal when receiving a close event', async () => {
    render(<ModalManager />);
    
    // First open a modal
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Test Modal',
      content: 'This is a test modal content'
    });
    
    // Verify modal is open
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    
    // Now get the close handler
    const closeModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:close'
    )[1];
    
    // Call the close handler
    closeModalHandler();
    
    // Verify modal is closed (animation might take time)
    await waitFor(() => {
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
    });
  });

  it('closes the modal when clicking the close button', async () => {
    render(<ModalManager />);
    
    // Open a modal
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Test Modal',
      content: 'This is a test modal content'
    });
    
    // Find and click the close button
    const closeButton = screen.getByTestId('modal-close');
    fireEvent.click(closeButton);
    
    // Verify modal closes and event is published
    await waitFor(() => {
      expect(EventBus.publish).toHaveBeenCalledWith('modal:closed');
    });
  });

  it('closes the modal when clicking the overlay if backdropDismiss is true', async () => {
    render(<ModalManager />);
    
    // Open a modal with backdropDismiss
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Test Modal',
      content: 'This is a test modal content',
      backdropDismiss: true
    });
    
    // Find and click the overlay
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    
    // Verify modal closes
    await waitFor(() => {
      expect(EventBus.publish).toHaveBeenCalledWith('modal:closed');
    });
  });

  it('does not close the modal when clicking the overlay if backdropDismiss is false', async () => {
    render(<ModalManager />);
    
    // Open a modal with backdropDismiss set to false
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Test Modal',
      content: 'This is a test modal content',
      backdropDismiss: false
    });
    
    // Find and click the overlay
    const overlay = screen.getByTestId('modal-overlay');
    fireEvent.click(overlay);
    
    // Modal should still be open
    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    
    // Event should not be published
    expect(EventBus.publish).not.toHaveBeenCalledWith('modal:closed');
  });

  it('renders custom content components', () => {
    render(<ModalManager />);
    
    // Create a custom React component for content
    const CustomContent = () => <div data-testid="custom-content">Custom content here</div>;
    
    // Open modal with custom content
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Custom Modal',
      content: <CustomContent />
    });
    
    // Verify custom content is rendered
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByText('Custom content here')).toBeInTheDocument();
  });

  it('handles action button clicks correctly', () => {
    render(<ModalManager />);
    
    // Create mock handlers
    const cancelHandler = jest.fn();
    const confirmHandler = jest.fn();
    
    // Open modal with actions
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Action Modal',
      content: 'Modal with actions',
      actions: [
        { label: 'Cancel', onClick: cancelHandler },
        { label: 'Confirm', onClick: confirmHandler, primary: true }
      ]
    });
    
    // Click the confirm button
    fireEvent.click(screen.getByText('Confirm'));
    
    // Verify handler was called
    expect(confirmHandler).toHaveBeenCalled();
    
    // Click the cancel button
    fireEvent.click(screen.getByText('Cancel'));
    
    // Verify handler was called
    expect(cancelHandler).toHaveBeenCalled();
  });

  it('renders different modal sizes correctly', () => {
    render(<ModalManager />);
    
    // Open a small modal
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Small Modal',
      content: 'Small modal content',
      size: 'sm'
    });
    
    // Verify small modal class is applied
    expect(screen.getByTestId('modal')).toHaveClass('modal-sm');
    
    // Close and open medium modal
    const closeModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:close'
    )[1];
    
    closeModalHandler();
    
    openModalHandler({
      title: 'Medium Modal',
      content: 'Medium modal content',
      size: 'md'
    });
    
    // Verify medium modal class
    expect(screen.getByTestId('modal')).toHaveClass('modal-md');
    
    // Test large modal
    closeModalHandler();
    openModalHandler({
      title: 'Large Modal',
      content: 'Large modal content',
      size: 'lg'
    });
    
    expect(screen.getByTestId('modal')).toHaveClass('modal-lg');
  });

  it('renders modal types correctly', () => {
    render(<ModalManager />);
    
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    // Test alert modal
    openModalHandler({
      type: 'alert',
      title: 'Alert',
      content: 'This is an alert'
    });
    
    expect(screen.getByTestId('modal')).toHaveClass('modal-alert');
    
    // Test confirm modal
    const closeModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:close'
    )[1];
    
    closeModalHandler();
    
    openModalHandler({
      type: 'confirm',
      title: 'Confirm',
      content: 'Are you sure?'
    });
    
    expect(screen.getByTestId('modal')).toHaveClass('modal-confirm');
  });

  it('handles keyboard events for modal closing', async () => {
    render(<ModalManager />);
    
    // Open a modal
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Keyboard Modal',
      content: 'Press ESC to close'
    });
    
    // Simulate pressing Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    
    // Verify modal closes
    await waitFor(() => {
      expect(EventBus.publish).toHaveBeenCalledWith('modal:closed');
    });
  });

  it('blocks scrolling of the page when modal is open', () => {
    const originalStyle = document.body.style.overflow;
    
    render(<ModalManager />);
    
    // Open a modal
    const openModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:open'
    )[1];
    
    openModalHandler({
      title: 'Scroll Block Modal',
      content: 'This should block page scrolling'
    });
    
    // Body should have overflow: hidden
    expect(document.body.style.overflow).toBe('hidden');
    
    // Close the modal
    const closeModalHandler = EventBus.subscribe.mock.calls.find(
      call => call[0] === 'modal:close'
    )[1];
    
    closeModalHandler();
    
    // Body should have original overflow style
    expect(document.body.style.overflow).toBe(originalStyle);
  });
}); 