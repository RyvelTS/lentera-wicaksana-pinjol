import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LoanMetrics, LoanInput } from './loan-calculator';
// Import the environment file
import { environment } from '../../environments/environment';

interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
}

interface ChatResponse {
  result: string;
}

/**
 * AI Client Service for communicating with Google Gemini backend
 * Handles financial analysis and explanation generation
 */
@Injectable({ providedIn: 'root' })
export class AiClient {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Request AI-generated financial explanation for loan analysis
   * @param input - User's loan input parameters
   * @param metrics - Calculated loan metrics
   * @param ojkStatus - OJK registration status
   * @returns Observable<string> - AI-generated explanation in Bahasa Indonesia
   */
  requestExplanation(
    input: LoanInput,
    metrics: LoanMetrics,
    ojkStatus: boolean,
  ): Observable<string> {
    const userPrompt = this.buildPrompt(input, metrics, ojkStatus);
    const request: ChatRequest = {
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.3,
    };

    // Send request and handle response
    return this.http.post<ChatResponse>(`${this.baseUrl}/chat`, request).pipe(
      map((res) => res.result || 'Gagal menghasilkan penjelasan'),
      catchError((error) => {
        console.error('AI request failed:', error);
        return throwError(() => new Error('Gagal membuat analisis dari AI'));
      }),
    );
  }

  /**
   * Multimodal chat with file upload support
   * @param message - Text message from user
   * @param file - Optional file (image, document, audio)
   * @param conversationHistory - Previous messages in the conversation
   * @param temperature - Temperature for response creativity
   * @returns Observable with result and updated conversation history
   */
  multimodalChat(
    message: string,
    file?: File,
    conversationHistory: Array<{ role: string; content: string }> = [],
    temperature: number = 0.3,
  ): Observable<{ result: string; conversationHistory: Array<{ role: string; content: string }> }> {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('conversationHistory', JSON.stringify(conversationHistory));
    formData.append('temperature', temperature.toString());

    if (file) {
      console.log('📎 Attaching file:', file.name, file.type);
      formData.append('file', file);
    }

    return this.http
      .post<{
        result: string;
        conversationHistory: Array<{ role: string; content: string }>;
      }>(`${this.baseUrl}/chat-multimodal`, formData)
      .pipe(
        catchError((error) => {
          console.error('Multimodal chat failed:', error);
          return throwError(() => new Error('Gagal memproses permintaan multimodal'));
        }),
      );
  }

  /**
   * Generate a structured prompt for the AI
   * Provides all necessary context for accurate financial analysis
   */
  private buildPrompt(input: LoanInput, metrics: LoanMetrics, ojkStatus: boolean): string {
    const ojkStatusText = ojkStatus ? 'Terdaftar' : 'TIDAK TERDAFTAR';

    return `Berikan analisis edukatif pendek untuk simulasi pinjaman berikut dalam Bahasa Indonesia:

**Data Pinjaman:**
- Nama Aplikasi/Lender: ${input.lenderName}
- Status OJK: ${ojkStatusText} ⚠️
- Jumlah Pinjaman: Rp ${input.amount.toLocaleString('id-ID')}
- Total Pengembalian: Rp ${metrics.totalRepayment.toLocaleString('id-ID')}
- Cicilan per Bulan: Rp ${metrics.monthlyInstallment.toLocaleString('id-ID')}
- Gaji Bulanan: Rp ${input.monthlyIncome.toLocaleString('id-ID')}

**Metrik Finansial:**
- Beban Utang (DTI): ${metrics.dtiRatio.toFixed(1)}% dari pendapatan
- Suku Bunga Efektif (APR): ${metrics.effectiveApr.toFixed(1)}% per tahun
- Tipe Bunga: ${this.getInterestTypeLabel(input.interestType)}
- Tenor: ${input.tenor} ${input.tenorUnit === 'days' ? 'hari' : 'bulan'}
- Tingkat Risiko: ${metrics.riskLevel}

**Instruksi Analisis:**
1. Jelaskan dampak finansial secara singkat (150-200 kata)
2. Fokus pada risiko dan beban utang
3. Jika TIDAK TERDAFTAR OJK, berikan peringatan keras
4. Jika Tinggi/Sangat Berbahaya, highlight risikonya
5. Berikan rekomendasi praktis
6. Gunakan nada netral dan pendidikan, JANGAN dorong untuk meminjam
7. JANGAN ubah atau haluskan angka-angka yang diberikan`;
  }

  /**
   * Get human-readable interest type label
   */
  private getInterestTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      daily: 'Bunga Harian',
      monthly_flat: 'Bunga Bulanan Tetap (Flat)',
      reducing_balance: 'Bunga Saldo Menurun (Anuitas)',
    };
    return labels[type] || type;
  }
}
