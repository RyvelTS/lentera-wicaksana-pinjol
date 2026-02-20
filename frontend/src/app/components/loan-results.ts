import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoanMetrics } from '../services/loan-calculator';
import { MarkdownPipe } from '../pipes/markdown.pipe';

@Component({
  selector: 'app-loan-results',
  standalone: true,
  imports: [CommonModule, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full',
  },
  styles: [
    `
      .markdown-explanation ul {
        list-style-type: disc;
        margin-left: 1.5rem;
        margin-bottom: 0.75rem;
      }
      .markdown-explanation ol {
        list-style-type: decimal;
        margin-left: 1.5rem;
        margin-bottom: 0.75rem;
      }
      .markdown-explanation p {
        margin-bottom: 0.75rem;
      }
      .markdown-explanation strong {
        font-weight: 700;
        color: #1e3a8a;
      }
      .markdown-explanation h3,
      .markdown-explanation h4 {
        font-weight: 700;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
      }
    `,
  ],
  template: `
    <div
      class="bg-white p-6 rounded-xl shadow-md space-y-6 max-w-4xl mx-auto"
      role="region"
      aria-label="Hasil Analisis Pinjaman"
    >
      <!-- Header with Risk Level -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
        <h2 class="text-2xl font-extrabold text-gray-800">Laporan Analisis Pinjaman</h2>
        <div
          [class]="
            'px-5 py-2 rounded-full font-bold text-sm tracking-wide text-white text-center shadow-sm ' +
            riskColorClass()
          "
          role="status"
          [attr.aria-label]="'Tingkat risiko: ' + (metrics()?.riskLevel || 'Tidak diketahui')"
        >
          RISIKO: {{ metrics()?.riskLevel | uppercase }}
        </div>
      </div>

      <!-- Financial Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- OJK Status -->
        <div class="bg-gray-50 p-5 rounded-lg border shadow-sm">
          <p class="text-sm text-gray-600 font-semibold mb-1">Status Legalitas (OJK)</p>

          @if (ojkStatus()) {
            <div class="flex items-center gap-2">
              <span class="text-2xl">✅</span>
              <p class="text-lg font-bold text-green-700">TERDAFTAR</p>
            </div>
          } @else {
            <div class="flex items-center gap-2">
              <span class="text-2xl">⚠️</span>
              <p class="text-lg font-bold text-red-700">ILEGAL / TIDAK TERDAFTAR</p>
            </div>
          }
        </div>

        <!-- Effective APR -->
        <div class="bg-gray-50 p-5 rounded-lg border shadow-sm">
          <p class="text-sm text-gray-600 font-semibold mb-1">Suku Bunga Nyata (APR)</p>
          <p class="text-xl font-bold text-gray-900">
            {{ metrics()?.effectiveApr | number: '1.0-2' }}% / tahun
          </p>
          <p class="text-xs text-gray-500 mt-1">(Bunga efektif tahunan)</p>
        </div>

        <!-- Total Repayment -->
        <div class="bg-gray-50 p-5 rounded-lg border shadow-sm">
          <p class="text-sm text-gray-600 font-semibold mb-1">Total Uang yang Harus Dikembalikan</p>
          <p class="text-xl font-bold text-gray-900">Rp {{ metrics()?.totalRepayment | number }}</p>
        </div>

        <!-- Monthly Installment -->
        <div class="bg-gray-50 p-5 rounded-lg border shadow-sm">
          <p class="text-sm text-gray-600 font-semibold mb-1">
            Estimasi Cicilan per
            @if (
              metrics()?.tenorUnit === 'days' &&
              (metrics()?.tenor ?? 0) > 0 &&
              (metrics()?.tenor ?? 0) < 30
            ) {
              <span> Hari</span>
            } @else {
              <span> Bulan</span>
            }
          </p>
          <p class="text-xl font-bold text-gray-900">
            @if (
              metrics()?.tenorUnit === 'days' &&
              (metrics()?.tenor ?? 0) > 0 &&
              (metrics()?.tenor ?? 0) < 30
            ) {
              Rp {{ metrics()?.dailyInstallment | number }}
            } @else {
              Rp {{ metrics()?.monthlyInstallment | number }}
            }
          </p>
        </div>

        <!-- DTI Ratio -->
        <div class="bg-gray-50 p-5 rounded-lg border shadow-sm md:col-span-2">
          <p class="text-sm text-gray-600 font-semibold mb-2">Beban Utang terhadap Gaji (DTI)</p>
          <div class="flex items-center space-x-3">
            <p class="text-2xl font-bold text-gray-900">
              {{ metrics()?.dtiRatio | number: '1.0-1' }}%
            </p>
            <div [class]="'text-sm font-medium px-3 py-1 rounded-full ' + dtiStatusClass()">
              @if ((metrics()?.dtiRatio ?? 0) <= 30) {
                <span> ✅ Aman (≤ 30%) </span>
              } @else if ((metrics()?.dtiRatio ?? 0) <= 40) {
                <span> ⚠️ Perlu Hati-hati (30-40%) </span>
              } @else {
                <span> 🚨 Berbahaya (> 40%) </span>
              }
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            Rasio ideal untuk DTI adalah di bawah 30%. Artinya, cicilan pinjaman tidak lebih dari
            30% dari pendapatan bulanan Anda.
          </p>
        </div>

        <!-- Risk Score Breakdown -->
        <div class="bg-blue-50 border border-blue-200 p-5 rounded-lg md:col-span-2">
          <p class="text-sm text-blue-900 font-semibold mb-2">
            🎯 Poin Risiko: {{ metrics()?.riskScore }}/100
          </p>
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-gray-300 rounded-full h-2 overflow-hidden">
              <div
                [style.width.%]="metrics()?.riskScore ?? 0"
                [class]="'h-full ' + riskProgressClass()"
              ></div>
            </div>
          </div>
          <p class="text-xs text-blue-700 mt-2">
            Semakin tinggi skor, semakin besar risiko pinjaman tersebut bagi Anda.
          </p>
        </div>
      </div>

      <!-- AI Explanation Section -->
      <div
        class="bg-blue-50 border border-blue-200 p-5 rounded-xl mt-6 shadow-sm"
        aria-live="polite"
        aria-label="Analisis dari AI Lentera Wicaksana"
      >
        <h3 class="font-bold text-blue-900 mb-3 flex items-center gap-2">
          🤖 Saran Lentera Wicaksana (AI)
        </h3>

        <!-- Loading State -->
        @if (loadingExplanation()) {
          <div class="flex items-center space-x-3 text-blue-700 font-medium">
            <div
              class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"
              role="status"
              aria-label="Loading"
            ></div>
            <span>AI sedang merumuskan saran keuangan Anda...</span>
          </div>
        } @else if (explanationError()) {
          <!-- Error State -->
          <div
            class="text-red-700 bg-red-50 p-3 rounded font-medium border border-red-200"
            role="alert"
          >
            ⚠️ Penjelasan AI tidak tersedia saat ini. Silakan merujuk pada metrik keuangan di atas
            untuk analisis Anda.
          </div>
        } @else {
          <!-- Success State -->
          <div>
            <div
              class="text-gray-800 leading-relaxed text-sm md:text-base markdown-explanation"
              [innerHTML]="explanation() | markdown"
            ></div>

            <div class="mt-4 p-3 bg-white rounded border border-gray-200">
              <p class="text-xs text-gray-600">
                💡 <strong>Disclaimer:</strong> Penjelasan ini bersifat edukatif dan tidak merupakan
                rekomendasi investasi resmi. Selalu konsultasikan dengan ahli keuangan profesional
                sebelum membuat keputusan pinjaman.
              </p>
            </div>
          </div>
        }
      </div>

      <!-- General Disclaimer -->
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p class="text-sm text-yellow-900">
          <strong>⚠️ Penting:</strong> Aplikasi ini dirancang sebagai alat edukasi finansial. Data
          pribadi Anda tidak disimpan. Selalu lakukan riset mendalam dan konsultasi dengan ahli
          sebelum mengambil keputusan pinjaman.
        </p>
      </div>
    </div>
  `,
})
export class LoanResultsComponent {
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
