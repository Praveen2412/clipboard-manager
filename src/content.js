/**
 * Content script for Clipboard Manager extension
 * Handles page interactions and paste operations
 * 
 * This is a minimal implementation designed to not interfere with normal page behavior
 */

// State variables
let verboseLogging = false;
let justCopied = false; // Track when Ctrl+C was just pressed
let lastCopyTime = 0;
let copyKeyPressed = false; // Track copy key state
let pasteKeyPressed = false; // Track paste key state

// MODIFIED: Remove global indicator that was causing text selection issues
// Only track mouseButtonDown in events that need it, not globally

// MODIFIED: Remove the event listeners that were interfering with selection
// document.addEventListener('mousedown', () => {
//   window.mouseButtonDown = true;
// }, { passive: true, capture: false });
// 
// document.addEventListener('mouseup', () => {
//   window.mouseButtonDown = false;
// }, { passive: true, capture: false });

// Helper function to detect Copy command (Ctrl+C or Command+C)
const detectCopyEvent = (event) => {
  // Windows/Linux: Ctrl+C, Mac: Command+C
  return (event.ctrlKey || event.metaKey) && (event.key === 'c' || event.keyCode === 67);
};

// Helper function to detect Paste command (Ctrl+V or Command+V)
const detectPasteEvent = (event) => {
  // Windows/Linux: Ctrl+V, Mac: Command+V
  return (event.ctrlKey || event.metaKey) && (event.key === 'v' || event.keyCode === 86);
};

// NEW: Create a MutationObserver to monitor clipboard button clicks
const setupClipboardButtonObserver = () => {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-clipboard-copied') {
        const target = mutation.target;
        if (target && target.getAttribute('data-clipboard-copied') === 'true') {
          // Clipboard button was clicked
          console.log('[Clipboard Manager] Clipboard button click detected');
          notifyBackgroundAboutCopy();
        }
      }
    });
  });
  
  // Look for buttons with clipboard classes
  const clipboardButtons = document.querySelectorAll('[class*="copy"], [class*="clipboard"], button[data-clipboard-text]');
  clipboardButtons.forEach(button => {
    observer.observe(button, { attributes: true });
  });
  
  return observer;
};

// Setup clipboard button observer when the page is ready
document.addEventListener('DOMContentLoaded', () => {
  setupClipboardButtonObserver();
});

