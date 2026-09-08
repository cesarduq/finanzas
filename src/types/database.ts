export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  code: string;
  type: 'banco' | 'billetera' | 'efectivo' | 'broker' | 'cripto' | 'deuda';
  color: string;
  icon_url: string | null;
  initial_balance: number;
  current_balance: number;
  display_order: number;
  is_archived: boolean;
  metadata?: {
    sp500_balance?: number;
    nasdaq_balance?: number;
    sp500_return?: number;
    nasdaq_return?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export type TransactionType =
  | 'ingreso'
  | 'gasto'
  | 'transferencia'
  | 'inversion'
  | 'transfer'
  | 'transfer_in'
  | 'transfer_out'
  | 'invest'
  | 'trade_profit'
  | 'trade_loss'
  | 'loan_out'
  | 'loan_payment'
  | 'debt_in'
  | 'debt_service_in'
  | 'debt_payment';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  destination_account_id?: string | null;
  type: TransactionType;
  amount: number;
  category: string | null;
  note: string | null;
  date: string;
  metadata?: {
    investment_asset?: 'nasdaq' | 'sp500' | string;
    shares?: number;
    share_price?: number;
    commission?: number;
    person?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  person_name: string;
  type: 'me_deben' | 'debo';
  initial_amount: number;
  current_balance: number;
  status: 'active' | 'settled';
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  user_id: string;
  debt_id: string;
  amount: number;
  type: 'cargo' | 'abono';
  note: string | null;
  date: string;
  is_settlement: boolean;
  created_at: string;
}

export interface InvestmentSettings {
  id: string;
  user_id: string;
  sp500_annual_rate: number;
  nasdaq_annual_rate: number;
  monthly_contribution: number;
  years: number;
  safe_withdrawal_rate: number;
  updated_at: string;
}
