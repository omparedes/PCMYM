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
          item_type: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          budget_id: string
          business_id: string
          created_at?: string
          description: string
          id?: string
          item_type?: string
          product_id?: string | null
          quantity?: number
          unit_price: number
        }
        Update: {
          budget_id?: string
          business_id?: string
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          product_id?: string | null
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
          {
            foreignKeyName: "budget_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      inventory_movements: {
        Row: {
          business_id: string
          created_at: string
          id: string
          movement_type: string
          new_stock: number
          notes: string | null
          performed_by: string | null
          previous_stock: number
          product_id: string
          quantity: number
          reason: string
          reference_doc: string | null
          service_order_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          movement_type: string
          new_stock: number
          notes?: string | null
          performed_by?: string | null
          previous_stock: number
          product_id: string
          quantity: number
          reason: string
          reference_doc?: string | null
          service_order_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          movement_type?: string
          new_stock?: number
          notes?: string | null
          performed_by?: string | null
          previous_stock?: number
          product_id?: string
          quantity?: number
          reason?: string
          reference_doc?: string | null
          service_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
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
      products: {
        Row: {
          active: boolean
          barcode: string | null
          brand: string | null
          business_id: string
          category: string
          compatibility: string | null
          cost_price: number
          created_at: string
          current_stock: number
          id: string
          location: string | null
          min_stock: number
          model: string | null
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          supplier: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          business_id: string
          category: string
          compatibility?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          location?: string | null
          min_stock?: number
          model?: string | null
          name: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          brand?: string | null
          business_id?: string
          category?: string
          compatibility?: string | null
          cost_price?: number
          created_at?: string
          current_stock?: number
          id?: string
          location?: string | null
          min_stock?: number
          model?: string | null
          name?: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          supplier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
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
      sales_quote_folio_counters: {
        Row: {
          business_id: string
          next_folio: number
        }
        Insert: {
          business_id: string
          next_folio?: number
        }
        Update: {
          business_id?: string
          next_folio?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quote_folio_counters_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quote_items: {
        Row: {
          build_key: string | null
          business_id: string
          compatibility_notes: string | null
          compatibility_status: string
          created_at: string
          description: string
          id: string
          quantity: number
          sales_quote_id: string
          specification_snapshot: Json
          supplier_product_id: string | null
          unit_cost_pen: number
          unit_cost_usd: number | null
          unit_price_pen: number
          updated_at: string
        }
        Insert: {
          build_key?: string | null
          business_id: string
          compatibility_notes?: string | null
          compatibility_status?: string
          created_at?: string
          description: string
          id?: string
          quantity?: number
          sales_quote_id: string
          specification_snapshot?: Json
          supplier_product_id?: string | null
          unit_cost_pen?: number
          unit_cost_usd?: number | null
          unit_price_pen?: number
          updated_at?: string
        }
        Update: {
          build_key?: string | null
          business_id?: string
          compatibility_notes?: string | null
          compatibility_status?: string
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sales_quote_id?: string
          specification_snapshot?: Json
          supplier_product_id?: string | null
          unit_cost_pen?: number
          unit_cost_usd?: number | null
          unit_price_pen?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_quote_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_items_sales_quote_id_fkey"
            columns: ["sales_quote_id"]
            isOneToOne: false
            referencedRelation: "sales_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_items_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotes: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          exchange_rate: number
          folio: number
          id: string
          margin_rate: number
          notes: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exchange_rate?: number
          folio: number
          id?: string
          margin_rate?: number
          notes?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exchange_rate?: number
          folio?: number
          id?: string
          margin_rate?: number
          notes?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "sales_quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_top_customers"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      service_order_deliveries: {
        Row: {
          business_id: string
          created_at: string
          delivered_at: string
          delivered_by: string | null
          delivery_notes: string | null
          id: string
          receiver_document: string | null
          receiver_name: string
          service_order_id: string
          warranty_days: number
          warranty_terms: string | null
          warranty_until: string | null
          work_summary: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_notes?: string | null
          id?: string
          receiver_document?: string | null
          receiver_name: string
          service_order_id: string
          warranty_days?: number
          warranty_terms?: string | null
          warranty_until?: string | null
          work_summary?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          delivered_at?: string
          delivered_by?: string | null
          delivery_notes?: string | null
          id?: string
          receiver_document?: string | null
          receiver_name?: string
          service_order_id?: string
          warranty_days?: number
          warranty_terms?: string | null
          warranty_until?: string | null
          work_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_deliveries_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_deliveries_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_deliveries_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: true
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
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
      service_order_parts: {
        Row: {
          budget_id: string | null
          business_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          service_order_id: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          budget_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          service_order_id: string
          unit_cost?: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          budget_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          service_order_id?: string
          unit_cost?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_parts_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_parts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_parts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_parts_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_parts_service_order_id_fkey"
            columns: ["service_order_id"]
            isOneToOne: false
            referencedRelation: "v_accounts_receivable"
            referencedColumns: ["service_order_id"]
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
          work_types: string[]
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
          work_types?: string[]
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
          work_types?: string[]
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
      supplier_catalog_imports: {
        Row: {
          accepted_rows: number
          business_id: string
          created_at: string
          created_by: string | null
          error_rows: number
          exchange_rate: number
          id: string
          notes: string | null
          skipped_rows: number
          source_file_name: string
          source_hash: string | null
          status: string
          supplier: string
          tax_included: boolean
          total_rows: number
        }
        Insert: {
          accepted_rows?: number
          business_id: string
          created_at?: string
          created_by?: string | null
          error_rows?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          skipped_rows?: number
          source_file_name: string
          source_hash?: string | null
          status?: string
          supplier?: string
          tax_included?: boolean
          total_rows?: number
        }
        Update: {
          accepted_rows?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          error_rows?: number
          exchange_rate?: number
          id?: string
          notes?: string | null
          skipped_rows?: number
          source_file_name?: string
          source_hash?: string | null
          status?: string
          supplier?: string
          tax_included?: boolean
          total_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_catalog_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_catalog_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          active: boolean
          brand: string | null
          business_id: string
          catalog_group: string
          category: string
          component_category: string
          created_at: string
          distribution_price_usd: number | null
          freight_text: string | null
          id: string
          igv_exempt: boolean
          inferred_attributes: Json
          is_quote_candidate: boolean
          last_import_id: string | null
          last_seen_at: string
          name: string
          pge_price_usd: number | null
          product_type: string
          search_document: string
          search_terms: string[]
          source_url: string | null
          specification_overrides: Json
          stock_is_at_least: boolean
          stock_quantity: number | null
          stock_text: string | null
          supplier: string
          supplier_code: string
          supplier_mini_code: string | null
          technical_attributes: Json
          technical_comment: string | null
          technical_description: string | null
          updated_at: string
          warranty_code: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          business_id: string
          catalog_group?: string
          category: string
          component_category?: string
          created_at?: string
          distribution_price_usd?: number | null
          freight_text?: string | null
          id?: string
          igv_exempt?: boolean
          inferred_attributes?: Json
          is_quote_candidate?: boolean
          last_import_id?: string | null
          last_seen_at?: string
          name: string
          pge_price_usd?: number | null
          product_type?: string
          search_document?: string
          search_terms?: string[]
          source_url?: string | null
          specification_overrides?: Json
          stock_is_at_least?: boolean
          stock_quantity?: number | null
          stock_text?: string | null
          supplier?: string
          supplier_code: string
          supplier_mini_code?: string | null
          technical_attributes?: Json
          technical_comment?: string | null
          technical_description?: string | null
          updated_at?: string
          warranty_code?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          business_id?: string
          catalog_group?: string
          category?: string
          component_category?: string
          created_at?: string
          distribution_price_usd?: number | null
          freight_text?: string | null
          id?: string
          igv_exempt?: boolean
          inferred_attributes?: Json
          is_quote_candidate?: boolean
          last_import_id?: string | null
          last_seen_at?: string
          name?: string
          pge_price_usd?: number | null
          product_type?: string
          search_document?: string
          search_terms?: string[]
          source_url?: string | null
          specification_overrides?: Json
          stock_is_at_least?: boolean
          stock_quantity?: number | null
          stock_text?: string | null
          supplier?: string
          supplier_code?: string
          supplier_mini_code?: string | null
          technical_attributes?: Json
          technical_comment?: string | null
          technical_description?: string | null
          updated_at?: string
          warranty_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_last_import_id_fkey"
            columns: ["last_import_id"]
            isOneToOne: false
            referencedRelation: "supplier_catalog_imports"
            referencedColumns: ["id"]
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
      add_part_to_service_order: {
        Args: {
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_service_order_id: string
        }
        Returns: {
          budget_id: string | null
          business_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          service_order_id: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_product_stock: {
        Args: {
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reason: string
          p_reference_doc?: string
        }
        Returns: {
          active: boolean
          barcode: string | null
          brand: string | null
          business_id: string
          category: string
          compatibility: string | null
          cost_price: number
          created_at: string
          current_stock: number
          id: string
          location: string | null
          min_stock: number
          model: string | null
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          supplier: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_budget_parts_to_service_order: {
        Args: { p_budget_id: string }
        Returns: Json
      }
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
          work_types: string[]
        }
        SetofOptions: {
          from: "*"
          to: "service_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_product_with_initial_stock: {
        Args: {
          p_barcode?: string
          p_brand?: string
          p_category: string
          p_compatibility?: string
          p_cost_price: number
          p_initial_stock?: number
          p_location?: string
          p_min_stock?: number
          p_model?: string
          p_name: string
          p_notes?: string
          p_sale_price: number
          p_sku?: string
          p_supplier?: string
        }
        Returns: {
          active: boolean
          barcode: string | null
          brand: string | null
          business_id: string
          category: string
          compatibility: string | null
          cost_price: number
          created_at: string
          current_stock: number
          id: string
          location: string | null
          min_stock: number
          model: string | null
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          supplier: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      deliver_service_order: {
        Args: {
          p_delivery_notes?: string
          p_receiver_document?: string
          p_receiver_name: string
          p_service_order_id: string
          p_warranty_days?: number
          p_warranty_terms?: string
          p_work_summary?: string
        }
        Returns: {
          business_id: string
          created_at: string
          delivered_at: string
          delivered_by: string | null
          delivery_notes: string | null
          id: string
          receiver_document: string | null
          receiver_name: string
          service_order_id: string
          warranty_days: number
          warranty_terms: string | null
          warranty_until: string | null
          work_summary: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_order_deliveries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      duplicate_sales_quote: {
        Args: { p_quote_id: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          exchange_rate: number
          folio: number
          id: string
          margin_rate: number
          notes: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sales_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_product_sku: {
        Args: {
          p_brand?: string
          p_business_id?: string
          p_category: string
          p_model?: string
          p_name: string
        }
        Returns: string
      }
      get_public_tracking_info: { Args: { p_token: string }; Returns: Json }
      infer_supplier_specs: {
        Args: { p_category: string; p_description: string; p_name: string }
        Returns: Json
      }
      is_valid_budget_transition: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      is_valid_service_order_transition: {
        Args: { p_from: string; p_to: string }
        Returns: boolean
      }
      modify_service_order_part_qty: {
        Args: {
          p_new_quantity: number
          p_product_id: string
          p_service_order_id: string
        }
        Returns: {
          budget_id: string | null
          business_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          service_order_id: string
          unit_cost: number
          unit_price: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "service_order_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_sales_quote_folio: { Args: never; Returns: number }
      normalize_supplier_catalog_text: {
        Args: { p_value: string }
        Returns: string
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
      remove_part_from_service_order: {
        Args: { p_product_id: string; p_service_order_id: string }
        Returns: boolean
      }
      search_supplier_products: {
        Args: {
          p_catalog_group?: string
          p_component_category?: string
          p_include_out_of_stock?: boolean
          p_limit?: number
          p_offset?: number
          p_quote_only?: boolean
          p_search?: string
        }
        Returns: {
          active: boolean
          brand: string | null
          business_id: string
          catalog_group: string
          category: string
          component_category: string
          created_at: string
          distribution_price_usd: number | null
          freight_text: string | null
          id: string
          igv_exempt: boolean
          inferred_attributes: Json
          is_quote_candidate: boolean
          last_import_id: string | null
          last_seen_at: string
          name: string
          pge_price_usd: number | null
          product_type: string
          search_document: string
          search_terms: string[]
          source_url: string | null
          specification_overrides: Json
          stock_is_at_least: boolean
          stock_quantity: number | null
          stock_text: string | null
          supplier: string
          supplier_code: string
          supplier_mini_code: string | null
          technical_attributes: Json
          technical_comment: string | null
          technical_description: string | null
          updated_at: string
          warranty_code: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "supplier_products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_supplier_specifications: {
        Args: { p_overrides: Json; p_product_id: string }
        Returns: {
          active: boolean
          brand: string | null
          business_id: string
          catalog_group: string
          category: string
          component_category: string
          created_at: string
          distribution_price_usd: number | null
          freight_text: string | null
          id: string
          igv_exempt: boolean
          inferred_attributes: Json
          is_quote_candidate: boolean
          last_import_id: string | null
          last_seen_at: string
          name: string
          pge_price_usd: number | null
          product_type: string
          search_document: string
          search_terms: string[]
          source_url: string | null
          specification_overrides: Json
          stock_is_at_least: boolean
          stock_quantity: number | null
          stock_text: string | null
          supplier: string
          supplier_code: string
          supplier_mini_code: string | null
          technical_attributes: Json
          technical_comment: string | null
          technical_description: string | null
          updated_at: string
          warranty_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "supplier_products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      supplier_header_classification: {
        Args: { p_category: string }
        Returns: Json
      }
      update_sales_quote_draft: {
        Args: {
          p_customer_name: string
          p_customer_phone: string
          p_exchange_rate: number
          p_items: Json
          p_margin_rate: number
          p_notes: string
          p_quote_id: string
          p_tax_rate: number
          p_valid_until: string
        }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          exchange_rate: number
          folio: number
          id: string
          margin_rate: number
          notes: string | null
          status: string
          subtotal: number
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
          valid_until: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sales_quotes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
