import React from 'react';
import { render, screen, act, within } from '@testing-library/react'; // v13.4.0
import userEvent from '@testing-library/user-event'; // v14.4.3
import App from './App';

// Mock required providers and components
jest.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>
}));

jest.mock('./contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>
}));

jest.mock('./contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="language-provider">{children}</div>
}));

jest.mock('./components/layout/MainLayout', () => ({
  __esModule: true,
  default: () => <div data-testid="main-layout">Main Layout Content</div>
}));

// Mock window.matchMedia for theme testing
const mockMatchMedia = () => ({
  matches: false,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});

describe('App', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup matchMedia mock
    window.matchMedia = window.matchMedia || mockMatchMedia;
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };
  });

  afterEach(() => {
    // Clean up
    jest.resetAllMocks();
    localStorage.clear();
    document.documentElement.dir = 'ltr';
  });

  it('renders with proper provider hierarchy', () => {
    render(<App />);

    // Verify providers are rendered in correct order
    const authProvider = screen.getByTestId('auth-provider');
    const themeProvider = screen.getByTestId('theme-provider');
    const languageProvider = screen.getByTestId('language-provider');
    const mainLayout = screen.getByTestId('main-layout');

    expect(languageProvider).toBeInTheDocument();
    expect(themeProvider).toBeInTheDocument();
    expect(authProvider).toBeInTheDocument();
    expect(mainLayout).toBeInTheDocument();

    // Verify nesting order
    expect(languageProvider).toContainElement(themeProvider);
    expect(themeProvider).toContainElement(authProvider);
    expect(authProvider).toContainElement(mainLayout);
  });

  it('handles theme switching with system preference', async () => {
    // Mock system color scheme preference
    const darkMediaQuery = '(prefers-color-scheme: dark)';
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === darkMediaQuery,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    render(<App />);

    // Verify initial theme matches system preference
    expect(document.documentElement.classList.contains('dark-mode')).toBe(true);

    // Simulate theme toggle
    const themeToggle = screen.getByLabelText(/toggle theme/i);
    await act(async () => {
      await userEvent.click(themeToggle);
    });

    // Verify theme change
    expect(document.documentElement.classList.contains('light-mode')).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('theme-mode', 'light');
  });

  it('supports RTL layout transitions', async () => {
    render(<App />);

    // Initial LTR layout
    expect(document.documentElement.dir).toBe('ltr');

    // Switch to Hebrew language
    const languageSelector = screen.getByLabelText(/select language/i);
    await act(async () => {
      await userEvent.click(languageSelector);
      const hebrewOption = screen.getByText('עברית');
      await userEvent.click(hebrewOption);
    });

    // Verify RTL layout
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('he');

    // Verify content alignment
    const mainLayout = screen.getByTestId('main-layout');
    expect(mainLayout).toHaveStyle({ direction: 'rtl' });
  });

  it('handles error boundaries correctly', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');

    // Mock component that throws error
    const ErrorComponent = () => {
      throw error;
    };

    render(
      <App>
        <ErrorComponent />
      </App>
    );

    // Verify error boundary caught the error
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText(error.message)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('initializes performance monitoring in production', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    const mockWebVitals = {
      getCLS: jest.fn(),
      getFID: jest.fn(),
      getFCP: jest.fn(),
      getLCP: jest.fn(),
      getTTFB: jest.fn(),
    };

    jest.mock('web-vitals', () => mockWebVitals);

    render(<App />);

    // Verify web vitals are initialized
    Object.values(mockWebVitals).forEach(metric => {
      expect(metric).toHaveBeenCalledWith(expect.any(Function));
    });

    process.env.NODE_ENV = originalNodeEnv;
  });
});