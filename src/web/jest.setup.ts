import '@testing-library/jest-dom/extend-expect'; // v5.16.5
import { configure } from '@testing-library/react'; // v13.4.0
import userEvent from '@testing-library/user-event'; // v14.4.3
import 'jest-environment-jsdom'; // v29.0.0
import i18next from 'i18next'; // v22.0.0

// Configure testing-library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Setup matchMedia mock
const setupMatchMediaMock = (): void => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Setup ResizeObserver mock
const setupResizeObserverMock = (): void => {
  class ResizeObserverMock {
    private callback: ResizeObserverCallback;
    private elements: Set<Element>;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      this.elements = new Set();
    }

    observe(element: Element): void {
      this.elements.add(element);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
    }

    disconnect(): void {
      this.elements.clear();
    }
  }

  global.ResizeObserver = ResizeObserverMock;
};

// Setup IntersectionObserver mock
const setupIntersectionObserverMock = (): void => {
  class IntersectionObserverMock {
    private callback: IntersectionObserverCallback;
    private elements: Set<Element>;
    private options?: IntersectionObserverInit;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.elements = new Set();
      this.options = options;
    }

    observe(element: Element): void {
      this.elements.add(element);
      // Simulate intersection
      this.callback([{
        target: element,
        isIntersecting: true,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRatio: 1,
        intersectionRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      }], this);
    }

    unobserve(element: Element): void {
      this.elements.delete(element);
    }

    disconnect(): void {
      this.elements.clear();
    }
  }

  global.IntersectionObserver = IntersectionObserverMock;
};

// Setup i18next for internationalization testing
const setupI18n = async (): Promise<void> => {
  await i18next.init({
    lng: 'en', // Default language
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'he'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { common: {} },
      fr: { common: {} },
      he: { common: {} },
    },
    react: {
      useSuspense: false,
    },
  });
};

// Setup fetch mock
const setupFetchMock = (): void => {
  global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
      headers: new Headers(),
    });
  });
};

// Setup storage mocks
const setupStorageMock = (): void => {
  class StorageMock implements Storage {
    private store: Map<string, string>;

    constructor() {
      this.store = new Map();
    }

    get length(): number {
      return this.store.size;
    }

    clear(): void {
      this.store.clear();
    }

    getItem(key: string): string | null {
      return this.store.get(key) || null;
    }

    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    key(index: number): string | null {
      return Array.from(this.store.keys())[index] || null;
    }
  }

  Object.defineProperty(window, 'localStorage', {
    value: new StorageMock(),
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: new StorageMock(),
  });
};

// Initialize all mocks and configurations
beforeAll(async () => {
  setupMatchMediaMock();
  setupResizeObserverMock();
  setupIntersectionObserverMock();
  setupFetchMock();
  setupStorageMock();
  await setupI18n();
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

// Make userEvent available globally for tests
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveValue(value: string | number | string[]): R;
    }
  }

  var userEvent: typeof userEvent;
}

global.userEvent = userEvent;