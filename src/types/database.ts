// ============================================================
// FINANZAS PERSONALES PWA — TypeScript Types
// ============================================================

export type TransactionType = 'income' | 'expense' | 'savings'
export type AccountType = 'cash' | 'bank' | 'broker' | 'digital'

export interface Profile {
  id: string
  email: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  color: string
  icon: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  transaction_type: TransactionType
  is_cashback: boolean
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  subcategories?: Category[]
}

export interface Transaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  currency: string
  category_id: string | null
  subcategory_id: string | null
  account_id: string | null
  destination_account_id: string | null
  concept: string
  notes: string | null
  transaction_date: string
  is_recurring: boolean
  tags: string[]
  created_at: string
  updated_at: string
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon' | 'is_cashback'>
  subcategory?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
  account?: Pick<Account, 'id' | 'name' | 'color' | 'icon' | 'type'>
  destination_account?: Pick<Account, 'id' | 'name' | 'color' | 'icon' | 'type'>
}

export interface TransactionFormData {
  type: TransactionType
  amount: number
  currency: string
  category_id: string
  subcategory_id?: string
  account_id: string
  destination_account_id?: string
  concept: string
  notes?: string
  transaction_date: Date
  is_recurring: boolean
  tags?: string[]
}

export interface AccountFormData {
  name: string
  type: AccountType
  currency: string
  color: string
  icon: string
  sort_order: number
}

export interface MonthlySummary {
  user_id: string
  month: string
  type: TransactionType
  total: number
  count: number
}

export interface CashbackMonthly {
  user_id: string
  month: string
  total_cashback: number
}

export interface AccountBalance {
  account_id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  color: string
  icon: string
  balance: number
}

export interface ExpenseByCategory {
  user_id: string
  category_id: string
  category_name: string
  color: string
  icon: string
  total: number
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at' | 'subcategories'>
        Update: Partial<Omit<Category, 'id' | 'user_id' | 'created_at' | 'subcategories'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'category' | 'subcategory' | 'account' | 'destination_account'>
        Update: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'category' | 'subcategory' | 'account' | 'destination_account'>>
      }
    }
    Views: {
      v_monthly_summary: { Row: MonthlySummary }
      v_cashback_monthly: { Row: CashbackMonthly }
      v_account_balance: { Row: AccountBalance }
      v_expense_by_category_current_month: { Row: ExpenseByCategory }
    }
    Functions: {
      seed_default_categories: { Args: { p_user_id: string }; Returns: void }
    }
  }
}

export interface HistoryFilter {
  type: TransactionType | 'all'
  period: 'current_month' | 'last_month' | 'custom'
  dateFrom?: string
  dateTo?: string
  category_id?: string
  account_id?: string
}

export interface WealthSummary {
  total_liquid: number
  total_invested: number
  total_net: number
  accounts: AccountBalance[]
}

export interface DashboardSummary {
  month: string
  income: number
  expenses: number
  savings: number
  cashback: number
  balance: number
  savings_rate: number
}

export type HistoryViewMode = 'list' | 'pie' | 'bar'
