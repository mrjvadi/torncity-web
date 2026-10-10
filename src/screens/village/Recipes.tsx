// The way of working at a workplace (ADR 0068): the recipe chooser (the first entry is the standard shift) with what each takes and makes and the
// research a locked one waits for, and the tool line (the tier the work needs, the best one held, the share of the output that leaves).

import type { MaterialLine, StationRecipeLine, ToolLine } from '../../api/views.gen'
import { Note } from '../../ui/Popup'
import { formatNumber } from '../native/kit/format'
import { atText } from '../../lib/duration'
import { t } from '../../i18n'

const list = (l: MaterialLine[] | null, name: (code: string, n: string) => string) => (l ?? []).map((m) => `${formatNumber(m.quantity)} ${name(m.component.code, m.component.name)}`).join('، ')

/** The code of the recipe to send: '' (the standard shift) is left out of the command. */
export const recipeArg = (code: string): Record<string, string> => (code ? { recipe: code } : {})

/** The code selected when the view is first drawn: the one the server marks, else the standard shift. */
export const firstRecipe = (rs: StationRecipeLine[] | null): string => (rs ?? []).find((r) => r.selected)?.code ?? ''

export function RecipePicker({ recipes, value, onChange, name }: { recipes: StationRecipeLine[] | null; value: string; onChange: (code: string) => void; name: (code: string, n: string) => string }) {
  const rs = recipes ?? []
  if (rs.length < 2) return null
  const cur = rs.find((r) => r.code === value) ?? rs[0]
  return (
    <div className="rc">
      <div className="rc-title">{t('rc.title')}</div>
      <div className="rc-chips" role="radiogroup" aria-label={t('rc.title')}>
        {rs.map((r) => (
          <button key={r.code || 'std'} type="button" role="radio" aria-checked={r.code === cur.code}
            className={`dk-chip${r.code === cur.code ? ' all' : ''}${r.available ? '' : ' rc-locked'}`} onClick={() => onChange(r.code)}>
            {r.name.name}
          </button>
        ))}
      </div>
      <div className="rc-body">
        {(cur.inputs ?? []).length > 0 && <div>{t('rc.in', { list: list(cur.inputs, name) })}</div>}
        {(cur.outputs ?? []).length > 0 && <div>{t('rc.out', { list: list(cur.outputs, name) })}</div>}
        {cur.minutes > 0 && <div className="gc-note">{t('rc.minutes', { n: formatNumber(cur.minutes) })}</div>}
        {!cur.available && <Note tone="bad">{t('rc.locked', { list: (cur.missing ?? []).map((m) => m.name).join('، ') || '—' })}</Note>}
      </div>
    </div>
  )
}

const pct = (bps: number) => `${new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(bps / 100)}٪`

export function ToolBlock({ tool }: { tool: ToolLine }) {
  if (!tool.tiers) return <div className="gc-note">{tool.starts_at ? t('tool.starts', { at: atText(tool.starts_at), need: formatNumber(tool.need) }) : t('tool.not_yet', { need: formatNumber(tool.need) })}</div>
  return (
    <div className="rc-tool">
      <div className="gc-note">{t('tool.need', { need: formatNumber(tool.need) })} – {tool.has_tool ? t('tool.have', { have: formatNumber(tool.have) }) : t('tool.none')}</div>
      {tool.factor_bps < 10000 && <Note tone="bad">{t('tool.short', { p: pct(tool.factor_bps) })}</Note>}
    </div>
  )
}
