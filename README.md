# Clipboard Manager Chrome Extension - Complete Documentation

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Technical Architecture](#technical-architecture)
- [Folder and File Structure](#folder-and-file-structure)
- [Components and Their Functionality](#components-and-their-functionality)
- [Data Flow and Object Interactions](#data-flow-and-object-interactions)
- [End-to-End Flows](#end-to-end-flows)
- [Implementation Guide](#implementation-guide)
- [Troubleshooting and Edge Cases](#troubleshooting-and-edge-cases)

## Overview

The PasteKeeper Clipboard Manager Chrome Extension is a productivity tool designed to help users efficiently manage their clipboard history. It captures copied content automatically, organizes it into categories, and provides easy access through multiple interfaces. The extension features a modern, dark-themed UI and supports text, URLs, code snippets, and images.

## Features

### 1. Clipboard History Management

- **Automated Tracking**: Automatically captures text, URLs, and images copied to clipboard
- **Categorization**: Sorts content into distinct categories (Text, URLs, Code, Images)
- **Time-based Organization**: Shows when items were copied (e.g., "7 mins ago", "2 hours ago")
- **Character Count**: Displays character count for each clipboard item
- **History Limit**: Maintains up to 100 most recent clipboard items (configurable in settings)

### 2. User Interaction Features

- **Favorite Items**: Star important items for quick access
- **Search Functionality**: Real-time search through clipboard history
- **One-Click Copy**: Copy any saved item back to clipboard with a single click
- **Add Manual Entries**: Add custom text directly to clipboard history
- **Delete Unwanted Items**: Remove individual items from history
- **Clear History**: Option to clear all clipboard history
- **Multi-select Mode**: Select multiple items for batch operations

### 3. Multiple Access Methods

- **Browser Action Popup**: Main extension interface via toolbar icon
- **Floating Window Mode**: Detachable window that persists outside the browser
- **Picture-in-Picture Mode**: Compact, always-on-top window for quick access
- **Context Menu Integration**: Right-click access to favorite clipboard items

### 4. Modern UI & UX

- **Theme Options**: Dark and light theme support
- **Responsive Design**: Adapts to different window sizes
- **Intuitive Controls**: Clear, icon-based action buttons
- **Tabbed Navigation**: Easy switching between content categories
- **Real-time Search**: Instant filtering as you type
- **Notifications**: Visual feedback for user actions

## Technical Architecture

### Architecture Overview

The extension is built using a combination of:

- **Frontend**: HTML, CSS, JavaScript with React.js
- **Storage**: Chrome Storage API (local and sync storage)
- **Browser Integration**: Chrome Extensions API
- **Clipboard Access**: Clipboard API with DOM fallbacks

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CHROME BROWSER                        │
│                                                             │
│  ┌─────────────┐     ┌───────────────┐     ┌──────────────┐  │
│  │  Extension  │     │  Background   │     │   Content    │  │
│  │   Popup UI  │◄───►│    Script     │◄───►│   Script     │  │
│  └─────────────┘     └───────┬───────┘     └──────────────┘  │
│        ▲                     │                   ▲           │
│        │                     ▼                   │           │
│        │             ┌───────────────┐           │           │
│        └─────────────┤  Chrome       ├───────────┘           │
│                      │  Storage API  │                       │
│                      └───────────────┘                       │
│                              ▲                               │
│                              │                               │
│                     ┌────────┴─────────┐                     │
│                     │  System Clipboard │                     │
│                     └──────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Folder and File Structure

```
clipboard-manager-extension/
│
├── manifest.json              # Extension configuration
│
├── src/
│   ├── background/
│   │   └── background.js      # Background script for extension
│   │
│   ├── components/            # React components
│   │   ├── AddItemModal.js    # Modal for adding new items
│   │   ├── ClipboardItem.js   # Individual clipboard item
│   │   ├── ClipboardList.js   # List of clipboard items
│   │   ├── Settings.js        # Settings panel
│   │   └── TabBar.js          # Category navigation tabs
│   │
│   ├── contexts/
│   │   └── SettingsContext.js # Context for settings management
│   │
│   ├── hooks/
│   │   └── useClipboardData.js # Custom React hook for data operations
│   │
│   ├── utils/
│   │   └── clipboardUtils.js   # Clipboard utility functions
│   │
│   ├── __mocks__/             # Mock files for testing
│   ├── tests/                 # Test files
│   ├── content.js             # Content script for page interaction
│   ├── index.js               # Entry point for main popup React app
│   └── pip.js                 # Script for picture-in-picture mode
│   
│
├── public/
│   ├── icons/                 # Extension icons
│   │   ├── icon16.png         # 16x16 icon
│   │   ├── icon48.png         # 48x48 icon
│   │   └── icon128.png        # 128x128 icon
│   │
│   ├── styles/
│   │   └── main.css           # Main CSS styles
│   │
│   ├── js/
│   │   └── window-detector.js # Script to detect window type
│   │
│   ├── popup.html             # Main popup HTML
│   ├── floating.html          # Floating window HTML
│   └── pip.html               # Picture-in-Picture window HTML
│
├── webpack.config.js          # Webpack configuration
└── package.json               # NPM package configuration
```

## Components and Their Functionality

### 1. Background Script (`background.js`)

**Purpose**: Central controller for the extension that runs persistently.

**Functions**:
- `initialize()` - Sets up extension on installation
  - *Input*: None
  - *Output*: None
  - *Actions*: Initializes storage, sets up context menus, starts clipboard monitoring

- `startClipboardMonitoring()` - Starts the clipboard monitoring process
  - *Input*: None
  - *Output*: None
  - *Actions*: Sets up interval to check clipboard for changes

- `checkClipboardForChanges()` - Monitors clipboard for new content
  - *Input*: None
  - *Output*: None
  - *Actions*: Polls clipboard, detects changes, processes new content

- `processClipboardContent(content)` - Processes and categorizes clipboard content
  - *Input*: `content` (string or binary data)
  - *Output*: None
  - *Actions*: Categorizes content, creates new item, stores in history

- `setupContextMenus()` - Creates right-click context menu items
  - *Input*: None
  - *Output*: None
  - *Actions*: Creates menu structure with favorites and options

- `handleMessageActions(message, sender, sendResponse)` - Processes messages from components
  - *Input*: 
    - `message` (object with action and data)
    - `sender` (sender information)
    - `sendResponse` (callback function)
  - *Output*: Varies based on action
  - *Actions*: Routes actions to appropriate handlers

- `saveClipboardData(data)` - Saves data to storage
  - *Input*: `data` (clipboard data object)
  - *Output*: Promise (resolves when save completes)
  - *Actions*: Persists data to Chrome storage

- `loadClipboardData()` - Retrieves data from storage
  - *Input*: None
  - *Output*: Promise (resolves with clipboard data)
  - *Actions*: Loads data from Chrome storage

- `openFloatingWindow()` - Creates floating window
  - *Input*: None
  - *Output*: None
  - *Actions*: Opens detached window with clipboard interface

- `openPictureInPictureMode()` - Creates PiP window
  - *Input*: None
  - *Output*: None
  - *Actions*: Opens small, always-on-top window

### 2. Content Script (`content.js`)

**Purpose**: Interacts with web pages for clipboard operations.

**Functions**:
- `detectCopyEvent(event)` - Detects copy keyboard shortcuts
  - *Input*: `event` (keyboard event)
  - *Output*: Boolean (true if copy event detected)
  - *Actions*: Checks for Ctrl+C or Command+C

- `detectPasteEvent(event)` - Detects paste keyboard shortcuts
  - *Input*: `event` (keyboard event)
  - *Output*: Boolean (true if paste event detected)
  - *Actions*: Checks for Ctrl+V or Command+V

- `setupClipboardButtonObserver()` - Monitors clipboard button clicks
  - *Input*: None
  - *Output*: MutationObserver instance
  - *Actions*: Sets up observer to detect clipboard button clicks

- `notifyBackgroundAboutCopy()` - Notifies background script about copy events
  - *Input*: None
  - *Output*: None
  - *Actions*: Sends message to background script about copy event

- `pasteToActiveElement(content)` - Pastes content to active element
  - *Input*: `content` (string)
  - *Output*: Boolean (success/failure)
  - *Actions*: Identifies active element, pastes content

- `showNotification(message, type)` - Shows UI notification
  - *Input*: 
    - `message` (string)
    - `type` (string: 'success', 'error', 'info')
  - *Output*: None
  - *Actions*: Creates and displays notification element

- `handleMessages(message, sender, sendResponse)` - Processes incoming messages
  - *Input*: 
    - `message` (object with action and data)
    - `sender` (sender information)
    - `sendResponse` (callback function)
  - *Output*: Varies based on action
  - *Actions*: Routes actions to appropriate handlers

### 3. React Components

#### Main App Component (`index.js`)
**Purpose**: Main application component for the popup.

**State**:
- `activeTab` (string) - Currently selected tab
- `searchQuery` (string) - Current search query
- `isAddModalOpen` (boolean) - Add item modal visibility
- `isSettingsOpen` (boolean) - Settings panel visibility
- `notification` (object) - Current notification
- `isSearchExpanded` (boolean) - Search input expanded state

**Functions**:
- `handleTabChange(tabId)` - Changes active tab
- `handleSearch(query)` - Updates search query
- `handleOpenFloatingWindow()` - Opens floating window
- `handleAddItem(content, type)` - Adds new item to clipboard history

#### TabBar Component (`TabBar.js`)
**Purpose**: Provides navigation between content categories.

**Props**:
- `activeTab` (string) - Currently selected tab
- `onTabChange` (function) - Tab change handler
- `tabs` (array) - Available tabs configuration

**Functions**:
- `handleTabClick(tabId)` - Changes active tab

#### ClipboardList Component (`ClipboardList.js`)
**Purpose**: Displays list of clipboard items.

**Props**:
- `items` (array) - Clipboard items to display
- `onCopyItem` (function) - Copy item handler
- `onDeleteItem` (function) - Delete item handler
- `onToggleFavorite` (function) - Favorite toggle handler
- `selectedItems` (array) - Selected items for multi-select
- `isMultiSelectMode` (boolean) - Multi-select mode state
- `onToggleItemSelection` (function) - Item selection toggle handler
- `onSelectAllItems` (function) - Select all items handler
- `onClearSelection` (function) - Clear selection handler

**Functions**:
- `renderItems()` - Renders list of clipboard items
- `handleSelectAll()` - Selects all visible items
- `handleClearSelection()` - Clears current selection

#### ClipboardItem Component (`ClipboardItem.js`)
**Purpose**: Renders individual clipboard item with actions.

**Props**:
- `item` (object) - Clipboard item data
- `onCopy` (function) - Copy handler
- `onDelete` (function) - Delete handler
- `onToggleFavorite` (function) - Favorite toggle handler
- `isSelected` (boolean) - Selection state
- `onToggleSelection` (function) - Selection toggle handler
- `isMultiSelectMode` (boolean) - Multi-select mode state

**Functions**:
- `handleCopyClick()` - Handles copy button click
- `handleDeleteClick()` - Handles delete button click
- `handleFavoriteClick()` - Handles favorite button click
- `handleSelectionToggle()` - Handles selection checkbox toggle
- `renderContent()` - Renders item content based on type
- `formatTimestamp(timestamp)` - Formats timestamp to relative time

#### AddItemModal Component (`AddItemModal.js`)
**Purpose**: Modal for adding new clipboard items manually.

**Props**:
- `isOpen` (boolean) - Modal visibility
- `onClose` (function) - Close handler
- `onAddItem` (function) - Add item handler

**State**:
- `content` (string) - New item content
- `type` (string) - New item type

**Functions**:
- `handleContentChange(event)` - Updates content state
- `handleTypeChange(event)` - Updates type state
- `handleSubmit(event)` - Submits new item

#### Settings Component (`Settings.js`)
**Purpose**: Provides settings configuration panel.

**Props**:
- `isOpen` (boolean) - Panel visibility
- `onClose` (function) - Close handler

**Context**:
- `SettingsContext` - Settings context for global settings management

**State**:
- `formData` (object) - Form data for settings

**Functions**:
- `handleInputChange(event)` - Updates form data
- `handleSubmit(event)` - Submits settings changes
- `resetToDefaults()` - Resets settings to defaults

### 4. Context Providers

#### SettingsContext (`SettingsContext.js`)
**Purpose**: Provides global settings management.

**State**:
- `settings` (object) - Current settings
- `isLoading` (boolean) - Loading state

**Functions**:
- `updateSettings(newSettings)` - Updates settings
- `resetSettings()` - Resets settings to defaults
- `loadSettings()` - Loads settings from storage

### 5. Custom Hooks

#### useClipboardData Hook (`useClipboardData.js`)
**Purpose**: Manages clipboard data and operations.

**Parameters**:
- `initialTab` (string) - Initial active tab
- `initialQuery` (string) - Initial search query

**Returns**:
- `clipboardItems` (array) - All clipboard items
- `filteredItems` (array) - Filtered clipboard items
- `isLoading` (boolean) - Loading state
- `error` (string) - Error message if applicable
- `copyItem` (function) - Copies item to clipboard
- `toggleFavorite` (function) - Toggles favorite status
- `deleteItem` (function) - Deletes item from history
- `addItem` (function) - Adds new item to history
- `clearAll` (function) - Clears all history
- `handleTabChange` (function) - Changes active tab
- `handleSearchQueryChange` (function) - Updates search query
- `loadData` (function) - Loads data from background script
- `selectedItems` (array) - Selected items for multi-select
- `isMultiSelectMode` (boolean) - Multi-select mode state
- `toggleItemSelection` (function) - Toggles item selection
- `selectAllItems` (function) - Selects all items
- `clearSelection` (function) - Clears selection
- `toggleMultiSelectMode` (function) - Toggles multi-select mode
- `deleteSelectedItems` (function) - Deletes selected items

**Functions**:
- `loadData(showLoading)` - Loads data from background script
- `filterItems(items, tab, query)` - Filters items based on tab and query
- `copyItem(itemId)` - Copies item to system clipboard
- `toggleFavorite(itemId)` - Toggles item favorite status
- `deleteItem(itemId)` - Deletes item from history
- `addItem(content, type)` - Adds new item to history
- `clearAll()` - Clears all clipboard history
- `handleTabChange(tab)` - Changes active tab
- `handleSearchQueryChange(query)` - Updates search query
- `toggleItemSelection(itemId)` - Toggles item selection
- `selectAllItems()` - Selects all visible items
- `clearSelection()` - Clears current selection
- `toggleMultiSelectMode()` - Toggles multi-select mode
- `deleteSelectedItems()` - Deletes selected items

### 6. Utility Functions

#### Clipboard Utilities (`clipboardUtils.js`)
**Purpose**: Provides helper functions for clipboard operations.

**Functions**:
- `copyTextToClipboard(text)` - Copies text to system clipboard
  - *Input*: `text` (string)
  - *Output*: Promise (resolves on success)
  - *Actions*: Uses Clipboard API with fallbacks

- `pasteFromClipboard()` - Gets text from system clipboard
  - *Input*: None
  - *Output*: Promise (resolves with clipboard text)
  - *Actions*: Uses Clipboard API with fallbacks

- `categorizeContent(content)` - Determines content type
  - *Input*: `content` (string or binary)
  - *Output*: String (content type: 'text', 'url', 'code', 'image')
  - *Actions*: Analyzes content and returns category

- `formatTimestamp(timestamp)` - Converts timestamp to relative time
  - *Input*: `timestamp` (number or date string)
  - *Output*: String (e.g., "7 mins ago")
  - *Actions*: Calculates time difference and formats

- `isValidUrl(string)` - Checks if string is a valid URL
  - *Input*: `string` (string)
  - *Output*: Boolean
  - *Actions*: Validates URL format

## Data Flow and Object Interactions

### 1. Data Structure

The core data structure for the clipboard manager is:

```
{
  items: [
    {
      id: "unique-id",
      content: "Content string or data URL for images",
      type: "text|url|code|image",
      timestamp: 1634567890123,
      isFavorite: false,
      charCount: 42
    },
    // More items...
  ],
  favorites: [
    // Structure same as above, but only favorite items
  ]
}
```

### 2. Settings Structure

The settings structure is:

```
{
  maxHistoryItems: 100,
  maxTextLength: 10000,
  maxImageSize: 1000, // in KB
  showCharCount: true,
  enableVerboseLogging: false,
  theme: 'dark', // or 'light'
  autoStartMonitoring: true,
  monitoringInterval: 2000, // in ms
  // Additional settings...
}
```

### 3. Component Interaction Diagram

```
┌─────────────────────────────────────────┐
│                                         │
│               App (React)               │
│                                         │
└───┬─────────┬─────────┬─────────┬───────┘
    │         │         │         │
    ▼         ▼         ▼         ▼
┌─────────┐ ┌───────┐ ┌───────┐ ┌─────────┐
│ Header  │ │TabBar │ │Search │ │Settings │
└─────────┘ └───┬───┘ └───┬───┘ └─────────┘
                │         │
                ▼         │
          ┌──────────┐    │
          │Clipboard │◄───┘
          │  List    │
          └────┬─────┘
               │
               ▼
         ┌──────────────┐
         │ ClipboardItem│
         └──────┬───────┘
                │
                ▼
          ┌──────────┐
          │AddItemModal│
          └──────────┘
```

### 4. Message Flow Between Components

```
┌─────────────┐  getClipboardData   ┌─────────────┐
│             │─────────────────────►│             │
│   React     │                     │ Background  │
│   Components│◄─────────────────────│   Script    │
│             │ clipboardData       │             │
└─────────────┘                     └──────┬──────┘
      ▲                                    │
      │                                    │
      │ pasteToActiveElement              │ checkClipboardForChanges
      │                                    │
      │                                    ▼
┌─────┴─────┐                       ┌────────────┐
│           │                       │            │
│  Content  │                       │  System    │
│  Script   │◄──────────────────────┤  Clipboard │
│           │   clipboard changes   │            │
└───────────┘                       └────────────┘
```

## End-to-End Flows

### 1. Copy Detection and Storage Flow

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│ User     │     │ Background    │     │ Chrome       │     │ Components  │
│ copies   │────►│ script detects│────►│ Storage API  │────►│ update with │
│ content  │     │ and processes │     │ stores item  │     │ new item    │
└──────────┘     └───────────────┘     └──────────────┘     └─────────────┘
```

**Detailed Steps**:
1. User copies content in any application
2. Content script detects copy event (Ctrl+C/Command+C) and notifies background script
3. Background script polls clipboard via `checkClipboardForChanges()`
4. New content detected by comparing with last known state
5. `processClipboardContent()` analyzes and categorizes content
6. New item created with unique ID, content, type, timestamp, and character count
7. Item added to clipboard data structure
8. `saveClipboardData()` persists updated data to Chrome storage
9. Background script broadcasts update message to all open extension windows
10. Components receive update notification and refresh their data
11. UI updates to show new item at top of list

### 2. Multi-select Operations Flow

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│ User     │     │ ClipboardList │     │ useClipboard │     │ Background  │
│ selects  │────►│ toggles       │────►│ Data updates │────►│ script      │
│ items    │     │ selection     │     │ selection    │     │ processes   │
└──────────┘     └───────────────┘     └──────────────┘     └─────────────┘
```

**Detailed Steps**:
1. User enables multi-select mode via toggle button
2. UI updates to show checkboxes next to items
3. User selects items by clicking checkboxes
4. `toggleItemSelection()` updates selected items array
5. User clicks action button (e.g., delete selected)
6. `deleteSelectedItems()` sends delete request to background script
7. Background script processes deletion of multiple items
8. Background script updates storage and notifies components
9. UI updates to reflect changes
10. Multi-select mode remains active until toggled off

### 3. Settings Management Flow

```
┌──────────┐     ┌───────────────┐     ┌──────────────┐     ┌─────────────┐
│ User     │     │ Settings      │     │ Settings     │     │ Components  │
│ changes  │────►│ component     │────►│ Context      │────►│ update with │
│ settings │     │ updates       │     │ updates      │     │ new settings│
└──────────┘     └───────────────┘     └──────────────┘     └─────────────┘
```

**Detailed Steps**:
1. User opens settings panel
2. Settings component loads current settings from SettingsContext
3. User modifies settings
4. `handleSubmit()` calls `updateSettings()` on SettingsContext
5. SettingsContext saves settings to Chrome storage
6. SettingsContext broadcasts settings update to all components
7. Components receive updated settings and adjust behavior accordingly
8. UI updates to reflect new settings (e.g., theme change)

## Implementation Guide

### 1. Setting Up the Project

1. **Create Project Structure**:
   - Set up folder structure as shown in [Folder and File Structure](#folder-and-file-structure)
   - Initialize npm project with `package.json`

2. **Configure Manifest**:
   - Create `manifest.json` with extension configuration:
     - Name, description, version
     - Permissions (clipboardRead, clipboardWrite, storage, contextMenus, scripting)
     - Background script configuration
     - Browser action popup
     - Content scripts configuration
     - Icons

3. **Setup Webpack**:
   - Configure webpack for React build process
   - Set entry points for popup, background, and content scripts
   - Configure output paths and asset handling

### 2. Implementing Core Components

1. **Background Script**:
   - Implement clipboard monitoring system
   - Create storage management functions
   - Set up message handling system
   - Implement context menu creation
   - Add floating window and PiP window management

2. **Content Script**:
   - Implement copy event detection
   - Create paste functionality
   - Set up clipboard button observer
   - Create notification system
   - Set up message handling

3. **React Components**:
   - Create component hierarchy starting with App
   - Implement individual components with their functionality
   - Create SettingsContext for settings management
   - Create useClipboardData hook for data operations

4. **Utilities**:
   - Implement clipboard utility functions
   - Create helper functions for common operations

### 3. Data Management

1. **Storage Structure**:
   - Define data structure for clipboard items
   - Implement storage read/write functions
   - Set up categorization system
   - Implement settings storage and management

2. **Clipboard Monitoring**:
   - Implement polling mechanism
   - Create content detection and processing
   - Handle different content types (text, URLs, code, images)
   - Implement copy event detection in content script

3. **Search Functionality**:
   - Implement debounced search
   - Create filtering functions
   - Connect search to UI components

### 4. User Interfaces

1. **Main Popup**:
   - Create responsive layout
   - Implement tabbed navigation
   - Design clipboard item display
   - Add multi-select functionality

2. **Floating Window**:
   - Create detachable window interface
   - Implement window management
   - Ensure data synchronization

3. **Picture-in-Picture Mode**:
   - Create compact interface
   - Implement always-on-top functionality
   - Design minimal controls

4. **Context Menu**:
   - Configure menu structure
   - Connect to favorite items
   - Implement paste functionality

### 5. Testing and Debugging

1. **Local Testing**:
   - Load unpacked extension in Chrome
   - Test core functionality
   - Verify data persistence

2. **Error Handling**:
   - Implement try/catch blocks
   - Create user-friendly error messages
   - Add fallback mechanisms

3. **Performance Optimization**:
   - Optimize polling frequency
   - Implement debouncing for expensive operations
   - Limit history size

## Troubleshooting and Edge Cases

### Common Issues and Solutions

1. **Clipboard Access Restrictions**:
   - **Issue**: Some websites restrict clipboard access
   - **Solution**: Implement fallback using execCommand where possible
   - **Detection**: Try/catch around clipboard operations

2. **Storage Limitations**:
   - **Issue**: Chrome storage has size limits
   - **Solution**: Limit history size, optimize image storage
   - **Handling**: Implement cleanup for oldest items when approaching limits

3. **Context Menu Limitations**:
   - **Issue**: Context menus have limited space
   - **Solution**: Limit favorites shown to 10 most recent
   - **Handling**: Prioritize recent and frequently used items

4. **Concurrent Operations**:
   - **Issue**: Race conditions during rapid clipboard changes
   - **Solution**: Use flags to prevent overlapping operations
   - **Implementation**: Add isProcessing flags with timeouts

5. **Image Clipboard Handling**:
   - **Issue**: Image clipboard access is complex
   - **Solution**: Use hidden elements for paste operations
   - **Implementation**: Create temporary DOM elements for processing

6. **Copy Event Detection**:
   - **Issue**: Copy events can be missed in some applications
   - **Solution**: Combine keyboard shortcut detection with clipboard polling
   - **Implementation**: Use content script to detect Ctrl+C/Command+C and notify background script

### Security Considerations

1. **Data Storage**:
   - All clipboard data stored only locally on device
   - No external server communication
   - Clear history option for privacy

2. **URL Restrictions**:
   - Prevent operations on restricted URLs (chrome://, edge://, etc.)
   - Validate URLs before processing
   - Handle errors gracefully

This documentation provides a comprehensive blueprint for the PasteKeeper Clipboard Manager Chrome Extension. It reflects the current implementation with features like multi-select mode, Picture-in-Picture window, theme options, and settings management through React Context. 