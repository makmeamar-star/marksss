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
      achievements: {
        Row: {
          active: boolean
          code: string
          description: string
          icon: string
          reward_amount: number
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          code: string
          description: string
          icon?: string
          reward_amount?: number
          sort_order?: number
          title: string
        }
        Update: {
          active?: boolean
          code?: string
          description?: string
          icon?: string
          reward_amount?: number
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
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
            referencedRelation: "market_source_coverage"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "bets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      cashback_runs: {
        Row: {
          cashback_amount: number
          created_at: string
          id: string
          loss_amount: number
          rate: number
          run_date: string
          user_id: string
        }
        Insert: {
          cashback_amount: number
          created_at?: string
          id?: string
          loss_amount: number
          rate: number
          run_date?: string
          user_id: string
        }
        Update: {
          cashback_amount?: number
          created_at?: string
          id?: string
          loss_amount?: number
          rate?: number
          run_date?: string
          user_id?: string
        }
        Relationships: []
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
      daily_missions: {
        Row: {
          code: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          reward_amount: number
          sort_order: number
          target: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          reward_amount?: number
          sort_order?: number
          target?: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          reward_amount?: number
          sort_order?: number
          target?: number
          title?: string
        }
        Relationships: []
      }
      daily_spins: {
        Row: {
          id: string
          prize_amount: number
          prize_label: string
          spin_date: string
          spun_at: string
          user_id: string
        }
        Insert: {
          id?: string
          prize_amount: number
          prize_label: string
          spin_date?: string
          spun_at?: string
          user_id: string
        }
        Update: {
          id?: string
          prize_amount?: number
          prize_label?: string
          spin_date?: string
          spun_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          auto_verified: boolean
          created_at: string
          expected_payee: string | null
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
          auto_verified?: boolean
          created_at?: string
          expected_payee?: string | null
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
          auto_verified?: boolean
          created_at?: string
          expected_payee?: string | null
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
      kyc_submissions: {
        Row: {
          address: string | null
          created_at: string
          dob: string | null
          doc_urls: string[]
          full_name: string | null
          id: string
          pan_masked: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: string
          tier: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          dob?: string | null
          doc_urls?: string[]
          full_name?: string | null
          id?: string
          pan_masked?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: string
          tier?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          dob?: string | null
          doc_urls?: string[]
          full_name?: string | null
          id?: string
          pan_masked?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: string
          tier?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_alert_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          market_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          market_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          market_id?: string
          user_id?: string
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
            referencedRelation: "market_source_coverage"
            referencedColumns: ["market_id"]
          },
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
            referencedRelation: "market_source_coverage"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "market_results_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_source_map: {
        Row: {
          created_at: string
          enabled: boolean
          market_id: string
          slug: string
          source: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          market_id: string
          slug: string
          source: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          market_id?: string
          slug?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_source_map_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "market_source_coverage"
            referencedColumns: ["market_id"]
          },
          {
            foreignKeyName: "market_source_map_market_id_fkey"
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
          is_core: boolean
          is_jodi_only: boolean
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
          is_core?: boolean
          is_jodi_only?: boolean
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
          is_core?: boolean
          is_jodi_only?: boolean
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
      payment_channels: {
        Row: {
          active: boolean
          created_at: string
          daily_cap: number | null
          details: Json
          id: string
          instructions: string | null
          label: string
          max_amount: number
          min_amount: number
          priority: number
          qr_image_url: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_cap?: number | null
          details?: Json
          id?: string
          instructions?: string | null
          label: string
          max_amount?: number
          min_amount?: number
          priority?: number
          qr_image_url?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_cap?: number | null
          details?: Json
          id?: string
          instructions?: string | null
          label?: string
          max_amount?: number
          min_amount?: number
          priority?: number
          qr_image_url?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          bonus_balance: number
          cashback_total: number
          created_at: string
          email: string | null
          kyc_status: string
          locked_balance: number
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          status: string
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
          bonus_balance?: number
          cashback_total?: number
          created_at?: string
          email?: string | null
          kyc_status?: string
          locked_balance?: number
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          status?: string
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
          bonus_balance?: number
          cashback_total?: number
          created_at?: string
          email?: string | null
          kyc_status?: string
          locked_balance?: number
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          status?: string
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
      promo_codes: {
        Row: {
          active: boolean
          bonus_amount: number
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          max_redemptions: number | null
          min_deposit: number
          per_user_limit: number
          redemptions_count: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bonus_amount: number
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          min_deposit?: number
          per_user_limit?: number
          redemptions_count?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bonus_amount?: number
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          min_deposit?: number
          per_user_limit?: number
          redemptions_count?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          bonus_amount: number
          code: string
          created_at: string
          id: string
          promo_id: string
          user_id: string
        }
        Insert: {
          bonus_amount: number
          code: string
          created_at?: string
          id?: string
          promo_id: string
          user_id: string
        }
        Update: {
          bonus_amount?: number
          code?: string
          created_at?: string
          id?: string
          promo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pwa_install_events: {
        Row: {
          created_at: string
          event: string
          id: string
          outcome: string | null
          platform: string
          session_id: string | null
          source: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          outcome?: string | null
          platform: string
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          outcome?: string | null
          platform?: string
          session_id?: string | null
          source?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      quick_bets: {
        Row: {
          amount: number
          created_at: string
          digit: number
          id: string
          round_id: string
          settled_at: string | null
          status: string
          user_id: string
          win_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          digit: number
          id?: string
          round_id: string
          settled_at?: string | null
          status?: string
          user_id: string
          win_amount?: number
        }
        Update: {
          amount?: number
          created_at?: string
          digit?: number
          id?: string
          round_id?: string
          settled_at?: string | null
          status?: string
          user_id?: string
          win_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "quick_bets_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "quick_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_rounds: {
        Row: {
          category: string
          closes_at: string
          declared_at: string | null
          id: string
          opens_at: string
          payout_multiplier: number
          result_digit: number | null
          round_no: number
          status: string
        }
        Insert: {
          category?: string
          closes_at: string
          declared_at?: string | null
          id?: string
          opens_at?: string
          payout_multiplier?: number
          result_digit?: number | null
          round_no?: number
          status?: string
        }
        Update: {
          category?: string
          closes_at?: string
          declared_at?: string | null
          id?: string
          opens_at?: string
          payout_multiplier?: number
          result_digit?: number | null
          round_no?: number
          status?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          first_deposit_at: string | null
          id: string
          lifetime_commission: number
          referee_id: string
          referrer_id: string
          signup_at: string
          signup_bonus_paid: number
        }
        Insert: {
          code: string
          first_deposit_at?: string | null
          id?: string
          lifetime_commission?: number
          referee_id: string
          referrer_id: string
          signup_at?: string
          signup_bonus_paid?: number
        }
        Update: {
          code?: string
          first_deposit_at?: string | null
          id?: string
          lifetime_commission?: number
          referee_id?: string
          referrer_id?: string
          signup_at?: string
          signup_bonus_paid?: number
        }
        Relationships: []
      }
      result_observations: {
        Row: {
          first_seen_at: string
          id: string
          last_seen_at: string
          market_id: string
          pana: string
          seen_count: number
          session: string
          session_date: string
          source: string
        }
        Insert: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          market_id: string
          pana: string
          seen_count?: number
          session: string
          session_date: string
          source: string
        }
        Update: {
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          market_id?: string
          pana?: string
          seen_count?: number
          session?: string
          session_date?: string
          source?: string
        }
        Relationships: []
      }
      result_proof: {
        Row: {
          client_seed: string | null
          created_at: string
          id: string
          market_id: string | null
          nonce: number | null
          result: string
          revealed_at: string | null
          round_id: string | null
          server_seed: string | null
          server_seed_hash: string
          session: string | null
          session_date: string | null
        }
        Insert: {
          client_seed?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          nonce?: number | null
          result: string
          revealed_at?: string | null
          round_id?: string | null
          server_seed?: string | null
          server_seed_hash: string
          session?: string | null
          session_date?: string | null
        }
        Update: {
          client_seed?: string | null
          created_at?: string
          id?: string
          market_id?: string | null
          nonce?: number | null
          result?: string
          revealed_at?: string | null
          round_id?: string | null
          server_seed?: string | null
          server_seed_hash?: string
          session?: string | null
          session_date?: string | null
        }
        Relationships: []
      }
      result_scrape_log: {
        Row: {
          error: string | null
          id: string
          market_id: string
          pana: string | null
          run_at: string
          session: string
          session_date: string
          source: string
          status: string
        }
        Insert: {
          error?: string | null
          id?: string
          market_id: string
          pana?: string | null
          run_at?: string
          session: string
          session_date: string
          source: string
          status: string
        }
        Update: {
          error?: string | null
          id?: string
          market_id?: string
          pana?: string | null
          run_at?: string
          session?: string
          session_date?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      rewards_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_retry_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          market_id: string
          max_attempts: number
          next_attempt_at: string
          session: string
          session_date: string
          slug: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          market_id: string
          max_attempts?: number
          next_attempt_at?: string
          session: string
          session_date: string
          slug: string
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          market_id?: string
          max_attempts?: number
          next_attempt_at?: string
          session?: string
          session_date?: string
          slug?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      self_exclusions: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          starts_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          kind: string
          starts_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          kind?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          context: Json | null
          created_at: string
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source: string
          title: string
        }
        Insert: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          source: string
          title: string
        }
        Update: {
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          code: string
          id: string
          reward_paid: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          code: string
          id?: string
          reward_paid?: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          code?: string
          id?: string
          reward_paid?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted: boolean
          consent_type: string
          created_at: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted?: boolean
          consent_type: string
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted?: boolean
          consent_type?: string
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      user_limits: {
        Row: {
          daily_bet_limit: number | null
          daily_deposit_limit: number | null
          reality_check_minutes: number | null
          session_minutes_limit: number | null
          updated_at: string
          user_id: string
          weekly_bet_limit: number | null
        }
        Insert: {
          daily_bet_limit?: number | null
          daily_deposit_limit?: number | null
          reality_check_minutes?: number | null
          session_minutes_limit?: number | null
          updated_at?: string
          user_id: string
          weekly_bet_limit?: number | null
        }
        Update: {
          daily_bet_limit?: number | null
          daily_deposit_limit?: number | null
          reality_check_minutes?: number | null
          session_minutes_limit?: number | null
          updated_at?: string
          user_id?: string
          weekly_bet_limit?: number | null
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          id: string
          mission_code: string
          mission_date: string
          progress: number
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          mission_code: string
          mission_date?: string
          progress?: number
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          mission_code?: string
          mission_date?: string
          progress?: number
          user_id?: string
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
      user_streaks: {
        Row: {
          current_streak: number
          last_claim_date: string | null
          longest_streak: number
          total_claimed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_claimed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_claim_date?: string | null
          longest_streak?: number
          total_claimed?: number
          updated_at?: string
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
      withdrawal_methods: {
        Row: {
          active: boolean
          created_at: string
          fee_pct: number
          id: string
          instructions: string | null
          label: string
          max_amount: number
          min_amount: number
          priority: number
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fee_pct?: number
          id?: string
          instructions?: string | null
          label: string
          max_amount?: number
          min_amount?: number
          priority?: number
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fee_pct?: number
          id?: string
          instructions?: string | null
          label?: string
          max_amount?: number
          min_amount?: number
          priority?: number
          type?: string
          updated_at?: string
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
          priority: number
          processed_at: string | null
          processed_by: string | null
          reject_reason: string | null
          sla_due_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          method: string
          priority?: number
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          sla_due_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          bank_details?: Json | null
          created_at?: string
          id?: string
          method?: string
          priority?: number
          processed_at?: string | null
          processed_by?: string | null
          reject_reason?: string | null
          sla_due_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_winnings: {
        Row: {
          month_won: number | null
          today_won: number | null
          user_id: string | null
          username: string | null
          week_won: number | null
        }
        Relationships: []
      }
      market_source_coverage: {
        Row: {
          display_name: string | null
          market_id: string | null
          sources: string[] | null
          sources_configured: number | null
        }
        Relationships: []
      }
      result_scrape_latest: {
        Row: {
          error: string | null
          market_id: string | null
          pana: string | null
          run_at: string | null
          session: string | null
          session_date: string | null
          source: string | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _unlock_achievement: {
        Args: { _code: string; _uid: string }
        Returns: undefined
      }
      admin_adjust_balance: {
        Args: { _delta: number; _reason: string; _user_id: string }
        Returns: Json
      }
      admin_bulk_user_status: {
        Args: { _status: string; _user_ids: string[] }
        Returns: number
      }
      admin_delete_market: { Args: { _market_id: string }; Returns: Json }
      admin_exposure_heatmap: {
        Args: never
        Returns: {
          bet_count: number
          bet_number: string
          bet_type: string
          market_id: string
          total_liability: number
          total_stake: number
        }[]
      }
      admin_fraud_signals: {
        Args: never
        Returns: {
          detail: Json
          severity: string
          signal: string
          user_id: string
          username: string
        }[]
      }
      admin_risk_summary: { Args: never; Returns: Json }
      admin_set_user_status: {
        Args: { _reason: string; _status: string; _user_id: string }
        Returns: Json
      }
      apply_referral_code: { Args: { _code: string }; Returns: Json }
      approve_deposit: {
        Args: { _note?: string; _request_id: string }
        Returns: Json
      }
      approve_withdrawal: {
        Args: { _note?: string; _request_id: string }
        Returns: Json
      }
      auto_approve_deposit_by_utr: {
        Args: { _amount: number; _payee?: string; _utr: string }
        Returns: Json
      }
      claim_daily_streak: { Args: never; Returns: Json }
      claim_mission: { Args: { p_code: string }; Returns: Json }
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
      enqueue_scrape_retry: {
        Args: {
          _error: string
          _market_id: string
          _session: string
          _session_date: string
          _slug: string
          _source: string
        }
        Returns: undefined
      }
      ensure_starline_rounds: { Args: never; Returns: Json }
      find_missing_results: {
        Args: never
        Returns: {
          display_name: string
          market_id: string
          minutes_overdue: number
          scheduled_time: string
          session: string
        }[]
      }
      gen_referral_code: { Args: never; Returns: string }
      get_hook_secret: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_mission: {
        Args: { p_amount?: number; p_code: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      log_consent: {
        Args: { _type: string; _ua?: string; _version: string }
        Returns: string
      }
      place_bets: {
        Args: { _items: Json; _market_id: string; _session_date: string }
        Returns: Json
      }
      place_quick_bet: {
        Args: { p_amount: number; p_digit: number; p_round_id: string }
        Returns: Json
      }
      record_jodi_observation_and_maybe_declare: {
        Args: {
          _jodi: string
          _market_id: string
          _session_date: string
          _source: string
        }
        Returns: Json
      }
      record_observation_and_maybe_declare: {
        Args: {
          _market_id: string
          _pana: string
          _session: string
          _session_date: string
          _source: string
        }
        Returns: Json
      }
      redeem_promo_code: { Args: { _code: string }; Returns: Json }
      reject_deposit: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      reject_withdrawal: {
        Args: { _reason: string; _request_id: string }
        Returns: Json
      }
      review_kyc: {
        Args: { _decision: string; _kyc_id: string; _notes?: string }
        Returns: {
          address: string | null
          created_at: string
          dob: string | null
          doc_urls: string[]
          full_name: string | null
          id: string
          pan_masked: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: string
          tier: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_daily_cashback: { Args: { _rate?: number }; Returns: Json }
      run_due_auto_declarations: { Args: never; Returns: Json }
      set_user_limits: {
        Args: {
          _daily_bet?: number
          _daily_deposit?: number
          _reality_check_min?: number
          _session_min?: number
          _weekly_bet?: number
        }
        Returns: {
          daily_bet_limit: number | null
          daily_deposit_limit: number | null
          reality_check_minutes: number | null
          session_minutes_limit: number | null
          updated_at: string
          user_id: string
          weekly_bet_limit: number | null
        }
        SetofOptions: {
          from: "*"
          to: "user_limits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      spin_daily_wheel: { Args: never; Returns: Json }
      start_self_exclusion: {
        Args: { _kind: string }
        Returns: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          kind: string
          starts_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "self_exclusions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_kyc: {
        Args: {
          _address: string
          _dob: string
          _doc_urls: string[]
          _full_name: string
          _pan_masked: string
          _selfie_url: string
          _tier: number
        }
        Returns: {
          address: string | null
          created_at: string
          dob: string | null
          doc_urls: string[]
          full_name: string | null
          id: string
          pan_masked: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: string
          tier: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "kyc_submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      system_auto_declare: {
        Args: {
          _market_id: string
          _pana: string
          _session: string
          _session_date: string
        }
        Returns: Json
      }
      system_auto_declare_jodi: {
        Args: { _jodi: string; _market_id: string; _session_date: string }
        Returns: Json
      }
      tick_quick_play: { Args: never; Returns: Json }
      update_scrape_retry_outcome: {
        Args: { _error: string; _id: string; _success: boolean }
        Returns: undefined
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
