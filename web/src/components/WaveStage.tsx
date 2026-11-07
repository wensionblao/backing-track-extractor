import { useEffect, useRef } from 'react'

interface Lane {
  key: string
  label: string
  color: string
  amp: number
  phase: number
}

const LANES: Lane[] = [
  { key: 'MIX', label: 'ORIGINAL MIX', color: '#F2F1EC', amp: 0.72, phase: 0.4 },
  { key: 'INST', label: 'INSTRUMENTAL', color: '#C8FF4D', amp: 0.5, phase: 1.6 },
  { key: 'LEAD', label: 'LEAD VOCAL', color: '#E8B04B', amp: 0.62, phase: 2.8 },
  { key: 'HARM', label: 'HARMONY', color: '#FF4D8D', amp: 0.38, phase: 3.9 },
]

const DURATION = 7200

interface Palette {
  lanes: string[]
  grid: string
  label: string
  labelDim: string
  baseline: string
  tick: string
  scanBase: string
  scanGlow: string
  scanCore: string
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  const rgb = (name: string, alpha: number) => `rgba(${v(name)},${alpha})`
  return {
    lanes: [v('--paper'), v('--lime'), v('--gold'), v('--rose')],
    grid: rgb('--paper-rgb', 0.06),
    label: rgb('--paper-rgb', 0.5),
    labelDim: rgb('--paper-rgb', 0.34),
    baseline: rgb('--paper-rgb', 0.1),
    tick: rgb('--paper-rgb', 0.22),
    scanBase: rgb('--lime-rgb', 0),
    scanGlow: rgb('--lime-rgb', 0.5),
    scanCore: rgb('--lime-rgb', 0.9),
  }
}

function sample(index: number, total: number, lane: Lane, laneIndex: number): number {
  const x = index / total
  const envelope = Math.sin(Math.PI * Math.min(1, x * 0.95 + 0.04)) ** 0.7
  const wobble =
    Math.sin(x * 26 + lane.phase) * 0.52 +
    Math.sin(x * 63 + lane.phase * 2.3) * 0.28 +
    Math.sin(x * 131 + laneIndex) * 0.12 +
    Math.sin(x * 7 + lane.phase) * 0.28
  const gate = 0.55 + 0.45 * Math.abs(Math.sin(x * 11 + laneIndex * 1.7))
  return Math.abs(wobble) * envelope * lane.amp * gate
}

export function WaveStage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let raf = 0
    let start = performance.now()
    let palette = readPalette()

    // 主题切换时（data-theme 属性变化）重新读取调色板并重绘
    const themeObserver = new MutationObserver(() => {
      palette = readPalette()
      draw(performance.now())
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // 只读 canvas 自身的内容尺寸，绝不把容器高度回写到 canvas，
      // 否则 ResizeObserver 会因边框差值形成无限增高循环（每次 +2px）。
      width = Math.max(1, canvas.clientWidth)
      height = Math.max(1, canvas.clientHeight)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const draw = (now: number) => {
      const progress = reduce ? 1 : Math.min(1, (now - start) / DURATION)
      ctx.clearRect(0, 0, width, height)

      // panel grid
      ctx.strokeStyle = palette.grid
      ctx.lineWidth = 1
      for (let i = 0; i <= 8; i += 1) {
        const x = Math.round((width / 8) * i) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      for (let i = 0; i <= 4; i += 1) {
        const y = Math.round((height / 4) * i) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      const scanX = progress * width
      const laneHeight = height / LANES.length

      LANES.forEach((lane, laneIndex) => {
        const center = laneHeight * (laneIndex + 0.5)
        const labelY = center - laneHeight * 0.32 + 4

        ctx.font = '9px ui-monospace, Menlo, monospace'
        ctx.fillStyle = laneIndex === 0 ? palette.label : palette.labelDim
        ctx.fillText(lane.label, 14, labelY)

        const points = Math.max(120, Math.floor(width / 3))
        const step = width / points
        const amplitude = laneHeight * 0.32
        const revealed = laneIndex === 0 ? progress : progress

        ctx.beginPath()
        for (let i = 0; i <= points; i += 1) {
          const x = i * step
          if (x > scanX * (laneIndex === 0 ? 1 : 1.04)) break
          const value = sample(i, points, lane, laneIndex)
          const y = center - value * amplitude
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        for (let i = points; i >= 0; i -= 1) {
          const x = i * step
          if (x > scanX * (laneIndex === 0 ? 1 : 1.04)) continue
          const value = sample(i, points, lane, laneIndex)
          const y = center + value * amplitude
          ctx.lineTo(x, y)
        }
        ctx.closePath()

        const fillAlpha = laneIndex === 0 ? 0.36 : 0.3
        ctx.fillStyle = palette.lanes[laneIndex] ?? lane.color
        ctx.globalAlpha = fillAlpha * (laneIndex === 0 ? 1 : revealed)
        ctx.fill()

        ctx.globalAlpha = laneIndex === 0 ? 0.9 : 1
        ctx.strokeStyle = palette.lanes[laneIndex] ?? lane.color
        ctx.lineWidth = laneIndex === 0 ? 1 : 1.2
        ctx.stroke()
        ctx.globalAlpha = 1

        // lane baseline
        ctx.strokeStyle = palette.baseline
        ctx.beginPath()
        ctx.moveTo(0, center)
        ctx.lineTo(width, center)
        ctx.stroke()

        // reveal head
        if (!reduce && progress < 1 && laneIndex > 0) {
          ctx.fillStyle = palette.lanes[laneIndex] ?? lane.color
          ctx.globalAlpha = 0.9
          ctx.fillRect(scanX - 1.5, center - amplitude, 3, amplitude * 2)
          ctx.globalAlpha = 1
        }
      })

      // scan line
      if (!reduce && progress < 1) {
        const gradient = ctx.createLinearGradient(scanX - 24, 0, scanX + 8, 0)
        gradient.addColorStop(0, palette.scanBase)
        gradient.addColorStop(1, palette.scanGlow)
        ctx.fillStyle = gradient
        ctx.fillRect(scanX - 24, 0, 24, height)
        ctx.fillStyle = palette.scanCore
        ctx.fillRect(scanX - 1, 0, 1, height)
      }

      // corner ticks
      ctx.strokeStyle = palette.tick
      ctx.lineWidth = 1
      const tick = 12
      const corners: [number, number, number, number][] = [
        [12, 12, 1, 1],
        [width - 12, 12, -1, 1],
        [12, height - 12, 1, -1],
        [width - 12, height - 12, -1, -1],
      ]
      corners.forEach(([x, y, dx, dy]) => {
        ctx.beginPath()
        ctx.moveTo(x + dx * tick, y)
        ctx.lineTo(x, y)
        ctx.lineTo(x, y + dy * tick)
        ctx.stroke()
      })

      if (!reduce && progress < 1) {
        raf = requestAnimationFrame(draw)
      }
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      if (reduce) draw(performance.now())
    })
    observer.observe(wrap)
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      themeObserver.disconnect()
    }
  }, [])

  return (
    <div className="wave-stage__canvas" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="波形分解动画：原曲逐条拆分为伴奏、主唱与和声" role="img" />
    </div>
  )
}
