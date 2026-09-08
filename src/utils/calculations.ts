import { DebtPayment } from '../types/database';

export interface YearProjection {
  year: number;
  totalInvested: number;
  nasdaqValue: number;
  sp500Value: number;
  combinedValue: number;
  annualInterestEarned: number;
  cumulativeInterest: number;
}

/**
 * Calcula la proyección financiera año por año combinando capital inicial y aportes mensuales.
 * Tasa por defecto: S&P500 (~10%) y Nasdaq (~14%) o según slider.
 */
/**
 * Calcula la proyección financiera año por año con aportes y rendimientos independientes para S&P 500 y NASDAQ-100.
 */
export function calculateInvestmentProjection(
  arg1: number,
  arg2: number,
  arg3: number,
  arg4?: number,
  arg5?: number,
  arg6?: number,
  arg7?: number,
  initialInvestedBase?: number
): YearProjection[] {
  let initialCapitalSP: number;
  let initialCapitalNAS: number;
  let monthlySP: number;
  let monthlyNAS: number;
  let totalYears: number;
  let rSP: number;
  let rNAS: number;
  let baseInvested: number;

  if (typeof arg6 === 'number' && typeof arg7 === 'number' && typeof arg4 === 'number' && typeof arg5 === 'number') {
    // Modo individual: (initialSP, initialNAS, monthlySP, monthlyNAS, years, sp500Rate, nasdaqRate, baseInvested)
    initialCapitalSP = arg1;
    initialCapitalNAS = arg2;
    monthlySP = arg3;
    monthlyNAS = arg4;
    totalYears = arg5;
    rSP = arg6 / 100;
    rNAS = arg7 / 100;
    baseInvested = initialInvestedBase ?? (initialCapitalSP + initialCapitalNAS);
  } else {
    // Modo retrocompatible 50/50: (initialCapital, monthlyContribution, years, sp500Rate, nasdaqRate)
    const initialTotal = arg1;
    const monthlyTotal = arg2;
    totalYears = arg3;
    rSP = (arg4 ?? 10) / 100;
    rNAS = (arg5 ?? 14) / 100;
    initialCapitalSP = initialTotal * 0.5;
    initialCapitalNAS = initialTotal * 0.5;
    monthlySP = monthlyTotal * 0.5;
    monthlyNAS = monthlyTotal * 0.5;
    baseInvested = initialTotal;
  }

  const results: YearProjection[] = [];
  let currentTotalInvested = baseInvested;
  let currentSP500Value = initialCapitalSP;
  let currentNasdaqValue = initialCapitalNAS;
  let currentCombinedValue = currentSP500Value + currentNasdaqValue;

  // Año 0 (Inicial / Punto de partida)
  results.push({
    year: 0,
    totalInvested: Math.round(currentTotalInvested * 100) / 100,
    nasdaqValue: Math.round(currentNasdaqValue * 100) / 100,
    sp500Value: Math.round(currentSP500Value * 100) / 100,
    combinedValue: Math.round(currentCombinedValue * 100) / 100,
    annualInterestEarned: 0,
    cumulativeInterest: Math.max(0, Math.round((currentCombinedValue - currentTotalInvested) * 100) / 100),
  });

  const totalMonthlyContribution = monthlySP + monthlyNAS;
  const annualContribution = totalMonthlyContribution * 12;
  const monthlyRateSP = rSP / 12;
  const monthlyRateNAS = rNAS / 12;

  for (let year = 1; year <= totalYears; year++) {
    const prevCombinedValue = currentCombinedValue;
    currentTotalInvested += annualContribution;

    // Capitalización mensual de aportes independientes
    for (let m = 0; m < 12; m++) {
      currentSP500Value = (currentSP500Value + monthlySP) * (1 + monthlyRateSP);
      currentNasdaqValue = (currentNasdaqValue + monthlyNAS) * (1 + monthlyRateNAS);
    }

    currentCombinedValue = currentSP500Value + currentNasdaqValue;
    const interestThisYear = currentCombinedValue - prevCombinedValue - annualContribution;
    const cumulativeInterest = Math.max(0, currentCombinedValue - currentTotalInvested);

    results.push({
      year,
      totalInvested: Math.round(currentTotalInvested * 100) / 100,
      nasdaqValue: Math.round(currentNasdaqValue * 100) / 100,
      sp500Value: Math.round(currentSP500Value * 100) / 100,
      combinedValue: Math.round(currentCombinedValue * 100) / 100,
      annualInterestEarned: Math.round(interestThisYear * 100) / 100,
      cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
    });
  }

  return results;
}

/**
 * Calcula la Regla del 4% (Retiro Seguro Anual, Mensual y Capital Intacto)
 */
export function calculateRetirementPension(finalCapital: number, withdrawalRate: number = 4.0) {
  const annualIncome = finalCapital * (withdrawalRate / 100);
  const monthlyIncome = annualIncome / 12;
  const intactCapital = finalCapital * (1 - withdrawalRate / 100);
  return {
    annualIncome: Math.round(annualIncome * 100) / 100,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    intactCapital: Math.round(intactCapital * 100) / 100,
  };
}

