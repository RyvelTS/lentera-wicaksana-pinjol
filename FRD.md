# Functional Requirements Document (FRD): Lentera Wicaksana Pinjol

## I. Functional Requirements

### 1. Core Purpose

Lentera Wicaksana Pinjol shall analyze online loan offers and provide:

- Transparent financial breakdown
- Risk evaluation
- Regulatory registration check
- Clear educational explanation in Bahasa Indonesia

The system shall act as a **financial literacy and risk advisory tool**, not a lending platform.

### 2. User Input Requirements

The system shall allow users to input:

1. Loan amount
2. Interest rate
3. Interest type:
   - Daily interest
   - Monthly flat interest
   - Reducing balance
4. Loan tenor (days or months)
5. Administrative fee (optional)
6. Monthly income
7. Lender name

The system shall validate:

- Loan amount > 0
- Interest rate > 0
- Tenor > 0
- Monthly income > 0

Invalid inputs shall produce a clear error message.

### 3. Financial Calculation Requirements

The system shall calculate:

#### 3.1 Total Repayment

- Based on interest type
- Including administrative fee if provided

#### 3.2 Monthly Installment

- For all interest types

#### 3.3 Effective Annual Percentage Rate (APR)

- Convert daily interest into annual equivalent
- Convert monthly interest into annual equivalent
- Display as percentage

### 3.4 Debt-to-Income Ratio (DTI)

- Monthly installment divided by monthly income
- Display as percentage

All financial results must be deterministic and consistent.

### 4. Risk Assessment Requirements

The system shall compute a numerical risk score based on:

1. APR level
2. Debt-to-Income ratio
3. Regulatory registration status

The system shall categorize risk into:

- Rendah
- Sedang
- Tinggi
- Sangat Berbahaya

The risk level must be clearly visible to the user.

### 5. Regulatory Registration Check

The system shall:

- Maintain a list of lenders registered by Otoritas Jasa Keuangan
- Compare the user-input lender name to this list
- Display:
  - TERDAFTAR OJK
  - TIDAK TERDAFTAR OJK

The system shall clearly highlight if the lender is not registered.

### 6. AI-Generated Financial Explanation

The system shall generate:

- A plain-language explanation of:
  - Total repayment impact
  - APR meaning
  - Debt burden
  - Risk level
- Practical financial advice
- Responsible and neutral tone
- No encouragement to borrow

The explanation shall be in Bahasa Indonesia.

### 7. Output Display Requirements

The system shall display:

- Loan amount
- Total repayment
- Monthly installment
- Effective APR
- Debt-to-Income ratio
- Risk score
- Risk level
- OJK registration status
- AI explanation

Risk level shall be visually distinguishable (e.g., color-coded).

### 8. Failure Handling

If AI explanation fails:

- Financial analysis must still be displayed.
- System shall notify user that explanation is temporarily unavailable.

### 9. Privacy Requirements

The system shall:

- Not store personal financial data
- Not store loan simulations
- Not share user input externally beyond analysis

## II. Milestones (Hackathon-Oriented)

Below is a structured milestone plan optimized for short development time.

### Milestone 1 — Core Calculation Engine

Deliverables:

- Loan input form
- Financial calculations:
  - Total repayment
  - Installment
  - APR
  - DTI
- Display results clearly

Success Criteria:

- Correct math output
- No calculation errors
- Edge case handling (high interest, short tenor)

### Milestone 2 — Risk Scoring System

Deliverables:

- Risk scoring logic
- Risk level categorization
- Visual risk indicator

Success Criteria:

- Risk score consistent with defined thresholds
- Clear “Sangat Berbahaya” condition

### Milestone 3 — Regulatory Check

Deliverables:

- Integrated lender list from Otoritas Jasa Keuangan
- Registration status check
- Highlight if unregistered

Success Criteria:

- Accurate name matching
- Clear warning display

### Milestone 4 — AI Financial Explanation

Deliverables:

- Plain-language explanation generation
- Risk interpretation
- Practical advice

Success Criteria:

- Explanation matches computed metrics
- No hallucinated numbers
- Neutral and responsible tone

### Milestone 5 — User Experience Refinement

Deliverables:

- Clean results dashboard
- Risk color coding
- Clear typography and layout
- Simple, intuitive user flow

Success Criteria:

- User understands results in under 30 seconds
- Clear differentiation between safe and dangerous loans

## III. Final Demonstration Flow

User enters:

- Loan details
- Income
- Lender name

System outputs:

1. True effective APR
2. Real total repayment
3. Debt burden
4. Risk classification
5. OJK registration status
6. Clear financial warning

## IV. Product Positioning Statement

**Lentera Wicaksana Pinjol** is a financial literacy tool that illuminates hidden loan risks by converting misleading interest rates into transparent financial metrics and responsible guidance.
