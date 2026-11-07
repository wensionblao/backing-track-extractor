import { useRef, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { artists, clock, initials } from '../lib/format'
import type { SourceId, Track, UploadResult } from '../lib/types'
import { LinkIcon, SearchIcon, UploadIcon } from './Icons'

interface SourceConsoleProps {
  selectedId: string | null
  track: Track | null
  upload: UploadResult | null
  onPickTrack: (track: Track, playable: boolean, reason: string) => void
  onUpload: (upload: UploadResult) => void
  onClearSelection: () => void
}

const TABS: { id: SourceId; label: string; hint: string }[] = [
  { id: 'netease', label: '网易云', hint: '歌名 / 歌手 / 链接' },
  { id: 'qq', label: 'QQ 音乐', hint: '歌名 / songmid / songid' },
  { id: 'upload', label: '本地上传', hint: 'mp3 / wav / flac' },
]

function Cover({ track }: { track: Track }) {
  const [broken, setBroken] = useState(false)
  if (track.cover && !broken) {
    return (
      <img
        className="result__cover"
        src={track.cover}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }
  return <div className="result__cover result__cover--fallback">{initials(track.name)}</div>
}

interface UiError {
  code: string
  message: string
  hint: string
}

const PAGE_SIZE = 5

export function SourceConsole({
  selectedId,
  track,
  upload,
  onPickTrack,
  onUpload,
  onClearSelection,
}: SourceConsoleProps) {
  const [tab, setTab] = useState<SourceId>('netease')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [page, setPage] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<UiError | null>(null)
  const [link, setLink] = useState('')
  const [resolving, setResolving] = useState(false)
  const [pickingId, setPickingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const switchTab = (next: SourceId) => {
    setTab(next)
    setError(null)
    setResults([])
    setPage(0)
  }

  const runSearch = async () => {
    const q = query.trim()
    if (!q || searching) return
    setSearching(true)
    setError(null)
    try {
      const data = await api.search(tab, q)
      setResults(data.items)
      setPage(0)
      if (data.items.length === 0) {
        setError({ code: 'EMPTY', message: '没有找到匹配的歌曲', hint: '换个关键词，或直接粘贴歌曲链接' })
      }
    } catch (exc) {
      const err = exc as ApiError
      setError({ code: err.code, message: err.message, hint: err.hint })
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const pick = async (track: Track) => {
    if (pickingId) return
    setPickingId(track.id)
    setError(null)
    try {
      const resolved = await api.resolve(track.source, track.id)
      if (!resolved.playable) {
        setError({
          code: 'URL_UNAVAILABLE',
          message: resolved.reason || '该曲目需要登录或 VIP 才能获取播放地址',
          hint: '可在 .env 配置平台 Cookie 后重试；或改用本地上传。',
        })
        return
      }
      onPickTrack(resolved.track, true, '')
    } catch (exc) {
      const err = exc as ApiError
      setError({ code: err.code, message: err.message, hint: err.hint })
    } finally {
      setPickingId(null)
    }
  }

  const resolveLink = async () => {
    const value = link.trim()
    if (!value || resolving) return
    setResolving(true)
    setError(null)
    try {
      const resolved = await api.resolve(tab, value)
      onPickTrack(resolved.track, resolved.playable, resolved.reason)
    } catch (exc) {
      const err = exc as ApiError
      setError({ code: err.code, message: err.message, hint: err.hint })
    } finally {
      setResolving(false)
    }
  }

  const handleFile = async (file: File | undefined | null) => {
    if (!file || uploading) return
    if (file.size > 200 * 1024 * 1024) {
      setError({ code: 'TOO_LARGE', message: '文件超过 200 MB', hint: '请换用更短的片段' })
      return
    }
    setUploading(true)
    setError(null)
    try {
      const result = await api.upload(file)
      onUpload(result)
    } catch (exc) {
      const err = exc as ApiError
      setError({ code: err.code, message: err.message, hint: err.hint })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0]

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = results.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  return (
    <section className="section" id="console">
      <div className="shell">
        <div className="section-head">
          <div>
            <span className="eyebrow eyebrow--lime">STEP 01 · SOURCE</span>
            <h2 className="section-title">先找到那首歌</h2>
          </div>
          <p className="section-note">
            三个入口，同一个结果：把音频拿到录音棚。平台链接会被解析成可下载的直链，解析失败会明确告诉你原因。
          </p>
        </div>

        <div className="console__grid">
          <div className="panel ticked console__main">
            <div className="tabs" role="tablist" aria-label="音源平台">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={`tab ${tab === item.id ? 'tab--active' : ''}`}
                  onClick={() => switchTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab !== 'upload' ? (
              <>
                <div className="search-row">
                  <div className="field">
                    <SearchIcon />
                    <input
                      type="search"
                      value={query}
                      placeholder={`搜索${activeTab.label}歌曲，例如「起风了」`}
                      aria-label="搜索歌曲"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void runSearch()
                        }
                      }}
                    />
                    <span className="field__label">ENTER</span>
                  </div>
                  <button
                    className="btn btn--lime btn--small"
                    type="button"
                    disabled={searching || !query.trim()}
                    onClick={() => void runSearch()}
                  >
                    {searching ? '搜索中' : '搜索'}
                  </button>
                </div>

                <div className="link-resolve">
                  <div className="link-resolve__head">
                    <h3>或粘贴歌曲链接 / ID</h3>
                    <span>{tab === 'netease' ? 'MUSIC.163.COM' : 'Y.QQ.COM'}</span>
                  </div>
                  <div className="search-row">
                    <div className="field">
                      <LinkIcon />
                      <input
                        type="text"
                        value={link}
                        placeholder={
                          tab === 'netease'
                            ? 'https://music.163.com/song?id=…'
                            : 'https://y.qq.com/n/ryqq/songDetail/…'
                        }
                        aria-label="粘贴歌曲链接"
                        onChange={(event) => setLink(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void resolveLink()
                          }
                        }}
                      />
                    </div>
                    <button
                      className="btn btn--ghost btn--small"
                      type="button"
                      disabled={resolving || !link.trim()}
                      onClick={() => void resolveLink()}
                    >
                      {resolving ? '解析中' : '解析'}
                    </button>
                  </div>
                </div>

                <div className="results" role="list" aria-label="搜索结果">
                  {results.length > 0 ? (
                    pageItems.map((item, index) => (
                      <button
                        key={`${item.source}-${item.id}`}
                        type="button"
                        role="listitem"
                        className={`result ${selectedId === item.id ? 'result--active' : ''}`}
                        onClick={() => void pick(item)}
                        disabled={pickingId === item.id}
                      >
                        <span className="result__index">
                          {String(safePage * PAGE_SIZE + index + 1).padStart(2, '0')}
                        </span>
                        <Cover track={item} />
                        <span className="result__body">
                          <span className="result__name">{item.name || '未命名曲目'}</span>
                          <span className="result__meta">
                            {artists(item.artist)}
                            {item.album ? ` · ${item.album}` : ''}
                          </span>
                        </span>
                        <span className="result__time">
                          {pickingId === item.id ? '校验…' : clock(item.duration)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="empty">
                      <b>还没有候选曲目</b>
                      搜索关键词，或把歌曲链接直接粘进上面的输入框。
                    </div>
                  )}
                </div>

                {pageCount > 1 ? (
                  <div className="pager" role="navigation" aria-label="搜索结果分页">
                    <button
                      type="button"
                      className="pager__btn"
                      disabled={safePage === 0}
                      onClick={() => setPage(safePage - 1)}
                      aria-label="上一页"
                    >
                      ← 上一页
                    </button>
                    <span className="pager__info">
                      {safePage + 1} / {pageCount} · 共 {results.length} 首
                    </span>
                    <button
                      type="button"
                      className="pager__btn"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage(safePage + 1)}
                      aria-label="下一页"
                    >
                      下一页 →
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div
                  className={`upload ${drag ? 'upload--drag' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileRef.current?.click()
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDrag(true)
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDrag(false)
                    void handleFile(event.dataTransfer.files?.[0])
                  }}
                >
                  <div className="upload__icon">
                    <UploadIcon />
                  </div>
                  <p className="upload__title">{uploading ? '正在上传…' : '拖入音频，或点击选择文件'}</p>
                  <p className="upload__note">mp3 / wav / flac / m4a / aac / ogg · 单文件 ≤ 200MB</p>
                  {upload ? (
                    <span className="upload__file">
                      ✓ {upload.filename} · {upload.duration ? clock(upload.duration) : '时长待检测'}
                    </span>
                  ) : null}
                  <input
                    ref={fileRef}
                    className="sr-only"
                    type="file"
                    accept=".mp3,.wav,.flac,.m4a,.aac,.ogg,audio/*"
                    onChange={(event) => void handleFile(event.target.files?.[0])}
                  />
                </div>
                <p className="upload__note" style={{ marginTop: 12 }}>
                  5sing、B 站、现场录音等无法直连的音频，走这里。
                </p>
              </>
            )}

            {error ? (
              <div className="error-line" role="alert">
                <strong>{error.code}</strong>
                <span>
                  {error.message}
                  {error.hint ? (
                    <em style={{ display: 'block', opacity: 0.7, fontStyle: 'normal' }}>
                      {error.hint}
                    </em>
                  ) : null}
                </span>
              </div>
            ) : null}
          </div>

          <aside className="console__side">
            <div className="panel ticked" style={{ padding: 22 }}>
              <div className="job-ticket">
                <span className="job-ticket__label">当前选择</span>
                {upload ? (
                  <>
                    <div className="ticket__row">
                      <div className="ticket__cover ticket__cover--fallback">UPLOAD</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="ticket__title">{upload.filename}</div>
                        <div className="ticket__meta">
                          本地上传 · {upload.duration ? clock(upload.duration) : '时长待检测'}
                        </div>
                      </div>
                    </div>
                    <button className="btn btn--ghost btn--small" type="button" onClick={onClearSelection}>
                      重新选择
                    </button>
                  </>
                ) : track ? (
                  <>
                    <div className="ticket__row">
                      <Cover track={track} />
                      <div style={{ minWidth: 0 }}>
                        <div className="ticket__title">{track.name || '未命名曲目'}</div>
                        <div className="ticket__meta">
                          {artists(track.artist)}
                          {track.album ? ` · ${track.album}` : ''} · {clock(track.duration)}
                        </div>
                      </div>
                    </div>
                    <button className="btn btn--ghost btn--small" type="button" onClick={onClearSelection}>
                      重新选择
                    </button>
                  </>
                ) : (
                  <div className="ticket__empty">
                    从搜索结果中选一首歌，或在「本地上传」里放入音频。
                    <br />
                    选定后右侧方案才会生效。
                  </div>
                )}
              </div>
            </div>

            <div className="panel" style={{ padding: 22 }}>
              <div className="job-ticket">
                <span className="job-ticket__label">录音棚须知</span>
                <ul className="plan__list">
                  <li>平台曲目需要可用播放地址；VIP 曲可在 .env 配置平台 Cookie 提高成功率。</li>
                  <li>分离在本机运行，音频不会离开这台机器。</li>
                  <li>任务产物 24 小时后自动清理，可随时手动删除。</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
