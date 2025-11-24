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
      camps: {
        Row: {
          address: string | null
          capacity: number | null
          created_at: string | null
          id: string
          location_lat: number
          location_lon: number
          manager_id: string | null
          name: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          created_at?: string | null
          id?: string
          location_lat: number
          location_lon: number
          manager_id?: string | null
          name: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          created_at?: string | null
          id?: string
          location_lat?: number
          location_lon?: number
          manager_id?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "camps_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          current_lat: number | null
          current_lon: number | null
          id: string
          status: Database["public"]["Enums"]["driver_status"] | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          current_lat?: number | null
          current_lon?: number | null
          id: string
          status?: Database["public"]["Enums"]["driver_status"] | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          current_lat?: number | null
          current_lon?: number | null
          id?: string
          status?: Database["public"]["Enums"]["driver_status"] | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      flood_zones: {
        Row: {
          avg_flood_depth: number | null
          center_lat: number
          center_lon: number
          created_at: string | null
          current_risk_score: number | null
          id: string
          last_updated: string | null
          predicted_rainfall: number | null
          zone_name: string
        }
        Insert: {
          avg_flood_depth?: number | null
          center_lat: number
          center_lon: number
          created_at?: string | null
          current_risk_score?: number | null
          id?: string
          last_updated?: string | null
          predicted_rainfall?: number | null
          zone_name: string
        }
        Update: {
          avg_flood_depth?: number | null
          center_lat?: number
          center_lon?: number
          created_at?: string | null
          current_risk_score?: number | null
          id?: string
          last_updated?: string | null
          predicted_rainfall?: number | null
          zone_name?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          assigned_driver_id: string | null
          citizen_id: string
          created_at: string | null
          description: string | null
          emergency_type: string
          id: string
          location_lat: number
          location_lon: number
          safe_route: Json | null
          status: Database["public"]["Enums"]["incident_status"] | null
          updated_at: string | null
        }
        Insert: {
          assigned_driver_id?: string | null
          citizen_id: string
          created_at?: string | null
          description?: string | null
          emergency_type: string
          id?: string
          location_lat: number
          location_lon: number
          safe_route?: Json | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          updated_at?: string | null
        }
        Update: {
          assigned_driver_id?: string | null
          citizen_id?: string
          created_at?: string | null
          description?: string | null
          emergency_type?: string
          id?: string
          location_lat?: number
          location_lon?: number
          safe_route?: Json | null
          status?: Database["public"]["Enums"]["incident_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_citizen_id_fkey"
            columns: ["citizen_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          camp_id: string
          id: string
          item_name: string
          last_updated: string | null
          min_threshold: number | null
          quantity: number | null
          unit: string | null
          updated_by: string | null
        }
        Insert: {
          camp_id: string
          id?: string
          item_name: string
          last_updated?: string | null
          min_threshold?: number | null
          quantity?: number | null
          unit?: string | null
          updated_by?: string | null
        }
        Update: {
          camp_id?: string
          id?: string
          item_name?: string
          last_updated?: string | null
          min_threshold?: number | null
          quantity?: number | null
          unit?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          vehicle_number: string
          vehicle_type: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          vehicle_number: string
          vehicle_type: string
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          vehicle_number?: string
          vehicle_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      driver_status: "available" | "busy" | "offline"
      incident_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
      user_role: "citizen" | "driver" | "pharmacist"
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
      driver_status: ["available", "busy", "offline"],
      incident_status: [
        "pending",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
      ],
      user_role: ["citizen", "driver", "pharmacist"],
    },
  },
} as const
