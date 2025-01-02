// @testing-library/jest-dom v5.16.5 - DOM matchers for Jest
import '@testing-library/jest-dom';
// @testing-library/react v13.4.0 - React testing utilities
import '@testing-library/react';
// @testing-library/user-event v14.4.3 - User event simulation
import '@testing-library/user-event';

/**
 * Enhanced matchMedia mock implementation supporting RTL and responsive design testing
 */
const setupMatchMediaMock = (): void => {
  const mockMatchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  });

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia,
  });
};

/**
 * Enhanced ResizeObserver mock for component size change testing
 */
const setupResizeObserverMock = (): void => {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    private elements: Set<Element>;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element: Element) {
      this.elements.add(element);
    }

    unobserve(element: Element) {
      this.elements.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  });
};

/**
 * Enhanced IntersectionObserver mock for infinite scroll and visibility testing
 */
const setupIntersectionObserverMock = (): void => {
  class IntersectionObserverMock {
    private callback: IntersectionObserverCallback;
    private elements: Map<Element, IntersectionObserverEntry>;

    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      this.elements = new Map();
    }

    observe(element: Element) {
      const entry: IntersectionObserverEntry = {
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRatio: 0,
        intersectionRect: new DOMRectReadOnly(0, 0, 0, 0),
        isIntersecting: false,
        rootBounds: null,
        target: element,
        time: Date.now(),
      };
      this.elements.set(element, entry);
    }

    unobserve(element: Element) {
      this.elements.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: IntersectionObserverMock,
  });
};

/**
 * Enhanced storage mocks with quota and language support
 */
const setupStorageMock = (): void => {
  class StorageMock implements Storage {
    private store: { [key: string]: string } = {};
    private quota: number = 5242880; // 5MB quota
    private used: number = 0;
    
    length = 0;

    clear(): void {
      this.store = {};
      this.length = 0;
      this.used = 0;
    }

    getItem(key: string): string | null {
      return this.store[key] || null;
    }

    key(index: number): string | null {
      return Object.keys(this.store)[index] || null;
    }

    removeItem(key: string): void {
      const value = this.store[key];
      if (value) {
        this.used -= value.length;
        delete this.store[key];
        this.length--;
      }
    }

    setItem(key: string, value: string): void {
      const newSize = value.length;
      if (this.used + newSize > this.quota) {
        throw new Error('QuotaExceededError');
      }
      if (!(key in this.store)) {
        this.length++;
      } else {
        this.used -= this.store[key].length;
      }
      this.store[key] = value;
      this.used += newSize;
    }
  }

  Object.defineProperty(window, 'localStorage', {
    writable: true,
    value: new StorageMock(),
  });

  Object.defineProperty(window, 'sessionStorage', {
    writable: true,
    value: new StorageMock(),
  });
};

/**
 * Enhanced fetch mock with multi-language support
 */
const setupFetchMock = (): void => {
  const mockFetch = jest.fn().mockImplementation((url: string, options: RequestInit = {}) => {
    // Default to successful response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
      headers: new Headers({
        'Content-Language': options.headers?.['Accept-Language'] || 'en',
      }),
    });
  });

  Object.defineProperty(window, 'fetch', {
    writable: true,
    value: mockFetch,
  });
};

// Initialize all mocks
setupMatchMediaMock();
setupResizeObserverMock();
setupIntersectionObserverMock();
setupStorageMock();
setupFetchMock();

// Configure testing environment
beforeAll(() => {
  // Set default viewport size
  Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 });

  // Set default language
  Object.defineProperty(window, 'navigator', {
    writable: true,
    value: {
      ...window.navigator,
      languages: ['en', 'he', 'fr'],
    },
  });
});

// Clean up after each test
afterEach(() => {
  // Clear storage
  window.localStorage.clear();
  window.sessionStorage.clear();
  
  // Reset fetch mock
  (window.fetch as jest.Mock).mockClear();
});