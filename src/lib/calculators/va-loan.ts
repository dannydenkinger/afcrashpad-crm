export interface VALoanResult {
    monthlyPayment: number;
    principalAndInterest: number;
    monthlyTax: number;
    monthlyInsurance: number;
    monthlyFundingFee: number;
    fundingFeeAmount: number;
    totalFinanced: number;
    amortizationSchedule: AmortizationSlot[];
    amortizationScheduleYearly: AmortizationSlot[];
}

export interface AmortizationSlot {
    period: number;
    payment: number;
    principal: number;
    interest: number;
    remainingBalance: number;
}

export function calculateVALoan(params: {
    homePrice: number;
    downPayment: number;
    interestRate: number;
    loanTerm: number; // years
    propertyTaxYearly: number;
    homeInsuranceYearly: number;
    hadVaLoanBefore: boolean;
    isExempt: boolean;
}): VALoanResult {
    const {
        homePrice, downPayment, interestRate, loanTerm,
        propertyTaxYearly, homeInsuranceYearly, hadVaLoanBefore, isExempt
    } = params;

    // 1. Funding Fee Calculation
    let fundingFeePercent = 0;
    if (!isExempt) {
        const downPaymentPercent = (downPayment / homePrice) * 100;
        if (!hadVaLoanBefore) {
            if (downPaymentPercent < 5) fundingFeePercent = 2.15;
            else if (downPaymentPercent < 10) fundingFeePercent = 1.5;
            else fundingFeePercent = 1.25;
        } else {
            if (downPaymentPercent < 5) fundingFeePercent = 3.3;
            else if (downPaymentPercent < 10) fundingFeePercent = 1.5;
            else fundingFeePercent = 1.25;
        }
    }

    const baseLoanAmount = homePrice - downPayment;
    const fundingFeeAmount = (baseLoanAmount * fundingFeePercent) / 100;
    const totalFinanced = baseLoanAmount + fundingFeeAmount;

    // 2. Monthly Payment (Principal & Interest)
    const monthlyRate = (interestRate / 100) / 12;
    const totalMonths = loanTerm * 12;

    let principalAndInterest = 0;
    if (monthlyRate === 0) {
        principalAndInterest = totalFinanced / totalMonths;
    } else {
        principalAndInterest = totalFinanced *
            (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
            (Math.pow(1 + monthlyRate, totalMonths) - 1);
    }

    const monthlyTax = propertyTaxYearly / 12;
    const monthlyInsurance = homeInsuranceYearly / 12;
    const monthlyFundingFee = fundingFeeAmount / totalMonths; // Often rolled in P&I if financed, but breakdown helps

    // 3. Amortization Schedule
    const amortizationSchedule: AmortizationSlot[] = [];
    let remainingBalance = totalFinanced;

    for (let i = 1; i <= totalMonths; i++) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = principalAndInterest - interestPayment;
        remainingBalance -= principalPayment;

        amortizationSchedule.push({
            period: i,
            payment: principalAndInterest,
            principal: principalPayment,
            interest: interestPayment,
            remainingBalance: Math.max(0, remainingBalance)
        });
    }


    const amortizationScheduleYearly: AmortizationSlot[] = [];
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;
    let yearlyPayment = 0;

    for (let i = 0; i < amortizationSchedule.length; i++) {
        const slot = amortizationSchedule[i];
        yearlyPrincipal += slot.principal;
        yearlyInterest += slot.interest;
        yearlyPayment += slot.payment;

        if ((i + 1) % 12 === 0 || i === amortizationSchedule.length - 1) {
            amortizationScheduleYearly.push({
                period: Math.ceil((i + 1) / 12),
                payment: yearlyPayment,
                principal: yearlyPrincipal,
                interest: yearlyInterest,
                remainingBalance: slot.remainingBalance
            });
            yearlyPrincipal = 0;
            yearlyInterest = 0;
            yearlyPayment = 0;
        }
    }

    return {
        monthlyPayment: principalAndInterest + monthlyTax + monthlyInsurance,
        principalAndInterest,
        monthlyTax,
        monthlyInsurance,
        monthlyFundingFee: 0, // In VA case, it's usually in the principal
        fundingFeeAmount,
        totalFinanced,
        amortizationSchedule,
        amortizationScheduleYearly
    };
}
