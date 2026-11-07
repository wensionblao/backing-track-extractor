import type { Health } from '../lib/types'
import { BrandMark, MoonIcon, SunIcon } from './Icons'

export type ThemeMode = 'day' | 'night'
export type View = 'home' | 'faq'

interface NavProps {
  health: Health | null
  theme: ThemeMode
  view: View
  onToggleTheme: () => void
  onNavigate: (view: View, anchor?: string) => void
}

export function Nav({ health, theme, view, onToggleTheme, onNavigate }: NavProps) {
  const online = health?.ok ?? false
  const statusText = health === null ? '正在连接' : online ? '录音棚在线' : '环境待安装'
  const dotClass = health === null ? '' : online ? 'nav__dot--on' : 'nav__dot--warn'

  return (
    <header className="nav">
      <div className="nav__inner">
        <a
          className="brand"
          href="#top"
          aria-label="拆声 STEMS 首页"
          onClick={(event) => {
            event.preventDefault()
            onNavigate('home', 'top')
          }}
        >
          <span className="brand__mark">
            <BrandMark />
          </span>
          <span className="brand__word">
            <span className="brand__cn">拆声</span>
            <span className="brand__en">STEMS</span>
          </span>
        </a>

        <nav className="nav__links" aria-label="主导航">
          <button
            className={`nav__link ${view === 'home' ? 'nav__link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('home', 'console')}
          >
            取歌
          </button>
          <button
            className={`nav__link ${view === 'home' ? 'nav__link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('home', 'studio')}
          >
            分轨台
          </button>
          <button
            className={`nav__link ${view === 'faq' ? 'nav__link--active' : ''}`}
            type="button"
            onClick={() => onNavigate('faq')}
          >
            常见问题
          </button>
        </nav>

        <div className="nav__right">
          <span className="nav__status" title={health?.hints?.join(' / ') || '服务状态'}>
            <span className={`nav__dot ${dotClass}`} />
            {statusText}
          </span>
          <button
            className="theme-toggle"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'day' ? '切换到夜间模式' : '切换到日间模式'}
            title={theme === 'day' ? '切换到夜间模式' : '切换到日间模式'}
          >
            {theme === 'day' ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
    </header>
  )
}
