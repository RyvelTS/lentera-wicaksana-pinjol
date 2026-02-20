import {
  Component,
  inject,
  output,
  signal,
  ChangeDetectionStrategy,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';

import { LoanInput } from '../services/loan-calculator';
import { OjkValidator } from '../services/ojk-validator';

/**
 * Loan Form Component
 * Handles user input for loan analysis
 * Standalone component with reactive forms
 */
@Component({
  selector: 'app-loan-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full',
  },
  template: `
    <form
      [formGroup]="form"
      (ngSubmit)="processForm()"
      class="bg-white p-6 rounded-xl shadow-md space-y-5 max-w-4xl mx-auto"
    >
      <h2 class="text-xl font-extrabold text-gray-800 border-b pb-2">Simulator Risiko Pinjaman</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Lender Name with Verify Button -->
        <div class="relative">
          <label for="lenderName" class="block text-sm font-semibold text-gray-700">
            Nama Aplikasi / Lender *
          </label>
          <div class="flex gap-2 mt-1">
            <div class="relative flex-1">
              <input
                id="lenderName"
                type="text"
                formControlName="lenderName"
                (blur)="closeSuggestions()"
                [class.border-red-500]="isInvalid('lenderName')"
                [class.border-green-500]="isLenderVerified()"
                class="w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                aria-required="true"
                placeholder="Contoh: Amartha, Investree"
              />

              <!-- Autocomplete Suggestions Dropdown -->
              @if (showSuggestions() && suggestions().length > 0) {
                <div
                  class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto"
                >
                  @for (suggestion of suggestions(); track suggestion) {
                    <button
                      type="button"
                      (mousedown)="selectSuggestion(suggestion); $event.preventDefault()"
                      class="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm text-gray-700"
                    >
                      {{ suggestion }}
                    </button>
                  }
                </div>
              }

              <!-- Verification Status Icon -->
              <div class="absolute right-3 top-1/2 transform -translate-y-1/2">
                @if (isVerifying()) {
                  <div
                    class="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"
                  ></div>
                } @else if (verificationStatus() === 'registered') {
                  <span class="text-green-600 font-bold">✓</span>
                } @else if (verificationStatus() === 'illegal') {
                  <span class="text-red-600 font-bold">⚠</span>
                }
              </div>
            </div>

            <!-- Verify Button -->
            <button
              type="button"
              (click)="onVerify()"
              [disabled]="!form.get('lenderName')?.value || isVerifying()"
              class="px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {{ isVerifying() ? 'Verifying...' : 'Verify' }}
            </button>
          </div>

          <!-- Verification Message -->
          @if (verificationStatus() === 'registered') {
            <p class="mt-2 text-sm text-green-600 font-medium">✓ Lender terdaftar resmi di OJK</p>
          } @else if (verificationStatus() === 'illegal') {
            <p class="mt-2 text-sm text-red-600 font-medium">
              ⚠ PERINGATAN: Lender ini tercatat sebagai ilegal di OJK
            </p>
          } @else if (verificationStatus() === 'unregistered') {
            <p class="mt-2 text-sm text-yellow-600 font-medium">
              ℹ Lender tidak ditemukan dalam daftar OJK - Hati-hati!
            </p>
          }

          @if (isInvalid('lenderName')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Nama lender wajib diisi</p>
          }
        </div>

        <!-- Monthly Income -->
        <div>
          <label for="monthlyIncome" class="block text-sm font-semibold text-gray-700">
            Gaji Bulanan (Rp) *
          </label>
          <input
            id="monthlyIncome"
            type="number"
            formControlName="monthlyIncome"
            [class.border-red-500]="isInvalid('monthlyIncome')"
            class="mt-1 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            aria-required="true"
            placeholder="Contoh: 5000000"
          />
          @if (isInvalid('monthlyIncome')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Gaji bulanan wajib diisi (> 0)</p>
          }
        </div>

        <!-- Loan Amount -->
        <div>
          <label for="amount" class="block text-sm font-semibold text-gray-700">
            Jumlah Pinjaman (Rp) *
          </label>
          <input
            id="amount"
            type="number"
            formControlName="amount"
            [class.border-red-500]="isInvalid('amount')"
            class="mt-1 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            aria-required="true"
            placeholder="Contoh: 1000000"
          />
          @if (isInvalid('amount')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Jumlah pinjaman wajib diisi (> 0)</p>
          }
        </div>

        <!-- Admin Fee -->
        <div>
          <label for="adminFee" class="block text-sm font-semibold text-gray-700">
            Biaya Admin di Awal (Rp)
          </label>
          <input
            id="adminFee"
            type="number"
            formControlName="adminFee"
            class="mt-1 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            placeholder="Contoh: 50000"
          />
        </div>

        <!-- Interest Rate -->
        <div>
          <label for="interestRate" class="block text-sm font-semibold text-gray-700">
            Suku Bunga (%) *
          </label>
          <input
            id="interestRate"
            type="number"
            step="0.01"
            formControlName="interestRate"
            [class.border-red-500]="isInvalid('interestRate')"
            class="mt-1 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            aria-required="true"
            placeholder="Contoh: 1.5"
          />
          @if (isInvalid('interestRate')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Suku bunga wajib diisi (> 0)</p>
          }
        </div>

        <!-- Interest Type -->
        <div>
          <label for="interestType" class="block text-sm font-semibold text-gray-700">
            Tipe Bunga *
          </label>
          <select
            id="interestType"
            formControlName="interestType"
            class="mt-1 block w-full rounded-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition"
            aria-required="true"
          >
            <option value="">-- Pilih Tipe Bunga --</option>
            <option value="daily">Bunga Harian</option>
            <option value="monthly_flat">Bunga Bulanan Tetap (Flat)</option>
            <option value="reducing_balance">Bunga Saldo Menurun (Anuitas)</option>
          </select>
          @if (isInvalid('interestType')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Pilih tipe bunga</p>
          }
        </div>

        <!-- Tenor -->
        <div>
          <label class="block text-sm font-semibold text-gray-700"> Lama Pinjaman (Tenor) * </label>
          <div class="flex mt-1 gap-0">
            <input
              type="number"
              formControlName="tenor"
              [class.border-red-500]="isInvalid('tenor')"
              class="block w-2/3 rounded-l-md border border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              aria-required="true"
              placeholder="Contoh: 12"
            />
            <select
              formControlName="tenorUnit"
              aria-label="Satuan Tenor"
              class="block w-1/3 rounded-r-md border border-l-0 border-gray-300 p-2.5 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 transition"
            >
              <option value="days">Hari</option>
              <option value="months">Bulan</option>
            </select>
          </div>
          @if (isInvalid('tenor')) {
            <p class="mt-1 text-sm text-red-600 font-medium">Tenor wajib diisi (> 0)</p>
          }
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        [disabled]="form.invalid"
        class="w-full bg-blue-700 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-700 mt-6 transition-colors"
      >
        Analisis Risiko Pinjaman
      </button>

      <p class="text-xs text-gray-500 text-center">* Wajib diisi</p>
    </form>
  `,
})
export class LoanFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private ojkValidator = inject(OjkValidator);
  private destroyRef = inject(DestroyRef); // To clean up subscriptions

  calculate = output<LoanInput>();

  // State signals
  verificationStatus = signal<'none' | 'registered' | 'illegal' | 'unregistered'>('none');
  isVerifying = signal<boolean>(false);
  showSuggestions = signal<boolean>(false);
  suggestions = signal<string[]>([]);

  form = this.fb.group({
    lenderName: ['', [Validators.required, Validators.minLength(2)]],
    monthlyIncome: [0, [Validators.required, Validators.min(1)]],
    amount: [0, [Validators.required, Validators.min(1)]],
    adminFee: [0, [Validators.min(0)]],
    interestRate: [0, [Validators.required, Validators.min(0.01)]],
    interestType: ['daily', [Validators.required]],
    tenor: [0, [Validators.required, Validators.min(1)]],
    tenorUnit: ['months', [Validators.required]],
  });

  ngOnInit() {
    this.setupLenderSearch();
  }

  /**
   * Setup reactive search with debounce
   * Handles autocomplete suggestions and validation status reset on user input
   */
  private setupLenderSearch() {
    this.form
      .get('lenderName')
      ?.valueChanges.pipe(
        // Wait 300ms after user stops typing
        debounceTime(300),
        // Only emit if value is different from previous
        distinctUntilChanged(),
        // Reset status when user starts typing
        tap(() => this.verificationStatus.set('none')),
        // Switch to new observable (cancels previous pending requests)
        switchMap((term) => {
          if (!term || term.length < 1) {
            this.showSuggestions.set(false);
            this.suggestions.set([]);
            return of([]); // Return empty
          }

          this.showSuggestions.set(true);
          // Return search observable
          return this.ojkValidator.searchLenders(term);
        }),
        // Clean up when component is destroyed
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (lenders) => {
          if (lenders && lenders.length > 0) {
            this.suggestions.set(lenders.slice(0, 10)); // Limit to 10 suggestions
          } else {
            this.suggestions.set([]);
          }
        },
        error: (err) => {
          console.error('Failed to fetch suggestions:', err);
          this.suggestions.set([]);
        },
      });
  }

  /**
   * Check if form control is invalid and should show error
   */
  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /**
   * Check if lender is verified as registered
   */
  isLenderVerified(): boolean {
    return this.verificationStatus() === 'registered';
  }

  /**
   * Select suggestion from autocomplete dropdown
   * Auto-triggers verification when a lender is selected
   */
  selectSuggestion(suggestion: string): void {
    this.form.get('lenderName')?.setValue(suggestion, { emitEvent: false });
    this.closeSuggestions();
    this.verifyLender(suggestion);
  }

  /**
   * Close suggestions dropdown
   * Adds delay to allow click event to fire before hiding
   */
  closeSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions.set(false);
      this.suggestions.set([]);
    }, 200);
  }

  /**
   * Manually verify lender via button click
   */
  onVerify(): void {
    const lenderName = this.form.get('lenderName')?.value;
    if (lenderName) {
      this.verifyLender(lenderName);
    }
  }

  /**
   * Verify lender against OJK registry
   * Sets verification status and handles error state
   */
  private verifyLender(lenderName: string): void {
    this.isVerifying.set(true);
    this.verificationStatus.set('none');

    this.ojkValidator.verifyDetailed(lenderName).subscribe({
      next: (response) => {
        if (response.isIllegal) {
          this.verificationStatus.set('illegal');
        } else if (response.isRegistered) {
          this.verificationStatus.set('registered');
        } else {
          this.verificationStatus.set('unregistered');
        }
        this.isVerifying.set(false);
      },
      error: (err) => {
        console.error('Verification error:', err);
        this.verificationStatus.set('none');
        this.isVerifying.set(false);
      },
    });
  }

  /**
   * Validate form and emit loan input for calculation
   * Ensures all required fields are valid before processing
   */
  processForm(): void {
    if (this.form.valid) {
      const formValue = this.form.value as unknown as LoanInput;
      formValue.amount = Number(formValue.amount);
      formValue.interestRate = Number(formValue.interestRate);
      formValue.tenor = Number(formValue.tenor);
      formValue.adminFee = Number(formValue.adminFee || 0);
      formValue.monthlyIncome = Number(formValue.monthlyIncome);

      this.calculate.emit(formValue);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
