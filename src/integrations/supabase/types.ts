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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_pricing: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          plan_id: string
          retail_price: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          plan_id: string
          retail_price: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          plan_id?: string
          retail_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_pricing_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_pricing_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_safe_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_pricing_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "esim_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          business_license: string | null
          company_name: string
          contact_person: string
          country: string
          created_at: string
          id: string
          markup_type: string
          markup_value: number
          phone: string
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          business_license?: string | null
          company_name: string
          contact_person: string
          country: string
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          phone: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          business_license?: string | null
          company_name?: string
          contact_person?: string
          country?: string
          created_at?: string
          id?: string
          markup_type?: string
          markup_value?: number
          phone?: string
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      device_brands: {
        Row: {
          brand_name: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          brand_name: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          brand_name?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_models: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_esim_compatible: boolean
          model_name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_esim_compatible?: boolean
          model_name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_esim_compatible?: boolean
          model_name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "device_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      esim_plans: {
        Row: {
          admin_only: boolean
          country_code: string
          country_name: string
          created_at: string
          currency: string
          data_amount: string
          description: string | null
          id: string
          is_active: boolean
          supplier_name: string
          supplier_plan_id: string
          title: string
          updated_at: string
          validity_days: number
          wholesale_price: number
        }
        Insert: {
          admin_only?: boolean
          country_code: string
          country_name: string
          created_at?: string
          currency?: string
          data_amount: string
          description?: string | null
          id?: string
          is_active?: boolean
          supplier_name?: string
          supplier_plan_id: string
          title: string
          updated_at?: string
          validity_days: number
          wholesale_price: number
        }
        Update: {
          admin_only?: boolean
          country_code?: string
          country_name?: string
          created_at?: string
          currency?: string
          data_amount?: string
          description?: string | null
          id?: string
          is_active?: boolean
          supplier_name?: string
          supplier_plan_id?: string
          title?: string
          updated_at?: string
          validity_days?: number
          wholesale_price?: number
        }
        Relationships: []
      }
      esim_status_events: {
        Row: {
          created_at: string
          eid: string | null
          esim_status: string | null
          event_type: string
          iccid: string
          id: string
          smdp_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          eid?: string | null
          esim_status?: string | null
          event_type: string
          iccid: string
          id?: string
          smdp_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          eid?: string | null
          esim_status?: string | null
          event_type?: string
          iccid?: string
          id?: string
          smdp_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      esim_topups: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          data_amount: string | null
          iccid: string
          id: string
          package_code: string
          status: string
          transaction_id: string
          updated_at: string
          validity_days: number | null
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          data_amount?: string | null
          iccid: string
          id?: string
          package_code: string
          status?: string
          transaction_id: string
          updated_at?: string
          validity_days?: number | null
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          data_amount?: string | null
          iccid?: string
          id?: string
          package_code?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          validity_days?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          activation_code: string | null
          agent_id: string
          compatibility_checked: boolean | null
          compatibility_warning_shown: boolean | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          device_brand_id: string | null
          device_model_id: string | null
          esim_expiry_date: string | null
          esim_iccid: string | null
          esim_qr_code: string | null
          id: string
          manual_code: string | null
          plan_id: string
          real_status: string | null
          retail_price: number
          smdp_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          supplier_order_id: string | null
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          activation_code?: string | null
          agent_id: string
          compatibility_checked?: boolean | null
          compatibility_warning_shown?: boolean | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          device_brand_id?: string | null
          device_model_id?: string | null
          esim_expiry_date?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string
          manual_code?: string | null
          plan_id: string
          real_status?: string | null
          retail_price: number
          smdp_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier_order_id?: string | null
          updated_at?: string
          wholesale_price: number
        }
        Update: {
          activation_code?: string | null
          agent_id?: string
          compatibility_checked?: boolean | null
          compatibility_warning_shown?: boolean | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          device_brand_id?: string | null
          device_model_id?: string | null
          esim_expiry_date?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string
          manual_code?: string | null
          plan_id?: string
          real_status?: string | null
          retail_price?: number
          smdp_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          supplier_order_id?: string | null
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_device_brand_id_fkey"
            columns: ["device_brand_id"]
            isOneToOne: false
            referencedRelation: "device_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_device_model_id_fkey"
            columns: ["device_model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_safe_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "esim_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          agent_filter: string | null
          created_at: string
          id: string
          is_active: boolean
          markup_type: string
          markup_value: number
          max_order_amount: number | null
          min_order_amount: number | null
          plan_id: string | null
          priority: number
          rule_type: string
          target_id: string | null
          updated_at: string
        }
        Insert: {
          agent_filter?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          markup_type?: string
          markup_value?: number
          max_order_amount?: number | null
          min_order_amount?: number | null
          plan_id?: string | null
          priority?: number
          rule_type: string
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_filter?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          markup_type?: string
          markup_value?: number
          max_order_amount?: number | null
          min_order_amount?: number | null
          plan_id?: string | null
          priority?: number
          rule_type?: string
          target_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_pricing_rules_plan_id"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_safe_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pricing_rules_plan_id"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "esim_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          agent_id: string
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          agent_id: string
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          agent_id?: string
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_safe_orders: {
        Row: {
          activation_code: string | null
          agent_id: string | null
          compatibility_checked: boolean | null
          compatibility_warning_shown: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          device_brand_id: string | null
          device_model_id: string | null
          esim_expiry_date: string | null
          esim_iccid: string | null
          esim_qr_code: string | null
          id: string | null
          manual_code: string | null
          plan_id: string | null
          real_status: string | null
          retail_price: number | null
          smdp_address: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          updated_at: string | null
        }
        Insert: {
          activation_code?: string | null
          agent_id?: string | null
          compatibility_checked?: boolean | null
          compatibility_warning_shown?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_brand_id?: string | null
          device_model_id?: string | null
          esim_expiry_date?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string | null
          manual_code?: string | null
          plan_id?: string | null
          real_status?: string | null
          retail_price?: number | null
          smdp_address?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
        }
        Update: {
          activation_code?: string | null
          agent_id?: string | null
          compatibility_checked?: boolean | null
          compatibility_warning_shown?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          device_brand_id?: string | null
          device_model_id?: string | null
          esim_expiry_date?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string | null
          manual_code?: string | null
          plan_id?: string | null
          real_status?: string | null
          retail_price?: number | null
          smdp_address?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_device_brand_id_fkey"
            columns: ["device_brand_id"]
            isOneToOne: false
            referencedRelation: "device_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_device_model_id_fkey"
            columns: ["device_model_id"]
            isOneToOne: false
            referencedRelation: "device_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "agent_safe_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "esim_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_safe_plans: {
        Row: {
          admin_only: boolean | null
          country_code: string | null
          country_name: string | null
          created_at: string | null
          currency: string | null
          data_amount: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          title: string | null
          updated_at: string | null
          validity_days: number | null
        }
        Insert: {
          admin_only?: boolean | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          currency?: string | null
          data_amount?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Update: {
          admin_only?: boolean | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string | null
          currency?: string | null
          data_amount?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          title?: string | null
          updated_at?: string | null
          validity_days?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_sensitive_operation: {
        Args: {
          _details?: Json
          _operation: string
          _record_id: string
          _table_name: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      profile_markups_equal: {
        Args: { _id: string; _markup_type: string; _markup_value: number }
        Returns: boolean
      }
      validate_agent_order_access: {
        Args: { _agent_id: string; _order_id: string }
        Returns: boolean
      }
      validate_agent_wallet_access: {
        Args: { _agent_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "pending" | "approved" | "suspended"
      app_role: "admin" | "agent"
      order_status: "pending" | "completed" | "failed" | "cancelled"
      transaction_type: "deposit" | "purchase" | "refund"
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
  public: {
    Enums: {
      agent_status: ["pending", "approved", "suspended"],
      app_role: ["admin", "agent"],
      order_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: ["deposit", "purchase", "refund"],
    },
  },
} as const
