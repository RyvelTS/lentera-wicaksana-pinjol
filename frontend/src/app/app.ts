import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { LoanFormComponent } from './components/loan-form';
import { LoanResultsComponent } from './components/loan-results';
import { MultimodalChatComponent } from './components/multimodal-chat';
import { LoanCalculator, LoanInput, LoanMetrics } from './services/loan-calculator';
import { OjkValidator } from './services/ojk-validator';
import { AiClient } from './services/ai-client';

/**
 * Root App Component
 * Main application shell for Lentera Wicaksana Pinjol
 * Orchestrates loan form, calculations, AI analysis, and multimodal chat
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    LoanFormComponent,
    LoanResultsComponent,
    MultimodalChatComponent,
  ],
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

  // State signals
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
   * Orchestrates OJK verification, financial calculations, and AI analysis
   * Handles errors gracefully with fallbacks for each stage
   */
  analyzeLoan(input: LoanInput): void {
    try {
      // Store current input for display purposes
      this.currentInput.set(input);

      // Reset AI state for new analysis
      this.isAiLoading.set(true);
      this.hasAiError.set(false);
      this.aiExplanation.set('');

      // Verify OJK registration via backend
      this.validator.verify(input.lenderName).subscribe({
        next: (ojkStatus) => {
          // Calculate financial metrics
          const metrics = this.calculator.calculateMetrics(input, ojkStatus);

          // Update state with results
          this.isOjkRegistered.set(ojkStatus);
          this.currentMetrics.set(metrics);
          this.hasResult.set(true);
          this.showEmptyState.set(false);

          // Request AI-generated explanation
          this.ai.requestExplanation(input, metrics, ojkStatus).subscribe({
            next: (explanation) => {
              this.aiExplanation.set(explanation);
              this.isAiLoading.set(false);
            },
            error: (err) => {
              console.error('AI Explanation Error:', err);
              // Don't mark as error - let financial metrics stand alone
              this.hasAiError.set(true);
              this.isAiLoading.set(false);
            },
          });
        },
        error: (err) => {
          console.error('OJK Verification Error:', err);
          // Fallback: assume not registered if verification fails
          const ojkStatus = false;
          const metrics = this.calculator.calculateMetrics(input, ojkStatus);

          this.isOjkRegistered.set(ojkStatus);
          this.currentMetrics.set(metrics);
          this.hasResult.set(true);
          this.showEmptyState.set(false);

          // Request AI-generated explanation even if OJK check failed
          this.ai.requestExplanation(input, metrics, ojkStatus).subscribe({
            next: (explanation) => {
              this.aiExplanation.set(explanation);
              this.isAiLoading.set(false);
            },
            error: (aiErr) => {
              console.error('AI Explanation Error:', aiErr);
              this.hasAiError.set(true);
              this.isAiLoading.set(false);
            },
          });
        },
      });
    } catch (error) {
      console.error('Analysis Error:', error);
      // Reset loading state
      this.isAiLoading.set(false);
      // Show error message to user (could be improved with a toast/snackbar)
      alert('Terjadi kesalahan dalam analisis. Silakan periksa input Anda dan coba lagi.');
    }
  }
}
