import { artists } from '../lib/format'
import type { JobView } from '../lib/types'
import type { View } from './Nav'
import { ArrowIcon } from './Icons'

interface ConsoleBarProps {
  job: JobView | null
  onNavigate: (view: View, anchor?: string) => void
}

export function ConsoleBar({ job, onNavigate }: ConsoleBarProps) {
  const show = Boolean(job)
  const done = job?.state === 'done'
  const failed = job?.state === 'failed'

  return (
    <div className={`consolebar ${show ? 'consolebar--show' : ''}`} aria-hidden={!show}>
      {job ? (
        <div className="consolebar__inner">
          <div className="consolebar__left">
            <span className="consolebar__eq" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div className="consolebar__text">
              <div className="consolebar__title">
                {job.track.name || '当前任务'} · {artists(job.track.artist)}
              </div>
              <div className="consolebar__sub">
                {failed ? '任务中断' : done ? '成品已就绪 · 可试听与下载' : `${job.stage_label} · ${job.progress}%`}
              </div>
            </div>
          </div>
          <div className="consolebar__right">
            {done ? (
              <button
                type="button"
                className="btn btn--lime btn--small"
                onClick={() => onNavigate('workbench', 'studio')}
              >
                查看分轨台
                <ArrowIcon size={13} />
              </button>
            ) : (
              <span className="chip chip--lime">{failed ? 'FAILED' : `${job.progress}%`}</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
