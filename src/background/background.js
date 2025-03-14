/**
 * Background script for Clipboard Manager extension
 * Handles clipboard monitoring, storage, and messaging
 */

// Constants
const CLIPBOARD_CHECK_INTERVAL = 1000; // 1 second (more frequent checks)
const DEFAULT_MAX_TEXT_LENGTH = 10000; // Default maximum text length

// State variables
let clipboardData = {
  items: [],
  favorites: []
};
let lastClipboardText = '';
let isProcessingClipboard = false;
let floatingWindowId = null;
let verboseLogging = false; // Default to false, will be updated from storage
let checkInterval = null;

// State tracking for copy key detection
let copyKeyDetectedTime = 0;
let lastCopyTimestamp = 0;
let forceNextClipboardCheck = false;

// Settings vars with defaults
let MAX_HISTORY_ITEMS = 100; // Default value, will be updated from settings
let maxTextLength = 10000;
let maxImageSize = 1000; // in KB
let showCharCount = true;

/**
 * Log verbose messages (only if enabled)
 * @param {...any} args - Arguments to log
 */
const logVerbose = (...args) => {
  if (verboseLogging) {
    console.log('[Clipboard Manager]', ...args);
  }
};

/**
 * Generate a unique ID
 * @returns {string} - Unique ID
 */
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

/**
 * Check if a URL is restricted (extension can't run on it)
 * @param {string} url - URL to check
 * @returns {boolean} - True if restricted
 */
const isRestrictedUrl = (url) => {
  if (!url) return true;
  
  const restrictedProtocols = [
    'chrome:', 'chrome-extension:', 'chrome-search:',
    'edge:', 'devtools:', 'about:', 'data:',
    'file:', 'view-source:'
  ];
  
  try {
    const urlObj = new URL(url);
    return restrictedProtocols.some(protocol => urlObj.protocol.startsWith(protocol));
  } catch (error) {
    return true;
  }
};

// Window close listener
const windowCloseListener = (windowId) => {
  if (windowId === floatingWindowId) {
    floatingWindowId = null;
    chrome.windows.onRemoved.removeListener(windowCloseListener);
  }
};

// Auto-start the extension when installed or browser starts
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started - initializing clipboard manager');
  
  // Add a slight delay to ensure the browser is fully initialized
  setTimeout(() => {
    initialize().catch(error => {
      console.error('Error during startup initialization:', error);
      // Try again after a delay
      setTimeout(initialize, 5000);
    });
  }, 1000);
});

// Also initialize when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated - initializing clipboard manager');
  
  // Create an alarm that will wake up the background script periodically
  chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
  
  // Also create a more frequent alarm for monitoring during development/debugging
  chrome.alarms.create('monitorCheck', { periodInMinutes: 0.5 });
  
  // Initialize after a short delay to ensure all browser systems are ready
  setTimeout(() => {
    initialize().catch(error => {
      console.error('Error during installation initialization:', error);
      // Try again after a delay
      setTimeout(initialize, 5000);
    });
  }, 1000);
});

// Handle alarms to keep the service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive' || alarm.name === 'monitorCheck') {
    console.log(`${alarm.name} alarm triggered - ensuring clipboard monitoring is active`);
    if (!checkInterval) {
      console.log('Clipboard monitoring was not running - restarting...');
      startClipboardMonitoring();
    } else {
      console.log('Clipboard monitoring is active, interval ID:', checkInterval);
    }
    
    // Update lastAliveTime
    const lastAliveTime = Date.now();
    chrome.storage.local.set({ lastAliveTime });
    
    // Occasionally check for images specifically on the monitorCheck alarm
    if (alarm.name === 'monitorCheck') {
      console.log('Running periodic direct image check');
      checkForImageData().catch(error => {
        console.warn('Periodic image check failed:', error);
      });
    }
  }
});

/**
 * Initialize background script
 */
const initialize = async () => {
  try {
    console.log('Initializing Clipboard Manager background script');
    
    // Load settings from storage
    const settingsData = await chrome.storage.sync.get('settings');
    if (settingsData && settingsData.settings) {
      // Update global settings
      verboseLogging = settingsData.settings.enableVerboseLogging || false;
      maxTextLength = settingsData.settings.maxTextLength || DEFAULT_MAX_TEXT_LENGTH;
      
      logVerbose('Settings loaded:', settingsData.settings);
    }
    
    // Load clipboard data from storage
    await loadClipboardData();
    
    // Start clipboard monitoring - ensure it's always running
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    startClipboardMonitoring();
    
    // Setup context menus
    setupContextMenus();
    
    // Add listener for when extension icon is clicked
    chrome.action.onClicked.addListener(() => {
      chrome.tabs.create({ url: 'index.html' });
    });
    
    // Explicitly check for clipboard content on startup
    setTimeout(() => {
      console.log('Performing initial clipboard check');
      checkClipboardForChanges(true); // Force check
    }, 2000);
    
    // Do an additional image check with delay to ensure the browser is ready
    setTimeout(() => {
      console.log('Performing initial image check');
      checkForImageData().catch(error => {
        console.warn('Initial image check failed:', error);
      });
    }, 3000);
    
    // Restart monitoring if it stops for any reason
    setInterval(() => {
      if (!checkInterval) {
        console.log('Clipboard monitoring was not running - restarting...');
        startClipboardMonitoring();
      }
    }, 60000); // Check every minute
    
    // Add a diagnostics check to verify clipboard monitoring
    setTimeout(() => {
      console.log('=== Clipboard Manager Diagnostics ===');
      console.log(`Active clipboard monitoring: ${checkInterval !== null ? 'YES' : 'NO'}`);
      console.log(`Check interval active: ${checkInterval ? 'YES' : 'NO'}`);
      console.log(`Clipboard items loaded: ${clipboardData.items.length}`);
      console.log(`Last clipboard text: ${lastClipboardText ? 'Present' : 'None'} (${lastClipboardText ? lastClipboardText.substring(0, 20) + '...' : ''})`);
      
      // Test message broadcast
      console.log('Testing message broadcast system...');
      const testMessage = {
        action: 'clipboardManagerDiagnostic',
        timestamp: Date.now()
      };
      
      chrome.runtime.sendMessage(testMessage, (response) => {
        if (chrome.runtime.lastError) {
          console.log('No UI connected yet - this is normal if no popup/floating window is open');
        } else if (response) {
          console.log('Message system working:', response);
        } else {
          console.log('Message sent but no response received');
        }
      });
      
      console.log('================================');
    }, 5000);
    
    console.log('Clipboard Manager background script initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing background script:', error);
    // Attempt to restart on error
    setTimeout(initialize, 10000);
    return false;
  }
};

