// A picker of goods by their names: a search box (names, never codes) and chips of the suggested goods and the matches. The code never shows.

import { useEffect, useState } from 'react'
import { loadContent } from '../../village/useVillage'
import { getLang } from '../../i18n'
import { t } from '../../i18n'
import type { FlowCtx } from './flow'

type Good = { code: string; name: string }

export function GoodsPick({ value, onChange, suggest, ctx }: { value: string; onChange: (code: string) => void; suggest: Good[]; ctx: FlowCtx }) {
  const [all, setAll] = useState<Good[]>([])
  const [q, setQ] = useState('')
  useEffect(() => {
    let off = false
    void loadContent().then((e) => {
      if (off) return
      const seen = new Set<string>()
      const out: Good[] = []
      for (const table of ['item', 'component']) for (const x of e[table] ?? []) {
        if (seen.has(x.code)) continue
        seen.add(x.code)
        const n = x.name && (getLang() === 'en' ? x.name.en || x.name.fa : x.name.fa || x.name.en)
        if (n) out.push({ code: x.code, name: n })
      }
      setAll(out)
    })
    return () => { off = true }
  }, [])
  const nm = (g: Good) => ctx.names.name(['item', 'component'], g.code, g.name)
  const uniq = (l: Good[]) => { const s = new Set<string>(); return l.filter((g) => (s.has(g.code) ? false : (s.add(g.code), true))) }
  const needle = q.trim()
  const matches = needle ? all.filter((g) => nm(g).includes(needle)).slice(0, 12) : []
  const shown = uniq([...suggest, ...matches])
  const chosen = value ? [...suggest, ...all].find((g) => g.code === value) : undefined
  return (
    <div className="gp">
      <input className="fx-field-input" value={q} placeholder={t('gp.search')} onChange={(e) => setQ(e.target.value)} aria-label={t('gp.search')} />
      {chosen && <div className="mn-sub">{t('gp.chosen', { item: nm(chosen) })}</div>}
      <div className="rc-chips" role="radiogroup" aria-label={t('hl.item')}>
        {shown.map((g) => <button key={g.code} type="button" role="radio" aria-checked={value === g.code} className={`dk-chip${value === g.code ? ' all' : ''}`} onClick={() => onChange(g.code)}>{nm(g)}</button>)}
      </div>
      {needle && matches.length === 0 && <div className="mn-sub">{t('gp.none')}</div>}
    </div>
  )
}
