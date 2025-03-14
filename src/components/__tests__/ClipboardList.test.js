import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ClipboardList from '../ClipboardList';

describe('ClipboardList', () => {
  // Mock handlers
  const mockHandlers = {
    onCopyItem: jest.fn(),
    onDeleteItem: jest.fn(),
    onToggleFavorite: jest.fn(),
    onSearch: jest.fn()
  };

  // Mock clipboard items for testing
  const mockItems = [
    { id: '1', content: 'Test content 1', type: 'text', isFavorite: false, timestamp: Date.now(), charCount: 14 },
    { id: '2', content: 'https://example.com', type: 'url', isFavorite: true, timestamp: Date.now() - 5000, charCount: 19 },
    { id: '3', content: 'const test = "code";', type: 'code', isFavorite: false, timestamp: Date.now() - 10000, charCount: 19 }
  ];

  beforeEach(() => {
    // Clear mocks before each test
    jest.clearAllMocks();
  });

  test('renders clipboard items correctly', () => {
    render(
      <ClipboardList 
        items={mockItems}
        onCopyItem={mockHandlers.onCopyItem}
        onDeleteItem={mockHandlers.onDeleteItem}
        onToggleFavorite={mockHandlers.onToggleFavorite}
      />
    );

    // Check if all items are rendered
    expect(screen.getByText('Test content 1')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('const test = "code";')).toBeInTheDocument();
  });

  test('renders empty state when no items', () => {
    render(
      <ClipboardList 
        items={[]}
        onCopyItem={mockHandlers.onCopyItem}
        onDeleteItem={mockHandlers.onDeleteItem}
        onToggleFavorite={mockHandlers.onToggleFavorite}
      />
    );

    // Should show empty state message
    expect(screen.getByText(/no clipboard items found/i)).toBeInTheDocument();
  });

  test('passes correct props to ClipboardItem', () => {
    render(
      <ClipboardList 
        items={[mockItems[0]]}
        onCopyItem={mockHandlers.onCopyItem}
        onDeleteItem={mockHandlers.onDeleteItem}
        onToggleFavorite={mockHandlers.onToggleFavorite}
      />
    );

    // Check if the item content is rendered correctly
    expect(screen.getByText('Test content 1')).toBeInTheDocument();
  });

  test.skip('toolbar search functionality works correctly', () => {
    // This test is now skipped because the search functionality has been moved to the App component
    render(
      <ClipboardList 
        items={mockItems}
        onCopyItem={mockHandlers.onCopyItem}
        onDeleteItem={mockHandlers.onDeleteItem}
        onToggleFavorite={mockHandlers.onToggleFavorite}
        onSearch={mockHandlers.onSearch}
        searchQuery="test query"
      />
    );

    // This functionality is now in the App component
  });
  
  test.skip('toolbar shows correct item count', () => {
    // This test is now skipped because the item count display has been moved to the App component
    render(
      <ClipboardList 
        items={mockItems}
        onCopyItem={mockHandlers.onCopyItem}
        onDeleteItem={mockHandlers.onDeleteItem}
        onToggleFavorite={mockHandlers.onToggleFavorite}
      />
    );
    
    // This functionality is now in the App component
  });
}); 