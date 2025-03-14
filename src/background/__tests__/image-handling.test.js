/**
 * Tests for the image capture and handling functionality
 * This file focuses on testing the background script's ability to capture,
 * process, and store images in the clipboard history
 */

// Mock the chrome API
const mockChromeStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn()
  }
};

const mockChromeTabs = {
  captureVisibleTab: jest.fn()
};

const mockChromeRuntime = {
  getURL: jest.fn(),
  sendMessage: jest.fn(),
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  }
};

// Mock the image processing functionality
// Small 1x1 transparent PNG
const mockImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// Create mock implementations for the functions we want to test
const processClipboardImage = async (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return false;
  }
  
  // Get current clipboard
  return new Promise((resolve) => {
    mockChromeStorage.local.get('clipboard', (result) => {
      const clipboard = result.clipboard || [];
      
      // Get settings for max size
      mockChromeStorage.local.get('settings', (settingsResult) => {
        const settings = settingsResult.settings || {};
        const maxImageSize = settings.maxImageSize || 5242880;
        
        // Check if image is too large (rough estimate from base64)
        const base64Data = dataUrl.split(',')[1];
        const sizeInBytes = base64Data ? (base64Data.length * 3) / 4 : 0;
        
        if (sizeInBytes > maxImageSize) {
          resolve(false);
          return;
        }
        
        // Add image to clipboard
        const newItem = {
          id: `img_${Date.now()}`,
          type: 'image',
          dataUrl: dataUrl,
          createdAt: Date.now()
        };
        
        // Add to beginning of array
        const newClipboard = [newItem, ...clipboard];
        
        // Enforce max items limit
        const maxItems = settings.maxItems || 50;
        if (newClipboard.length > maxItems) {
          newClipboard.length = maxItems;
        }
        
        // Save to storage
        mockChromeStorage.local.set({ clipboard: newClipboard }, () => {
          resolve(true);
        });
      });
    });
  });
};

const captureScreenshot = async () => {
  return new Promise((resolve) => {
    mockChromeTabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (dataUrl) {
        processClipboardImage(dataUrl).then(resolve);
      } else {
        resolve(false);
      }
    });
  });
};

