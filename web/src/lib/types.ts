export type SourceId = 'netease' | 'qq' | 'upload'
export type RecipeId = 'quick' | 'karaoke' | 'acapella'
export type AudioFormat = 'mp3' | 'wav'

export interface Track {
  id: string
  source: SourceId
  name: string
  artist: string[]
  album: string
  duration: number
  cover: string
  link: string
}

export interface SearchResult {
  source: string
  query: string
  items: Track[]
}

export interface ResolveResult {
  track: Track
  playable: boolean
  reason: string
}

export interface SourceMeta {
  id: SourceId
  name: string
  note: string
  accepts: string
  searchable: boolean
}

export interface RecipeInfo {
  id: RecipeId
  name: string
  tagline: string
  stems: string[]
  model_runs: number
  eta_seconds: number
  recommended: boolean
}

export interface Stem {
  id: string
  label: string
  description: string
  filename: string
  size: number
  duration: number
  url: string
  download_url: string
}

export interface JobError {
  code: string
  message: string
  hint: string
}

export interface JobView {
  id: string
  state: string
  stage: string
  stage_label: string
  progress: number
  message: string
  created_at: number
  elapsed: number
  queue_position: number
  track: Track
  recipe: RecipeId
  format: string
  stem_roles?: string[]
  stems: Stem[]
  zip_url: string
  error: JobError | null
  events: string[]
}

export interface Health {
  ok: boolean
  app: string
  python: string
  ffmpeg: boolean
  ffmpeg_path: string
  audio_separator: boolean
  audio_separator_version: string
  models: Record<string, boolean>
  device: string
  queue: number
  running: number
  jobs_total: number
  hints: string[]
}

export interface UploadResult {
  uploadId: string
  filename: string
  size: number
  duration: number
}
