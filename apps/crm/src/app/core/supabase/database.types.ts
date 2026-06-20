export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      budget_folio_counters: {
        Row: {
          business_id: string
          last_folio: number
        }
        Insert: {
          business_id: string
          last_folio?: number
        }
        Update: {
          business_id?: string
          last_folio?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_folio_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          budget_id: string
          business_id: string
          created_at: string
          description: string
          id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          budget_id: string
          business_id: string
          created_at?: string
          description: string
          id?: string
          quantity?: number
          unit_price: number
        }
        Update: {
          budget_id?: string
          business_id?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_status_history: {
        Row: {
          budget_id: string
          business_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          to_status: string
        }
        Insert: {
          budget_id: string
          business_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          to_status: string
        }
        Update: {
          budget_id?: string
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_status_history_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_status_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          folio: number | null
          id: string
          notes: string | null
          service_order_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          folio?: number | null
          id?: string
          notes?: string | null
          service_order_id: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          folio?: number | null
          id?: string
          notes?: string | null
          service_order_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          archived_at: string | null
          business_id: string
          created_at: string
          document_number: string | null
          document_type: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          business_id: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          business_id?: string
          created_at?: string
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          description: string
          entry_type: string
          id: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          description: string
          entry_type: string
          id?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          description?: string
          entry_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          business_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          note: string | null
          service_order_id: string
          to_status: string
        }
        Insert: {
          business_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          service_order_id: string
          to_status: string
        }
        Update: {
          business_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          service_order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          payment_method: string
          recorded_by: string | null
          service_order_id: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          payment_method: string
          recorded_by?: string | null
          service_order_id: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          payment_method?: string
          recorded_by?: string | null
          service_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id: string
          name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_folio_counters: {
        Row: {
          business_id: string
          last_folio: number
        }
        Insert: {
          business_id: string
          last_folio?: number
        }
        Update: {
          business_id?: string
          last_folio?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_order_folio_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_photos: {
        Row: {
          business_id: string
          id: string
          service_order_id: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          business_id: string
          id?: string
          service_order_id: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          service_order_id?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_photos_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_photos_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
          },
          {
            foreignKeyName: "service_order_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          accessories: string | null
          assigned_to: string | null
          brand: string | null
          business_id: string
          created_at: string
          customer_id: string
          equipment_type: string | null
          estimated_delivery: string | null
          folio: number | null
          id: string
          initial_diagnosis: string | null
          model: string | null
          priority: string
          received_at: string
          reported_issue: string | null
          serial_number: string | null
          status: string
          tracking_token: string
          updated_at: string
        }
        Insert: {
          accessories?: string | null
          assigned_to?: string | null
          brand?: string | null
          business_id: string
          created_at?: string
          customer_id: string
          equipment_type?: string | null
          estimated_delivery?: string | null
          folio?: number | null
          id?: string
          initial_diagnosis?: string | null
          model?: string | null
          priority?: string
          received_at?: string
          reported_issue?: string | null
          serial_number?: string | null
          status?: string
          tracking_token?: string
          updated_at?: string
        }
        Update: {
          accessories?: string | null
          assigned_to?: string | null
          brand?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string
          equipment_type?: string | null
          estimated_delivery?: string | null
          folio?: number | null
          id?: string
          initial_diagnosis?: string | null
          model?: string | null
          priority?: string
          received_at?: string
          reported_issue?: string | null
          serial_number?: string | null
          status?: string
          tracking_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "service_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_top_customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
    }
    Views: {
      v_accounts_receivable: {
        Row: {
          approved_amount: number | null
          balance_due: number | null
          business_id: string | null
          customer_id: string | null
          customer_name: string | null
          folio: number | null
          order_status: string | null
          service_order_id: string | null
          total_paid: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_income_expense_daily: {
        Row: {
          business_id: string | null
          entry_date: string | null
          total_expense: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_income_expense_monthly: {
        Row: {
          business_id: string | null
          entry_month: string | null
          total_expense: number | null
          total_income: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_customers: {
        Row: {
          business_id: string | null
          customer_id: string | null
          customer_name: string | null
          service_order_count: number | null
          total_revenue: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_top_equipment_types: {
        Row: {
          business_id: string | null
          equipment_type: string | null
          order_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_business_id: { Args: never; Returns: string }
      auth_role: { Args: never; Returns: string }
      change_budget_status: {
        Args: { p_budget_id: string; p_new_status: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          folio: number | null
          id: string
          notes: string | null
          service_order_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "budgets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      change_service_order_status: {
        Args: {
          p_new_status: string
          p_note?: string
          p_service_order_id: string
        }
        Returns: {
          accessories: string | null
          assigned_to: string | null
          brand: string | null
          business_id: string
          created_at: string
          customer_id: string
          equipment_type: string | null
          estimated_delivery: string | null
          folio: number | null
          id: string
          initial_diagnosis: string | null
          model: string | null
          priority: string
          received_at: string
          reported_issue: string | null
          serial_number: string | null
          status: string
          tracking_token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_tracking_info: { Args: { p_token: string }; Returns: Json }
      is_valid_budget_transition: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      is_valid_service_order_transition: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      record_expense: {
        Args: { p_amount: number; p_description: string }
        Returns: {
          amount: number
          business_id: string
          created_at: string
          description: string
          entry_type: string
          id: string
        }
        SetofOptions: {
          from: "*"
          to: "financial_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
