import React, { createContext, useState, useEffect } from 'react';

// Create the context
export const SettingsContext = createContext({
  settings: {
    theme: 'dark',
    showCharCount: true,
    maxTextLength: 10000,
    maxImageSize: 1000,
    verboseLogging: false,
    maxItems: 50
  },
  updateSettings: () => {}
});

/**
 * Settings provider component that wraps the application
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Provider component
 */
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    theme: 'dark',
    showCharCount: true,
    maxTextLength: 10000,
    maxImageSize: 1000,
    verboseLogging: false,
    maxItems: 50
  });
  
  // Load settings from storage on mount
  useEffect(() => {
    console.log('SettingsProvider: Loading settings from storage');
    chrome.storage.local.get('settings', (result) => {
      if (result.settings) {
        // Remove autoCleanup if it exists in stored settings
        const { autoCleanup, ...otherSettings } = result.settings;
        
        console.log('SettingsProvider: Settings loaded from storage:', otherSettings);
        setSettings(prevSettings => ({
          ...prevSettings,
          ...otherSettings
        }));
      } else {
        console.log('SettingsProvider: No settings found in storage, using defaults');
      }
    });
    
    // Listen for settings changes
    const handleMessage = (message) => {
      if (message.action === 'settingsUpdated' && message.settings) {
        // Remove autoCleanup if it exists in message
        const { autoCleanup, ...otherSettings } = message.settings;
        
        console.log('SettingsProvider: Received settingsUpdated message:', otherSettings);
        setSettings(prevSettings => ({
          ...prevSettings,
          ...otherSettings
        }));
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);
  
  // Apply theme changes
  useEffect(() => {
    if (settings.theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      console.log('SettingsProvider: Applied system theme preference:', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', settings.theme);
      console.log('SettingsProvider: Applied theme:', settings.theme);
    }
    
    // Listen for system theme changes
    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const themeListener = (e) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        console.log('SettingsProvider: System theme changed to:', e.matches ? 'dark' : 'light');
      };
      
      mediaQuery.addEventListener('change', themeListener);
      return () => {
        mediaQuery.removeEventListener('change', themeListener);
      };
    }
  }, [settings.theme]);
  
  // Update settings in storage and notify components
  const updateSettings = (newSettings) => {
    // Remove autoCleanup if it exists
    const { autoCleanup, ...filteredSettings } = newSettings;
    
    console.log('SettingsProvider: Updating settings:', filteredSettings);
    
    const updatedSettings = {
      ...settings,
      ...filteredSettings
    };
    
    setSettings(updatedSettings);
    
    // Save to storage
    chrome.storage.local.set({ settings: updatedSettings }, () => {
      console.log('SettingsProvider: Settings saved to storage');
    });
    
    // Notify background script
    chrome.runtime.sendMessage({
      action: 'settingsUpdated',
      settings: updatedSettings
    });
  };
  
  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsProvider; 