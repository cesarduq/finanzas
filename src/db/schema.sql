-- ==============================================================================
-- SCHEMA SQL: FINANZAS PERSONALES CON SUPABASE (POSTGRESQL + RLS + TRIGGERS)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLA: ACCOUNTS (Cuentas y Bancos)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'banco', -- 'banco', 'billetera', 'efectivo', 'broker', 'cripto', 'deuda'
    color TEXT NOT NULL DEFAULT '#3b82f6',
    icon_url TEXT,
    initial_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    display_order INT NOT NULL DEFAULT 0,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLA: TRANSACTIONS (Ingresos, Gastos, Transferencias, Inversiones)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'ingreso', 'gasto', 'transferencia', 'inversion'
    amount NUMERIC(14,2) NOT NULL,
    category TEXT,
    note TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. TABLA: DEBTS (Personas en el sistema de deudas)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    person_name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'me_deben', -- 'me_deben', 'debo'
    initial_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'settled'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TABLA: DEBT_PAYMENTS (Historial de movimientos y ciclos de deudas)
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL,
    type TEXT NOT NULL DEFAULT 'abono', -- 'cargo' (incrementa deuda) o 'abono' (paga/reduce deuda)
    note TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_settlement BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. TABLA: INVESTMENT_SETTINGS (Parámetros del simulador por usuario)
CREATE TABLE IF NOT EXISTS public.investment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    sp500_annual_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    nasdaq_annual_rate NUMERIC(5,2) NOT NULL DEFAULT 14.00,
    monthly_contribution NUMERIC(14,2) NOT NULL DEFAULT 300.00,
    years INT NOT NULL DEFAULT 20,
    safe_withdrawal_rate NUMERIC(4,2) NOT NULL DEFAULT 4.00,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - SEGURIDAD TOTAL POR USUARIO
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Políticas para Accounts
CREATE POLICY "Users can manage own accounts" ON public.accounts
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para Transactions
CREATE POLICY "Users can manage own transactions" ON public.transactions
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para Debts
CREATE POLICY "Users can manage own debts" ON public.debts
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para Debt Payments
CREATE POLICY "Users can manage own debt payments" ON public.debt_payments
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para Investment Settings
CREATE POLICY "Users can manage own investment settings" ON public.investment_settings
    FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- TRIGGERS Y FUNCIONES AUTOMÁTICAS
-- ==============================================================================

-- Función para inicializar las 14 cuentas predeterminadas de un nuevo usuario
CREATE OR REPLACE FUNCTION public.initialize_user_accounts(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.accounts (user_id, name, code, type, color, icon_url, display_order, initial_balance, current_balance, metadata)
    VALUES
        (p_user_id, 'Banco Pichincha', 'pichincha', 'banco', '#f59e0b', '/assets/pichincha.svg', 1, 0, 0, '{}'::jsonb),
        (p_user_id, 'Deuna!', 'deuna', 'billetera', '#10b981', '/assets/deuna.svg', 2, 0, 0, '{}'::jsonb),
        (p_user_id, 'Banco Guayaquil', 'guayaquil', 'banco', '#e11d48', '/assets/guayaquil.png', 3, 0, 0, '{}'::jsonb),
        (p_user_id, 'Peigo', 'peigo', 'billetera', '#06b6d4', '/assets/peigo.svg', 4, 0, 0, '{}'::jsonb),
        (p_user_id, 'Produbanco', 'produbanco', 'banco', '#0284c7', '/assets/produbanco.svg', 5, 0, 0, '{}'::jsonb),
        (p_user_id, 'Binance', 'binance', 'cripto', '#eab308', '/assets/binance.svg', 6, 0, 0, '{}'::jsonb),
        (p_user_id, 'Ugly Cash', 'ugly', 'billetera', '#38bdf8', '/assets/ugly.svg', 7, 0, 0, '{}'::jsonb),
        (p_user_id, 'Airtm', 'airtm', 'billetera', '#2563eb', '/assets/airtm.png', 8, 0, 0, '{}'::jsonb),
        (p_user_id, 'Efectivo', 'efectivo', 'efectivo', '#16a34a', '/assets/efectivo.png', 9, 0, 0, '{}'::jsonb),
        (p_user_id, 'Morse', 'morse', 'billetera', '#f97316', '/assets/morse.webp', 10, 0, 0, '{}'::jsonb),
        (p_user_id, 'Hapi (Broker)', 'hapi', 'broker', '#8b5cf6', '/assets/hapi.svg', 11, 0, 0, '{"sp500_balance": 0, "nasdaq_balance": 0, "sp500_return": 0, "nasdaq_return": 0}'::jsonb),
        (p_user_id, 'Por Cobrar', 'por_cobrar', 'deuda', '#a855f7', '', 12, 0, 0, '{}'::jsonb);

    -- Configuración inicial de simulador de inversiones
    INSERT INTO public.investment_settings (user_id, sp500_annual_rate, nasdaq_annual_rate, monthly_contribution, years, safe_withdrawal_rate)
    VALUES (p_user_id, 10.00, 14.00, 300.00, 20, 4.00)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear profile e inicializar cuentas al registrarse un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

    PERFORM public.initialize_user_accounts(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparador después de la creación de usuario en Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
