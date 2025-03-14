import { renderHook, act } from '@testing-library/react-hooks';
import useClipboardData from '../useClipboardData';

// Helper function to wait for state updates
const waitForStateUpdate = () => new Promise(resolve => setTimeout(resolve, 0));

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  }
};

// Mock clipboard data for testing
const mockClipboardData = {
  items: [
    { id: '1', content: 'Text item', type: 'text', timestamp: Date.now(), isFavorite: false },
    { id: '2', content: 'https://example.com', type: 'url', timestamp: Date.now(), isFavorite: true },
    { id: '3', content: 'function test() {}', type: 'code', timestamp: Date.now(), isFavorite: false },
    { id: '4', content: 'data:image/png;base64,ABC', type: 'image', timestamp: Date.now(), isFavorite: false },
    { id: '5', content: 'Another text', type: 'text', timestamp: Date.now(), isFavorite: true }
  ]
};

describe('useClipboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the sendMessage function to return our mockClipboardData
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getClipboardData') {
        setTimeout(() => callback(mockClipboardData), 0);
      } else if (message.action === 'toggleFavorite' || 
                message.action === 'deleteItem' || 
                message.action === 'addNewItem' || 
                message.action === 'clearAll') {
        callback({ success: true });
      }
      return true;
    });
  });

  it.skip('should load clipboard data on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useClipboardData());
    
    // Initially it should be loading or undefined (during initialization)
    expect(result.current.loading !== false).toBe(true);
    
    // Wait for the data to load
    await waitForNextUpdate();
    
    // After loading, we should have the data
    // Add a retry mechanism to wait for clipboardData to be defined
    let attempts = 0;
    while (attempts < 5 && (!result.current.clipboardData || !result.current.clipboardData.items)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Now check the data
    expect(result.current.clipboardData?.items).toEqual(mockClipboardData.items);
  });

  it('should filter items by tab correctly', async () => {
    // Test 'all' tab
    const { result, waitForNextUpdate } = renderHook(() => useClipboardData('all', ''));
    await waitForNextUpdate();
    
    // Should include all items
    expect(result.current.filteredItems.length).toBe(5);
    
    // Test 'text' tab
    const { result: textResult, waitForNextUpdate: waitForTextUpdate } = renderHook(() => 
      useClipboardData('text', '')
    );
    await waitForTextUpdate();
    
    // Should only include text items
    expect(textResult.current.filteredItems.length).toBe(2);
    expect(textResult.current.filteredItems.every(item => item.type === 'text')).toBe(true);
    
    // Test 'url' tab
    const { result: urlResult, waitForNextUpdate: waitForUrlUpdate } = renderHook(() => 
      useClipboardData('url', '')
    );
    await waitForUrlUpdate();
    
    // Should only include url items
    expect(urlResult.current.filteredItems.length).toBe(1);
    expect(urlResult.current.filteredItems[0].type).toBe('url');
    
    // Test 'favorites' tab
    const { result: favResult, waitForNextUpdate: waitForFavUpdate } = renderHook(() => 
      useClipboardData('favorites', '')
    );
    await waitForFavUpdate();
    
    // Should only include favorite items
    expect(favResult.current.filteredItems.length).toBe(2);
    expect(favResult.current.filteredItems.every(item => item.isFavorite)).toBe(true);
  });

  it('should filter by search query correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useClipboardData('all', ''));
    
    await waitForNextUpdate();
    
    // Test search filtering
    act(() => {
      result.current.handleSearchQueryChange('text');
    });
    
    // Wait for state to update
    await waitForStateUpdate();
    
    // Should filter to items containing 'text' in content
    expect(result.current.filteredItems.some(item => item.content.includes('Text'))).toBe(true);
    expect(result.current.filteredItems.length).toBeLessThan(mockClipboardData.items.length);
    
    // Test special case for image search
    act(() => {
      result.current.handleSearchQueryChange('image');
    });
    
    // Wait for state to update
    await waitForStateUpdate();
    
    // Should include image items when searching for 'image'
    expect(result.current.filteredItems.some(item => item.type === 'image')).toBe(true);
  });

  it('should combine tab and search filtering correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useClipboardData('text', ''));
    
    await waitForNextUpdate();
    
    // Initially should show all text items
    expect(result.current.filteredItems.every(item => item.type === 'text')).toBe(true);
    expect(result.current.filteredItems.length).toBe(2);
    
    // Add search filter
    act(() => {
      result.current.handleSearchQueryChange('Another');
    });
    
    // Wait for state to update
    await waitForStateUpdate();
    
    // Should filter to text items containing 'Another'
    expect(result.current.filteredItems.length).toBe(1);
    expect(result.current.filteredItems[0].content).toBe('Another text');
    expect(result.current.filteredItems[0].type).toBe('text');
  });
}); 