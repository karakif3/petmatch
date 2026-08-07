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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      adoption_interests: {
        Row: {
          applicant_id: string
          conversation_id: string | null
          created_at: string
          id: string
          note: string | null
          pet_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["adoption_status"]
        }
        Insert: {
          applicant_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          pet_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["adoption_status"]
        }
        Update: {
          applicant_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          pet_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["adoption_status"]
        }
        Relationships: [
          {
            foreignKeyName: "adoption_interests_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adoption_interests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adoption_interests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      app_user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          app_version: string | null
          created_at: string
          error_name: string
          id: number
          message: string
          route: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          error_name: string
          id?: never
          message: string
          route?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          error_name?: string
          id?: never
          message?: string
          route?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
        }
        Relationships: []
      }
      discovery_preferences: {
        Row: {
          language: string
          max_age_years: number | null
          max_distance_km: number
          min_age_years: number | null
          notify_on_match: boolean
          notify_on_message: boolean
          notify_on_new_candidates: boolean
          require_owner_photo: boolean
          require_owner_social: boolean
          require_verified_owner: boolean
          species: Database["public"]["Enums"]["species"][]
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string
          max_age_years?: number | null
          max_distance_km?: number
          min_age_years?: number | null
          notify_on_match?: boolean
          notify_on_message?: boolean
          notify_on_new_candidates?: boolean
          require_owner_photo?: boolean
          require_owner_social?: boolean
          require_verified_owner?: boolean
          species?: Database["public"]["Enums"]["species"][]
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string
          max_age_years?: number | null
          max_distance_km?: number
          min_age_years?: number | null
          notify_on_match?: boolean
          notify_on_message?: boolean
          notify_on_new_candidates?: boolean
          require_owner_photo?: boolean
          require_owner_social?: boolean
          require_verified_owner?: boolean
          species?: Database["public"]["Enums"]["species"][]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted: boolean
          created_at: string
          document_type: string
          document_version: string
          id: number
          user_id: string
        }
        Insert: {
          accepted: boolean
          created_at?: string
          document_type: string
          document_version: string
          id?: never
          user_id: string
        }
        Update: {
          accepted?: boolean
          created_at?: string
          document_type?: string
          document_version?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          is_active: boolean
          matched_goals: Database["public"]["Enums"]["match_goal"][]
          pet_a_id: string
          pet_b_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          matched_goals?: Database["public"]["Enums"]["match_goal"][]
          pet_a_id: string
          pet_b_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          matched_goals?: Database["public"]["Enums"]["match_goal"][]
          pet_a_id?: string
          pet_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_pet_a_id_fkey"
            columns: ["pet_a_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_pet_b_id_fkey"
            columns: ["pet_b_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_feedback: {
        Row: {
          conversation_id: string
          created_at: string
          meetup_id: string | null
          outcome: Database["public"]["Enums"]["meetup_outcome"]
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          meetup_id?: string | null
          outcome: Database["public"]["Enums"]["meetup_outcome"]
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          meetup_id?: string | null
          outcome?: Database["public"]["Enums"]["meetup_outcome"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetup_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_feedback_meetup_id_fkey"
            columns: ["meetup_id"]
            isOneToOne: false
            referencedRelation: "meetups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetup_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetup_places: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_verified: boolean
          name: string
          note: string | null
          region_slug: string
          sort_order: number
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          name: string
          note?: string | null
          region_slug: string
          sort_order?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_verified?: boolean
          name?: string
          note?: string | null
          region_slug?: string
          sort_order?: number
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetup_places_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "meetup_places_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meetups: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          place_id: string
          proposed_by: string
          responded_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["meetup_status"]
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          place_id: string
          proposed_by: string
          responded_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["meetup_status"]
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          place_id?: string
          proposed_by?: string
          responded_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["meetup_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meetups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "meetup_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetups_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_items: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["moderation_kind"]
          note: string | null
          payload: Json
          reason: Database["public"]["Enums"]["report_reason"] | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["moderation_status"]
          subject_pet_id: string | null
          subject_user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["moderation_kind"]
          note?: string | null
          payload?: Json
          reason?: Database["public"]["Enums"]["report_reason"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status"]
          subject_pet_id?: string | null
          subject_user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["moderation_kind"]
          note?: string | null
          payload?: Json
          reason?: Database["public"]["Enums"]["report_reason"] | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["moderation_status"]
          subject_pet_id?: string | null
          subject_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_items_subject_pet_id_fkey"
            columns: ["subject_pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_items_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempted_at: string
          event_id: string
          event_type: string
          last_error: string | null
          recipient_id: string
          sent_at: string | null
          status: string
          ticket_id: string | null
        }
        Insert: {
          attempted_at?: string
          event_id: string
          event_type: string
          last_error?: string | null
          recipient_id: string
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
        }
        Update: {
          attempted_at?: string
          event_id?: string
          event_type?: string
          last_error?: string | null
          recipient_id?: string
          sent_at?: string | null
          status?: string
          ticket_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_photos: {
        Row: {
          created_at: string
          id: string
          pet_id: string
          position: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          pet_id: string
          position?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          pet_id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_photos_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          adoption_confirmed_at: string | null
          bio: string | null
          birth_date: string | null
          breed: string | null
          city: string | null
          created_at: string
          details_completed_at: string | null
          energy_level: number
          gender: Database["public"]["Enums"]["pet_gender"]
          goals: Database["public"]["Enums"]["match_goal"][]
          good_with_cats: boolean
          good_with_dogs: boolean
          good_with_kids: boolean
          id: string
          is_active: boolean
          is_neutered: boolean
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments: string[]
          updated_at: string
        }
        Insert: {
          adoption_confirmed_at?: string | null
          bio?: string | null
          birth_date?: string | null
          breed?: string | null
          city?: string | null
          created_at?: string
          details_completed_at?: string | null
          energy_level?: number
          gender: Database["public"]["Enums"]["pet_gender"]
          goals?: Database["public"]["Enums"]["match_goal"][]
          good_with_cats?: boolean
          good_with_dogs?: boolean
          good_with_kids?: boolean
          id?: string
          is_active?: boolean
          is_neutered?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          size?: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments?: string[]
          updated_at?: string
        }
        Update: {
          adoption_confirmed_at?: string | null
          bio?: string | null
          birth_date?: string | null
          breed?: string | null
          city?: string | null
          created_at?: string
          details_completed_at?: string | null
          energy_level?: number
          gender?: Database["public"]["Enums"]["pet_gender"]
          goals?: Database["public"]["Enums"]["match_goal"][]
          good_with_cats?: boolean
          good_with_dogs?: boolean
          good_with_kids?: boolean
          id?: string
          is_active?: boolean
          is_neutered?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          size?: Database["public"]["Enums"]["pet_size"]
          species?: Database["public"]["Enums"]["species"]
          temperaments?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          properties: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: never
          properties?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: never
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          display_name: string | null
          gender: string | null
          id: string
          interests: string[]
          last_active_at: string
          onboarded_at: string | null
          owner_social_open: boolean
          owner_visibility: Database["public"]["Enums"]["owner_visibility"]
          region_slug: string | null
          require_visible_owner: boolean
          updated_at: string
          verification_status:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          verified_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id: string
          interests?: string[]
          last_active_at?: string
          onboarded_at?: string | null
          owner_social_open?: boolean
          owner_visibility?: Database["public"]["Enums"]["owner_visibility"]
          region_slug?: string | null
          require_visible_owner?: boolean
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          verified_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          gender?: string | null
          id?: string
          interests?: string[]
          last_active_at?: string
          onboarded_at?: string | null
          owner_social_open?: boolean
          owner_visibility?: Database["public"]["Enums"]["owner_visibility"]
          region_slug?: string | null
          require_visible_owner?: boolean
          updated_at?: string
          verification_status?:
            | Database["public"]["Enums"]["moderation_status"]
            | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_region_slug_fkey"
            columns: ["region_slug"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["slug"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          city: string | null
          is_active: boolean
          is_pilot: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          city?: string | null
          is_active?: boolean
          is_pilot?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          city?: string | null
          is_active?: boolean
          is_pilot?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      swipes: {
        Row: {
          actor_id: string
          created_at: string
          direction: Database["public"]["Enums"]["swipe_direction"]
          from_pet_id: string
          id: string
          is_super: boolean
          to_pet_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["swipe_direction"]
          from_pet_id: string
          id?: string
          is_super?: boolean
          to_pet_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["swipe_direction"]
          from_pet_id?: string
          id?: string
          is_super?: boolean
          to_pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_from_pet_id_fkey"
            columns: ["from_pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swipes_to_pet_id_fkey"
            columns: ["to_pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activity_bucket: { Args: { p_last_active: string }; Returns: string }
      block_user: { Args: { p_blocked_id: string }; Returns: undefined }
      blocked_user_ids: { Args: never; Returns: string[] }
      can_access_conversation_realtime: {
        Args: { p_topic: string }
        Returns: boolean
      }
      cancel_meetup: { Args: { p_meetup_id: string }; Returns: undefined }
      capture_client_error: {
        Args: {
          p_app_version?: string
          p_error_name: string
          p_message: string
          p_route?: string
          p_stack?: string
        }
        Returns: undefined
      }
      complete_adoption: { Args: { p_interest_id: string }; Returns: undefined }
      confirm_adoption_listing: {
        Args: { p_pet_id: string }
        Returns: undefined
      }
      conversation_meetup: {
        Args: { p_conversation_id: string }
        Returns: {
          id: string
          mine: boolean
          place_id: string
          place_name: string
          place_note: string
          proposed_by: string
          scheduled_at: string
          status: Database["public"]["Enums"]["meetup_status"]
        }[]
      }
      discover_pets: {
        Args: {
          p_limit?: number
          p_owner_genders?: string[]
          p_owner_max_age?: number
          p_owner_min_age?: number
          p_pet_id: string
        }
        Returns: {
          activity_bucket: string
          bio: string
          birth_date: string
          breed: string
          city: string
          distance_bucket: string
          energy_level: number
          gender: Database["public"]["Enums"]["pet_gender"]
          goals: Database["public"]["Enums"]["match_goal"][]
          good_with_cats: boolean
          good_with_dogs: boolean
          good_with_kids: boolean
          id: string
          is_neutered: boolean
          name: string
          owner_id: string
          owner_visible: boolean
          photo_paths: string[]
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments: string[]
        }[]
      }
      discover_playdate_pets: {
        Args: {
          p_limit?: number
          p_owner_genders?: string[]
          p_owner_max_age?: number
          p_owner_min_age?: number
          p_pet_id: string
        }
        Returns: {
          activity_bucket: string
          bio: string
          birth_date: string
          breed: string
          city: string
          distance_bucket: string
          energy_level: number
          gender: Database["public"]["Enums"]["pet_gender"]
          goals: Database["public"]["Enums"]["match_goal"][]
          good_with_cats: boolean
          good_with_dogs: boolean
          good_with_kids: boolean
          id: string
          is_neutered: boolean
          name: string
          owner_age_bucket: string
          owner_avatar_path: string
          owner_bio: string
          owner_display_name: string
          owner_gender: string
          owner_id: string
          owner_social_open: boolean
          owner_verified: boolean
          owner_visible: boolean
          photo_paths: string[]
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments: string[]
        }[]
      }
      distance_bucket: { Args: { km: number }; Returns: string }
      express_adoption_interest: {
        Args: { p_note?: string; p_pet_id: string }
        Returns: string
      }
      get_conversation_owner_profile: {
        Args: { p_conversation_id: string }
        Returns: {
          activity_bucket: string
          age_bucket: string
          avatar_path: string
          bio: string
          display_name: string
          gender: string
          social_open: boolean
          user_id: string
          verified: boolean
        }[]
      }
      get_moderation_queue: {
        Args: { p_limit?: number }
        Returns: {
          age_hours: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["moderation_kind"]
          note: string
          payload: Json
          reason: Database["public"]["Enums"]["report_reason"]
          sla_breached: boolean
          status: Database["public"]["Enums"]["moderation_status"]
          subject_pet_id: string
          subject_user_id: string
        }[]
      }
      get_operations_metrics: { Args: never; Returns: Json }
      haversine_km: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      is_blocked_between: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      is_match_participant: { Args: { p_match_id: string }; Returns: boolean }
      is_moderator: { Args: never; Returns: boolean }
      list_adoptable_pets: {
        Args: {
          p_city?: string
          p_limit?: number
          p_species?: Database["public"]["Enums"]["species"][]
        }
        Returns: {
          activity_bucket: string
          already_applied: boolean
          bio: string
          birth_date: string
          breed: string
          city: string
          gender: Database["public"]["Enums"]["pet_gender"]
          good_with_cats: boolean
          good_with_dogs: boolean
          good_with_kids: boolean
          id: string
          is_neutered: boolean
          name: string
          owner_id: string
          owner_verified: boolean
          photo_paths: string[]
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments: string[]
        }[]
      }
      list_meetup_place_candidates: {
        Args: never
        Returns: {
          id: string
          is_active: boolean
          is_verified: boolean
          name: string
          note: string
          region_name: string
          region_slug: string
        }[]
      }
      list_meetup_places: {
        Args: never
        Returns: {
          id: string
          name: string
          note: string
        }[]
      }
      list_my_conversations: {
        Args: never
        Returns: {
          ask_meetup_feedback: boolean
          awaiting_my_reply: boolean
          conversation_id: string
          conversation_kind: string
          counterpart_display_name: string
          counterpart_user_id: string
          is_active: boolean
          last_message: string
          last_message_at: string
          pet_id: string
          pet_name: string
          pet_photo_path: string
          unread_count: number
        }[]
      }
      mark_messages_read: {
        Args: { p_conversation_id: string }
        Returns: number
      }
      mark_onboarding_complete: { Args: never; Returns: undefined }
      mark_pet_details_completed: {
        Args: { p_pet_id: string }
        Returns: undefined
      }
      matched_owner_ids: { Args: never; Returns: string[] }
      my_conversation_ids: { Args: never; Returns: string[] }
      my_match_ids: { Args: never; Returns: string[] }
      my_pet_ids: { Args: never; Returns: string[] }
      owner_age_bucket: { Args: { p_birth_date: string }; Returns: string }
      owner_meetup_rate: { Args: { p_user_id: string }; Returns: number }
      owner_response_rate: { Args: { p_owner_id: string }; Returns: number }
      owns_pet: { Args: { p_pet_id: string }; Returns: boolean }
      pause_stale_adoption_listings: {
        Args: { p_days?: number }
        Returns: number
      }
      pending_likes: {
        Args: { p_limit?: number }
        Returns: {
          activity_bucket: string
          bio: string
          birth_date: string
          breed: string
          city: string
          distance_bucket: string
          energy_level: number
          gender: Database["public"]["Enums"]["pet_gender"]
          goals: Database["public"]["Enums"]["match_goal"][]
          good_with_cats: boolean
          good_with_dogs: boolean
          good_with_kids: boolean
          id: string
          is_neutered: boolean
          is_super: boolean
          liked_at: string
          name: string
          owner_age_bucket: string
          owner_avatar_path: string
          owner_bio: string
          owner_display_name: string
          owner_gender: string
          owner_id: string
          owner_social_open: boolean
          owner_verified: boolean
          owner_visible: boolean
          photo_paths: string[]
          size: Database["public"]["Enums"]["pet_size"]
          species: Database["public"]["Enums"]["species"]
          temperaments: string[]
        }[]
      }
      pending_likes_count: { Args: never; Returns: number }
      propose_meetup: {
        Args: {
          p_conversation_id: string
          p_place_id: string
          p_scheduled_at: string
        }
        Returns: string
      }
      record_legal_acceptances: {
        Args: {
          p_document_version: string
          p_location_consent?: boolean
          p_privacy_notice_acknowledged: boolean
          p_public_profile_consent?: boolean
          p_terms_accepted: boolean
        }
        Returns: undefined
      }
      record_meetup_feedback: {
        Args: {
          p_conversation_id: string
          p_outcome: Database["public"]["Enums"]["meetup_outcome"]
        }
        Returns: undefined
      }
      record_optional_legal_consent: {
        Args: {
          p_accepted: boolean
          p_consent_type: string
          p_document_version: string
        }
        Returns: undefined
      }
      region_density: {
        Args: never
        Returns: {
          is_pilot: boolean
          name: string
          onboarded: number
          slug: string
          with_active_pet: number
        }[]
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      replace_pet_photo_order: {
        Args: { p_pet_id: string; p_storage_paths: string[] }
        Returns: undefined
      }
      report_content: {
        Args: {
          p_note?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_subject_pet_id?: string
          p_subject_user_id?: string
        }
        Returns: string
      }
      respond_to_adoption_interest: {
        Args: { p_accept: boolean; p_interest_id: string }
        Returns: string
      }
      respond_to_meetup: {
        Args: { p_accept: boolean; p_meetup_id: string }
        Returns: undefined
      }
      review_moderation_item: {
        Args: {
          p_decision: Database["public"]["Enums"]["moderation_status"]
          p_item_id: string
          p_note?: string
        }
        Returns: undefined
      }
      security_surface_report: {
        Args: never
        Returns: {
          finding: string
          object: string
          severity: string
        }[]
      }
      set_meetup_place_verification: {
        Args: { p_note?: string; p_place_id: string; p_verified: boolean }
        Returns: undefined
      }
      set_my_region: { Args: { p_region_slug: string }; Returns: undefined }
      shares_active_match_with: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      submit_verification: {
        Args: { p_pet_id: string; p_photo_path: string }
        Returns: string
      }
      swipe_pet: {
        Args: {
          p_direction: Database["public"]["Enums"]["swipe_direction"]
          p_from_pet_id: string
          p_is_super?: boolean
          p_to_pet_id: string
        }
        Returns: string
      }
      touch_last_active: { Args: never; Returns: undefined }
      track_product_event: {
        Args: { p_event_name: string; p_properties?: Json }
        Returns: undefined
      }
      unmatch: { Args: { p_match_id: string }; Returns: undefined }
      unmatch_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      unregister_push_token: { Args: { p_token: string }; Returns: undefined }
      update_my_discovery_filters: {
        Args: {
          p_max_age_years: number
          p_max_distance_km: number
          p_min_age_years: number
          p_notify_on_new_candidates: boolean
          p_require_owner_photo: boolean
          p_require_owner_social: boolean
          p_require_verified_owner: boolean
          p_require_visible_owner: boolean
          p_species: Database["public"]["Enums"]["species"][]
        }
        Returns: undefined
      }
      update_my_language: { Args: { p_language: string }; Returns: undefined }
      update_my_owner_details: {
        Args: {
          p_avatar_path: string
          p_bio: string
          p_birth_date: string
          p_display_name: string
          p_gender: string
          p_interests: string[]
          p_owner_social_open: boolean
          p_owner_visibility: Database["public"]["Enums"]["owner_visibility"]
        }
        Returns: undefined
      }
      update_my_pet_profile: {
        Args: {
          p_bio: string
          p_birth_date: string
          p_breed: string
          p_energy_level: number
          p_good_with_cats: boolean
          p_good_with_dogs: boolean
          p_good_with_kids: boolean
          p_is_neutered: boolean
          p_name: string
          p_pet_id: string
          p_size: Database["public"]["Enums"]["pet_size"]
          p_temperaments: string[]
        }
        Returns: string
      }
      update_my_profile: {
        Args: {
          p_city: string
          p_display_name: string
          p_latitude: number
          p_longitude: number
          p_owner_visibility: Database["public"]["Enums"]["owner_visibility"]
          p_pet_name: string
          p_update_location: boolean
        }
        Returns: string
      }
      update_notification_preferences: {
        Args: { p_notify_on_match: boolean; p_notify_on_message: boolean }
        Returns: undefined
      }
      update_owner_discovery_filters: {
        Args: {
          p_require_owner_photo: boolean
          p_require_owner_social: boolean
          p_require_verified_owner: boolean
        }
        Returns: undefined
      }
      visible_pet_ids: { Args: never; Returns: string[] }
      withdraw_adoption_interest: {
        Args: { p_interest_id: string }
        Returns: undefined
      }
    }
    Enums: {
      adoption_status: "pending" | "accepted" | "declined" | "withdrawn"
      match_goal: "playdate" | "adoption"
      meetup_outcome: "met" | "not_yet" | "declined"
      meetup_status: "proposed" | "accepted" | "declined" | "cancelled"
      moderation_kind: "report" | "verification" | "photo"
      moderation_status: "pending" | "approved" | "rejected"
      owner_visibility: "hidden" | "after_match" | "public"
      pet_gender: "male" | "female"
      pet_size: "small" | "medium" | "large"
      report_reason:
        | "spam"
        | "harassment"
        | "fake_profile"
        | "animal_welfare"
        | "other"
        | "commercial_sale"
      species: "cat" | "dog"
      swipe_direction: "like" | "pass"
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
      adoption_status: ["pending", "accepted", "declined", "withdrawn"],
      match_goal: ["playdate", "adoption"],
      meetup_outcome: ["met", "not_yet", "declined"],
      meetup_status: ["proposed", "accepted", "declined", "cancelled"],
      moderation_kind: ["report", "verification", "photo"],
      moderation_status: ["pending", "approved", "rejected"],
      owner_visibility: ["hidden", "after_match", "public"],
      pet_gender: ["male", "female"],
      pet_size: ["small", "medium", "large"],
      report_reason: [
        "spam",
        "harassment",
        "fake_profile",
        "animal_welfare",
        "other",
        "commercial_sale",
      ],
      species: ["cat", "dog"],
      swipe_direction: ["like", "pass"],
    },
  },
} as const
