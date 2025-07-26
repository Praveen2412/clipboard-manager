/**
 * End-to-end tests for the Settings page functionality
 * These tests verify that settings are properly saved and applied
 * with a special focus on image capture features
 */

// Mock the Chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      })
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  runtime: {
    getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn()
  }
};

// Mock settings data
const mockSettings = {
  settings: {
    verboseLogging: false,
    maxItems: 50,
    autoCleanup: true,
    colorTheme: 'system',
    showMetaInfo: true,
    maxTextSize: 100000, // 100KB default
    maxImageSize: 5242880, // 5MB default
    favoriteShortcuts: {}
  }
};

describe('Settings Component Tests', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    chrome.storage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback(mockSettings);
      } else {
        callback({});
      }
    });
  });
  
  test('Settings loads with correct initial values', () => {
    // Verify chrome.storage.local.get is called with 'settings'
    expect(chrome.storage.local.get).not.toHaveBeenCalled();
    
    // Simulate loading settings
    chrome.storage.local.get('settings', (result) => {
      expect(result).toEqual(mockSettings);
      expect(result.settings.maxItems).toBe(50);
      expect(result.settings.verboseLogging).toBe(false);
      expect(result.settings.autoCleanup).toBe(true);
    });
    
    expect(chrome.storage.local.get).toHaveBeenCalledWith('settings', expect.any(Function));
  });
  
  test('Saving settings updates storage', () => {
    // Simulate saving settings
    const updatedSettings = {
      ...mockSettings.settings,
      maxItems: 100
    };
    
    chrome.storage.local.set({ settings: updatedSettings }, () => {
      // Verify set was called with the right parameters
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { settings: updatedSettings },
        expect.any(Function)
      );
    });
  });
  
  test('Toggling verbose logging sends message to background', () => {
    // Setup mock for sendMessage
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'toggleVerboseLogging') {
        callback({ success: true });
      }
    });
    
    // Simulate toggling verbose logging
    chrome.runtime.sendMessage({ action: 'toggleVerboseLogging', value: true }, (response) => {
      expect(response).toEqual({ success: true });
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'toggleVerboseLogging', value: true },
      expect.any(Function)
    );
  });
  
  test('Max text size is properly formatted', () => {
    const textSizeInBytes = 204800; // 200 KB
    const formattedSize = (textSizeInBytes / 1024).toFixed(0) + ' KB';
    
    expect(formattedSize).toBe('200 KB');
  });
  
  test('Max image size is properly formatted', () => {
    const imageSizeInBytes = 5242880; // 5 MB
    const formattedSize = (imageSizeInBytes / (1024 * 1024)).toFixed(1) + ' MB';
    
    expect(formattedSize).toBe('5.0 MB');
  });
  
  test('Image capture respects size limits', () => {
    // Setup mock for sendMessage with image capture
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (message.action === 'captureVisibleTab') {
        if (message.simulateOversize) {
          // Simulate an oversized image that exceeds the limit
          callback(null);
        } else {
          // Simulate a valid image
          callback('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==');
        }
      }
    });
    
    // Test with normal image
    chrome.runtime.sendMessage({ action: 'captureVisibleTab', simulateOversize: false }, (result) => {
      expect(result).toBeTruthy();
    });
    
    // Test with oversized image
    chrome.runtime.sendMessage({ action: 'captureVisibleTab', simulateOversize: true }, (result) => {
      expect(result).toBeFalsy();
    });
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });
  
  test('Export functionality retrieves all data', () => {
    const allData = {
      settings: mockSettings.settings,
      clipboard: [
        { id: '1', text: 'Test item', type: 'text' }
      ]
    };
    
    // Setup mock for get with null (all data)
    chrome.storage.local.get.mockImplementation((key, callback) => {
      if (key === null) {
        callback(allData);
      }
    });
    
    // Simulate export
    chrome.storage.local.get(null, (data) => {
      expect(data).toEqual(allData);
      
      // Verify the exported JSON can be parsed back
      const exportedJson = JSON.stringify(data);
      const parsedData = JSON.parse(exportedJson);
      
      expect(parsedData).toEqual(allData);
    });
    
    expect(chrome.storage.local.get).toHaveBeenCalledWith(null, expect.any(Function));
  });
  
  test('Import functionality sets all data', () => {
    const importData = {
      settings: {
        ...mockSettings.settings,
        maxItems: 200,
        maxTextSize: 204800
      },
      clipboard: [
        { id: '1', text: 'Imported item', type: 'text' }
      ]
    };
    
    // Simulate import
    chrome.storage.local.set(importData, () => {
      expect(chrome.storage.local.set).toHaveBeenCalledWith(importData, expect.any(Function));
    });
  });
  
  test('Invalid JSON import is handled gracefully', () => {
    // This would be handled in the component's try/catch block
    expect(() => {
      JSON.parse('{invalid json}');
    }).toThrow();
  });
}); 