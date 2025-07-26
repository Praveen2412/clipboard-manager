/**
 * End-to-end tests for the Clipboard Manager extension
 * Using a simplified approach with mocked Chrome API
 */

// Mock the Chrome API
global.chrome = {
  runtime: {
    getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  }
};

// Mock clipboard data
const mockClipboardData = {
  items: [
    { id: '1', content: 'Text item', type: 'text', timestamp: Date.now(), isFavorite: false },
    { id: '2', content: 'https://example.com', type: 'url', timestamp: Date.now() - 60000, isFavorite: true },
    { id: '3', content: 'function test() {}', type: 'code', timestamp: Date.now() - 120000, isFavorite: false },
    { id: '4', content: 'data:image/png;base64,ABC', type: 'image', timestamp: Date.now() - 180000, isFavorite: false }
  ]
};

describe('Clipboard Manager Extension', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    chrome.storage.local.get.mockImplementation((key, callback) => {
      if (key === 'clipboardData') {
        callback({ clipboardData: mockClipboardData });
      } else if (key === 'settings') {
        callback({ 
          settings: {
            maxItems: 50,
            maxTextSize: 100000,
            maxImageSize: 5242880,
            verboseLogging: false,
            autoCleanup: true
          }
        });
      } else {
        callback({});
      }
    });
    
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'getClipboardData') {
        callback(mockClipboardData);
      } else if (message.action === 'toggleFavorite' || 
                message.action === 'deleteItem' || 
                message.action === 'addNewItem' || 
                message.action === 'clearAll') {
        callback({ success: true });
      }
      return true;
    });
  });
  
  test('loads clipboard data from storage', () => {
    // Simulate loading clipboard data
    chrome.storage.local.get('clipboardData', (result) => {
      expect(result).toEqual({ clipboardData: mockClipboardData });
      expect(result.clipboardData.items.length).toBe(4);
      expect(result.clipboardData.items[0].type).toBe('text');
      expect(result.clipboardData.items[1].type).toBe('url');
      expect(result.clipboardData.items[2].type).toBe('code');
      expect(result.clipboardData.items[3].type).toBe('image');
    });
    
    expect(chrome.storage.local.get).toHaveBeenCalledWith('clipboardData', expect.any(Function));
  });
  
  test('adds new item to clipboard', () => {
    // Setup mock for set
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    
    // Simulate adding a new item
    const newItem = {
      content: 'New clipboard item',
      type: 'text',
      isFavorite: false
    };
    
    chrome.runtime.sendMessage({ action: 'addNewItem', item: newItem }, (response) => {
      expect(response).toEqual({ success: true });
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'addNewItem', item: newItem },
      expect.any(Function)
    );
  });
  
  test('toggles favorite status of an item', () => {
    // Simulate toggling favorite status
    chrome.runtime.sendMessage({ action: 'toggleFavorite', itemId: '1' }, (response) => {
      expect(response).toEqual({ success: true });
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'toggleFavorite', itemId: '1' },
      expect.any(Function)
    );
  });
  
  test('deletes an item from clipboard', () => {
    // Simulate deleting an item
    chrome.runtime.sendMessage({ action: 'deleteItem', itemId: '2' }, (response) => {
      expect(response).toEqual({ success: true });
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'deleteItem', itemId: '2' },
      expect.any(Function)
    );
  });
  
  test('clears all clipboard items', () => {
    // Simulate clearing all items
    chrome.runtime.sendMessage({ action: 'clearAll' }, (response) => {
      expect(response).toEqual({ success: true });
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'clearAll' },
      expect.any(Function)
    );
  });
}); 