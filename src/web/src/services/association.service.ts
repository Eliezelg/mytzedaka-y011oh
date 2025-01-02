/**
 * @fileoverview Service layer for managing Jewish charitable associations
 * Provides comprehensive business logic, data transformation, caching,
 * and error handling between the UI and API layers with multi-language
 * and payment gateway integration support
 * @version 1.0.0
 */

import {
  getAssociations,
  getAssociationById,
  createAssociation,
  updateAssociation,
  verifyAssociation,
  updateAssociationStatus
} from '../api/associations';
import { IAssociation, IAssociationStatus } from '../interfaces/association.interface';
import { Observable, BehaviorSubject, Subject, of, throwError } from 'rxjs'; // ^7.0.0
import { map, catchError, retry, shareReplay, takeUntil } from 'rxjs/operators'; // ^7.0.0
import { CACHE_DURATION, ERROR_MESSAGES, SUPPORTED_LANGUAGES } from '../config/constants';

/**
 * Service class for managing association operations with enhanced caching
 * and memory management capabilities
 */
export class AssociationService {
  private associationCache: BehaviorSubject<Map<string, IAssociation>>;
  private cacheExpiry: Map<string, number>;
  private destroy$: Subject<void>;

  constructor() {
    this.associationCache = new BehaviorSubject<Map<string, IAssociation>>(new Map());
    this.cacheExpiry = new Map();
    this.destroy$ = new Subject<void>();
  }

  /**
   * Retrieves a paginated list of associations with enhanced filtering
   * including language support and caching
   */
  public fetchAssociations(params: {
    page?: number;
    limit?: number;
    status?: IAssociationStatus;
    category?: string;
    language?: string;
  }): Observable<{ data: IAssociation[]; total: number }> {
    const cacheKey = `associations_${JSON.stringify(params)}`;
    const cachedData = this.associationCache.value.get(cacheKey);
    const cacheTimestamp = this.cacheExpiry.get(cacheKey);

    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION.ASSOCIATION_DETAILS * 1000) {
      return of({ data: [cachedData], total: 1 });
    }

    return new Observable(subscriber => {
      getAssociations(params)
        .then(response => {
          // Update cache with new data
          const newCache = new Map(this.associationCache.value);
          response.data.forEach(association => {
            newCache.set(`association_${association.id}`, association);
          });
          this.associationCache.next(newCache);
          this.cacheExpiry.set(cacheKey, Date.now());
          
          subscriber.next(response);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      retry(3),
      shareReplay(1),
      takeUntil(this.destroy$),
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.NETWORK_ERROR)))
    );
  }

  /**
   * Retrieves detailed association information by ID with caching
   */
  public getAssociationDetails(id: string): Observable<IAssociation> {
    const cacheKey = `association_${id}`;
    const cachedData = this.associationCache.value.get(cacheKey);
    const cacheTimestamp = this.cacheExpiry.get(cacheKey);

    if (cachedData && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION.ASSOCIATION_DETAILS * 1000) {
      return of(cachedData);
    }

    return new Observable(subscriber => {
      getAssociationById(id)
        .then(association => {
          // Update cache with new data
          const newCache = new Map(this.associationCache.value);
          newCache.set(cacheKey, association);
          this.associationCache.next(newCache);
          this.cacheExpiry.set(cacheKey, Date.now());
          
          subscriber.next(association);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      retry(3),
      shareReplay(1),
      takeUntil(this.destroy$),
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.NETWORK_ERROR)))
    );
  }

  /**
   * Creates a new association with multi-language support
   */
  public createNewAssociation(data: Omit<IAssociation, 'id' | 'createdAt' | 'updatedAt'>): Observable<IAssociation> {
    return new Observable(subscriber => {
      // Validate required languages
      if (!this.validateLanguageSupport(data)) {
        subscriber.error(new Error(ERROR_MESSAGES.VALIDATION_ERROR));
        return;
      }

      createAssociation(data)
        .then(association => {
          // Update cache with new association
          const newCache = new Map(this.associationCache.value);
          newCache.set(`association_${association.id}`, association);
          this.associationCache.next(newCache);
          
          subscriber.next(association);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.VALIDATION_ERROR)))
    );
  }

  /**
   * Updates association information with cache invalidation
   */
  public updateAssociationDetails(
    id: string,
    updateData: Partial<IAssociation>
  ): Observable<IAssociation> {
    return new Observable(subscriber => {
      updateAssociation(id, updateData)
        .then(association => {
          // Update cache with new data
          const newCache = new Map(this.associationCache.value);
          newCache.set(`association_${id}`, association);
          this.associationCache.next(newCache);
          this.invalidateListCache();
          
          subscriber.next(association);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.VALIDATION_ERROR)))
    );
  }

  /**
   * Updates association status with audit logging
   */
  public updateStatus(
    id: string,
    status: IAssociationStatus,
    reason: string
  ): Observable<IAssociation> {
    return new Observable(subscriber => {
      updateAssociationStatus(id, status, reason)
        .then(association => {
          // Update cache and invalidate related caches
          const newCache = new Map(this.associationCache.value);
          newCache.set(`association_${id}`, association);
          this.associationCache.next(newCache);
          this.invalidateListCache();
          
          subscriber.next(association);
          subscriber.complete();
        })
        .catch(error => subscriber.error(error));
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => throwError(() => new Error(ERROR_MESSAGES.PERMISSION_ERROR)))
    );
  }

  /**
   * Clears all cached association data
   */
  public clearCache(): void {
    this.associationCache.next(new Map());
    this.cacheExpiry.clear();
  }

  /**
   * Performs cleanup on service destruction
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearCache();
  }

  /**
   * Validates language support requirements
   */
  private validateLanguageSupport(data: Partial<IAssociation>): boolean {
    if (!data.name || !data.description) return false;
    
    return SUPPORTED_LANGUAGES.every(lang => 
      data.name[lang] && 
      data.description[lang] &&
      data.name[lang].trim() !== '' &&
      data.description[lang].trim() !== ''
    );
  }

  /**
   * Invalidates list-related caches
   */
  private invalidateListCache(): void {
    const keysToRemove: string[] = [];
    this.cacheExpiry.forEach((_, key) => {
      if (key.startsWith('associations_')) {
        keysToRemove.push(key);
      }
    });
    
    keysToRemove.forEach(key => {
      this.cacheExpiry.delete(key);
    });
  }
}