/**
 * Start monitoring clipboard for changes
 */
const startClipboardMonitoring = () => {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  checkInterval = setInterval(checkClipboardForChanges, CLIPBOARD_CHECK_INTERVAL);
  logVerbose('Clipboard monitoring started with interval:', CLIPBOARD_CHECK_INTERVAL);
  
  // Force an immediate check
  setTimeout(checkClipboardForChanges, 100);
};

/**
 * Process a key copy event (Ctrl+C) detected by content script
 * @param {boolean} hasSelection - Whether there's text selected
 * @param {number} timestamp - When the copy happened
 */
const handleCopyKeyDetected = (hasSelection, timestamp = Date.now()) => {
  logVerbose('Copy key detection received, hasSelection:', hasSelection, 'timestamp:', timestamp);
  copyKeyDetectedTime = Date.now();
  lastCopyTimestamp = timestamp;
  forceNextClipboardCheck = true;
  
  // Immediately trigger a clipboard check with a small delay
  // to allow the clipboard operation to complete
  setTimeout(() => {
    logVerbose('Performing forced clipboard check after copy key detection');
    checkClipboardForChanges(true); // Force check regardless of selection
  }, 100);
  
  // Sometimes the first check might miss the clipboard content if it's still
  // being processed, so do a second check after a slightly longer delay
  setTimeout(() => {
    if (forceNextClipboardCheck) {
      logVerbose('Performing second forced clipboard check');
      checkClipboardForChanges(true);
      forceNextClipboardCheck = false;
    }
  }, 500);
};

/**
 * Check clipboard for changes
 * @param {boolean} force - Force check even if there's selection
 */
const checkClipboardForChanges = async (force = false) => {
  if (isProcessingClipboard) {
    // If it's been processing for more than 10 seconds, reset the flag
    if (isProcessingClipboard && (Date.now() - isProcessingClipboard) > 10000) {
      console.warn('Clipboard processing took too long, resetting flag');
      isProcessingClipboard = false;
    } else {
      return;
    }
  }

  try {
    // Set a timestamp when we started processing
    isProcessingClipboard = Date.now();
    logVerbose('Checking clipboard for changes, force =', force);

    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      logVerbose('No active tab found, trying again with all windows');
      // Try to find any active tab in any window
      const allTabs = await chrome.tabs.query({ active: true });
      if (!allTabs || allTabs.length === 0) {
        logVerbose('No active tab found in any window, skipping clipboard check');
        isProcessingClipboard = false;
        return;
      }
      // Use the first active tab found
      tabs[0] = allTabs[0];
    }

    const activeTab = tabs[0];
    
    // Skip restricted URLs
    if (isRestrictedUrl(activeTab.url)) {
      logVerbose('Restricted URL, skipping clipboard check:', activeTab.url);
      isProcessingClipboard = false;
      return;
    }
    
    logVerbose('Reading clipboard from tab:', activeTab.title);
    
    // Check for image content first - often more reliable
    try {
      const imageResult = await checkForImageData();
      if (imageResult && imageResult.imageDetected) {
        console.log('Image detected and processed');
        isProcessingClipboard = false;
        return;
      }
    } catch (imageError) {
      console.warn('Error checking for image data:', imageError);
    }
    
    // Then check for text content
    try {
      // Execute the content script to read clipboard data with enhanced error handling
      const clipboardResults = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (forceCheck) => {
          // A safe wrapper for reading the clipboard
          function safeReadClipboard() {
            try {
              // Check if we should force the clipboard read (after Ctrl+C or Ctrl+V)
              const forceClipboardCheck = window.forceClipboardCheck === true || forceCheck === true;
              if (forceClipboardCheck) {
                console.log('[Clipboard Manager] Forcing clipboard read after copy/paste event:', forceCheck);
                // Reset the force flag
                window.forceClipboardCheck = false;
              }
              
              // Create a safe response object to avoid null reference errors
              const safeResponse = {
                success: true,
                text: null,
                skipReason: null,
                error: null
              };
              
              // Always try to read the clipboard regardless of selection state
              // to improve reliability
              try {
                // Use the Clipboard API
                const text = window.navigator.clipboard.readText().then(text => {
                  if (text && text.length > 0) {
                    console.log('[Clipboard Manager] Text found in clipboard via API');
                    return text;
                  }
                  return null;
                }).catch(e => {
                  console.warn('[Clipboard Manager] Clipboard API access failed:', e);
                  return null;
                });
                
                return text;
              } catch (e) {
                safeResponse.error = 'Clipboard API error: ' + e.message;
                console.warn('[Clipboard Manager] Error reading clipboard:', e);
                return safeResponse;
              }
            } catch (error) {
              console.error('[Clipboard Manager] Critical error in safeReadClipboard:', error);
              return {
                success: false,
                error: 'Critical error: ' + error.message 
              };
            }
          }
          
          return safeReadClipboard();
        },
        args: [force]
      });
      
      // Process the result
      if (clipboardResults && clipboardResults.length > 0) {
        const clipboardResult = clipboardResults[0].result;
        
        if (clipboardResult && clipboardResult.then) {
          // It's a promise, need to resolve it
          clipboardResult.then(text => {
            if (text && typeof text === 'string' && text !== lastClipboardText) {
              processClipboardContent(text);
            }
          }).catch(error => {
            console.error('Error resolving clipboard promise:', error);
          });
        } else if (clipboardResult && clipboardResult.text && clipboardResult.text !== lastClipboardText) {
          // It's already a text result
          processClipboardContent(clipboardResult.text);
        } else if (typeof clipboardResult === 'string' && clipboardResult !== lastClipboardText) {
          // Direct string result
          processClipboardContent(clipboardResult);
        } else if (clipboardResult && clipboardResult.error) {
          console.warn('Error reading clipboard:', clipboardResult.error);
        }
      }
    } catch (error) {
      console.error('Error executing clipboard read script:', error);
    }
    
    isProcessingClipboard = false;
  } catch (error) {
    console.error('Error in clipboard check:', error);
    isProcessingClipboard = false;
  }
};

