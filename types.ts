export interface GlobalDimension {
  fact_keywords: Record<string, string>;
  description: string;
  highlights: Record<string, string>;
  lowlights: Record<string, string>;
}

export interface SectionDimension {
  id: string;
  timestamp: string;
  keywords: Record<string, string>;
  description: string;
  lyrics: string;
  highlights: Record<string, string>;
  lowlights: Record<string, string>;
}

export interface PipelineInfo {
  processing_status: string;
  audio_duration_seconds: string;
  processing_time_seconds: string;
}

export interface MusicData {
  global_dimension: GlobalDimension;
  section_dimension: SectionDimension[];
  _pipeline_info?: PipelineInfo;
  [key: string]: any; // Allow flexibility for other fields
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export enum AppMode {
  UPLOAD = 'UPLOAD',
  EDITOR = 'EDITOR',
  SETTINGS = 'SETTINGS',
}

export enum ApiProvider {
  GEMINI = 'GEMINI',
  CUSTOM = 'CUSTOM',
}

export interface ApiSettings {
  provider: ApiProvider;
  customUrl: string;
  customMethod: 'POST' | 'GET';
  customHeaders: string; // Stored as JSON string
  customBodyTemplate: string;
  customResponsePath: string; // e.g. "choices[0].message.content" or "data.text"
}