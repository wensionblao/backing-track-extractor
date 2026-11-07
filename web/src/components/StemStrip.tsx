import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { api } from '../lib/api'
import { clock, size } from '../lib/format'
import type { Stem } from '../lib/types'
import { DownloadIcon, PauseIcon, PlayIcon } from './Icons'

const COLORS: Record<string, string> = {
  instrumental_clean: '#C8FF4D',
  instrumental_harmony: '#E8B04B',
  vocal_lead: '#F2F1EC',
  vocal_harmony: '#FF4D8D',
  vocal_all: '#7A5CFF',
}

let currentPlayer: WaveSurfer | null = null

interface StripProps {
  jobId: string
  stem: Stem
  index: number
}

function Strip({ jobId, stem, index }: StripProps) {
  const waveRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<WaveSurfer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const color = COLORS[stem.id] ?? '#C8FF4D'

  useEffect(() => {
    const container = waveRef.current
    if (!container) return

    const player = WaveSurfer.create({
      container,
      url: api.stemUrl(jobId, stem.id),
      height: 42,
      waveColor: 'rgba(242,241,236,0.22)',
      progressColor: color,
      cursorColor: 'rgba(242,241,236,0.7)',
      cursorWidth: 1,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
    })
    playerRef.current = player

    player.on('ready', () => setReady(true))
    player.on('error', () => setFailed(true))
    player.on('finish', () => {
      setPlaying(false)
      currentPlayer = null
      player.setTime(0)
    })

    return () => {
      if (currentPlayer === player) currentPlayer = null
      player.destroy()
      playerRef.current = null
    }
  }, [jobId, stem.id, color])

  const toggle = async () => {
    const player = playerRef.current
    if (!player) return
    if (playing) {
      player.pause()
      setPlaying(false)
      return
    }
    if (currentPlayer && currentPlayer !== player) {
      currentPlayer.pause()
    }
    currentPlayer = player
    try {
      await player.play()
      setPlaying(true)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div className="strip" style={{ '--strip-color': color } as CSSProperties}>
      <div className="strip__id">
        <span className="strip__no">TRACK {String(index + 1).padStart(2, '0')}</span>
        <span className="strip__name">{stem.label}</span>
        <span className="strip__role">{stem.description}</span>
      </div>

      <div className="strip__wave" ref={waveRef}>
        {failed ? <span className="strip__role">音频加载失败，请重新分离</span> : null}
      </div>

      <div className="strip__side">
        <button
          type="button"
          className={`strip__play ${playing ? 'strip__play--on' : ''}`}
          onClick={() => void toggle()}
          disabled={!ready || failed}
          aria-label={playing ? `暂停${stem.label}` : `试听${stem.label}`}
          title={ready ? '试听' : '加载中'}
        >
          {playing ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
        </button>
        <div>
          <a
            className="strip__dl"
            href={`${stem.download_url}`}
            download
            aria-label={`下载${stem.label}`}
            title="下载"
          >
            <DownloadIcon size={15} />
          </a>
          <div className="strip__meta">
            {clock(stem.duration)} · {size(stem.size)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StemStrip({ jobId, stems }: { jobId: string; stems: Stem[] }) {
  return (
    <div className="mixer">
      {stems.map((stem, index) => (
        <Strip key={stem.id} jobId={jobId} stem={stem} index={index} />
      ))}
    </div>
  )
}
