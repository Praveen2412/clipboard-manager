module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleFileExtensions: ['js', 'jsx'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!.*\\.mjs$)'
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js'
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  verbose: true
};
