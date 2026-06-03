import { describe, it, expect } from 'vitest'
import { calculateOnBaseLodging, lodgingData } from '../calculators/on-base'
import { calculateVALoan } from '../calculators/va-loan'
import { calculateTripCosts, type TDYRate } from '../calculators/tdy'

// ─── On-Base Lodging Calculator ──────────────────────────────────────────────

describe('calculateOnBaseLodging', () => {
  it('returns zero for an unknown base', () => {
    const result = calculateOnBaseLodging('Nonexistent Base', '2025-01-01', '2025-01-05')
    expect(result.totalCost).toBe(0)
    expect(result.totalNights).toBe(0)
    expect(result.breakdown).toEqual([])
  })

  it('returns zero for invalid dates', () => {
    const result = calculateOnBaseLodging('Altus AFB, OK', 'bad-date', '2025-01-05')
    expect(result.totalCost).toBe(0)
    expect(result.totalNights).toBe(0)
  })

  it('calculates correctly for a base with a single rate period', () => {
    // Altus AFB has a flat rate of $99 year-round
    const result = calculateOnBaseLodging('Altus AFB, OK', '2025-01-01', '2025-01-04')
    expect(result.totalNights).toBe(3)
    expect(result.totalCost).toBe(99 * 3)
    expect(result.breakdown).toHaveLength(3)
    expect(result.breakdown[0].rate).toBe(99)
  })

  it('returns zero nights when start equals end', () => {
    const result = calculateOnBaseLodging('Altus AFB, OK', '2025-03-15', '2025-03-15')
    expect(result.totalNights).toBe(0)
    expect(result.totalCost).toBe(0)
  })

  it('calculates a single night stay', () => {
    const result = calculateOnBaseLodging('Altus AFB, OK', '2025-06-01', '2025-06-02')
    expect(result.totalNights).toBe(1)
    expect(result.totalCost).toBe(99)
  })

  it('handles seasonal rate changes for multi-period bases', () => {
    // Nellis AFB: Oct-Dec=$104, Jan-Mar=$144, Apr-Sep=$104
    // Stay from Dec 30 to Jan 3 crosses a rate boundary
    const result = calculateOnBaseLodging('Nellis AFB, NV', '2025-12-30', '2026-01-03')
    expect(result.totalNights).toBe(4)
    // Dec 30 = $104, Dec 31 = $104, Jan 1 = $144, Jan 2 = $144
    expect(result.totalCost).toBe(104 + 104 + 144 + 144)
  })

  it('produces correct breakdown dates', () => {
    const result = calculateOnBaseLodging('Altus AFB, OK', '2025-03-10', '2025-03-13')
    expect(result.breakdown.map(b => b.date)).toEqual([
      '2025-03-10',
      '2025-03-11',
      '2025-03-12',
    ])
  })
})

describe('lodgingData', () => {
  it('contains expected bases', () => {
    expect(lodgingData).toHaveProperty('Altus AFB, OK')
    expect(lodgingData).toHaveProperty('Nellis AFB, NV')
    expect(lodgingData).toHaveProperty('Eglin AFB, FL')
  })

  it('has rate periods with required fields', () => {
    const altus = lodgingData['Altus AFB, OK']
    expect(altus.length).toBeGreaterThan(0)
    expect(altus[0]).toHaveProperty('start')
    expect(altus[0]).toHaveProperty('end')
    expect(altus[0]).toHaveProperty('rate')
    expect(typeof altus[0].rate).toBe('number')
  })
})

// ─── VA Loan Calculator ─────────────────────────────────────────────────────

