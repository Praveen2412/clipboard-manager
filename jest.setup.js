require('@testing-library/jest-dom');

// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onSuspend: {
      addListener: jest.fn()
    },
    getManifest: jest.fn().mockReturnValue({ version: '1.0.0' })
  },
  storage: {
    local: {
      get: jest.fn().mockImplementation((keys, callback) => {
        callback({});
      }),
      set: jest.fn().mockImplementation((data, callback) => {
        if (callback) callback();
      })
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn().mockImplementation((queryInfo, callback) => {
      callback([{ id: 1, url: 'https://example.com' }]);
    }),
    create: jest.fn(),
    sendMessage: jest.fn()
  },
  extension: {
    getURL: jest.fn().mockReturnValue('chrome-extension://abcdefgh/index.html')
  },
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