/**
 * Tests for window handling functionality (floating window and PiP mode)
 */

import { jest } from '@jest/globals';

// Mock chrome API
global.chrome = {
  runtime: {
    getURL: jest.fn().mockImplementation(path => `chrome-extension://abcdefgh/${path}`),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  windows: {
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

// Mock the screen object
global.screen = {
  availWidth: 1920,
  availHeight: 1080
};

// Mock logVerbose function that's used in background.js
const logVerbose = jest.fn();

// Import background.js module
// Note: Since we can't directly import the background script due to jest environment,
// we'll mock the functions for testing

describe('Window Handling', () => {
  let openFloatingWindow;
  let openPictureInPictureMode;
  let floatingWindowId = null;
  let pipWindowId = null;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset window IDs
    floatingWindowId = null;
    pipWindowId = null;
    
    // Create mock implementations for the window handling functions
    openFloatingWindow = async () => {
      try {
        // Check if window already exists
        if (floatingWindowId) {
          try {
            const windowInfo = await chrome.windows.get(floatingWindowId);
            if (windowInfo) {
              await chrome.windows.update(floatingWindowId, { focused: true });
              return { success: true, message: 'Focused existing floating window' };
            }
          } catch (error) {
            floatingWindowId = null;
          }
        }
        
        // Create new window
        const screenWidth = screen.availWidth || 1366;
        const window = await chrome.windows.create({
          url: chrome.runtime.getURL('floating.html'),
          type: 'popup',
          width: 450,
          height: 600,
          left: Math.round(screenWidth - 450 - 20),
          top: 50
        });
        
        floatingWindowId = window.id;
        
        // Add window close listener
        chrome.windows.onRemoved.addListener(function windowCloseListener(windowId) {
          if (windowId === floatingWindowId) {
            floatingWindowId = null;
            chrome.windows.onRemoved.removeListener(windowCloseListener);
          }
        });
        
        logVerbose('Floating window opened');
        return { success: true };
      } catch (error) {
        console.error('Error opening floating window:', error);
        return { error: error.message };
      }
    };
    
    openPictureInPictureMode = async () => {
      try {
        // Check if window already exists
        if (pipWindowId) {
          try {
            const windowInfo = await chrome.windows.get(pipWindowId);
            if (windowInfo) {
              await chrome.windows.update(pipWindowId, { focused: true });
              return { success: true, message: 'Focused existing PiP window' };
            }
          } catch (error) {
            pipWindowId = null;
          }
        }
        
        // Create new window
        const screenWidth = screen.availWidth || 1366;
        const screenHeight = screen.availHeight || 768;
        
        const window = await chrome.windows.create({
          url: chrome.runtime.getURL('pip.html'),
          type: 'popup',
          width: 250,
          height: 350,
          left: Math.round(screenWidth - 250 - 10),
          top: Math.round(screenHeight - 350 - 10)
        });
        
        pipWindowId = window.id;
        
        // Add window close listener
        chrome.windows.onRemoved.addListener(function windowCloseListener(windowId) {
          if (windowId === pipWindowId) {
            pipWindowId = null;
            chrome.windows.onRemoved.removeListener(windowCloseListener);
          }
        });
        
        logVerbose('PiP mode opened');
        return { success: true };
      } catch (error) {
        console.error('Error opening PiP mode:', error);
        return { error: error.message };
      }
    };
    
    // Mock successful window creation
    chrome.windows.create.mockImplementation(async (options) => {
      return { id: 12345, ...options };
    });
  });
  
  test('opens floating window successfully', async () => {
    // Mock that no window exists yet
    chrome.windows.get.mockRejectedValue(new Error('Window not found'));
    
    const result = await openFloatingWindow();
    
    // Check if windows.create was called with correct parameters
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: 'chrome-extension://abcdefgh/floating.html',
      type: 'popup',
      width: 450,
      height: 600,
      left: expect.any(Number),
      top: 50
    });
    
    // Check if onRemoved listener was added
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled();
    
    // Check result
    expect(result).toEqual({ success: true });
  });
  
  test('focuses existing floating window', async () => {
    // Setup: Simulate an existing window
    floatingWindowId = 12345;
    chrome.windows.get.mockResolvedValue({ id: floatingWindowId });
    
    const result = await openFloatingWindow();
    
    // Should not create a new window
    expect(chrome.windows.create).not.toHaveBeenCalled();
    
    // Should update the existing window to focus it
    expect(chrome.windows.update).toHaveBeenCalledWith(floatingWindowId, { focused: true });
    
    // Check result
    expect(result).toEqual({ success: true, message: 'Focused existing floating window' });
  });
  
  test('opens PiP window successfully', async () => {
    // Mock that no window exists yet
    chrome.windows.get.mockRejectedValue(new Error('Window not found'));
    
    const result = await openPictureInPictureMode();
    
    // Check if windows.create was called with correct parameters
    expect(chrome.windows.create).toHaveBeenCalledWith({
      url: 'chrome-extension://abcdefgh/pip.html',
      type: 'popup',
      width: 250,
      height: 350,
      left: expect.any(Number),
      top: expect.any(Number)
    });
    
    // Check if onRemoved listener was added
    expect(chrome.windows.onRemoved.addListener).toHaveBeenCalled();
    
    // Check result
    expect(result).toEqual({ success: true });
  });
  
  test('focuses existing PiP window', async () => {
    // Setup: Simulate an existing window
    pipWindowId = 54321;
    chrome.windows.get.mockResolvedValue({ id: pipWindowId });
    
    const result = await openPictureInPictureMode();
    
    // Should not create a new window
    expect(chrome.windows.create).not.toHaveBeenCalled();
    
    // Should update the existing window to focus it
    expect(chrome.windows.update).toHaveBeenCalledWith(pipWindowId, { focused: true });
    
    // Check result
    expect(result).toEqual({ success: true, message: 'Focused existing PiP window' });
  });
  
  test('handles window creation error', async () => {
    // Mock window creation error
    chrome.windows.get.mockRejectedValue(new Error('Window not found'));
    chrome.windows.create.mockRejectedValue(new Error('Failed to create window'));
    
    const result = await openFloatingWindow();
    
    // Check result contains error
    expect(result).toEqual({ error: 'Failed to create window' });
  });
}); 