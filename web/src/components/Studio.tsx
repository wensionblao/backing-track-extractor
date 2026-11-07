import { useState } from 'react'
import { artists, clock, initials } from '../lib/format'
import { STEM_OPTIONS } from '../lib/content'
import type { AudioFormat, JobView, Track, UploadResult } from '../lib/types'
import { JobConsole } from './JobConsole'
import { StemPicker } from './StemPicker'
import { ArrowIcon } from './Icons'

interface StudioProps {
  track: Track | null
  upload: UploadResult | null
  stems: string[]
  format: AudioFormat
  job: JobView | null
  creating: boolean
  error: { code: string; message: string; hint: string } | null
  onStems: (stems: string[]) => void
  onFormat: (format: AudioFormat) => void
  onCreate: () => void
  onReset: () => void
}

export function Studio({
  track,
  upload,
  stems,
  format,
  job,
  creating,
  error,
  onStems,
  onFormat,
  onCreate,
  onReset,
}: StudioProps) {
  const [coverBroken, setCoverBroken] = useState(false)
  const selected = Boolean(track || upload)
  const active = job ? !['done', 'failed'].includes(job.state) : false
  const modelRuns = stems.some((id) =>
    ['instrumental_harmony', 'vocal_lead', 'vocal_harmony'].includes(id),
  )
    ? 2
    : 1

  let buttonLabel = '开始分离'
  if (!selected) buttonLabel = '请先选择歌曲'
  else if (stems.length === 0) buttonLabel = '请至少选择一条音轨'
  else if (creating) buttonLabel = '正在提交…'
  else if (active) buttonLabel = '分离进行中'

  const disabled = !selected || creating || active || stems.length === 0

  return (
    <section className="section" id="studio">
      <div className="shell">
        <div className="section-head">
          <div>
            <span className="eyebrow">STEP 02 · MIXER</span>
            <h2 className="section-title">勾选音轨，点亮分轨台</h2>
          </div>
          <p className="section-note">
            只选伴奏类轨道只需 1 次推理；勾选主唱/和声类任意一条会追加一次和声拆分。
          </p>
        </div>

        <div className="console__grid">
          <JobConsole job={job} creating={creating} error={error} onReset={onReset} />

          <aside className="console__side">
            <div className="panel ticked" style={{ padding: 22 }}>
              <div className="job-ticket" style={{ marginBottom: 18 }}>
                <span className="job-ticket__label">当前选择</span>
                {track ? (
                  <div className="ticket__row">
                    {track.cover && !coverBroken ? (
                      <img
                        className="ticket__cover"
                        src={track.cover}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() => setCoverBroken(true)}
                      />
                    ) : (
                      <div className="ticket__cover ticket__cover--fallback">{initials(track.name)}</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="ticket__title">{track.name}</div>
                      <div className="ticket__meta">
                        {artists(track.artist)}
                        {track.duration ? ` · ${clock(track.duration)}` : ''}
                      </div>
                    </div>
                  </div>
                ) : upload ? (
                  <div className="ticket__row">
                    <div className="ticket__cover ticket__cover--fallback">UPLOAD</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="ticket__title">{upload.filename}</div>
                      <div className="ticket__meta">
                        本地上传 · {upload.duration ? clock(upload.duration) : '时长待检测'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ticket__empty">尚未选择曲目 · 先在上方「取歌」区域挑选</div>
                )}
              </div>

              <StemPicker selected={stems} format={format} onChange={onStems} onFormat={onFormat} />

              <button
                type="button"
                className="btn btn--lime"
                style={{ width: '100%', marginTop: 18 }}
                disabled={disabled}
                onClick={onCreate}
              >
                {buttonLabel}
                {!disabled ? <ArrowIcon /> : null}
              </button>

              <p className="upload__note" style={{ marginTop: 12, textAlign: 'center' }}>
                {modelRuns} 次推理 · 产出{' '}
                {STEM_OPTIONS.filter((item) => stems.includes(item.id))
                  .map((item) => item.label)
                  .join(' / ') || '—'}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
