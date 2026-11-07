import { ALL_STEM_IDS, STEM_OPTIONS } from '../lib/content'
import type { AudioFormat } from '../lib/types'

interface StemPickerProps {
  selected: string[]
  format: AudioFormat
  onChange: (stems: string[]) => void
  onFormat: (format: AudioFormat) => void
}

export function StemPicker({ selected, format, onChange, onFormat }: StemPickerProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length === 1) return // 至少保留一条
      onChange(selected.filter((item) => item !== id))
    } else {
      // 保持 STEM_OPTIONS 的定义顺序，方便预估与展示
      onChange(ALL_STEM_IDS.filter((item) => item === id || selected.includes(item)))
    }
  }

  const runs = selected.some((id) =>
    ['instrumental_harmony', 'vocal_lead', 'vocal_harmony'].includes(id),
  )
    ? 2
    : 1

  return (
    <div className="recipe" aria-label="音轨与输出">
      <div className="recipe__label">要哪几条轨（可多选）</div>

      <div className="stempick" role="group" aria-label="音轨多选">
        <div className="stempick__actions">
          <button type="button" onClick={() => onChange([...ALL_STEM_IDS])}>
            全选
          </button>
          <button
            type="button"
            onClick={() => onChange(['instrumental_clean'])}
            disabled={selected.length === 1}
          >
            只留伴奏
          </button>
        </div>

        <div className="stempick__list">
          {STEM_OPTIONS.map((item) => {
            const checked = selected.includes(item.id)
            return (
              <label key={item.id} className={`stempick__item ${checked ? 'stempick__item--on' : ''}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(item.id)} />
                <span className="stempick__check" aria-hidden="true">
                  {checked ? '✓' : ''}
                </span>
                <span className="stempick__body">
                  <span className="stempick__name">{item.label}</span>
                  <span className="stempick__desc">{item.description}</span>
                </span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="format-row">
        <span className="format-row__label">输出格式</span>
        <div className="seg" role="radiogroup" aria-label="输出格式">
          {(['mp3', 'wav'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={format === item}
              className={`seg__btn ${format === item ? 'seg__btn--active' : ''}`}
              onClick={() => onFormat(item)}
            >
              {item === 'mp3' ? 'MP3 320k' : 'WAV'}
            </button>
          ))}
        </div>
      </div>

      <p className="recipe__estimate">
        {runs} 次推理 · 已选 {selected.length} 条成品轨
      </p>
    </div>
  )
}
