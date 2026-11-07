import type {
  AudioFormat,
  Health,
  JobView,
  RecipeId,
  RecipeInfo,
  ResolveResult,
  SearchResult,
  SourceId,
  SourceMeta,
  UploadResult,
} from './types'

const BASE = ''

export class ApiError extends Error {
  code: string
  hint: string
  status: number

  constructor(message: string, code: string, hint: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.hint = hint
    this.status = status
  }
}

interface Detail {
  code?: string
  message?: string
  hint?: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, init)
  } catch {
    throw new ApiError('无法连接服务，请确认后端已启动', 'NETWORK', '启动 uv run uvicorn app.main:app', 0)
  }
  if (!response.ok) {
    let detail: Detail = {}
    try {
      const data = (await response.json()) as { detail?: Detail | string } & Detail
      if (typeof data.detail === 'string') detail = { message: data.detail }
      else if (data.detail) detail = data.detail
      else if (data.code || data.message) detail = data
    } catch {
      // 非 JSON 错误体，保留状态码
    }
    throw new ApiError(
      detail.message || `请求失败（${response.status}）`,
      detail.code || `HTTP_${response.status}`,
      detail.hint || '',
      response.status,
    )
  }
  return (await response.json()) as T
}

export const api = {
  health: () => request<Health>('/api/health'),

  sources: async () => {
    const data = await request<{ items: SourceMeta[] }>('/api/sources')
    return data.items
  },

  search: (source: SourceId, q: string, limit = 12) =>
    request<SearchResult>(`/api/search?source=${source}&q=${encodeURIComponent(q)}&limit=${limit}`),

  resolve: (source: SourceId, input: string) =>
    request<ResolveResult>('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, input }),
    }),

  upload: async (file: File): Promise<UploadResult> => {
    const form = new FormData()
    form.append('file', file)
    let response: Response
    try {
      response = await fetch(`${BASE}/api/uploads`, { method: 'POST', body: form })
    } catch {
      throw new ApiError('上传失败，无法连接服务', 'NETWORK', '请检查后端是否运行', 0)
    }
    if (!response.ok) {
      let detail: Detail = {}
      try {
        const data = (await response.json()) as { detail?: Detail } & Detail
        detail = data.detail ?? (data.code || data.message ? data : {})
      } catch {
        // ignore
      }
      throw new ApiError(
        detail.message || '上传失败',
        detail.code || `HTTP_${response.status}`,
        detail.hint || '',
        response.status,
      )
    }
    return (await response.json()) as UploadResult
  },

  recipes: () => request<RecipeInfo[]>('/api/recipes'),

  createJob: (payload: {
    recipe: RecipeId
    format: AudioFormat
    stems?: string[]
    track?: TrackPayload
    uploadId?: string
  }) =>
    request<{ jobId: string; job: JobView }>('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  getJob: (id: string) => request<JobView>(`/api/jobs/${id}`),

  deleteJob: (id: string) => request<{ ok: boolean }>(`/api/jobs/${id}`, { method: 'DELETE' }),

  stemUrl: (jobId: string, stemId: string) => `/api/jobs/${jobId}/files/${stemId}`,
}

export interface TrackPayload {
  id: string
  source: SourceId
  name: string
  artist: string[]
  album: string
  duration: number
  cover: string
  link: string
}

export function subscribeJob(
  jobId: string,
  onUpdate: (job: JobView) => void,
  onClose?: () => void,
): () => void {
  const source = new EventSource(`/api/jobs/${jobId}/events`)
  source.addEventListener('job', (event) => {
    try {
      onUpdate(JSON.parse((event as MessageEvent).data) as JobView)
    } catch {
      // 忽略异常帧
    }
  })
  source.onerror = () => {
    source.close()
    onClose?.()
  }
  return () => source.close()
}
