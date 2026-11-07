export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function eta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '约 1 分钟'
  if (seconds < 60) return `约 ${seconds} 秒`
  return `约 ${Math.round(seconds / 60)} 分钟`
}

export function size(bytes: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function artists(list: string[] | undefined): string {
  if (!list || list.length === 0) return '未知歌手'
  return list.filter(Boolean).join(' / ')
}

export function initials(text: string): string {
  const clean = (text || '').trim()
  if (!clean) return '♪'
  return clean.slice(0, 2).toUpperCase()
}

export const STAGE_PHASES = [
  { key: 'fetch', label: '取音频', meta: 'FETCH' },
  { key: 'model1', label: '模型一', meta: 'PASS 1' },
  { key: 'model2', label: '模型二', meta: 'PASS 2' },
  { key: 'mix', label: '混音', meta: 'MIX' },
  { key: 'pack', label: '打包', meta: 'PACK' },
] as const

export type PhaseKey = (typeof STAGE_PHASES)[number]['key']

export function phaseOf(stage: string): PhaseKey {
  if (stage === 'queued' || stage === 'downloading') return 'fetch'
  if (stage === 'preparing' || stage === 'separating_inst') return 'model1'
  if (stage === 'separating_kara') return 'model2'
  if (stage === 'mixing') return 'mix'
  return 'pack'
}

export function phaseIndex(stage: string): number {
  return STAGE_PHASES.findIndex((item) => item.key === phaseOf(stage))
}
