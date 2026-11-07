import { useState } from 'react'
import { FAQS } from '../lib/content'

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="section" id="faq">
      <div className="shell">
        <div className="section-head">
          <div>
            <span className="eyebrow">SUPPORT</span>
            <h2 className="section-title">在按下分离之前</h2>
          </div>
          <p className="section-note">
            关于和声、Cookie、时长与版权的常见问题。还有其他疑问，可在页脚找到联系方式。
          </p>
        </div>

        <div className="faq">
          {FAQS.map((item, index) => {
            const isOpen = open === index
            return (
              <div className={`faq__item ${isOpen ? 'faq__item--open' : ''}`} key={item.q}>
                <button
                  type="button"
                  className="faq__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : index)}
                >
                  <span>{item.q}</span>
                  <span className="faq__toggle" aria-hidden="true">
                    +
                  </span>
                </button>
                {isOpen ? <p className="faq__a">{item.a}</p> : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
