/**
 * Utility functions for clipboard operations
 */

/**
 * Copies text to the system clipboard
 * @param {string} text - The text to copy
 * @param {string} contentType - The type of content (text, url, code, image)
 * @returns {Promise} - Resolves when copy is successful
 */
export const copyTextToClipboard = async (text, contentType = 'text') => {
  try {
    // For image data URLs, we need special handling
    if (contentType === 'image' && text.startsWith('data:image/')) {
      try {
        // For image data URLs, create a temporary image and use the canvas approach
        const img = new Image();
        img.src = text;
        
        // Wait for image to load
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          // Set a timeout just in case
          setTimeout(resolve, 1000);
        });
        
        // Create canvas to get blob
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Get as blob and copy to clipboard
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        
        // Use clipboard API if available
        if (navigator.clipboard && navigator.clipboard.write) {
          const clipboardItem = new ClipboardItem({
            [blob.type]: blob
          });
          
          await navigator.clipboard.write([clipboardItem]);
          return true;
        } else {
          console.warn('Clipboard API not supported for images, trying alternative method');
          
          // Alternative approach: Create an image element and simulate copy
          const tempImg = document.createElement('img');
          tempImg.src = text;
          tempImg.style.position = 'fixed';
          tempImg.style.left = '0';
          tempImg.style.top = '0';
          tempImg.style.opacity = '0';
          document.body.appendChild(tempImg);
          
          // Create a range and selection
          const range = document.createRange();
          range.selectNode(tempImg);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Try to copy
          const success = document.execCommand('copy');
          document.body.removeChild(tempImg);
          
          if (success) {
            return true;
          } else {
            // Fall back to copying as text (data URL)
            console.warn('Alternative image copy method failed, falling back to data URL');
          }
        }
      } catch (imageError) {
        console.error('Error copying image to clipboard:', imageError);
        // Fall back to copying as text (data URL)
      }
    }
    
    // Standard text copying (also used as fallback for images)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (!success) {
        throw new Error('Copy command failed');
      }
      return true;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard: ', error);
    
    // Make one more attempt with execCommand as last resort
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      return success;
    } catch (fallbackError) {
      console.error('Fallback copy method also failed:', fallbackError);
      return false;
    }
  }
};

/**
 * Gets text from the system clipboard
 * @returns {Promise<string>} - Resolves with clipboard text
 */
export const pasteFromClipboard = async () => {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText();
    } else {
      // Fallback is tricky and often doesn't work
      // due to security restrictions
      throw new Error('Clipboard API not available');
    }
  } catch (error) {
    console.error('Failed to read clipboard: ', error);
    throw error;
  }
};

/**
 * Determines the content type of clipboard text
 * @param {string} content - The clipboard content
 * @returns {string} - The content type (text, url, code, image)
 */
export const categorizeContent = (content) => {
  if (!content) return 'text';
  
  // Check if it's an image (data URL)
  if (typeof content === 'string' && content.startsWith('data:image/')) {
    return 'image';
  }
  
  // Check if it's a URL
  try {
    const urlPattern = /^(https?:\/\/|www\.)[^\s/$.?#].[^\s]*$/i;
    if (urlPattern.test(content.trim())) {
      return 'url';
    }
  } catch (error) {
    // Not a URL
  }
  
  // Check if it's likely code
  try {
    const codeIndicators = [
      '{', '}', '()', '=>', 'function', 'class', 'import', 'export',
      'const', 'let', 'var', 'def ', 'elif', 'for (', 'while (', 
      '<div>', '<span>', '</div>', '</span>', '<?php', '#!/usr'
    ];
    
    if (codeIndicators.some(indicator => content.includes(indicator))) {
      return 'code';
    }
  } catch (error) {
    // Not code
  }
  
  // Default to text
  return 'text';
};

/**
 * Formats a timestamp into a relative time string
 * @param {number|string} timestamp - The timestamp to format
 * @returns {string} - Relative time (e.g., "7 mins ago")
 */
export const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Checks if a string is a valid URL
 * @param {string} string - String to check
 * @returns {boolean} - True if valid URL
 */
export const isValidUrl = (string) => {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

export default {
  copyTextToClipboard,
  pasteFromClipboard,
  categorizeContent,
  formatTimestamp,
  isValidUrl
}; 