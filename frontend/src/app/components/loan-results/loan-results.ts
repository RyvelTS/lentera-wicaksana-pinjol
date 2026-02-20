import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { LoanMetrics } from '../../services/loan-calculator';
import { MarkdownPipe } from '../../pipes/markdown.pipe';
import { DecimalPipe, UpperCasePipe } from '@angular/common';

/**
 * LoanResults Component
 *
 * Displays comprehensive loan analysis results including risk assessment, DTI ratio status,
 * and risk scoring metrics. This component uses Angular's signal-based inputs and computed
 * properties for reactive rendering.
 *
 * @inputs
 * - `metrics` - The calculated loan metrics including risk level, DTI ratio, and risk score
 * - `ojkStatus` - Boolean flag indicating OJK (Indonesian Financial Services Authority) compliance status
 * - `explanation` - Detailed explanation text for the loan analysis results
 * - `loadingExplanation` - Boolean flag indicating if explanation is being fetched
 * - `explanationError` - Boolean flag indicating if an error occurred while fetching explanation
 */
@Component({
  selector: 'app-loan-results',
  imports: [MarkdownPipe, DecimalPipe, UpperCasePipe],
  templateUrl: './loan-results.html',
  styleUrl: './loan-results.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full',
  },
})
export class LoanResults {
  metrics = input<LoanMetrics | null>(null);
  ojkStatus = input<boolean>(false);
  explanation = input<string>('');
  loadingExplanation = input<boolean>(false);
  explanationError = input<boolean>(false);

  riskColorClass = computed(() => {
    const level = this.metrics()?.riskLevel;
    switch (level) {
      case 'Sangat Berbahaya':
        return 'bg-red-700';
      case 'Tinggi':
        return 'bg-orange-600';
      case 'Sedang':
        return 'bg-yellow-500 text-gray-900';
      case 'Rendah':
        return 'bg-green-700';
      default:
        return 'bg-gray-500';
    }
  });

  dtiStatusClass = computed(() => {
    const dtiRatio = this.metrics()?.dtiRatio ?? 0;
    if (dtiRatio <= 30) return 'bg-green-100 text-green-800';
    else if (dtiRatio <= 40) return 'bg-yellow-100 text-yellow-800';
    else return 'bg-red-100 text-red-800';
  });

  riskProgressClass = computed(() => {
    const score = this.metrics()?.riskScore ?? 0;
    if (score >= 75) return 'bg-red-600';
    else if (score >= 50) return 'bg-orange-500';
    else if (score >= 25) return 'bg-yellow-500';
    else return 'bg-green-600';
  });
}
