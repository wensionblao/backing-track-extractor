import { WaveStage } from './WaveStage'
import { ArrowIcon, SparkIcon } from './Icons'
import type { View } from './Nav'

interface HeroProps {
  onNavigate: (view: View, anchor?: string) => void
}

export function Hero({ onNavigate }: HeroProps) {
  return (
    <section className="hero" id="top">
      <div className="shell hero__grid">
        <div className="hero__copy">
          <span className="hero__kicker">
            <i />
            UVR MDX · 双模型分离
          </span>

          <h1 className="hero__title">
            把一首歌，
            <br />
            拆成<em>你的舞台</em>。
          </h1>

          <p className="hero__lede">
            不是降噪，是拆声。从网易云、QQ 音乐取歌，或直接上传——
            我们把它分成 <b>去和声伴奏、和声伴奏、主唱、和声</b>，
            每一条都能单独试听与下载。
          </p>

          <div className="hero__actions">
            <button className="btn btn--lime" type="button" onClick={() => onNavigate('workbench', 'console')}>
              开始分离
              <ArrowIcon />
            </button>
            <button className="btn btn--ghost" type="button" onClick={() => onNavigate('workbench', 'studio')}>
              看分轨台示例
            </button>
          </div>

          <dl className="hero__meta">
            <div className="hero__metaItem">
              <dt>分离引擎</dt>
              <dd>
                本地 UVR <span>MDX-NET</span>
              </dd>
            </div>
            <div className="hero__metaItem">
              <dt>成品轨数</dt>
              <dd>5 条 / 首</dd>
            </div>
            <div className="hero__metaItem">
              <dt>文件保留</dt>
              <dd>24 小时后销毁</dd>
            </div>
          </dl>
        </div>

        <div className="hero__visual">
          <div className="wave-stage ticked">
            <div className="wave-stage__top">
              <span className="wave-stage__tag">
                <i />
                SESSION 001 · LIVE SPLIT
              </span>
              <span className="chip chip--lime">STUDIO READY</span>
            </div>
            <WaveStage />
            <div className="wave-stage__legend">
              <span className="legend__item">
                <span className="legend__dot" style={{ background: '#F2F1EC' }} />
                原曲
              </span>
              <span className="legend__item">
                <span className="legend__dot" style={{ background: '#C8FF4D' }} />
                伴奏
              </span>
              <span className="legend__item">
                <span className="legend__dot" style={{ background: '#E8B04B' }} />
                主唱
              </span>
              <span className="legend__item">
                <span className="legend__dot" style={{ background: '#FF4D8D' }} />
                和声
              </span>
            </div>
            <p className="wave-stage__hint">
              <SparkIcon size={12} /> 所有音频仅在本机处理，下载链接随任务销毁。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
