import type { RecipeInfo } from './types'

/** 音轨多选项（与后端 STEM_META 对齐） */
export const STEM_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: 'instrumental_clean', label: '去和声伴奏', description: '表演主用 · 与平台消音伴奏同类' },
  { id: 'instrumental_harmony', label: '和声伴奏', description: '保留和声、去掉主唱 · 垫唱/和声练习' },
  { id: 'vocal_lead', label: '主唱干声', description: '独唱部分 · 混音/翻唱采样素材' },
  { id: 'vocal_harmony', label: '和声干声', description: '伴唱层 · 和声编写参考' },
  { id: 'vocal_all', label: '全人声', description: '主唱+和声合并 · 一次取走所有人声' },
]

export const ALL_STEM_IDS = STEM_OPTIONS.map((item) => item.id)

export const FALLBACK_RECIPES: RecipeInfo[] = [
  {
    id: 'quick',
    name: '快速纯伴奏',
    tagline: '只要一条干净的伴奏，最快出片',
    stems: ['去和声伴奏'],
    model_runs: 1,
    eta_seconds: 90,
    recommended: false,
  },
  {
    id: 'karaoke',
    name: '全套分轨',
    tagline: '主唱、和声、伴奏一次拿齐',
    stems: ['去和声伴奏', '和声伴奏', '无和声人声', '仅和声', '全人声'],
    model_runs: 2,
    eta_seconds: 240,
    recommended: true,
  },
  {
    id: 'acapella',
    name: '纯人声',
    tagline: '主唱与和声分离，方便二次创作',
    stems: ['全人声', '无和声人声', '仅和声'],
    model_runs: 2,
    eta_seconds: 240,
    recommended: false,
  },
]

export const FAQS = [
  {
    q: '「去和声伴奏」和「和声伴奏」到底差在哪？',
    a: '去和声伴奏会把主唱与和声一起剥掉，只剩乐器底子，适合需要干净底轨的独唱；和声伴奏保留原曲的背景和声，只去掉主唱，适合合唱或需要和声铺垫的舞台版本。两条轨道都由同一套双模型流水线产出。',
  },
  {
    q: '为什么有些歌提示「需要登录」？',
    a: '网易云与 QQ 的部分曲目（版权曲、付费曲、高音质）在未登录状态下不发放播放地址。可以在 .env 里配置 NETEASE_COOKIE / QQ_COOKIE（从浏览器开发者工具复制对应平台的 Cookie）后重启服务再试；本地上传始终可用。',
  },
  {
    q: '分离要多久？',
    a: 'CPU 环境下，快速纯伴奏约 1–2 分钟，全套分轨约 3–5 分钟（视歌曲长度与硬件而定）。队列串行执行，进度会通过录音棚时间线实时推送。',
  },
  {
    q: '音频会上传到云端吗？',
    a: '不会。平台取歌、模型推理、混音与打包都在本机完成；任务产物在 24 小时后自动清理，你也可以随时手动删除整个任务目录。',
  },
  {
    q: '支持哪些格式与时长？',
    a: '上传支持 mp3 / wav / flac / m4a / aac / ogg，单文件上限 200MB；分离时长默认上限 15 分钟，输出默认 MP3 320kbps，可切换 WAV。',
  },
  {
    q: '这个工具收费吗？',
    a: '不收费。全部功能免费开放：三种分离方案、五轨试听下载、ZIP 打包，都不限次数、无需解锁。',
  },
  {
    q: '版权怎么处理？',
    a: '本工具仅用于个人练习、翻唱准备与音频研究。请确保你对所处理的音频拥有合法使用权，不要将成品用于商业发行或二次售卖。',
  },
]
