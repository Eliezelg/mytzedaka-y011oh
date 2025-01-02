/**
 * @fileoverview Core API client module for handling HTTP requests, authentication,
 * error management, caching, and offline support
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.5.0
import localforage from 'localforage'; // ^1.10.0
import { API_CONFIG, ERROR_MESSAGES } from '../config/constants';

/**
 * Network status tracking interface
 */
interface NetworkStatus {
  isOnline: boolean;
  lastChecked: number;
}

/**
 * Request queue interface for offline support
 */
interface QueuedRequest {
  config: AxiosRequestConfig;
  timestamp: number;
  retryCount: number;
}

/**
 * Class for managing request queuing and retry logic
 */
class RequestQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing: boolean = false;
  private networkStatus: NetworkStatus = { isOnline: true, lastChecked: Date.now() };

  constructor(
    private maxRetries: number = 3,
    private retryDelay: number = 1000,
    private storage: LocalForage = localforage
  ) {
    this.initializeNetworkListener();
    this.initializeStorage();
  }

  /**
   * Initialize network status listener
   */
  private initializeNetworkListener(): void {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
  }

  /**
   * Initialize storage and load queued requests
   */
  private async initializeStorage(): Promise<void> {
    try {
      const savedQueue = await this.storage.getItem('requestQueue');
      if (savedQueue) {
        this.queue = JSON.parse(savedQueue as string);
      }
    } catch (error) {
      console.error('Failed to initialize request queue:', error);
    }
  }

  /**
   * Handle network status changes
   */
  private handleNetworkChange(isOnline: boolean): void {
    this.networkStatus = { isOnline, lastChecked: Date.now() };
    if (isOnline) {
      this.processQueue();
    }
  }

  /**
   * Add request to queue
   */
  public async addToQueue(config: AxiosRequestConfig): Promise<void> {
    const queuedRequest: QueuedRequest = {
      config,
      timestamp: Date.now(),
      retryCount: 0
    };
    this.queue.push(queuedRequest);
    await this.saveQueue();
  }

  /**
   * Process queued requests
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing || !this.networkStatus.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    try {
      const request = this.queue[0];
      const response = await axiosInstance(request.config);
      this.queue.shift();
      await this.saveQueue();
    } catch (error) {
      const request = this.queue[0];
      if (request.retryCount < this.maxRetries) {
        request.retryCount++;
        setTimeout(() => this.processQueue(), this.retryDelay * Math.pow(2, request.retryCount));
      } else {
        this.queue.shift();
        await this.saveQueue();
      }
    } finally {
      this.isProcessing = false;
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Save queue to persistent storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await this.storage.setItem('requestQueue', JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save request queue:', error);
    }
  }
}

// Initialize request queue
const requestQueue = new RequestQueue();

/**
 * Create and configure Axios instance
 */
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: `${API_CONFIG.BASE_URL}/api/${API_CONFIG.API_VERSION}`,
    timeout: API_CONFIG.TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': localStorage.getItem('selected_language') || 'en'
    }
  });

  // Request interceptor
  instance.interceptors.request.use(
    async (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Add request timestamp for cache control
      config.headers['X-Request-Time'] = Date.now().toString();

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Cache successful GET requests
      if (response.config.method?.toLowerCase() === 'get') {
        const cacheKey = `${response.config.url}${JSON.stringify(response.config.params || {})}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          data: response.data,
          timestamp: Date.now()
        }));
      }
      return response;
    },
    async (error: AxiosError) => {
      return handleError(error);
    }
  );

  return instance;
};

/**
 * Enhanced error handler
 */
const handleError = async (error: AxiosError): Promise<never> => {
  if (!error.response) {
    // Network error - queue request for offline handling
    if (error.config) {
      await requestQueue.addToQueue(error.config);
    }
    throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
  }

  switch (error.response.status) {
    case 401:
      // Handle authentication errors
      localStorage.removeItem('auth_token');
      throw new Error(ERROR_MESSAGES.AUTH_ERROR);
    
    case 403:
      throw new Error(ERROR_MESSAGES.PERMISSION_ERROR);
    
    case 500:
      throw new Error(ERROR_MESSAGES.SERVER_ERROR);
    
    default:
      throw error;
  }
};

/**
 * Handle offline requests
 */
const handleOfflineRequest = async (request: AxiosRequestConfig): Promise<void> => {
  await requestQueue.addToQueue(request);
};

// Create and export configured Axios instance
const axiosInstance = createAxiosInstance();

export default axiosInstance;

// Export additional utilities
export {
  handleOfflineRequest,
  RequestQueue
};