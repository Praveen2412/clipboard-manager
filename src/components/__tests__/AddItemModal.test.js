import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddItemModal from '../AddItemModal';

describe('AddItemModal', () => {
  // Mock handlers
  const mockOnAddItem = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  test('renders modal when isOpen is true', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    expect(screen.getByText('Add New Item')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter content...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    render(
      <AddItemModal 
        isOpen={false}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    expect(screen.queryByText('Add New Item')).not.toBeInTheDocument();
  });

  test('updates input value when typing', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    const contentInput = screen.getByPlaceholderText('Enter content...');
    fireEvent.change(contentInput, { target: { value: 'Test content' } });
    
    expect(contentInput.value).toBe('Test content');
  });

  test('changes item type when selecting from dropdown', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'url' } });
    
    expect(typeSelect.value).toBe('url');
  });

  test('toggles favorite checkbox', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    const favoriteCheckbox = screen.getByRole('checkbox');
    expect(favoriteCheckbox.checked).toBe(false);
    
    fireEvent.click(favoriteCheckbox);
    expect(favoriteCheckbox.checked).toBe(true);
  });

  test('calls onAddItem when submitting with valid content', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    // Enter content
    const contentInput = screen.getByPlaceholderText('Enter content...');
    fireEvent.change(contentInput, { target: { value: 'Test content' } });
    
    // Select type
    const typeSelect = screen.getByRole('combobox');
    fireEvent.change(typeSelect, { target: { value: 'code' } });
    
    // Toggle favorite
    const favoriteCheckbox = screen.getByRole('checkbox');
    fireEvent.click(favoriteCheckbox);
    
    // Submit form
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);
    
    // Verify onAddItem was called with correct parameters
    expect(mockOnAddItem).toHaveBeenCalledWith(
      'Test content',
      'code',
      true
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows error when submitting with empty content', () => {
    // Mock window.alert
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    // Submit form without entering content
    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);
    
    // Verify alert was called and that onAddItem was not called
    expect(alertMock).toHaveBeenCalledWith('Please enter content');
    expect(mockOnAddItem).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
    
    // Clean up mock
    alertMock.mockRestore();
  });

  test('calls onClose when clicking cancel button', () => {
    render(
      <AddItemModal 
        isOpen={true}
        onAddItem={mockOnAddItem}
        onClose={mockOnClose}
      />
    );
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnAddItem).not.toHaveBeenCalled();
  });
}); 