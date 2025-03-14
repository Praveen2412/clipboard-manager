import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import Settings from '../Settings';
import { SettingsContext } from '../../contexts/SettingsContext';

// Mock functions for image handling
const mockProcessClipboardImage = jest.fn();

describe('Settings Component', () => {
  // Mock chrome storage API
  const mockChromeStorage = {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  };

  // Mock settings data with all settings
  const mockSettings = {
    verboseLogging: false,
    maxItems: 50,
    theme: 'dark',
    showCharCount: true,
    maxTextLength: 10000,
    maxImageSize: 1000
  };

  // Mock favorites data
  const mockFavorites = [
    { id: 'fav1', text: 'Favorite 1', type: 'text' },
    { id: 'fav2', text: 'Favorite 2', type: 'text' },
    { id: 'fav3', text: 'Favorite 3', type: 'text' },
    { id: 'fav4', text: 'Favorite 4', type: 'text' }
  ];

  // Mock settings context update function
  const mockUpdateSettings = jest.fn();

  // Helper function to render with settings context
  const renderWithSettingsContext = (ui) => {
    return render(
      <SettingsContext.Provider value={{ settings: mockSettings, updateSettings: mockUpdateSettings }}>
        {ui}
      </SettingsContext.Provider>
    );
  };

  beforeEach(() => {
    // Save original chrome object if it exists
    global.originalChrome = global.chrome;

    // Create mock chrome API
    global.chrome = {
      storage: mockChromeStorage,
      runtime: {
        getManifest: jest.fn().mockReturnValue({ version: '1.0.0' }),
        sendMessage: jest.fn().mockImplementation((message, callback) => {
          if (message.action === 'getFavorites' && callback) {
            callback({ favorites: mockFavorites });
          }
        })
      }
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Mock storage.local.get to return settings
    mockChromeStorage.local.get.mockImplementation((key, callback) => {
      if (key === 'settings') {
        callback({ settings: mockSettings });
      } else if (key === 'clipboard') {
        callback({ clipboard: [] });
      } else {
        callback({});
      }
    });

    // Mock storage.local.set to call the callback
    mockChromeStorage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });

    // Mock window.matchMedia for theme testing
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    // Mock document getElementById for render container
    document.getElementById = jest.fn().mockImplementation(() => document.createElement('div'));
  });

  afterEach(() => {
    // Restore original chrome object
    global.chrome = global.originalChrome;
  });

  describe('General Settings Tab', () => {
    test('renders settings form with correct initial values', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Verify general settings section is displayed
      expect(screen.getByText('General')).toBeInTheDocument();
      
      // Check initial values of general settings
      const verboseLoggingToggle = screen.getByLabelText(/enable verbose logging/i);
      const maxItemsInput = screen.getByLabelText(/maximum items to store/i);
      
      expect(verboseLoggingToggle.checked).toBe(mockSettings.verboseLogging);
      expect(maxItemsInput.value).toBe(mockSettings.maxItems.toString());
      
      // Check version is displayed
      expect(screen.getByText(/version: 1.0.0/i)).toBeInTheDocument();
    });

    test('toggles verbose logging setting and saves it', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      const verboseLoggingToggle = screen.getByLabelText(/enable verbose logging/i);
      
      // Toggle the setting
      fireEvent.click(verboseLoggingToggle);
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        verboseLogging: true 
      }));
    });

    test('changes max items setting and validates input', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      const maxItemsInput = screen.getByLabelText(/maximum items to store/i);
      
      // Change to a valid value
      fireEvent.change(maxItemsInput, { target: { value: '100' } });
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        maxItems: 100 
      }));
    });
  });

  describe('Theme Settings', () => {
    test('renders theme options with correct initial values', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Verify theme section is displayed
      expect(screen.getByText('Theme')).toBeInTheDocument();
      
      // Check initial theme values - find the checked radio button
      const checkedThemeOption = screen.getByRole('radio', { checked: true });
      expect(checkedThemeOption.value).toBe(mockSettings.theme);
    });
    
    test('changes theme setting and saves it', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Find the light theme radio button
      const lightThemeOption = screen.getByRole('radio', { name: /light/i });
      
      // Change theme to light
      fireEvent.click(lightThemeOption);
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        theme: 'light' 
      }));
    });
  });

  describe('Display Settings', () => {
    test('toggles show character count setting and saves it', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Find Display section
      expect(screen.getByText('Display')).toBeInTheDocument();
      
      const showCharCountToggle = screen.getByLabelText(/show character count/i);
      
      // Toggle the setting
      fireEvent.click(showCharCountToggle);
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        showCharCount: false 
      }));
    });
  });

  describe('Content Limits Settings', () => {
    test('renders content limits section with correct initial values', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Verify content limits section is displayed
      expect(screen.getByText('Content Limits')).toBeInTheDocument();
      
      // Check initial values
      const maxTextLengthInput = screen.getByLabelText(/max text length/i);
      const maxImageSizeInput = screen.getByLabelText(/max image size/i);
      
      expect(maxTextLengthInput.value).toBe(mockSettings.maxTextLength.toString());
      expect(maxImageSizeInput.value).toBe(mockSettings.maxImageSize.toString());
    });
    
    test('changes max text length setting and saves it', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      const maxTextLengthInput = screen.getByLabelText(/max text length/i);
      
      // Change the value
      fireEvent.change(maxTextLengthInput, { target: { value: '20000' } });
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        maxTextLength: 20000 
      }));
    });
    
    test('changes max image size setting and saves it', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      const maxImageSizeInput = screen.getByLabelText(/max image size/i);
      
      // Change the value
      fireEvent.change(maxImageSizeInput, { target: { value: '2000' } });
      
      // Save button should now be enabled
      const saveButton = screen.getByText('Save Settings');
      expect(saveButton).not.toBeDisabled();
      
      // Click save button
      fireEvent.click(saveButton);
      
      // Verify updateSettings was called
      expect(mockUpdateSettings).toHaveBeenCalledWith(expect.objectContaining({ 
        maxImageSize: 2000 
      }));
    });
  });

  describe('Data Management', () => {
    test('renders data management section', async () => {
      renderWithSettingsContext(<Settings isOpen={true} />);
      
      // Verify data management section is displayed
      expect(screen.getByText('Data Management')).toBeInTheDocument();
      
      // Check buttons are displayed
      expect(screen.getByText('Import Data')).toBeInTheDocument();
      expect(screen.getByText('Export Data')).toBeInTheDocument();
    });
  });
}); 