/**
 * Process clipboard content and save to history
 * @param {string} content - Clipboard content
 */
const processClipboardContent = async (content) => {
  try {
    // Skip empty content
    if (!content || content.trim() === '') {
      console.log('Background: Skipping empty content');
      return;
    }
    
    // Compare with last clipboard text (case-sensitive)
    if (content === lastClipboardText) {
      console.log('Background: Skipping duplicate content (exact match)');
      return;
    }
    
    // Check content size against settings before processing
    if (content.length > maxTextLength) {
      console.log(`Background: Content exceeds maximum length (${content.length} > ${maxTextLength}), skipping`);
      
      // Show notification
      handleShowNotification({
        type: 'warning',
        message: `Text exceeds maximum length (${Math.round(content.length / 1000)}K > ${Math.round(maxTextLength / 1000)}K chars)`
      });
      
      return;
    }
    
    // Update last clipboard text reference
    lastClipboardText = content;
    
    const contentType = categorizeContent(content);
    console.log(`Background: Processing new clipboard content: type=${contentType}, length=${content.length}, preview="${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`);
    
    // Create new item with detailed information
    const newItem = {
      id: generateId(),
      content: content,
      type: contentType,
      timestamp: Date.now(),
      isFavorite: false,
      charCount: content.length
    };
    
    // Check if duplicate items exist (by content)
    const existingItemIndex = clipboardData.items.findIndex(item => item.content === content);
    
    if (existingItemIndex !== -1) {
      // If the item exists, delete it so we can move it to the top
      clipboardData.items.splice(existingItemIndex, 1);
      console.log('Background: Item already exists, moving to top of history');
    }
    
    // Add to history at the top
    clipboardData.items.unshift(newItem);
    
    // Limit history size
    const maxItems = MAX_HISTORY_ITEMS;
    if (clipboardData.items.length > maxItems) {
      console.log(`Background: Trimming history to ${maxItems} items`);
      clipboardData.items = clipboardData.items.slice(0, maxItems);
    }
    
    // Save changes to storage
    await saveClipboardData();
    
    console.log('Background: Clipboard content processed successfully, broadcasting update');
    
    // Broadcast change to all UI instances with HIGH priority
    broadcastClipboardUpdate();
    
    return newItem;
  } catch (error) {
    console.error('Background: Error processing clipboard content:', error);
    return null;
  }
};

/**
 * Broadcast clipboard data update to all UI instances
 * Makes multiple attempts with different message types for redundancy
 */
const broadcastClipboardUpdate = () => {
  try {
    console.log('Broadcasting clipboard update to all UI instances');
    
    // Check if there are any active connections before sending messages
    // Note: In background scripts, we can't directly check for listeners,
    // but we can track active connections based on window IDs
    const hasActiveWindows = floatingWindowId !== null;
    
    // Track if we're seeing connection errors to avoid flooding the console
    let connectionErrorLogged = false;
    
    const logConnectionError = (error, attempt) => {
      // Only log the first connection error to reduce console spam
      if (!connectionErrorLogged) {
        console.log(`Message broadcast: No active receivers (${attempt}). This is normal when no UI is open.`);
        connectionErrorLogged = true;
      }
    };
    
    // Send messages wrapped in a helper that handles common errors
    const sendMessageSafely = (messageData, attemptName) => {
      console.log(`Sending ${attemptName} message...`);
      chrome.runtime.sendMessage(messageData, (response) => {
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          // Only log real errors, not connection issues
          if (error.includes("Receiving end does not exist") || 
              error.includes("message port closed")) {
            logConnectionError(error, attemptName);
          } else {
            console.warn(`Error in ${attemptName}:`, error);
          }
        } else if (response) {
          console.log(`[Clipboard Manager] ${attemptName} successfully received by UI:`, response);
          
          // If we got a response, try to send the actual clipboard data directly
          if (response.received && !messageData.includesData) {
            // Send the full data with the next message
            setTimeout(() => {
              chrome.runtime.sendMessage({
                action: 'fullClipboardData',
                timestamp: Date.now(),
                data: clipboardData,
                includesData: true
              }, (dataResponse) => {
                if (!chrome.runtime.lastError && dataResponse) {
                  console.log('Full clipboard data sent successfully');
                }
              });
            }, 50);
          }
        }
      });
    };
    
    // Proceed with broadcast attempts
    console.log(`Broadcasting updates. Active windows: ${hasActiveWindows}`);
    
    // Send the standard update message
    sendMessageSafely({ 
      action: 'clipboardDataUpdated',
      timestamp: Date.now() 
    }, 'standard update');
    
    // Send our explicit clipboardUpdated message that our hook is listening for
    sendMessageSafely({ 
      action: 'clipboardUpdated',
      timestamp: Date.now()
    }, 'clipboardUpdated message');
    
    // Send a second message type as backup
    sendMessageSafely({ 
      action: 'refreshClipboardData',
      timestamp: Date.now()
    }, 'refresh message');
    
    // If we have any open windows, try to send to them directly
    if (floatingWindowId) {
      try {
        chrome.windows.get(floatingWindowId, (win) => {
          if (!chrome.runtime.lastError && win) {
            sendMessageSafely({ 
              action: 'forceRefreshData',
              target: 'floating',
              timestamp: Date.now()
            }, 'direct floating window message');
          }
        });
      } catch (e) {
        console.warn('Could not send direct message to floating window:', e);
      }
    }
  } catch (error) {
    console.error('Error in broadcast function:', error);
  }
};

