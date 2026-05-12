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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      generation_jobs: {
        Row: {
          anchor_url: string | null
          aspect_ratio: string | null
          completed_at: string | null
          config: Json | null
          created_at: string
          id: string
          job_seed: string | null
          model_lock: Json | null
          niche: string
          product_hash: string | null
          provider_id: string
          status: string
          target_height: number | null
          target_width: number | null
          tasks_done: number
          tasks_failed: number
          tasks_total: number
          updated_at: string
          user_id: string
          wardrobe_anchor_url: string | null
        }
        Insert: {
          anchor_url?: string | null
          aspect_ratio?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          job_seed?: string | null
          model_lock?: Json | null
          niche: string
          product_hash?: string | null
          provider_id?: string
          status?: string
          target_height?: number | null
          target_width?: number | null
          tasks_done?: number
          tasks_failed?: number
          tasks_total?: number
          updated_at?: string
          user_id: string
          wardrobe_anchor_url?: string | null
        }
        Update: {
          anchor_url?: string | null
          aspect_ratio?: string | null
          completed_at?: string | null
          config?: Json | null
          created_at?: string
          id?: string
          job_seed?: string | null
          model_lock?: Json | null
          niche?: string
          product_hash?: string | null
          provider_id?: string
          status?: string
          target_height?: number | null
          target_width?: number | null
          tasks_done?: number
          tasks_failed?: number
          tasks_total?: number
          updated_at?: string
          user_id?: string
          wardrobe_anchor_url?: string | null
        }
        Relationships: []
      }
      generation_tasks: {
        Row: {
          aspect_ratio: string | null
          attempt_count: number
          created_at: string
          id: string
          is_base: boolean
          job_id: string
          last_error: string | null
          max_attempts: number
          next_run_at: string
          parent_task_id: string | null
          product_hash: string | null
          result_url: string | null
          status: string
          target_height: number | null
          target_width: number | null
          task_seed: string
          updated_at: string
          variant_color: string | null
          variant_key: string
          variant_name: string
          view_key: string
          view_name: string
        }
        Insert: {
          aspect_ratio?: string | null
          attempt_count?: number
          created_at?: string
          id?: string
          is_base?: boolean
          job_id: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          parent_task_id?: string | null
          product_hash?: string | null
          result_url?: string | null
          status?: string
          target_height?: number | null
          target_width?: number | null
          task_seed: string
          updated_at?: string
          variant_color?: string | null
          variant_key: string
          variant_name: string
          view_key: string
          view_name: string
        }
        Update: {
          aspect_ratio?: string | null
          attempt_count?: number
          created_at?: string
          id?: string
          is_base?: boolean
          job_id?: string
          last_error?: string | null
          max_attempts?: number
          next_run_at?: string
          parent_task_id?: string | null
          product_hash?: string | null
          result_url?: string | null
          status?: string
          target_height?: number | null
          target_width?: number | null
          task_seed?: string
          updated_at?: string
          variant_color?: string | null
          variant_key?: string
          variant_name?: string
          view_key?: string
          view_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "generation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          current_period_end: string | null
          full_name: string | null
          id: string
          is_unlimited: boolean
          stripe_customer_id: string | null
          subscription_status: string | null
          subscription_tier: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          current_period_end?: string | null
          full_name?: string | null
          id: string
          is_unlimited?: boolean
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          current_period_end?: string | null
          full_name?: string | null
          id?: string
          is_unlimited?: boolean
          stripe_customer_id?: string | null
          subscription_status?: string | null
          subscription_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_prompts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          prompt_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          prompt_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          prompt_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_custom_colors: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_prompt_configs: {
        Row: {
          config_data: Json
          config_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config_data?: Json
          config_type: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config_data?: Json
          config_type?: string
          created_at?: string
          id?: string
          updated_at?: string
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
      whitelisted_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cancel_job: { Args: { p_job_id: string }; Returns: Json }
      admin_delete_user: { Args: { target_user_id: string }; Returns: Json }
      admin_set_credits: {
        Args: { new_credits: number; target_user_id: string }
        Returns: Json
      }
      admin_update_user: {
        Args: {
          p_full_name?: string
          p_is_unlimited?: boolean
          p_subscription_tier?: string
          target_user_id: string
        }
        Returns: Json
      }
      decrement_credits: {
        Args: { amount: number; user_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_analytics: { Args: { p_days?: number }; Returns: Json }
      get_admin_job_tasks: { Args: { p_job_id: string }; Returns: Json }
      get_admin_jobs: {
        Args: {
          p_email?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
        }
        Returns: Json
      }
      get_admin_profiles: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_admin_stats: { Args: never; Returns: Json }
      get_system_prompt: { Args: { p_key: string }; Returns: string }
      get_user_profile: { Args: { user_id: string }; Returns: Json }
      give_admin_credits: {
        Args: { amount: number; target_email: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_credits: {
        Args: { amount: number; user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_whitelisted: { Args: { user_email: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reap_stale_jobs: { Args: { max_age_minutes?: number }; Returns: Json }
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
