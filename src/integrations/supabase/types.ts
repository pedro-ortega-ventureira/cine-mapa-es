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
      contact_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          professional_id: string
          read: boolean
          sender_email: string
          sender_name: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          professional_id: string
          read?: boolean
          sender_email: string
          sender_name: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          professional_id?: string
          read?: boolean
          sender_email?: string
          sender_name?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      filmography_items: {
        Row: {
          created_at: string
          credit_type: Database["public"]["Enums"]["credit_type"] | null
          custom_note: string | null
          featured: boolean
          id: string
          original_title: string | null
          poster_url: string | null
          professional_id: string
          role_in_production: string | null
          sort_order: number
          synopsis: string | null
          title: string
          tmdb_id: number | null
          tmdb_rating: number | null
          type: Database["public"]["Enums"]["filmography_type"]
          year: number | null
        }
        Insert: {
          created_at?: string
          credit_type?: Database["public"]["Enums"]["credit_type"] | null
          custom_note?: string | null
          featured?: boolean
          id?: string
          original_title?: string | null
          poster_url?: string | null
          professional_id: string
          role_in_production?: string | null
          sort_order?: number
          synopsis?: string | null
          title: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          type?: Database["public"]["Enums"]["filmography_type"]
          year?: number | null
        }
        Update: {
          created_at?: string
          credit_type?: Database["public"]["Enums"]["credit_type"] | null
          custom_note?: string | null
          featured?: boolean
          id?: string
          original_title?: string | null
          poster_url?: string | null
          professional_id?: string
          role_in_production?: string | null
          sort_order?: number
          synopsis?: string | null
          title?: string
          tmdb_id?: number | null
          tmdb_rating?: number | null
          type?: Database["public"]["Enums"]["filmography_type"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "filmography_items_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          errors: Json | null
          filename: string | null
          id: string
          imported_by: string | null
          rows_error: number
          rows_inserted: number
          rows_updated: number
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          filename?: string | null
          id?: string
          imported_by?: string | null
          rows_error?: number
          rows_inserted?: number
          rows_updated?: number
        }
        Update: {
          created_at?: string
          errors?: Json | null
          filename?: string | null
          id?: string
          imported_by?: string | null
          rows_error?: number
          rows_inserted?: number
          rows_updated?: number
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          autonomous_community: string
          code: string
          created_at: string
          lat: number | null
          lng: number | null
          name: string
          population: number
          postal_codes: string[] | null
          province: string
        }
        Insert: {
          autonomous_community: string
          code: string
          created_at?: string
          lat?: number | null
          lng?: number | null
          name: string
          population?: number
          postal_codes?: string[] | null
          province: string
        }
        Update: {
          autonomous_community?: string
          code?: string
          created_at?: string
          lat?: number | null
          lng?: number | null
          name?: string
          population?: number
          postal_codes?: string[] | null
          province?: string
        }
        Relationships: []
      }
      professionals: {
        Row: {
          alias: string | null
          availability: Database["public"]["Enums"]["availability_enum"] | null
          awards: Json | null
          bio: string | null
          birth_year: number | null
          date_joined: string
          education: Json | null
          email: string | null
          equipment_owned: string[] | null
          full_name: string
          gender: Database["public"]["Enums"]["gender_enum"] | null
          id: string
          languages: string[] | null
          municipality_code: string | null
          nationality: string | null
          nif_cif: string | null
          phone: string | null
          photo_url: string | null
          primary_role: string | null
          production_types: string[] | null
          profile_views: number
          raw_postal_code: string | null
          reel_url: string | null
          secondary_roles: string[] | null
          slug: string
          social_links: Json | null
          tags: string[] | null
          union_membership: string | null
          updated_at: string
          verified: boolean
          website: string | null
          willing_to_travel: boolean | null
          works_remotely: boolean | null
          years_of_experience: number | null
        }
        Insert: {
          alias?: string | null
          availability?: Database["public"]["Enums"]["availability_enum"] | null
          awards?: Json | null
          bio?: string | null
          birth_year?: number | null
          date_joined?: string
          education?: Json | null
          email?: string | null
          equipment_owned?: string[] | null
          full_name: string
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          languages?: string[] | null
          municipality_code?: string | null
          nationality?: string | null
          nif_cif?: string | null
          phone?: string | null
          photo_url?: string | null
          primary_role?: string | null
          production_types?: string[] | null
          profile_views?: number
          raw_postal_code?: string | null
          reel_url?: string | null
          secondary_roles?: string[] | null
          slug: string
          social_links?: Json | null
          tags?: string[] | null
          union_membership?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          willing_to_travel?: boolean | null
          works_remotely?: boolean | null
          years_of_experience?: number | null
        }
        Update: {
          alias?: string | null
          availability?: Database["public"]["Enums"]["availability_enum"] | null
          awards?: Json | null
          bio?: string | null
          birth_year?: number | null
          date_joined?: string
          education?: Json | null
          email?: string | null
          equipment_owned?: string[] | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender_enum"] | null
          id?: string
          languages?: string[] | null
          municipality_code?: string | null
          nationality?: string | null
          nif_cif?: string | null
          phone?: string | null
          photo_url?: string | null
          primary_role?: string | null
          production_types?: string[] | null
          profile_views?: number
          raw_postal_code?: string | null
          reel_url?: string | null
          secondary_roles?: string[] | null
          slug?: string
          social_links?: Json | null
          tags?: string[] | null
          union_membership?: string | null
          updated_at?: string
          verified?: boolean
          website?: string | null
          willing_to_travel?: boolean | null
          works_remotely?: boolean | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipalities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "professionals_municipality_code_fkey"
            columns: ["municipality_code"]
            isOneToOne: false
            referencedRelation: "municipality_stats"
            referencedColumns: ["code"]
          },
        ]
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
    }
    Views: {
      municipality_stats: {
        Row: {
          autonomous_community: string | null
          code: string | null
          lat: number | null
          lng: number | null
          name: string | null
          population: number | null
          professionals_count: number | null
          province: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_profile_views: { Args: { _slug: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "editor" | "user"
      availability_enum: "Disponible" | "No disponible" | "Bajo consulta"
      credit_type:
        | "director"
        | "writer"
        | "producer"
        | "cast"
        | "crew"
        | "composer"
        | "cinematographer"
        | "editor"
        | "sound"
        | "other"
      filmography_type: "movie" | "tv" | "short" | "other"
      gender_enum: "Hombre" | "Mujer" | "No binario" | "Prefiero no decirlo"
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
      app_role: ["admin", "editor", "user"],
      availability_enum: ["Disponible", "No disponible", "Bajo consulta"],
      credit_type: [
        "director",
        "writer",
        "producer",
        "cast",
        "crew",
        "composer",
        "cinematographer",
        "editor",
        "sound",
        "other",
      ],
      filmography_type: ["movie", "tv", "short", "other"],
      gender_enum: ["Hombre", "Mujer", "No binario", "Prefiero no decirlo"],
    },
  },
} as const
