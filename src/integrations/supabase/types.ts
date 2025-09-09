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
      esim_plans: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          currency: string
          data_amount: string
          description: string | null
          id: string
          is_active: boolean
          supplier_plan_id: string
          title: string
          updated_at: string
          validity_days: number
          wholesale_price: number
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          currency?: string
          data_amount: string
          description?: string | null
          id?: string
          is_active?: boolean
          supplier_plan_id: string
          title: string
          updated_at?: string
          validity_days: number
          wholesale_price: number
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          currency?: string
          data_amount?: string
          description?: string | null
          id?: string
          is_active?: boolean
          supplier_plan_id?: string
          title?: string
          updated_at?: string
          validity_days?: number
          wholesale_price?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          activation_code: string | null
          agent_id: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          esim_iccid: string | null
          esim_qr_code: string | null
          id: string
          plan_id: string
          retail_price: number
          status: Database["public"]["Enums"]["order_status"]
          supplier_order_id: string | null
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          activation_code?: string | null
          agent_id: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string
          plan_id: string
          retail_price: number
          status?: Database["public"]["Enums"]["order_status"]
          supplier_order_id?: string | null
          updated_at?: string
          wholesale_price: number
        }
        Update: {
          activation_code?: string | null
          agent_id?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          esim_iccid?: string | null
          esim_qr_code?: string | null
          id?: string
          plan_id?: string
          retail_price?: number
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
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "esim_plans"
            referencedColumns: ["id"]
          },
        ]
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agent_status: "pending" | "approved" | "suspended"
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
      order_status: ["pending", "completed", "failed", "cancelled"],
      transaction_type: ["deposit", "purchase", "refund"],
    },
  },
} as const
