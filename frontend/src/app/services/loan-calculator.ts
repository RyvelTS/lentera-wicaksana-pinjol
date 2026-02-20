import { Injectable } from '@angular/core';

export type InterestType = 'daily' | 'monthly_flat' | 'reducing_balance';

export interface LoanInput {
  amount: number;
  interestRate: number;
  interestType: InterestType;
  tenor: number;
  tenorUnit: 'days' | 'months';
  adminFee: number;
  monthlyIncome: number;
  lenderName: string;
}

export interface LoanMetrics {
  totalRepayment: number;
  monthlyInstallment: number;
  effectiveApr: number;
  dtiRatio: number;
  riskScore: number;
  riskLevel: 'Rendah' | 'Sedang' | 'Tinggi' | 'Sangat Berbahaya';
}

@Injectable({ providedIn: 'root' })
export class LoanCalculator {
  /**
   * Calculate comprehensive loan metrics based on input parameters
   * All calculations are deterministic and consistent
   * @param input - Loan input parameters
   * @param isOjkRegistered - Whether the lender is OJK registered
   * @returns Complete loan metrics including risk assessment
   */
  calculateMetrics(input: LoanInput, isOjkRegistered: boolean): LoanMetrics {
    // Input validation
    this.validateInput(input);

    let totalInterest = 0;
    let effectiveApr = 0;
    let monthlyInstallment = 0;

    const principal = input.amount;
    const tenorInMonths = input.tenorUnit === 'months' ? input.tenor : input.tenor / 30;

    // Calculate based on interest type
    if (input.interestType === 'daily') {
      totalInterest = this.calculateDailyInterest(
        principal,
        input.interestRate,
        input.tenor,
        input.tenorUnit,
      );
      effectiveApr = (input.interestRate / 100) * 365 * 100;
      monthlyInstallment = (principal + totalInterest + input.adminFee) / (tenorInMonths || 1);
    } else if (input.interestType === 'monthly_flat') {
      totalInterest = this.calculateMonthlyFlatInterest(
        principal,
        input.interestRate,
        tenorInMonths,
      );
      effectiveApr = (input.interestRate / 100) * 12 * 100;
      monthlyInstallment = (principal + totalInterest + input.adminFee) / tenorInMonths;
    } else if (input.interestType === 'reducing_balance') {
      const result = this.calculateReducingBalanceInterest(
        principal,
        input.interestRate,
        tenorInMonths,
        input.adminFee,
      );
      totalInterest = result.totalInterest;
      monthlyInstallment = result.monthlyInstallment;
      effectiveApr = (input.interestRate / 100) * 12 * 100;
    }

    const totalRepayment = principal + totalInterest + input.adminFee;
    const dtiRatio = (monthlyInstallment / input.monthlyIncome) * 100;

    // Calculate risk score
    let riskScore = 0;

    // Factor 1: OJK Registration (50 points if unregistered)
    if (!isOjkRegistered) {
      riskScore += 50;
    }

    // Factor 2: Debt-to-Income Ratio
    if (dtiRatio > 40) {
      riskScore += 30;
    } else if (dtiRatio > 30) {
      riskScore += 15;
    }

    // Factor 3: Effective APR
    if (effectiveApr > 36) {
      riskScore += 30;
    } else if (effectiveApr > 20) {
      riskScore += 10;
    }

    // Determine risk level
    let riskLevel: LoanMetrics['riskLevel'] = 'Rendah';
    if (riskScore >= 75) {
      riskLevel = 'Sangat Berbahaya';
    } else if (riskScore >= 50) {
      riskLevel = 'Tinggi';
    } else if (riskScore >= 25) {
      riskLevel = 'Sedang';
    }

    return {
      totalRepayment: Math.round(totalRepayment * 100) / 100,
      monthlyInstallment: Math.round(monthlyInstallment * 100) / 100,
      effectiveApr: Math.round(effectiveApr * 100) / 100,
      dtiRatio: Math.round(dtiRatio * 100) / 100,
      riskScore,
      riskLevel,
    };
  }

  /**
   * Validate loan input parameters
   */
  private validateInput(input: LoanInput): void {
    if (input.amount <= 0) throw new Error('Jumlah pinjaman harus lebih dari 0');
    if (input.interestRate <= 0) throw new Error('Suku bunga harus lebih dari 0');
    if (input.tenor <= 0) throw new Error('Tenor harus lebih dari 0');
    if (input.monthlyIncome <= 0) throw new Error('Gaji bulanan harus lebih dari 0');
    if (input.adminFee < 0) throw new Error('Biaya admin tidak boleh negatif');
  }

  /**
   * Calculate interest for daily interest type
   */
  private calculateDailyInterest(
    principal: number,
    dailyRate: number,
    tenor: number,
    tenorUnit: string,
  ): number {
    const dailyRateDecimal = dailyRate / 100;
    const tenorInDays = tenorUnit === 'days' ? tenor : tenor * 30;
    return principal * dailyRateDecimal * tenorInDays;
  }

  /**
   * Calculate interest for monthly flat interest type
   */
  private calculateMonthlyFlatInterest(
    principal: number,
    monthlyRate: number,
    tenorInMonths: number,
  ): number {
    const monthlyRateDecimal = monthlyRate / 100;
    return principal * monthlyRateDecimal * tenorInMonths;
  }

  /**
   * Calculate interest for reducing balance (amortization) type
   */
  private calculateReducingBalanceInterest(
    principal: number,
    monthlyRate: number,
    tenorInMonths: number,
    adminFee: number,
  ): { monthlyInstallment: number; totalInterest: number } {
    const monthlyRateDecimal = monthlyRate / 100;

    if (monthlyRateDecimal === 0) {
      return {
        monthlyInstallment: (principal + adminFee) / tenorInMonths,
        totalInterest: 0,
      };
    }

    // PMT formula: P * [r(1+r)^n] / [(1+r)^n - 1]
    const numerator = monthlyRateDecimal * Math.pow(1 + monthlyRateDecimal, tenorInMonths);
    const denominator = Math.pow(1 + monthlyRateDecimal, tenorInMonths) - 1;
    const monthlyInstallmentPrincipal = (principal * numerator) / denominator;

    // Add prorated admin fee
    const monthlyInstallment = monthlyInstallmentPrincipal + adminFee / tenorInMonths;

    // Total interest = (monthly payment * months) - principal
    const totalInterest = monthlyInstallmentPrincipal * tenorInMonths - principal;

    return {
      monthlyInstallment,
      totalInterest,
    };
  }
}
