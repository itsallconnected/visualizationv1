import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EncryptionStatusIndicator from '../../../components/EncryptionStatusIndicator';

// Mock the ModuleRegistry since we want to test the component directly
jest.mock('../../../ModuleRegistry', () => ({
  register: (name, component) => component
}));

describe('EncryptionStatusIndicator', () => {
  test('renders nothing when content is not encrypted', () => {
    const { container } = render(
      <EncryptionStatusIndicator isEncrypted={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders locked icon when content is encrypted but not decrypted', () => {
    render(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        isDecrypted={false}
      />
    );
    
    const indicator = screen.getByRole('button');
    expect(indicator).toHaveAttribute('title', 'Encrypted (Click to unlock)');
    expect(indicator.textContent).toContain('🔒');
  });

  test('renders unlocked icon when content is encrypted and decrypted', () => {
    render(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        isDecrypted={true}
      />
    );
    
    const indicator = screen.getByRole('button');
    expect(indicator).toHaveAttribute('title', 'Decrypted content');
    expect(indicator.textContent).toContain('🔓');
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        isDecrypted={false}
        onClick={handleClick}
      />
    );
    
    const indicator = screen.getByRole('button');
    fireEvent.click(indicator);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('renders with label when showLabel is true', () => {
    render(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        isDecrypted={false}
        showLabel={true}
      />
    );
    
    const label = screen.getByText('Encrypted (Click to unlock)');
    expect(label).toBeInTheDocument();
  });

  test('applies correct size class based on size prop', () => {
    const { rerender } = render(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        size="small"
      />
    );
    
    let indicator = screen.getByRole('button');
    expect(indicator).toHaveClass('encryption-indicator-sm');
    
    rerender(
      <EncryptionStatusIndicator 
        isEncrypted={true} 
        size="large"
      />
    );
    
    indicator = screen.getByRole('button');
    expect(indicator).toHaveClass('encryption-indicator-lg');
  });
}); 