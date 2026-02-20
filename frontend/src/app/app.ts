import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';
import { LoanCalculator, LoanInput, LoanMetrics } from './services/loan-calculator';
import { OjkValidator } from './services/ojk-validator';
import { AiClient } from './services/ai-client';
import { LoanForm } from './components/loan-form/loan-form';
import { LoanResults } from './components/loan-results/loan-results';
import { MultimodalChat } from './components/multimodal-chat/multimodal-chat';

/**
 * Root App Component
 * Main application shell for Lentera Wicaksana Pinjol
 */
@Component({
  selector: 'app-root',
  imports: [LoanForm, LoanResults, MultimodalChat],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block min-h-screen',
  },
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private calculator = inject(LoanCalculator);
  private validator = inject(OjkValidator);
  private ai = inject(AiClient);

  hasResult = signal<boolean>(false);
  showEmptyState = signal<boolean>(true);
  currentMetrics = signal<LoanMetrics | null>(null);
  currentInput = signal<LoanInput | null>(null);
  isOjkRegistered = signal<boolean>(false);

  aiExplanation = signal<string>('');
  isAiLoading = signal<boolean>(false);
  hasAiError = signal<boolean>(false);

  /**
   * Analyze loan and generate metrics with AI explanation
   * Optimized with RxJS pipe to avoid nested subscriptions
   */
  analyzeLoan(input: LoanInput): void {
    // 1. Reset State
    this.currentInput.set(input);
    this.isAiLoading.set(true);
    this.hasAiError.set(false);
    this.aiExplanation.set('');

    // 2. Start Reactive Flow
    this.validator
      .verify(input.lenderName)
      .pipe(
        catchError((err) => {
          console.error('OJK Verification Error (Creating Fallback):', err);
          return of(false);
        }),
        // Calculate Metrics & Update UI (Side Effect)
        tap((ojkStatus) => {
          const metrics = this.calculator.calculateMetrics(input, ojkStatus);
          this.isOjkRegistered.set(ojkStatus);
          this.currentMetrics.set(metrics);
          this.hasResult.set(true);
          this.showEmptyState.set(false);
        }),
        switchMap((ojkStatus) => {
          const metrics = this.currentMetrics()!;
          return this.ai.requestExplanation(input, metrics, ojkStatus);
        }),
        finalize(() => {
          this.isAiLoading.set(false);
        }),
      )
      .subscribe({
        next: (explanation) => {
          this.aiExplanation.set(explanation);
        },
        error: (err) => {
          console.error('AI Explanation Error:', err);
          this.hasAiError.set(true);
        },
      });
  }
}
