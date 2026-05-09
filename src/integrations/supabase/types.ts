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
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          id: string
          market_id: string | null
          metadata: Json | null
          pana: string | null
          previous_pana: string | null
          reason: string | null
          session: string | null
          session_date: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          metadata?: Json | null
          pana?: string | null
          previous_pana?: string | null
          reason?: string | null
          session?: string | null
          session_date?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          metadata?: Json | null
          pana?: string | null
          previous_pana?: string | null
          reason?: string | null
          session?: string | null
          session_date?: string | null
        }
        Relationships: []
      }
      bets: {
        Row: {
          amount: number
          bet_number: string
          bet_type: string
          created_at: string
          id: string
          market_id: string
          payout: number
          session: string
          session_date: string
          settled_at: string | null
          status: string
          user_id: string
          win_amount: number | null
        }
        Insert: {
          amount: number
          bet_number: string
          bet_type: string
          created_at?: string
          id?: string
          market_id: string
          payout: number
          session: string
          session_date: string
          settled_at?: string | null
          status?: string
          user_id: string
          win_amount?: number | null
        }
        Update: {
          amount?: number
          bet_number?: string
          bet_type?: string
          created_at?: string
          id?: string
          market_id?: string
          payout?: number
          session?: string
          session_date?: string
          settled_at?: string | null
          status?: string
          user_id?: string
          win_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          app_version: string | null
          context: Json | null
          created_at: string
          id: string
          message: string
          route: string | null
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          route?: string | null
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          reject_reason: string | null
          screenshot_url: string | null
          status: string
          user_id: string
          utr: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          screenshot_url?: string | null
          status?: string
          user_id: string
          utr?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          screenshot_url?: string | null
          status?: string
          user_id?: string
          utr?: string | null
        }
        Relationships: []
      }
      market_automation: {
        Row: {
          close_enabled: boolean
          grace_minutes: number
          last_run_at: string | null
          market_id: string
          mode: string
          open_enabled: boolean
          updated_at: string
        }
        Insert: {
          close_enabled?: boolean
          grace_minutes?: number
          last_run_at?: string | null
          market_id: string
          mode?: string
          open_enabled?: boolean
          updated_at?: string
        }
        Update: {
          close_enabled?: boolean
          grace_minutes?: number
          last_run_at?: string | null
          market_id?: string
          mode?: string
          open_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_automation_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: true
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_results: {
        Row: {
          close_digit: number | null
          close_pana: string | null
          created_at: string
          declared_at: string | null
          declared_by: string | null
          id: string
          jodi: string | null
          market_id: string
          open_digit: number | null
          open_pana: string | null
          session_date: string
          status: string
          updated_at: string
        }
        Insert: {
          close_digit?: number | null
          close_pana?: string | null
          created_at?: string
          declared_at?: string | null
          declared_by?: string | null
          id?: string
          jodi?: string | null
          market_id: string
          open_digit?: number | null
          open_pana?: string | null
          session_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          close_digit?: number | null
          close_pana?: string | null
          created_at?: string
          declared_at?: string | null
          declared_by?: string | null
          id?: string
          jodi?: string | null
          market_id?: string
          open_digit?: number | null
          open_pana?: string | null
          session_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_results_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          close_time: string
          created_at: string
          days: string[]
          display_name: string
          id: string
          max_bet: number
          min_bet: number
          name: string
          open_time: string
          payouts: Json
          result_time: string
          status: string
          updated_at: string
        }
        Insert: {
          close_time: string
          created_at?: string
          days: string[]
          display_name: string
          id: string
          max_bet?: number
          min_bet?: number
          name: string
          open_time: string
          payouts: Json
          result_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          close_time?: string
          created_at?: string
          days?: string[]
          display_name?: string
          id?: string
          max_bet?: number
          min_bet?: number
          name?: string
          open_time?: string
          payouts?: Json
          result_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pana_chart: {
        Row: {
          digit: number
          pana: string
          pana_type: string
        }
        Insert: {
          digit: number
          pana: string
          pana_type: string
        }
        Update: {
          digit?: number
          pana?: string
          pana_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          email: string | null
          kyc_status: string
          phone: string | null
          total_bet: number
          total_deposit: number
          total_win: number
          total_withdraw: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          balance?: number
          created_at?: string
          email?: string | null
          kyc_status?: string
          phone?: string | null
          total_bet?: number
          total_deposit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          balance?: number
          created_at?: string
          email?: string | null
          kyc_status?: string
          phone?: string | null
          total_bet?: number
          total_deposit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount: number
          bank_details: Json | null
          created_at: string
          id: string
          method: string
          processed_at: string | null
          processed_by: string | null
          reject_reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          method: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          method?: string
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_deposit: {
        Args: { _note?: string; _request_id: string }
        Returns: Json
      }
      approve_withdrawal: {
        Args: { _note?: string; _request_id: string }
        Returns: Json
      }
      correct_result: {
        Args: {
          _market_id: string
          _new_pana: string
          _reason: string
          _session: string
          _session_date: string
        }
        Returns: Json
      }
      declare_result: {
        Args: {
          _market_id: string
          _pana: string
          _reason?: string
          _session: string
          _session_date: string
        }
        Returns: Json
      }
      ensure_demo_admin: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      place_bets: {
        Args: { _items: Json; _market_id: string; _session_date: string }
        Returns: Json
      }
      reject_deposit: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      reject_withdrawal: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      run_due_auto_declarations: { Args: never; Returns: Json }
      system_auto_declare: {
        Args: {
          _market_id: string
          _pana: string
          _session: string
          _session_date: string
        }
        Returns: Json
      }
      validate_pana: {
        Args: { _pana: string }
        Returns: {
          digit: number
          pana_type: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
