import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface VerifyLenderResponse {
  isRegistered: boolean;
  isIllegal?: boolean;
  lenderName: string;
  owner?: string;
  url?: string;
  message: string;
  details?: string;
}

/**
 * OJK (Otoritas Jasa Keuangan) Lender Validator
 * Integrates with official OJK API via backend for real-time verification
 * Checks against registered apps and illegal products
 */
@Injectable({ providedIn: 'root' })
export class OjkValidator {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Verify if a lender name is officially registered with OJK
   * Uses real-time OJK API data from backend
   * @param lenderName - The name of the lender to verify
   * @returns Observable<boolean> - true if lender is registered, false otherwise
   */
  verify(lenderName: string): Observable<boolean> {
    return this.http
      .post<VerifyLenderResponse>(`${this.baseUrl}/verify-lender`, {
        lenderName,
      })
      .pipe(
        map((response) => response.isRegistered),
        catchError((error) => {
          console.error('OJK verification failed:', error);
          // Fallback to false on error
          return of(false);
        }),
      );
  }

  /**
   * Get detailed verification result for a lender
   * @param lenderName - The name of the lender to verify
   * @returns Observable with full verification details
   */
  verifyDetailed(lenderName: string): Observable<VerifyLenderResponse> {
    return this.http
      .post<VerifyLenderResponse>(`${this.baseUrl}/verify-lender`, {
        lenderName,
      })
      .pipe(
        catchError((error) => {
          console.error('OJK verification failed:', error);
          return of({
            isRegistered: false,
            lenderName,
            message: 'Gagal memverifikasi lender. Cek koneksi internet Anda.',
            details: error.message,
          });
        }),
      );
  }

  /**
   * Get list of registered apps from OJK
   * @returns Observable with list of registered apps
   */
  getRegisteredApps(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ojk/apps`).pipe(
      catchError((error) => {
        console.error('Failed to fetch OJK apps:', error);
        return of({ data: { apps: [], version: '' } });
      }),
    );
  }

  /**
   * Get list of illegal products from OJK
   * @returns Observable with list of illegal products
   */
  getIllegalProducts(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ojk/illegals`).pipe(
      catchError((error) => {
        console.error('Failed to fetch OJK illegals:', error);
        return of({ data: { illegals: [], version: '' } });
      }),
    );
  }

  /**
   * Get OJK API status
   * @returns Observable with API status
   */
  getApiStatus(): Observable<any> {
    return this.http.get(`${this.baseUrl}/ojk/status`).pipe(
      catchError((error) => {
        console.error('Failed to fetch OJK status:', error);
        return of({ error: error.message });
      }),
    );
  }

  /**
   * Get list of registered lender names for autocomplete
   * @returns Observable with array of registered lender names
   */
  getRegisteredLendersList(): Observable<string[]> {
    return this.getRegisteredApps().pipe(
      map((response) => {
        // Extract lender names from OJK API response
        if (response?.data?.apps && Array.isArray(response.data.apps)) {
          return response.data.apps
            .map((app: any) => app.name || app.title || '')
            .filter((name: string) => name.length > 0)
            .sort();
        }
        return [];
      }),
      catchError((error) => {
        console.error('Failed to fetch registered lenders list:', error);
        return of([]);
      }),
    );
  }

  /**
   * Search for lenders matching a search term
   * @param searchTerm - Partial name to search for
   * @returns Observable with filtered lender names
   */
  searchLenders(searchTerm: string): Observable<string[]> {
    if (!searchTerm || searchTerm.length < 1) {
      return of([]);
    }

    return this.getRegisteredLendersList().pipe(
      map((lenders) => {
        const normalized = searchTerm.toLowerCase().trim();
        return lenders.filter((lender) => lender.toLowerCase().includes(normalized));
      }),
      catchError((error) => {
        console.error('Failed to search lenders:', error);
        return of([]);
      }),
    );
  }
}
