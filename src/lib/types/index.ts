// Database types are placeholder — replace with supabase gen types output

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          email: string
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          is_admin?: boolean
          created_at?: string
        }
      }
      topics: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          topic_id: string
          filename: string
          storage_path: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_id: string
          filename: string
          storage_path: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string
          filename?: string
          storage_path?: string
          created_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          content: string
          embedding: string
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: string
        }
      }
      ocr_queue: {
        Row: {
          id: string
          user_id: string
          document_id: string
          file_url: string
          status: string
          extracted_text: string | null
          error: string | null
          claim_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          file_url: string
          status?: string
          extracted_text?: string | null
          error?: string | null
          claim_token?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          file_url?: string
          status?: string
          extracted_text?: string | null
          error?: string | null
          claim_token?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_weaknesses: {
        Row: {
          id: string
          user_id: string
          topic_name: string
          error_count: number
          last_failed_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_name: string
          error_count?: number
          last_failed_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_name?: string
          error_count?: number
          last_failed_at?: string
        }
      }
      shared_exams: {
        Row: {
          id: string
          topic_id: string
          creator_id: string
          title: string
          questions_json: unknown
          is_public: boolean
          created_at: string
        }
        Insert: {
          id?: string
          topic_id: string
          creator_id: string
          title: string
          questions_json: unknown
          is_public?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          topic_id?: string
          creator_id?: string
          title?: string
          questions_json?: unknown
          is_public?: boolean
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          key: string
          value: unknown
        }
        Insert: {
          key: string
          value: unknown
        }
        Update: {
          key?: string
          value?: unknown
        }
      }
      app_secrets: {
        Row: {
          key: string
          value: unknown
        }
        Insert: {
          key: string
          value: unknown
        }
        Update: {
          key?: string
          value?: unknown
        }
      }
    }
  }
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'embedded' | 'failed'
