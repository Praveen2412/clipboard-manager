import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ClipboardItem from '../ClipboardItem';

describe('ClipboardItem', () => {
  const mockItem = {
    id: '123',
    content: 'Test content',
    type: 'text',
    timestamp: Date.now(),
    isFavorite: false,
    charCount: 12
  };

  const mockHandlers = {
    onCopy: jest.fn(),
    onDelete: jest.fn(),
    onToggleFavorite: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders item content', () => {
    render(<ClipboardItem item={mockItem} {...mockHandlers} />);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  test('displays formatted timestamp', () => {
    render(<ClipboardItem item={mockItem} {...mockHandlers} />);
    // The formatTimestamp function returns "just now" for recent timestamps
    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  test('calls onCopy when copy button is clicked', () => {
    render(<ClipboardItem item={mockItem} {...mockHandlers} />);
    const copyButton = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyButton);
    expect(mockHandlers.onCopy).toHaveBeenCalledWith('123');
  });

  test('calls onDelete when delete button is clicked', () => {
    render(<ClipboardItem item={mockItem} {...mockHandlers} />);
    const deleteButton = screen.getByTitle('Delete');
    fireEvent.click(deleteButton);
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('123');
  });

  test('calls onToggleFavorite when favorite button is clicked', () => {
    render(<ClipboardItem item={mockItem} {...mockHandlers} />);
    const favoriteButton = screen.getByTitle('Add to favorites');
    fireEvent.click(favoriteButton);
    expect(mockHandlers.onToggleFavorite).toHaveBeenCalledWith('123');
  });

  test('renders differently based on item type', () => {
    // Test URL type
    const urlItem = {...mockItem, type: 'url', content: 'https://example.com'};
    const { rerender } = render(<ClipboardItem item={urlItem} {...mockHandlers} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com');
    
    // Test code type
    const codeItem = {...mockItem, type: 'code', content: 'console.log("test")'};
    rerender(<ClipboardItem item={codeItem} {...mockHandlers} />);
    expect(screen.getByText('console.log("test")')).toBeInTheDocument();
    expect(screen.getByText('console.log("test")').closest('pre')).toBeInTheDocument();
  });
}); 