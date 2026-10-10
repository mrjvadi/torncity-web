// What a player lacks for a post (ADR 0055): shared by the work screen, the research desk and the refusal
// `personal`. A calm note while the grace runs, a list of what is missing, and the way to get it.

import type { ReactNode } from 'react'
import type { PersonalNeed } from '../../api/views.gen'
import type { ContentNames } from '../../village/useVillage'
import { formatNumber } from '../../lib/persian'
import { atText } from '../../lib/duration'
import { hasKey, t, type Key } from '../../i18n'

const key = (k: string) => k as Key

/** One thing the player lacks, in a sentence. */
export function personalText(names: ContentNames, n: PersonalNeed): string {
  const p = { need: formatNumber(n.need), have: formatNumber(n.have) }
  switch (n.kind) {
    case 'level': return t('vx.pn.level', p)
    case 'skill': return t('vx.pn.skill', { ...p, skill: names.name('skill', n.item.code, n.item.name) })
    case 'certificate': return t('vx.pn.certificate', { course: names.name('course', n.item.code, n.item.name) })
    case 'literacy': return t('vx.pn.literacy')
    case 'rank': return t('vx.pn.rank', { name: names.name(['life_rank', 'rank'], n.item.code, n.item.name) })
    default: return t('vx.pn.other')
  }
}

/** The way to get it, when the server names one. */
const howText = (how: string): string => (how && hasKey(`vx.pn.how.${how}`) ? t(key(`vx.pn.how.${how}`)) : '')

export function PersonalList({ names, list, title, onCourses }: { names: ContentNames; list: PersonalNeed[] | null | undefined; title?: ReactNode; onCourses?: () => void }) {
  const l = list ?? []
  if (!l.length) return null
  const learn = l.some((n) => n.kind !== 'level' && n.kind !== 'rank')
  return (
    <div className="pn-lack">
      {title && <div className="pn-lack-t">{title}</div>}
      <ul className="vf-src">
        {l.map((n, i) => <li key={i}>{personalText(names, n)}{howText(n.how) ? <small className="pn-how"> – {howText(n.how)}</small> : null}</li>)}
      </ul>
      {onCourses && learn && <button type="button" className="pn-btn sec" onClick={onCourses}>{t('vx.pn.go')}</button>}
    </div>
  )
}

/** The calm notice of the grace: «until then you may go on as you are». */
export function personalUntilText(until: string | null | undefined, post: 'work' | 'research'): string {
  return until ? t(post === 'work' ? 'vx.pn.until_work' : 'vx.pn.until_research', { at: atText(until) }) : ''
}
