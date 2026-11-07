import { BrandMark } from './Icons'
import type { View } from './Nav'

interface FooterProps {
  healthOk: boolean
  onNavigate: (view: View, anchor?: string) => void
}

export function Footer({ healthOk, onNavigate }: FooterProps) {
  return (
    <footer className="footer">
      <div className="shell footer__grid">
        <div>
          <div className="brand">
            <span className="brand__mark">
              <BrandMark />
            </span>
            <span className="brand__word">
              <span className="brand__cn">拆声</span>
              <span className="brand__en">STEMS</span>
            </span>
          </div>
          <p className="footer__note">
            把一首歌，拆成你的舞台。基于 UVR MDX-NET 与 audio-separator 的本地分轨工作台；
            音频不离开本机，任务产物 24 小时后自动清理。
          </p>
        </div>

        <div className="footer__col">
          <h4>工作台</h4>
          <button type="button" onClick={() => onNavigate('home', 'console')}>
            取歌控制台
          </button>
          <button type="button" onClick={() => onNavigate('home', 'studio')}>
            分轨台
          </button>
          <button type="button" onClick={() => onNavigate('faq')}>
            常见问题
          </button>
        </div>

        <div className="footer__col">
          <h4>技术署名</h4>
          <a href="https://github.com/nomadkaraoke/python-audio-separator" target="_blank" rel="noreferrer">
            audio-separator · MIT
          </a>
          <a href="https://github.com/Anjok07/ultimatevocalremovergui" target="_blank" rel="noreferrer">
            UVR / MDX-NET 模型
          </a>
          <span>FastAPI · React · wavesurfer.js</span>
        </div>
      </div>

      <div className="shell footer__bottom">
        <span>© {new Date().getFullYear()} 拆声 STEMS · 仅用于个人练习与音频研究</span>
        <span>
          版权归原作者所有 · 请勿将成品用于商业发行 ·{' '}
          <span style={{ color: healthOk ? 'var(--lime)' : 'var(--muted)' }}>
            {healthOk ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
          </span>
        </span>
      </div>
    </footer>
  )
}