describe('calculateVALoan', () => {
  const baseParams = {
    homePrice: 300000,
    downPayment: 0,
    interestRate: 6.5,
    loanTerm: 30,
    propertyTaxYearly: 3600,
    homeInsuranceYearly: 1200,
    hadVaLoanBefore: false,
    isExempt: false,
  }

  it('calculates funding fee for first-time VA loan with no down payment', () => {
    const result = calculateVALoan(baseParams)
    // 2.15% of $300,000
    expect(result.fundingFeeAmount).toBeCloseTo(300000 * 0.0215, 2)
    expect(result.totalFinanced).toBeCloseTo(300000 + 6450, 2)
  })

  it('reduces funding fee for 5-10% down payment', () => {
    const result = calculateVALoan({ ...baseParams, downPayment: 20000 })
    // ~6.67% down => 1.5% funding fee on $280,000
    expect(result.fundingFeeAmount).toBeCloseTo(280000 * 0.015, 2)
  })

  it('reduces funding fee further for 10%+ down payment', () => {
    const result = calculateVALoan({ ...baseParams, downPayment: 30000 })
    // 10% down => 1.25% funding fee on $270,000
    expect(result.fundingFeeAmount).toBeCloseTo(270000 * 0.0125, 2)
  })

  it('charges higher fee for subsequent VA loan usage', () => {
    const result = calculateVALoan({ ...baseParams, hadVaLoanBefore: true })
    // 3.3% for subsequent, no down payment
    expect(result.fundingFeeAmount).toBeCloseTo(300000 * 0.033, 2)
  })

  it('exempts funding fee when isExempt is true', () => {
    const result = calculateVALoan({ ...baseParams, isExempt: true })
    expect(result.fundingFeeAmount).toBe(0)
    expect(result.totalFinanced).toBe(300000)
  })

  it('calculates monthly payment including tax and insurance', () => {
    const result = calculateVALoan(baseParams)
    const expectedMonthlyTax = 3600 / 12
    const expectedMonthlyInsurance = 1200 / 12
    expect(result.monthlyTax).toBeCloseTo(expectedMonthlyTax, 2)
    expect(result.monthlyInsurance).toBeCloseTo(expectedMonthlyInsurance, 2)
    expect(result.monthlyPayment).toBeCloseTo(
      result.principalAndInterest + expectedMonthlyTax + expectedMonthlyInsurance,
      2
    )
  })

  it('handles zero interest rate', () => {
    const result = calculateVALoan({ ...baseParams, interestRate: 0, isExempt: true })
    // P&I should be totalFinanced / totalMonths
    expect(result.principalAndInterest).toBeCloseTo(300000 / 360, 2)
  })

  it('generates correct number of amortization periods', () => {
    const result = calculateVALoan(baseParams)
    expect(result.amortizationSchedule).toHaveLength(360) // 30 years * 12
    expect(result.amortizationScheduleYearly).toHaveLength(30)
  })

  it('amortization ends with near-zero remaining balance', () => {
    const result = calculateVALoan(baseParams)
    const lastMonth = result.amortizationSchedule[result.amortizationSchedule.length - 1]
    expect(lastMonth.remainingBalance).toBeCloseTo(0, 0)
  })
})

// ─── TDY Trip Cost Calculator ────────────────────────────────────────────────

describe('calculateTripCosts', () => {
  const mockRate: TDYRate = {
    city: 'Test City',
    county: 'Test County',
    lodgingRates: {
      '1': 100,
      '2': 110,
      '3': 120,
    },
    mieTotal: 59,
    mieBreakdown: {
      breakfast: 13,
      lunch: 15,
      dinner: 26,
      incidental: 5,
      firstLastDay: 44.25,
    },
  }

  it('returns null for invalid dates', () => {
    expect(calculateTripCosts(mockRate, 'bad', 'dates')).toBeNull()
  })

  it('calculates a single-day trip (first and last day are the same)', () => {
    const result = calculateTripCosts(mockRate, '2025-01-15', '2025-01-15')
    expect(result).not.toBeNull()
    expect(result!.totalDays).toBe(1)
    expect(result!.totalLodging).toBe(100) // January rate
    // Single day = first/last day M&IE
    expect(result!.totalMie).toBeCloseTo(44.25, 2)
  })

  it('calculates a multi-day trip with first/last day M&IE reduction', () => {
    // Jan 15-17: 3 days
    const result = calculateTripCosts(mockRate, '2025-01-15', '2025-01-17')
    expect(result).not.toBeNull()
    expect(result!.totalDays).toBe(3)
    expect(result!.totalLodging).toBe(300) // 3 days * $100/day January
    // First day + middle day + last day M&IE
    expect(result!.totalMie).toBeCloseTo(44.25 + 59 + 44.25, 2)
    expect(result!.grandTotal).toBeCloseTo(300 + 44.25 + 59 + 44.25, 2)
  })

  it('calculates daily average correctly', () => {
    const result = calculateTripCosts(mockRate, '2025-01-15', '2025-01-17')
    expect(result).not.toBeNull()
    expect(result!.dailyAverage).toBeCloseTo(result!.grandTotal / result!.totalDays, 2)
  })

  it('uses correct lodging rate per month when crossing months', () => {
    // Jan 31 to Feb 2: crosses from January ($100) to February ($110)
    const result = calculateTripCosts(mockRate, '2025-01-31', '2025-02-02')
    expect(result).not.toBeNull()
    expect(result!.totalDays).toBe(3)
    // Jan 31=$100, Feb 1=$110, Feb 2=$110
    expect(result!.totalLodging).toBe(100 + 110 + 110)
  })
})