/**
 * Categorize content based on its format
 * @param {string} content - Content to categorize
 * @returns {string} - Content type (text, url, code, image)
 */
const categorizeContent = (content) => {
  // Handle empty content
  if (!content || content.trim() === '') {
    return 'text';
  }
  
  // Check if it's an image (data URL)
  if (content.startsWith('data:image/')) {
    return 'image';
  }
  
  // Check if it's a URL using a comprehensive regex
  const urlRegex = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
  if (urlRegex.test(content.trim())) {
    return 'url';
  }
  
  try {
    // Check if it's likely code by counting code indicators
    const codeIndicators = [
      '{', '}', '()', '=>', ';', 
      'function', 'class', 'const', 'let', 'var',
      'if', 'else', 'for', 'while', 'switch',
      'import', 'export', 'return', 'async', 'await',
      '<div', '<span', '<p', '<a', '</div>', '</span>', '</p>', '</a>',
      '/*', '*/', '//', '#include', 'def ', 'public', 'private', 'protected'
    ];
    
    let indicatorCount = 0;
    for (const indicator of codeIndicators) {
      if (content.includes(indicator)) {
        indicatorCount++;
      }
    }
    
    // Check for multiple lines with indentation (common in code)
    const lines = content.split('\n');
    const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\t'));
    
    // If we have multiple code indicators or indented lines, it's likely code
    if (indicatorCount >= 3 || (lines.length > 3 && indentedLines.length > 1)) {
      return 'code';
    }
  } catch (error) {
    // Not code
  }
  
  // Default to text
  return 'text';
};

/**
 * Check for image data in clipboard
 * @returns {Promise<Object|null>} The result or null if nothing is found
 */
const checkForImageData = async () => {
  try {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      logVerbose('No active tab found, skipping image check');
      return null;
    }

    const activeTab = tabs[0];
    
    // Skip restricted URLs
    if (isRestrictedUrl(activeTab.url)) {
      logVerbose('Restricted URL, skipping image check:', activeTab.url);
      return null;
    }
    
    // Try to read clipboard image with robust error handling
    try {
      logVerbose('Attempting to check for clipboard image in tab', activeTab.id);
      
      // First, try using the navigator.clipboard API through content script
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          return new Promise((resolve) => {
            try {
              // Create a hidden container for paste operations
              const container = document.createElement('div');
              container.contentEditable = true;
              container.style.position = 'fixed';
              container.style.top = '-9999px';
              container.style.left = '-9999px';
              container.style.width = '1px';
              container.style.height = '1px';
              container.style.opacity = '0';
              document.body.appendChild(container);
              
              // Flag to track if an image was found
              let imageDetected = false;
              let imageData = null;
              
              // Handle paste events to detect images
              container.addEventListener('paste', (e) => {
                console.log('[Clipboard Manager] Paste event triggered for image check');
                
                try {
                  if (e.clipboardData && e.clipboardData.items) {
                    // Log what's in the clipboard for debugging
                    console.log('[Clipboard Manager] Clipboard items count:', e.clipboardData.items.length);
                    
                    for (let i = 0; i < e.clipboardData.items.length; i++) {
                      const item = e.clipboardData.items[i];
                      console.log('[Clipboard Manager] Clipboard item:', item.type);
                      
                      // Check if item is an image
                      if (item.type.indexOf('image') !== -1) {
                        console.log('[Clipboard Manager] Image detected in clipboard');
                        imageDetected = true;
                        
                        // Get image as a file
                        const file = item.getAsFile();
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target && event.target.result) {
                              imageData = event.target.result;
                              console.log('[Clipboard Manager] Image data loaded successfully, length:', 
                                imageData.length);
                              
                              // Resolve the promise with the image data
                              resolve({ imageDetected: true, imageData });
                            }
                          };
                          
                          // Start the file reading process
                          reader.readAsDataURL(file);
                          // Prevent further processing
                          return;
                        }
                      }
                    }
                  }
                } catch (pasteError) {
                  console.error('[Clipboard Manager] Error processing paste event:', pasteError);
                }
                
                // If we reach here, no image was detected
                setTimeout(() => {
                  if (!imageDetected) {
                    // Cleanup
                    try {
                      document.body.removeChild(container);
                    } catch (e) {}
                    resolve({ imageDetected: false });
                  }
                }, 100);
              });
              
              // Focus and trigger paste
              container.focus();
              document.execCommand('paste');
              
              // Set a timeout in case paste doesn't trigger or resolve
              setTimeout(() => {
                if (!imageDetected) {
                  // Cleanup
                  try {
                    document.body.removeChild(container);
                  } catch (e) {}
                  resolve({ imageDetected: false });
                }
              }, 500);
            } catch (error) {
              console.error('[Clipboard Manager] Image detection error:', error);
              resolve({ imageDetected: false, error: error.message });
            }
          });
        }
      });
      
      // Process the results
      if (!results || !results.length || !results[0] || !results[0].result) {
        console.log('No results from image check script or invalid response structure');
        return null;
      }
      
      const result = results[0].result;
      
      // Check if image was detected and we have the data
      if (result.imageDetected && result.imageData) {
        console.log('Image detected and data received, processing...');
        
        // Process the image data directly
        await processClipboardImage(result.imageData);
        return { imageDetected: true };
      } else if (result.error) {
        console.error('Error in image detection:', result.error);
      } else {
        console.log('No image detected in clipboard');
      }
      
      return result;
    } catch (execError) {
      console.error('Error executing image check script:', execError);
      return null;
    }
  } catch (error) {
    console.error('Error in checkForImageData:', error);
    return null;
  }
};

