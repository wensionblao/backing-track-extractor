import type { CSSProperties } from 'react'
import { clock, phaseIndex, STAGE_PHASES } from '../lib/format'
import type { JobView } from '../lib/types'
import { StemStrip } from './StemStrip'
import { CloseIcon, DownloadIcon, ZipIcon } from './Icons'

interface JobConsoleProps {
  job: JobView | null
  creating: boolean
  error: { code: string; message: string; hint: string } | null
  onReset: () => void
}

const ACTIVE = new Set([
  'queued',
  'downloading',
  'preparing',
  'separating_inst',
  'separating_kara',
  'mixing',
  'packaging',
])

const PLACEHOLDER = [
  { label: '去和声伴奏', desc: '无主唱、无和声，最干净的伴奏' },
  { label: '和声伴奏', desc: '保留背景和声，适合带和声的舞台版本' },
  { label: '无和声人声', desc: '只有主唱，可用于对齐或二次混音' },
  { label: '仅和声', desc: '只有背景和声，方便单独调节' },
  { label: '全人声', desc: '主唱 + 和声的完整人声轨' },
]

function EmptyMixer() {
  return (
    <div className="mixer">
      {PLACEHOLDER.map((item, index) => (
        <div
          className="strip"
          key={item.label}
          style={{
            opacity: 0.42,
            borderStyle: 'dashed',
            '--strip-color': ['#C8FF4D', '#E8B04B', '#F2F1EC', '#FF4D8D', '#7A5CFF'][index],
          } as CSSProperties}
        >
          <div className="strip__id">
            <span className="strip__no">TRACK {String(index + 1).padStart(2, '0')}</span>
            <span className="strip__name">{item.label}</span>
            <span className="strip__role">{item.desc}</span>
          </div>
          <div className="strip__wave" />
          <div className="strip__side">
            <span className="strip__meta">待生成</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function JobConsole({ job, creating, error, onReset }: JobConsoleProps) {
  const active = job ? ACTIVE.has(job.state) : false
  const failed = job?.state === 'failed'
  const done = job?.state === 'done'
  const currentIndex = job ? phaseIndex(job.stage) : -1
  const currentLabel = job?.stage_label || (creating ? '创建任务' : '空闲')

  return (
    <div className="panel ticked console__main">
      <div className="job__head">
        <div>
          <span className="eyebrow eyebrow--lime">STEP 02 · SPLIT</span>
          <h2 className="section-title" style={{ fontSize: 26, marginTop: 10 }}>
            分轨台
          </h2>
        </div>
        <div className="job__state">
          <span
            className={`job__pulse ${done ? 'job__pulse--done' : ''} ${failed ? 'job__pulse--fail' : ''}`}
          />
          {currentLabel}
          {job && active ? <span style={{ color: 'var(--muted-2)' }}>{job.elapsed}s</span> : null}
        </div>
      </div>

      {job ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div className="job__pct">
              {job.progress}
              <span>%</span>
            </div>
            {job.queue_position > 0 && job.state === 'queued' ? (
              <span className="chip">队列第 {job.queue_position} 位</span>
            ) : (
              <span className="chip chip--lime">{job.format.toUpperCase()} · {job.recipe}</span>
            )}
          </div>

          <div className="progress">
            <div
              className={`progress__fill ${failed ? 'progress__fill--fail' : ''}`}
              style={{ width: `${Math.max(2, Math.min(100, job.progress))}%` }}
            />
          </div>

          <div className="timeline">
            {STAGE_PHASES.map((phase, index) => {
              const isDone = done || index < currentIndex
              const isActive = !done && !failed && index === currentIndex
              return (
                <div
                  key={phase.key}
                  className={`timeline__step ${isDone ? 'timeline__step--done' : ''} ${
                    isActive ? 'timeline__step--active' : ''
                  }`}
                >
                  <div className="timeline__dot" />
                  <div className="timeline__label">{phase.label}</div>
                  <div className="timeline__meta">{phase.meta}</div>
                </div>
              )
            })}
          </div>

          {job.message ? (
            <p style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>{job.message}</p>
          ) : null}

          {job.error ? (
            <div className="error-line" role="alert">
              <strong>{job.error.code}</strong>
              <span>
                {job.error.message}
                {job.error.hint ? (
                  <em style={{ display: 'block', opacity: 0.72, fontStyle: 'normal' }}>{job.error.hint}</em>
                ) : null}
              </span>
            </div>
          ) : null}

          {job.events.length > 0 ? (
            <div className="events" aria-label="任务日志">
              {job.events.slice(-6).map((text, index) => (
                <div className="events__row" key={`${index}-${text}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          ) : null}

          {done && job.stems.length > 0 ? (
            <>
              <div className="mixer__head" style={{ marginTop: 22 }}>
                <div className="mixer__title">
                  成品轨 <span>{job.stems.length} STEMS · {clock(job.elapsed)} 用时</span>
                </div>
                <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
                  再分一首
                </button>
              </div>
              <StemStrip jobId={job.id} stems={job.stems} />
              <div className="zip-row">
                <div>
                  <div className="zip-row__title">整套打包下载</div>
                  <div className="zip-row__note">单曲 ZIP · 无需逐条保存 · 24 小时后自动清理</div>
                </div>
                <a className="btn btn--gold btn--small" href={job.zip_url} download>
                  <ZipIcon size={14} />
                  下载 ZIP
                </a>
              </div>
            </>
          ) : null}

          {failed ? (
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn--lime btn--small" onClick={onReset}>
                重新开始
              </button>
              <button type="button" className="btn btn--ghost btn--small" onClick={onReset}>
                <CloseIcon size={13} />
                关闭任务
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="section-note" style={{ marginBottom: 18 }}>
            右侧选好方案后，这里会依次点亮「取音频 → 模型一 → 模型二 → 混音 → 打包」五段
            录音棚时间线，每条成品轨都能单独试听。
          </p>
          {error ? (
            <div className="error-line" role="alert">
              <strong>{error.code}</strong>
              <span>
                {error.message}
                {error.hint ? (
                  <em style={{ display: 'block', opacity: 0.72, fontStyle: 'normal' }}>{error.hint}</em>
                ) : null}
              </span>
            </div>
          ) : null}
          <EmptyMixer />
          <p className="upload__note" style={{ marginTop: 14 }}>
            <DownloadIcon size={13} /> 未开始 · 示例轨道仅用于展示混音台结构
          </p>
        </>
      )}
    </div>
  )
}