export interface DebtMovementProcessed {
  id: string;
  amount: number;
  type: 'cargo' | 'abono';
  rawType?: string;
  note: string | null;
  date: string;
  is_settlement: boolean;
  previousBalance: number;
  newBalance: number;
}

export interface DebtCycle {
  cycleIndex: number;
  isCurrent: boolean;
  isFullySettled: boolean;
  startDate: string;
  endDate: string;
  totalBorrowed: number;
  totalPaid: number;
  movements: DebtMovementProcessed[];
}

export interface DebtCyclesSummary {
  cycles: DebtCycle[];
  allMovements: DebtMovementProcessed[];
  currentTotalBalance: number;
}

/**
 * Divide el historial de movimientos de una deuda en ciclos inteligentes:
 * REGLA ESTRICTA: Cada ciclo se cierra ÚNICAMENTE cuando el saldo acumulado llega a exactamente $0.00.
 * Si el saldo cae en negativo (yo le debo a la otra persona), el ciclo NO se cierra; continúa abierto
 * hasta que un pago posterior devuelva el saldo a $0.00.
 * Los movimientos dentro de cada ciclo se devuelven en orden cronológico descendente (más reciente arriba),
 * pero con el balance anterior correctamente calculado cronológicamente.
 */
export function processDebtCycles(rawMovements: DebtPayment[]): DebtCyclesSummary {
  if (!rawMovements || rawMovements.length === 0) {
    return { cycles: [], allMovements: [], currentTotalBalance: 0 };
  }

  // Preservar orden cronológico ascendente exacto
  const indexed = rawMovements.map((m, idx) => ({ ...m, _origIndex: idx }));
  const sortedAsc = indexed.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    if (timeA !== timeB) return timeA - timeB;
    if (a.created_at && b.created_at) {
      const createA = new Date(a.created_at).getTime();
      const createB = new Date(b.created_at).getTime();
      if (createA !== createB) return createA - createB;
    }
    // Si la lista de entrada venía en orden descendente (más reciente primero),
    // el de índice mayor es cronológicamente más antiguo
    return b._origIndex - a._origIndex;
  });

  const cycles: DebtCycle[] = [];
  const allMovements: DebtMovementProcessed[] = [];
  let currentMovements: DebtMovementProcessed[] = [];
  let runningBalance = 0;
  let totalBorrowed = 0;
  let totalPaid = 0;
  let cycleIndex = 1;

  for (let i = 0; i < sortedAsc.length; i++) {
    const mov = sortedAsc[i];
    const previousBalance = runningBalance;
    const rawType = (mov.type as string) || '';
    const isCargo =
      rawType === 'cargo' ||
      rawType === 'loan_out' ||
      rawType === 'debt_payment' ||
      (Number(mov.amount) > 0 && !mov.is_settlement && rawType !== 'abono' && rawType !== 'loan_payment' && rawType !== 'debt_in');
    const amt = Math.abs(Number(mov.amount));

    if (isCargo) {
      runningBalance += amt;
      totalBorrowed += amt;
    } else {
      runningBalance -= amt;
      totalPaid += amt;
    }
    runningBalance = Math.round(runningBalance * 100) / 100;

    // Solo se considera saldo saldado si llega exactamente a $0.00
    const isSettlement = Math.abs(runningBalance) < 0.005;

    const processedMovement: DebtMovementProcessed = {
      id: mov.id,
      amount: amt,
      type: isCargo ? 'cargo' : 'abono',
      rawType: mov.type,
      note: mov.note,
      date: mov.date,
      is_settlement: isSettlement,
      previousBalance: Math.round(previousBalance * 100) / 100,
      newBalance: runningBalance,
    };

    currentMovements.push(processedMovement);
    allMovements.push(processedMovement);

    // REGLA CRÍTICA:
    // El ciclo ÚNICAMENTE se cierra cuando el saldo acumulado llega a exactamente $0.00.
    // Si el saldo está en negativo (le debo dinero), el ciclo NO se cierra,
    // continúa abierto hasta que se salde y vuelva a 0.00.
    if (isSettlement && i < sortedAsc.length - 1) {
      cycles.push({
        cycleIndex,
        isCurrent: false,
        isFullySettled: true,
        startDate: currentMovements[0].date,
        endDate: processedMovement.date,
        totalBorrowed: Math.round(totalBorrowed * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        movements: [...currentMovements].reverse(),
      });

      cycleIndex++;
      currentMovements = [];
      runningBalance = 0;
      totalBorrowed = 0;
      totalPaid = 0;
    }
  }

  // Ciclo activo actual (el más reciente)
  if (currentMovements.length > 0) {
    const isSettled = Math.abs(runningBalance) < 0.005;
    cycles.push({
      cycleIndex,
      isCurrent: true,
      isFullySettled: isSettled,
      startDate: currentMovements[0].date,
      endDate: currentMovements[currentMovements.length - 1].date,
      totalBorrowed: Math.round(totalBorrowed * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      movements: [...currentMovements].reverse(),
    });
  }

  return {
    cycles: cycles.reverse(),
    allMovements: [...allMovements].reverse(),
    currentTotalBalance: runningBalance,
  };
}