/**
 * Process clipboard image content
 * @param {string} dataUrl - Image data URL
 */
const processClipboardImage = async (dataUrl) => {
  try {
    // Validate data URL
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      console.warn('Background: Invalid image data format:', 
                  dataUrl ? `${dataUrl.substring(0, 30)}...` : 'undefined');
      console.warn('Background: Type of dataUrl:', typeof dataUrl);
      return;
    }
    
    console.log('Background: Processing clipboard image data, length:', dataUrl.length);
    
    // Skip if we already have this image
    const isDuplicate = clipboardData.items.some(item => item.content === dataUrl);
    if (isDuplicate) {
      console.log('Background: Duplicate image, skipping');
      return;
    }
    
    // Check image size against settings before processing
    const imageSizeKB = Math.round(dataUrl.length / 1024);
    console.log('Background: Processing clipboard image, size:', imageSizeKB + 'KB');
    
    if (imageSizeKB > maxImageSize) {
      console.log(`Background: Image exceeds maximum size (${imageSizeKB}KB > ${maxImageSize}KB), skipping`);
      
      // Show notification
      handleShowNotification({
        type: 'warning',
        message: `Image exceeds maximum size (${imageSizeKB}KB > ${maxImageSize}KB)`
      });
      
      return;
    }
    
    // Create new item
    const newItem = {
      id: generateId(),
      content: dataUrl,
      type: 'image',
      timestamp: Date.now(),
      isFavorite: false,
      charCount: imageSizeKB + 'KB'
    };
    
    console.log('Background: Adding image to clipboard history');
    
    // Add item to history
    clipboardData.items.unshift(newItem);
    
    // Limit history size
    const maxItems = MAX_HISTORY_ITEMS;
    if (clipboardData.items.length > maxItems) {
      console.log(`Background: Trimming history to ${maxItems} items`);
      clipboardData.items = clipboardData.items.slice(0, maxItems);
    }
    
    // Save to storage
    const saveResult = await saveClipboardData();
    if (!saveResult.success) {
      console.error('Background: Failed to save clipboard data:', saveResult.error);
      return;
    }
    
    console.log('Background: Saved clipboard data successfully:', {
      savedItems: saveResult.savedItems,
      totalItems: clipboardData.items.length
    });
    
    // Notify any open UI
    chrome.runtime.sendMessage({ 
      action: 'clipboardDataUpdated',
      source: 'image_processor',
      timestamp: Date.now()
    }, response => {
      if (chrome.runtime.lastError) {
        console.log('No UI listening for clipboardDataUpdated message (this is normal)');
      } else if (response) {
        console.log('UI received image update notification', response);
      }
    });
    
    // Also broadcast with the more specific message type
    broadcastClipboardUpdate();
    
    // Show notification
    handleShowNotification({
      type: 'success',
      message: 'Image copied to clipboard history'
    });
    
    // Log success
    console.log('Background: Clipboard image saved successfully');
    return true;
  } catch (error) {
    console.error('Error processing clipboard image:', error);
    
    // Show notification for the error
    handleShowNotification({
      type: 'error',
      message: 'Failed to process clipboard image'
    });
    return false;
  }
};

/**
 * Set up context menus
 */
const setupContextMenus = () => {
  try {
    // Remove existing menus
    chrome.contextMenus.removeAll();
    
    // Create parent menu
    chrome.contextMenus.create({
      id: 'clipboard-manager',
      title: 'Clipboard Manager',
      contexts: ['editable']
    });
    
    // Add favorites to menu (limited to 10)
    const favorites = clipboardData.favorites.slice(0, 10);
    favorites.forEach((item, index) => {
      // Truncate content for menu title
      let title = item.content;
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      chrome.contextMenus.create({
        id: `favorite-${item.id}`,
        parentId: 'clipboard-manager',
        title: title,
        contexts: ['editable']
      });
    });
    
    // Add separator
    chrome.contextMenus.create({
      id: 'separator',
      parentId: 'clipboard-manager',
      type: 'separator',
      contexts: ['editable']
    });
    
    // Add options
    chrome.contextMenus.create({
      id: 'floating-window',
      parentId: 'clipboard-manager',
      title: 'Open Floating Window',
      contexts: ['editable']
    });
    
    // Set up click handler
    chrome.contextMenus.onClicked.addListener(handleContextMenuClick);
    
    logVerbose('Context menus created');
  } catch (error) {
    console.error('Error setting up context menus:', error);
  }
};

