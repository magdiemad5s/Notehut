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
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          embedding?: string
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          content?: string
          embedding?: string
          created_at?: string
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
          created_at?: string
          updated_at?: string
        }
      }
      user_weaknesses: {
        Row: {
          id: string
          user_id: string
          topic_name: string
          weakness_score: number
          last_assessed: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_name: string
          weakness_score: number
          last_assessed?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_name?: string
          weakness_score?: number
          last_assessed?: string
        }
      }
      shared_exams: {
        Row: {
          id: string
          owner_id: string
          title: string
          questions_json: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          questions_json: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          questions_json?: string
          created_at?: string
        }
      }
      app_settings: {
        Row: {
          key: string
          value: boolean
        }
        Insert: {
          key: string
          value: boolean
        }
        Update: {
          key?: string
          value?: boolean
        }
      }
      app_secrets: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
      }
    }
  }
}

export interface BYOKConfig {
  llmProvider: string
  llmBaseURL: string
  llmApiKey: string
  llmModelName: string
  embeddingsBaseURL: string
  embeddingsModel: string
}

export type LlmProvider = 'custom' | 'gemini' | 'deepseek'

export interface McqQuestion {
  type: 'mcq'
  question: string
  options: string[]
  correctIndex: number
  topicTags: string[]
}

export interface CheckboxQuestion {
  type: 'checkbox'
  question: string
  options: string[]
  correctIndices: number[]
  topicTags: string[]
}

export interface EssayQuestion {
  type: 'essay'
  question: string
  modelAnswer: string
  topicTags: string[]
}

export type Question = McqQuestion | CheckboxQuestion | EssayQuestion

export interface Exam {
  id: string
  title: string
  questions: Question[]
  created_at: string
}

export interface GradeResult {
  score: number
  totalQuestions: number
  feedback: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type OcrStatus = 'pending' | 'processing' | 'completed' | 'failed'
