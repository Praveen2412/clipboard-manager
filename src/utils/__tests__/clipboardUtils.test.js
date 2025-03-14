import { 
  formatTimestamp,
  categorizeContent,
  copyTextToClipboard,
  isValidUrl as isUrl
} from '../clipboardUtils';

describe('clipboardUtils', () => {
  describe('formatTimestamp', () => {
    test('formats timestamp correctly', () => {
      const date = new Date('2023-05-15T10:30:00');
      expect(formatTimestamp(date.getTime())).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });
  });

  describe('isUrl', () => {
    test('identifies valid URLs', () => {
      expect(isUrl('https://example.com')).toBe(true);
      expect(isUrl('http://localhost:3000')).toBe(true);
      expect(isUrl('just some text')).toBe(false);
    });
  });

  describe('categorizeContent', () => {
    test('identifies URLs correctly', () => {
      // URL detection tests
      expect(categorizeContent('https://example.com')).toBe('url');
      expect(categorizeContent('http://localhost:3000')).toBe('url');
      expect(categorizeContent('This is not a URL')).not.toBe('url');
    });

    test('identifies code snippets correctly', () => {
      // Code snippet detection tests
      expect(categorizeContent('function test() { return true; }')).toBe('code');
      expect(categorizeContent('const x = 10; if (x > 5) { console.log(x); }')).toBe('code');
      expect(categorizeContent('This is not code')).not.toBe('code');
    });

    test('defaults to text for plain content', () => {
      // Plain text detection
      expect(categorizeContent('This is plain text')).toBe('text');
      expect(categorizeContent('Another text example')).toBe('text');
    });
  });

  describe('copyTextToClipboard', () => {
    // Mock for testing copyTextToClipboard
    beforeEach(() => {
      // Mock the navigator.clipboard API
      Object.defineProperty(global.navigator, 'clipboard', {
        value: {
          writeText: jest.fn().mockImplementation(() => Promise.resolve())
        },
        configurable: true
      });

      // Mock document methods
      document.execCommand = jest.fn().mockReturnValue(true);
      document.createElement = jest.fn().mockReturnValue({
        value: '',
        style: {},
        focus: jest.fn(),
        select: jest.fn()
      });
      document.body.appendChild = jest.fn();
      document.body.removeChild = jest.fn();
    });

    test('uses Clipboard API when available', async () => {
      await copyTextToClipboard('test text');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(document.execCommand).not.toHaveBeenCalled();
    });

    test('falls back to execCommand when Clipboard API fails', async () => {
      // Mock the clipboard API to throw an error
      navigator.clipboard.writeText.mockImplementation(() => Promise.reject(new Error('Clipboard API failed')));
      
      await copyTextToClipboard('test text');
      
      // Clipboard API should be called but fail
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(document.createElement).toHaveBeenCalledWith('textarea');
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.execCommand).toHaveBeenCalledWith('copy');
      expect(document.body.removeChild).toHaveBeenCalled();
    });
  });
}); 