/**
 * Handle context menu clicks
 * @param {Object} info - Click info
 * @param {Object} tab - Tab info
 */
const handleContextMenuClick = async (info, tab) => {
  try {
    if (info.menuItemId === 'floating-window') {
      openFloatingWindow();
    } else if (info.menuItemId.startsWith('favorite-')) {
      const itemId = info.menuItemId.replace('favorite-', '');
      const item = clipboardData.favorites.find(item => item.id === itemId);
      
      if (item) {
        // Send paste command to content script
        chrome.tabs.sendMessage(tab.id, {
          action: 'pasteContent',
          content: item.content
        });
      }
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
};

/**
 * Open floating window
 */
const openFloatingWindow = async () => {
  try {
    // Close existing window if open
    if (floatingWindowId) {
      try {
        const windowInfo = await chrome.windows.get(floatingWindowId);
        if (windowInfo) {
          // If window exists, focus it instead of opening a new one
          await chrome.windows.update(floatingWindowId, { focused: true });
          return { success: true, message: 'Focused existing floating window' };
        }
      } catch (error) {
        // Window might not exist anymore, continue creating a new one
        console.log('Previous floating window not found, creating new one');
        floatingWindowId = null;
      }
    }
    
    // Get screen dimensions safely
    let screenWidth = 1366;  // Default fallback
    let screenHeight = 768;  // Default fallback
    
    try {
      if (chrome.system && chrome.system.display) {
        const displays = await chrome.system.display.getInfo();
        if (displays && displays.length > 0) {
          const primaryDisplay = displays[0];
          screenWidth = primaryDisplay.bounds.width;
          screenHeight = primaryDisplay.bounds.height;
        }
      }
    } catch (displayError) {
      console.warn('Could not get screen dimensions:', displayError);
    }

    // Create a new floating window
    const window = await chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'), // Use popup.html with floating-window class
      type: 'popup',
      width: 400,
      height: 550,
      left: Math.round(screenWidth - 400 - 20),
      top: 50,
      focused: true
    });
    
    // Store the window ID
    floatingWindowId = window.id;

    // Add listener for window close event if not already added
    if (!chrome.windows.onRemoved.hasListener(windowCloseListener)) {
      chrome.windows.onRemoved.addListener(windowCloseListener);
    }

    logVerbose('Floating window opened');
    return { success: true };
  } catch (error) {
    console.error('Error opening floating window:', error);
    return { error: error.message };
  }
};

/**
 * Save clipboard data to storage
 * @returns {Promise<Object>} Result of the save operation
 */