// Function to notify background script about copy
const notifyBackgroundAboutCopy = () => {
  justCopied = true;
  copyKeyPressed = true;
  lastCopyTime = Date.now();
  
  // Notify background script that a keyboard copy occurred
  try {
    chrome.runtime.sendMessage({ 
      action: 'copyKeyDetected',
      hasSelection: window.getSelection().toString().trim() !== '',
      timestamp: lastCopyTime
    }, response => {
      // Check for connection error
      if (chrome.runtime.lastError) {
        console.log('[Clipboard Manager] Runtime error:', chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    // Catch errors when extension context is invalidated
    console.log('[Clipboard Manager] Failed to send message - extension context may be invalid');
  }
  
  // Reset the flag after a short delay (let clipboard operation complete)
  setTimeout(() => {
    justCopied = false;
  }, 500);
  
  // Reset the key pressed flag after a longer delay
  setTimeout(() => {
    copyKeyPressed = false;
  }, 2000);
};

// Notify background about paste event
const notifyBackgroundAboutPaste = () => {
  // Set both paste and copy indicators to ensure clipboard is read
  pasteKeyPressed = true;
  justCopied = true; // Treat paste like copy for clipboard reading purposes
  lastCopyTime = Date.now();
  
  // Reset the justCopied flag after a short delay
  setTimeout(() => {
    justCopied = false;
  }, 500);
  
  // Reset the paste key flag after a longer delay
  setTimeout(() => {
    pasteKeyPressed = false;
  }, 2000);
  
  // Notify background script about paste
  chrome.runtime.sendMessage({
    action: 'pasteKeyDetected',
    hasSelection: window.getSelection().toString().trim() !== '',
    timestamp: Date.now()
  });
};

// NEW: Add keyboard event listener to detect Ctrl+C copy events
document.addEventListener('keydown', (event) => {
  // Check for Ctrl+C (copy) keyboard shortcut
  if (detectCopyEvent(event)) {
    console.log('[Clipboard Manager] Copy keyboard shortcut detected');
    notifyBackgroundAboutCopy();
  }
  
  // Check for Ctrl+V (paste) keyboard shortcut
  if (detectPasteEvent(event)) {
    console.log('[Clipboard Manager] Paste keyboard shortcut detected');
    notifyBackgroundAboutPaste();
  }
}, { passive: true });

// NEW: Also listen for copy event (right-click copy or Edit menu)
document.addEventListener('copy', () => {
  console.log('[Clipboard Manager] Copy event detected');
  notifyBackgroundAboutCopy();
}, { passive: true });

// Expose copy detection status to be checked by clipboard reader
window.getClipboardManagerState = () => {
  return {
    justCopied,
    lastCopyTime,
    hasSelection: window.getSelection().toString().trim() !== '',
    copyKeyPressed: copyKeyPressed === true,
    pasteKeyPressed: pasteKeyPressed === true
  };
};

/**
 * Paste content to the active element on the page
 * @param {string} content - The content to paste
 * @returns {boolean} - Success or failure
 */
const pasteToActiveElement = (content) => {
  try {
    logVerbose('Attempting to paste content to active element');
    
    // Get active element
    const activeElement = document.activeElement;
    
    // Check if element can accept paste
    if (!activeElement || 
        (activeElement.tagName !== 'INPUT' && 
         activeElement.tagName !== 'TEXTAREA' && 
         !activeElement.isContentEditable)) {
      showNotification('Please focus on an input field, textarea, or editable area', 'error');
      return false;
    }
    
    // Handle different element types
    if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
      // Store original selection
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const before = activeElement.value.substring(0, start);
      const after = activeElement.value.substring(end);
      
      // Use standard clipboard API if available
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        // For modern browsers, use clipboard API
        navigator.clipboard.writeText(content).then(() => {
          // Then use the browser's own paste mechanism
          document.execCommand('paste');
        }).catch(() => {
          // Fallback to direct value manipulation
          activeElement.value = before + content + after;
          activeElement.selectionStart = activeElement.selectionEnd = start + content.length;
          
          // Trigger input event for frameworks that listen for it
          activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else {
        // Direct manipulation fallback
        activeElement.value = before + content + after;
        activeElement.selectionStart = activeElement.selectionEnd = start + content.length;
        
        // Trigger input event for frameworks that listen for it
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (activeElement.isContentEditable) {
      // For contentEditable elements
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(content).then(() => {
          document.execCommand('paste');
        }).catch(() => {
          // Fallback to execCommand insertText
          document.execCommand('insertText', false, content);
        });
      } else {
        // Fallback to execCommand
        document.execCommand('insertText', false, content);
      }
    }
    
    // Show success notification
    showNotification('Pasted from Clipboard Manager', 'success');
    return true;
  } catch (error) {
    console.error('Error pasting content:', error);
    showNotification('Failed to paste content', 'error');
    return false;
  }
};

/**
 * Show notification in the UI
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, info)
 */
const showNotification = (message, type = 'info') => {
  try {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `clipboard-manager-notification ${type}`;
    notification.textContent = message;
    
    // Apply styles
    Object.assign(notification.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 15px',
      borderRadius: '4px',
      backgroundColor: '#1e1e1e',
      color: '#e0e0e0',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      zIndex: '2147483647',
      fontSize: '14px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      transition: 'opacity 0.3s, transform 0.3s',
      opacity: '0',
      borderLeft: '4px solid',
      pointerEvents: 'none' // Make sure notifications don't interfere with mouse events
    });
    
    // Set color based on type
    if (type === 'success') {
      notification.style.borderLeftColor = '#4caf50';
    } else if (type === 'error') {
      notification.style.borderLeftColor = '#f44336';
    } else {
      notification.style.borderLeftColor = '#2196f3';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(20px)';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 4000);
    }, 5000);
  } catch (error) {
    console.error('Error showing notification:', error);
  }
};

/**
 * Log verbose messages (only if enabled)
 * @param {...any} args - Arguments to log
 */
const logVerbose = (...args) => {
  if (verboseLogging) {
    console.log('[Clipboard Manager]', ...args);
  }
};

// Set up message listener without using any global event handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Log if verbose logging is enabled
  logVerbose('Message received:', message);
  
  try {
    // Ensure only specific actions are handled
    if (!message || !message.action) {
      logVerbose('Ignoring message without action:', message);
      sendResponse({ error: 'No action specified' });
      return true;
    }
    
    switch (message.action) {
      case 'pasteContent':
        const success = pasteToActiveElement(message.content);
        sendResponse({ success });
        break;
        
      case 'showNotification':
        showNotification(message.message, message.type);
        sendResponse({ success: true });
        break;
        
      case 'toggleVerboseLogging':
        verboseLogging = message.enabled;
        logVerbose('Verbose logging ' + (verboseLogging ? 'enabled' : 'disabled'));
        sendResponse({ success: true });
        break;
        
      default:
        logVerbose('Unknown action received:', message.action);
        sendResponse({ error: 'Unknown action' });
        break;
    }
      
      // Always return true to indicate we'll call sendResponse asynchronously
      return true;
    } catch (err) {
      console.error('Error handling message:', err);
      try {
        sendResponse({ error: err.message });
      } catch (e) {
        console.log('[Clipboard Manager] Failed to send response - extension context may be invalid');
      }
      return true;
    }
  } catch (outerError) {
    console.log('[Clipboard Manager] Extension context invalidated or other critical error:', outerError);
    return false; // Don't keep the messaging channel open if we can't process messages
  }
});

// Log content script loaded without adding any event listeners
logVerbose('Clipboard Manager content script loaded'); 