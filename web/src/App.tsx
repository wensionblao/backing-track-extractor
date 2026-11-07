import { useEffect, useRef, useState } from 'react'
import { api, ApiError, subscribeJob } from './lib/api'
import { ALL_STEM_IDS } from './lib/content'
import type { AudioFormat, Health, JobView, Track, UploadResult } from './lib/types'
import { Nav, type ThemeMode, type View } from './components/Nav'
import { Hero } from './components/Hero'
import { SourceConsole } from './components/SourceConsole'
import { Studio } from './components/Studio'
import { Faq } from './components/Faq'
import { Footer } from './components/Footer'
import { ConsoleBar } from './components/ConsoleBar'

interface UiError {
  code: string
  message: string
  hint: string
}

function toUiError(exc: unknown): UiError {
  if (exc instanceof ApiError) {
    return { code: exc.code, message: exc.message, hint: exc.hint }
  }
  return { code: 'UNKNOWN', message: '发生未知错误，请重试', hint: '' }
}

const THEME_KEY = 'stems.theme'

function readTheme(): ThemeMode {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'night' ? 'night' : 'day'
  } catch {
    return 'day'
  }
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [stems, setStems] = useState<string[]>(ALL_STEM_IDS)
  const [format, setFormat] = useState<AudioFormat>('mp3')
  const [job, setJob] = useState<JobView | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<UiError | null>(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState<ThemeMode>(readTheme)
  const [view, setView] = useState<View>('home')
  const toastTimer = useRef<number | null>(null)

  const showToast = (text: string) => {
    setToast(text)
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  // 主题：默认日间，写入 <html data-theme>，夜间记忆在 localStorage
  useEffect(() => {
    if (theme === 'night') {
      document.documentElement.dataset.theme = 'dark'
    } else {
      delete document.documentElement.dataset.theme
    }
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // 隐私模式下忽略
    }
  }, [theme])

  useEffect(() => {
    let alive = true
    const loadHealth = async () => {
      try {
        const data = await api.health()
        if (alive) setHealth(data)
      } catch {
        if (alive) setHealth(null)
      }
    }
    void loadHealth()
    const timer = window.setInterval(loadHealth, 60_000)

    return () => {
      alive = false
      window.clearInterval(timer)
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!job) return
    if (job.state === 'done' || job.state === 'failed') return
    const close = subscribeJob(job.id, (next) => setJob(next))
    return close
  }, [job?.id, job?.state])

  const pickTrack = (next: Track) => {
    setTrack(next)
    setUpload(null)
    setJob(null)
    setError(null)
  }

  const pickUpload = (next: UploadResult) => {
    setUpload(next)
    setTrack(null)
    setJob(null)
    setError(null)
  }

  const clearSelection = () => {
    setTrack(null)
    setUpload(null)
    setJob(null)
    setError(null)
  }

  const reset = () => {
    setJob(null)
    setError(null)
    if (job?.state === 'failed' || job?.state === 'done') {
      clearSelection()
    }
  }

  const createJob = async () => {
    if (creating || !(track || upload)) return
    setCreating(true)
    setError(null)
    try {
      const data = await api.createJob({
        recipe: 'karaoke',
        format,
        stems,
        ...(upload
          ? { uploadId: upload.uploadId }
          : track
            ? { track }
            : {}),
      })
      setJob(data.job)
      window.setTimeout(() => {
        document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    } catch (exc) {
      setError(toUiError(exc))
    } finally {
      setCreating(false)
    }
  }

  const navigate = (next: View, anchor?: string) => {
    setView(next)
    if (next === 'home' && anchor) {
      window.setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    } else {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
    }
  }

  return (
    <>
      <Nav
        health={health}
        theme={theme}
        view={view}
        onToggleTheme={() => setTheme(theme === 'day' ? 'night' : 'day')}
        onNavigate={navigate}
      />

      <main>
        {view === 'home' ? (
          <>
            <Hero />

            <SourceConsole
              selectedId={track?.id ?? null}
              track={track}
              upload={upload}
              onPickTrack={(next, playable) => {
                pickTrack(next)
                if (!playable) {
                  showToast('该曲目暂不可播放，可换源或改用本地上传')
                }
              }}
              onUpload={pickUpload}
              onClearSelection={clearSelection}
            />

            <Studio
              track={track}
              upload={upload}
              stems={stems}
              format={format}
              job={job}
              creating={creating}
              error={error}
              onStems={setStems}
              onFormat={setFormat}
              onCreate={() => void createJob()}
              onReset={reset}
            />
          </>
        ) : (
          <Faq />
        )}
      </main>

      <Footer healthOk={Boolean(health?.ok)} onNavigate={navigate} />

      <ConsoleBar job={job} />

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  )
}