const saveClipboardData = async () => {
  try {
    logVerbose('Saving clipboard data to storage...');
    logVerbose('Items to save:', clipboardData.items.length);
    
    // Make a clean copy of the data to ensure it's serializable
    const dataToSave = {
      items: clipboardData.items.map(item => ({
        id: item.id,
        content: item.content,
        type: item.type,
        timestamp: item.timestamp,
        isFavorite: item.isFavorite,
        charCount: item.charCount
      })),
      favorites: clipboardData.favorites.map(item => ({
        id: item.id,
        content: item.content,
        type: item.type,
        timestamp: item.timestamp,
        isFavorite: item.isFavorite,
        charCount: item.charCount
      }))
    };
    
    // Save to sync storage for persistence across browser restarts
    await chrome.storage.sync.set({ clipboardData: dataToSave });
    
    // Also save to local storage for faster access
    await chrome.storage.local.set({ clipboardData: dataToSave });
    
    // Verify data was saved by reading it back
    const savedData = await chrome.storage.sync.get('clipboardData');
    if (savedData && savedData.clipboardData && Array.isArray(savedData.clipboardData.items)) {
      logVerbose('Clipboard data successfully saved, items:', savedData.clipboardData.items.length);
      return { 
        success: true, 
        savedItems: savedData.clipboardData.items.length 
      };
    } else {
      console.error('Failed to verify saved clipboard data');
      return { 
        success: false, 
        error: 'Verification failed' 
      };
    }
  } catch (error) {
    console.error('Error saving clipboard data:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Load clipboard data from storage
 */
const loadClipboardData = async () => {
  try {
    console.log('Background: Loading clipboard data and settings...');
    
    // Load the clipboard data from sync storage first
    let result = await chrome.storage.sync.get('clipboardData');
    
    // If not found in sync, try local storage as fallback (for backward compatibility)
    if (!result.clipboardData) {
      console.log('Background: No clipboard data found in sync storage, checking local storage');
      result = await chrome.storage.local.get('clipboardData');
    }
    
    // Initialize if not found
    if (!result.clipboardData) {
      clipboardData = {
        items: [],
        favorites: []
      };
      console.log('Background: No clipboard data found, initialized empty data');
    } else {
      clipboardData = result.clipboardData;
      console.log('Background: Loaded clipboard data, items:', clipboardData.items.length);
    }
    
    // Load settings from sync storage first
    let settingsResult = await chrome.storage.sync.get('settings');
    
    // If not found in sync, try local storage as fallback
    if (!settingsResult.settings) {
      console.log('Background: No settings found in sync storage, checking local storage');
      settingsResult = await chrome.storage.local.get('settings');
    }
    
    if (settingsResult.settings) {
      const settings = settingsResult.settings;
      
      // Update global settings
      verboseLogging = settings.verboseLogging || false;
      MAX_HISTORY_ITEMS = settings.maxItems || 50;
      
      // Content limits
      maxTextLength = settings.maxTextLength || 10000;
      maxImageSize = settings.maxImageSize || 1000;
      showCharCount = settings.showCharCount !== undefined ? settings.showCharCount : true;
      
      console.log('Background: Loaded settings:', {
        verboseLogging,
        MAX_HISTORY_ITEMS,
        maxTextLength,
        maxImageSize,
        showCharCount
      });
    } else {
      console.log('Background: No settings found, using defaults');
      
      // Save default settings
      const defaultSettings = {
        verboseLogging: false,
        maxItems: MAX_HISTORY_ITEMS,
        theme: 'dark',
        showCharCount: true,
        maxTextLength: 10000,
        maxImageSize: 1000
      };
      
      await chrome.storage.sync.set({ settings: defaultSettings });
      console.log('Background: Saved default settings');
    }
    
    return true;
  } catch (error) {
    console.error('Error loading clipboard data:', error);
    return false;
  }
};

/**
 * Toggle favorite status for an item
 * @param {string} itemId - Item ID
 */
const handleToggleFavorite = async (itemId) => {
  try {
    const itemIndex = clipboardData.items.findIndex(item => item.id === itemId);
    
    if (itemIndex !== -1) {
      // Toggle favorite status
      clipboardData.items[itemIndex].isFavorite = !clipboardData.items[itemIndex].isFavorite;
      
      // Update favorites list
      clipboardData.favorites = clipboardData.items.filter(item => item.isFavorite);
      
      // Save changes
      await saveClipboardData();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return false;
  }
};

/**
 * Delete an item from history
 * @param {string} itemId - Item ID
 */
const handleDeleteItem = async (itemId) => {
  try {
    // Remove from items
    clipboardData.items = clipboardData.items.filter(item => item.id !== itemId);
    
    // Update favorites list
    clipboardData.favorites = clipboardData.favorites.filter(item => item.id !== itemId);
    
    // Save changes
    await saveClipboardData();
    
    return true;
  } catch (error) {
    console.error('Error deleting item:', error);
    return false;
  }
};

/**
 * Add a new item to clipboard history
 * @param {Object} item - New item data
 */
const handleAddNewItem = async (item) => {
  try {
    // Create new item
    const newItem = {
      id: generateId(),
      content: item.content,
      type: item.type || categorizeContent(item.content),
      timestamp: Date.now(),
      isFavorite: item.isFavorite || false,
      charCount: item.content.length
    };
    
    // Add to history
    clipboardData.items.unshift(newItem);
    
    // Add to favorites if marked as favorite
    if (newItem.isFavorite) {
      clipboardData.favorites.unshift(newItem);
    }
    
    // Limit history size
    if (clipboardData.items.length > MAX_HISTORY_ITEMS) {
      console.log(`Background: Trimming history to ${MAX_HISTORY_ITEMS} items`);
      clipboardData.items = clipboardData.items.slice(0, MAX_HISTORY_ITEMS);
    }
    
    // Save changes
    await saveClipboardData();
    
    return newItem;
  } catch (error) {
    console.error('Error adding new item:', error);
    return null;
  }
};

/**
 * Clear all clipboard history
 */
const handleClearAll = async () => {
  try {
    // Reset data
    clipboardData = {
      items: [],
      favorites: []
    };
    
    // Save changes
    await saveClipboardData();
    
    return true;
  } catch (error) {
    console.error('Error clearing clipboard history:', error);
    return false;
  }
};

/**
 * Move an item to the top of the clipboard history
 * @param {string} itemId - ID of the item to move
 */
const handleMoveItemToTop = async (itemId) => {
  try {
    // Find the item
    const itemIndex = clipboardData.items.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    
    // If already at the top, no need to do anything
    if (itemIndex === 0) {
      return true;
    }
    
    // Remove the item from its current position
    const item = clipboardData.items[itemIndex];
    clipboardData.items.splice(itemIndex, 1);
    
    // Add it to the top
    clipboardData.items.unshift(item);
    
    // Update timestamp to current time
    clipboardData.items[0].timestamp = Date.now();
    
    // Save changes
    await saveClipboardData();
    
    // Notify any open UI
    chrome.runtime.sendMessage({ action: 'clipboardDataUpdated' });
    
    return true;
  } catch (error) {
    console.error('Error moving item to top:', error);
    return false;
  }
};

/**
 * Show a notification in the UI
 * @param {Object} notification - Notification data
 */
const handleShowNotification = (notification) => {
  try {
    // Just relay the notification to all UI instances
    chrome.runtime.sendMessage({ 
      action: 'showNotification',
      notification
    });
    
    return true;
  } catch (error) {
    console.error('Error showing notification:', error);
    return false;
  }
};

/**
 * Delete multiple items from clipboard history
 * @param {string[]} itemIds - Array of item IDs to delete
 */
const handleDeleteMultipleItems = async (itemIds) => {
  try {
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return { success: false, error: 'No items to delete' };
    }
    
    // Filter out the items to be deleted
    clipboardData.items = clipboardData.items.filter(item => !itemIds.includes(item.id));
    
    // Filter out deleted items from favorites
    const favoritesToRemove = new Set(itemIds);
    const updatedFavorites = clipboardData.favorites.filter(
      item => !favoritesToRemove.has(item.id)
    );
    clipboardData.favorites = updatedFavorites;
    
    // Save changes
    await saveClipboardData();
    
    // Notify UI of changes
    chrome.runtime.sendMessage({ action: 'clipboardDataUpdated' });
    
    return { 
      success: true, 
      deletedCount: itemIds.length 
    };
  } catch (error) {
    console.error('Error deleting multiple items:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// Handle messages from popup, content scripts, etc.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // Enable verbose logging temporarily for debugging
    const originalVerboseLogging = verboseLogging;
    verboseLogging = true;
    
    logVerbose('Message received:', message);
    
    if (!message || !message.action) {
      logVerbose('Invalid message received (no action)');
      sendResponse({ error: 'Invalid message' });
      verboseLogging = originalVerboseLogging;
      return true;
    }
    
    switch (message.action) {
      case 'getClipboardData':
        logVerbose('Sending clipboard data to caller, items:', clipboardData.items.length);
        sendResponse(clipboardData);
        break;
        
      case 'copyKeyDetected':
        // Handle copy key detection from content script
        handleCopyKeyDetected(message.hasSelection, message.timestamp);
        sendResponse({ success: true });
        break;
        
      case 'pasteKeyDetected':
        // Handle paste key detection from content script
        logVerbose('Paste key detection received, hasSelection:', message.hasSelection, 'timestamp:', message.timestamp);
        // Set force flag to ensure clipboard is read
        forceNextClipboardCheck = true;
        // Immediately trigger a clipboard check with a small delay to allow paste to complete
        setTimeout(() => {
          logVerbose('Performing forced clipboard check after paste key detection');
          checkClipboardForChanges(true); // Force check regardless of selection
        }, 100);
        
        // Do another check after a bit more time in case the paste is still processing
        setTimeout(() => {
          if (forceNextClipboardCheck) {
            logVerbose('Performing second forced clipboard check after paste');
            checkClipboardForChanges(true);
            forceNextClipboardCheck = false;
          }
        }, 500);
        
        sendResponse({ success: true });
        break;
        
      case 'clipboardImageDetected':
        logVerbose('Image data detected, processing...', message.content ? `(data length: ${message.content.length.toString().substring(0, 30)}...)` : '(no content)');
        
        if (!message.content) {
          console.error('Missing image content in clipboardImageDetected message');
          sendResponse({ error: 'Missing image content' });
          break;
        }
        
        // Process the image asynchronously
        processClipboardImage(message.content)
          .then((result) => {
            sendResponse({ success: result });
          })
          .catch(error => {
            console.error('Error processing clipboard image:', error);
            sendResponse({ error: error.message });
          });
        
        // Keep channel open for async response
        return true;
      
      case 'checkForImages':
        // Manual request to check for images in the clipboard
        console.log('Manual image check requested');
        checkForImageData()
          .then(result => {
            sendResponse({
              success: true,
              imageDetected: !!(result && result.imageDetected),
              message: 'Image check completed'
            });
          })
          .catch(error => {
            console.error('Error during manual image check:', error);
            sendResponse({ 
              success: false, 
              error: error.message,
              message: 'Failed to check for images'
            });
          });
        return true; // Keep channel open for async response
      
      case 'clipboardDataUpdated':
        // Notify all UI instances that data has changed
        chrome.runtime.sendMessage({ action: 'refreshClipboardData' });
        sendResponse({ success: true });
        break;
        
      case 'toggleFavorite':
        handleToggleFavorite(message.itemId).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error toggling favorite:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'deleteItem':
        handleDeleteItem(message.itemId).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error deleting item:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'addNewItem':
        handleAddNewItem(message.item).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error adding item:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'clearAll':
        handleClearAll().then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error clearing clipboard history:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'toggleVerboseLogging':
        verboseLogging = message.enabled;
        chrome.storage.sync.set({ verboseLogging: verboseLogging });
        logVerbose('Verbose logging ' + (verboseLogging ? 'enabled' : 'disabled'));
        sendResponse({ success: true });
        break;
        
      case 'pasteToActiveElement':
        logVerbose('Forwarding paste request to content script');
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'pasteContent',
            content: message.content
          });
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Cannot paste in this context' });
        }
        break;
        
      case 'showNotification':
        handleShowNotification(message.notification);
        sendResponse({ success: true });
        break;
        
      case 'openFloatingWindow':
        openFloatingWindow().then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          console.error('Error opening floating window:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'clipboardContent':
        // Handle content received from content script
        processClipboardContent(message.content).then(() => {
          sendResponse({ success: true });
        }).catch(error => {
          console.error('Error processing clipboard content:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'moveItemToTop':
        handleMoveItemToTop(message.itemId).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error moving item to top:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'deleteMultipleItems':
        handleDeleteMultipleItems(message.itemIds).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('Error deleting multiple items:', error);
          sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
        
      case 'settingsUpdated':
        if (message.settings) {
          // Update global settings
          verboseLogging = message.settings.verboseLogging || false;
          MAX_HISTORY_ITEMS = message.settings.maxItems || 50;
          
          // Content limits
          maxTextLength = message.settings.maxTextLength || 10000;
          maxImageSize = message.settings.maxImageSize || 1000;
          showCharCount = message.settings.showCharCount !== undefined ? message.settings.showCharCount : true;
          
          console.log('Background: Settings updated:', {
            verboseLogging,
            MAX_HISTORY_ITEMS,
            maxTextLength,
            maxImageSize,
            showCharCount
          });
          
          // Save the settings
          chrome.storage.sync.set({ settings: message.settings }, () => {
            console.log('Background: Settings saved to storage');
          });
          
          // Broadcast the updated settings to all UI instances
          chrome.runtime.sendMessage({
            action: 'settingsUpdated',
            settings: message.settings
          });
        }
        sendResponse({ success: true });
        break;
        
      default:
        logVerbose('Unknown action:', message.action);
        sendResponse({ error: 'Unknown action' });
    }
    
    // Restore original verbose logging setting
    verboseLogging = originalVerboseLogging;
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep channel open for async response
});

// Initialize immediately to ensure background monitoring starts right away
// This needs to be placed after all function declarations
initialize();