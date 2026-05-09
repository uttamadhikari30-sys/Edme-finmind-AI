// Database type definitions. Regenerate with `supabase gen types typescript`.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JEStatus = "draft" | "posted" | "void";
export type PeriodStatus = "open" | "closed";
export type ReconStatus = "open" | "in_progress" | "reconciled";
export type OrgRole = "owner" | "cfo" | "ceo" | "finance" | "bh" | "viewer";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          fiscal_year_start_month: number;
          currency: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["organizations"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
      };
      org_members: {
        Row: {
          org_id: string;
          user_id: string;
          role: OrgRole;
          full_name: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["org_members"]["Row"], "created_at"> & {
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["org_members"]["Row"]>;
      };
      business_units: {
        Row: {
          id: string;
          org_id: string;
          code: string;
          name: string;
          manager_user_id: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["business_units"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["business_units"]["Row"]>;
      };
      fiscal_periods: {
        Row: {
          id: string;
          org_id: string;
          period_label: string;
          start_date: string;
          end_date: string;
          status: PeriodStatus;
        };
        Insert: Omit<Database["public"]["Tables"]["fiscal_periods"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["fiscal_periods"]["Row"]>;
      };
      chart_of_accounts: {
        Row: {
          id: string;
          org_id: string;
          account_code: string;
          account_name: string;
          account_type: AccountType;
          parent_account_id: string | null;
          is_active: boolean;
        };
        Insert: Omit<Database["public"]["Tables"]["chart_of_accounts"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["chart_of_accounts"]["Row"]>;
      };
      journal_entries: {
        Row: {
          id: string;
          org_id: string;
          entry_number: string;
          entry_date: string;
          period_id: string;
          business_unit_id: string | null;
          description: string;
          status: JEStatus;
          created_by: string | null;
          posted_by: string | null;
          posted_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["journal_entries"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Row"]>;
      };
      journal_entry_lines: {
        Row: {
          id: string;
          journal_entry_id: string;
          line_number: number;
          account_id: string;
          business_unit_id: string | null;
          description: string | null;
          debit_amount: number;
          credit_amount: number;
        };
        Insert: Omit<Database["public"]["Tables"]["journal_entry_lines"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["journal_entry_lines"]["Row"]>;
      };
      budgets: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          fiscal_year: string;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["budgets"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["budgets"]["Row"]>;
      };
      budget_lines: {
        Row: {
          id: string;
          budget_id: string;
          account_id: string;
          period_id: string;
          business_unit_id: string | null;
          amount: number;
        };
        Insert: Omit<Database["public"]["Tables"]["budget_lines"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["budget_lines"]["Row"]>;
      };
      reconciliations: {
        Row: {
          id: string;
          org_id: string;
          account_id: string;
          period_id: string;
          gl_balance: number;
          statement_balance: number;
          difference: number;
          status: ReconStatus;
          prepared_by: string | null;
          reviewed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reconciliations"]["Row"], "id" | "created_at" | "difference"> & {
          id?: string;
          created_at?: string;
          difference?: number;
        };
        Update: Partial<Database["public"]["Tables"]["reconciliations"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      account_type: AccountType;
      je_status: JEStatus;
      period_status: PeriodStatus;
      recon_status: ReconStatus;
      org_role: OrgRole;
    };
  };
}
