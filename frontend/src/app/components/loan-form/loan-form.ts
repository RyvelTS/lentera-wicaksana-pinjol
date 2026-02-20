import {
  Component,
  inject,
  output,
  signal,
  ChangeDetectionStrategy,
  DestroyRef,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { OjkValidator } from '../../services/ojk-validator';
import { LoanInput } from '../../services/loan-calculator';

/**
 * Loan Form Component
 * Handles user input for loan analysis
 * Standalone component with reactive forms
 */
@Component({
  selector: 'app-loan-form',
  imports: [ReactiveFormsModule],
  templateUrl: './loan-form.html',
  styleUrl: './loan-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full',
  },
})
export class LoanForm {
  private fb = inject(FormBuilder);
  private ojkValidator = inject(OjkValidator);
  private destroyRef = inject(DestroyRef);

  calculate = output<LoanInput>();

  verificationStatus = signal<'none' | 'registered' | 'illegal' | 'unregistered'>('none');
  isVerifying = signal<boolean>(false);
  isLoading = signal<boolean>(false);
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
        debounceTime(300), // Wait 300ms after stop typing
        distinctUntilChanged(),
        tap(() => this.verificationStatus.set('none')),
        switchMap((term) => {
          if (!term || term.length < 1) {
            this.showSuggestions.set(false);
            this.suggestions.set([]);
            return of([]);
          }

          this.showSuggestions.set(true);
          return this.ojkValidator.searchLenders(term);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (lenders) => {
          if (lenders && lenders.length > 0) {
            this.suggestions.set(lenders.slice(0, 10)); // 10 suggestions
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
      this.isLoading.set(true);
      const formValue = this.form.value as unknown as LoanInput;
      formValue.amount = Number(formValue.amount);
      formValue.interestRate = Number(formValue.interestRate);
      formValue.tenor = Number(formValue.tenor);
      formValue.adminFee = Number(formValue.adminFee || 0);
      formValue.monthlyIncome = Number(formValue.monthlyIncome);

      this.calculate.emit(formValue);
      // Reset loading state after a short delay to allow parent to process
      setTimeout(() => this.isLoading.set(false), 500);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