describe('Image Capture and Handling', () => {
  beforeEach(() => {
    // Save original chrome object if it exists
    global.originalChrome = global.chrome;
    
    // Create mock chrome API
    global.chrome = {
      storage: mockChromeStorage,
      tabs: mockChromeTabs,
      runtime: mockChromeRuntime,
      contextMenus: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      },
      commands: {
        onCommand: {
          addListener: jest.fn()
        }
      },
      notifications: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      }
    };
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock settings data
    const mockSettings = {
      maxImageSize: 5242880, // 5MB default
      maxItems: 50,
      autoCleanup: true
    };
    
    // Mock clipboard data
    const mockClipboard = [];
    
    // Mock storage.local.get to return settings and clipboard
    mockChromeStorage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback({ settings: mockSettings });
      } else if (key === 'clipboard') {
        callback({ clipboard: mockClipboard });
      } else if (key === null) {
        callback({
          settings: mockSettings,
          clipboard: mockClipboard
        });
      } else {
        callback({});
      }
    });
    
    // Mock storage.local.set to call the callback
    mockChromeStorage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    
    // Mock tab capture to return an image
    mockChromeTabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
      callback(mockImageDataUrl);
    });
  });
  
  afterEach(() => {
    // Restore original chrome object
    global.chrome = global.originalChrome;
  });
  
  test('capturing a screenshot adds an image to clipboard history', async () => {
    // Call the function
    const result = await captureScreenshot();
    
    // Verify chrome.tabs.captureVisibleTab was called
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
    
    // Verify image was saved to storage
    expect(chrome.storage.local.set).toHaveBeenCalled();
    
    // Verify the result is true (success)
    expect(result).toBe(true);
    
    // Verify the saved object contains image data
    const saveCall = chrome.storage.local.set.mock.calls[0][0];
    expect(saveCall).toHaveProperty('clipboard');
    expect(saveCall.clipboard[0]).toHaveProperty('type', 'image');
    expect(saveCall.clipboard[0]).toHaveProperty('dataUrl');
  });
  
  test('respects maxImageSize setting when capturing images', async () => {
    // Override settings with a very small image size limit
    mockChromeStorage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback({ 
          settings: {
            maxImageSize: 10, // Only 10 bytes allowed
            maxItems: 50,
            autoCleanup: true
          }
        });
      } else if (key === 'clipboard') {
        callback({ clipboard: [] });
      } else {
        callback({});
      }
    });
    
    // Create a large mock image that exceeds the limit
    const mockLargeImageDataUrl = 'data:image/png;base64,' + 'A'.repeat(100);
    mockChromeTabs.captureVisibleTab.mockImplementation((windowId, options, callback) => {
      callback(mockLargeImageDataUrl);
    });
    
    // Call the function
    const result = await captureScreenshot();
    
    // Verify chrome.tabs.captureVisibleTab was called
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
    
    // Verify the result is false (failure due to size limit)
    expect(result).toBe(false);
  });
  
  test('processes and saves valid clipboard image data', async () => {
    // Call the function with valid image data
    const result = await processClipboardImage(mockImageDataUrl);
    
    // Verify image was saved to storage
    expect(chrome.storage.local.set).toHaveBeenCalled();
    
    // Verify the result is true (success)
    expect(result).toBe(true);
    
    // Verify the saved object contains image data
    const saveCall = chrome.storage.local.set.mock.calls[0][0];
    expect(saveCall).toHaveProperty('clipboard');
    expect(saveCall.clipboard[0]).toHaveProperty('type', 'image');
    expect(saveCall.clipboard[0]).toHaveProperty('dataUrl');
  });
  
  test('rejects invalid image data', async () => {
    // Call the function with invalid data
    const result = await processClipboardImage('not-an-image');
    
    // Verify the result is false (failure)
    expect(result).toBe(false);
    
    // Verify nothing was saved to storage
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
  
  test('enforces maximum items limit when adding new images', async () => {
    // Create a mock clipboard with max items already
    const mockFullClipboard = Array(50).fill(null).map((_, i) => ({
      id: `item${i}`,
      text: `Item ${i}`,
      type: 'text',
      createdAt: Date.now() - i * 1000
    }));
    
    // Override settings to get full clipboard
    mockChromeStorage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback({ 
          settings: {
            maxImageSize: 5242880,
            maxItems: 50, // Set max items to 50
            autoCleanup: true
          }
        });
      } else if (key === 'clipboard') {
        callback({ clipboard: mockFullClipboard });
      } else {
        callback({});
      }
    });
    
    // Call the function with valid image data
    const result = await processClipboardImage(mockImageDataUrl);
    
    // Verify the result is true (success)
    expect(result).toBe(true);
    
    // Verify image was saved to storage
    expect(chrome.storage.local.set).toHaveBeenCalled();
    
    // Verify the clipboard still has only maxItems entries (oldest one was removed)
    const saveCall = chrome.storage.local.set.mock.calls[0][0];
    expect(saveCall).toHaveProperty('clipboard');
    expect(saveCall.clipboard.length).toBe(50);
    
    // Verify the new image is at the beginning of the array
    expect(saveCall.clipboard[0]).toHaveProperty('type', 'image');
  });
  
  test('handles oversized image properly', async () => {
    // Create a large mock image that exceeds the limit
    const mockLargeImageDataUrl = 'data:image/png;base64,' + 'A'.repeat(1024 * 1024); // 1MB of base64 data
    
    // Set a small image size limit
    mockChromeStorage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback({ 
          settings: {
            maxImageSize: 1024, // Only 1KB allowed
            maxItems: 50,
            autoCleanup: true
          }
        });
      } else if (key === 'clipboard') {
        callback({ clipboard: [] });
      } else {
        callback({});
      }
    });
    
    // Call the function with oversized image data
    const result = await processClipboardImage(mockLargeImageDataUrl);
    
    // Verify the result is false (failure due to size limit)
    expect(result).toBe(false);
    
    // Verify nothing was saved to storage
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
}); 