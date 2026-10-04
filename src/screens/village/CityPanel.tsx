// The city panel (web map 6.2): the one place for facts and affairs about the settlement as a whole. Opened from the
// civic building's ring «اطلاعات» and, on a desktop, from the rail's «شهر» sub-items. It starts with the development
// readout (G1: the neutral view `settlement.development.view` -> `village_development`): what the city carries against
// what it can carry, the service buildings it has, and what could be added next. It names no stage and no size word
// (ADR 0044 4.5); it replaces the promotion screen and its promote button. Then the sections, each shown only if it has
// content for this viewer (the server's flags decide, never the client): residents, knowledge, construction, treasury,
// the storehouse, and the doors to the charter («جامعه») and, for a resident who is not the head, leaving.

import type { ScreenProps } from '../types'
import { Empty, Header, ScreenScroll } from '../native/kit/Parts'
import { CardGrid, PBar, PCard, PSec, PTile } from '../../ui/v6/panel'
import { hasKey, t, type Key } from '../../i18n'
import { formatNumber } from '../../lib/persian'
import { useSession } from '../../state/SessionContext'
import { useVillageView } from './common'
import { useCan } from '../../lib/permissions'
import { useContentNames } from '../../village/useVillage'
import { cityItemsFor } from './cityItems'
import type { DevelopmentDimension, DevelopmentView } from '../../api/views.gen'
import './village.css'

/** The readout's dimension codes this client words. A code it does not know is not shown (never a raw key). */
const DIM_LABEL: Record<string, Key> = { people: 'city.dim.people', buildings: 'city.dim.buildings', knowledge: 'city.dim.knowledge' }

function Dimension({ d }: { d: DevelopmentDimension }) {
  const label = DIM_LABEL[d.code]
  if (!label) return null
  const ceiling = d.capacity > 0
  const frac = ceiling ? d.load / d.capacity : 0
  // the city works at a loss when it carries more than it can; the game never forbids it (ADR 0044 4.1, 4.2)
  const tone = !ceiling ? undefined : frac > 1 ? 'bad' : frac >= 0.85 ? 'low' : undefined
  return (
    <div className="cp-dim">
      <div className="pn-kv"><span>{t(label)}</span><b>{ceiling ? t('city.dim.of', { load: formatNumber(d.load), cap: formatNumber(d.capacity) }) : formatNumber(d.load)}</b></div>
      {ceiling && <PBar frac={Math.min(1, frac)} tone={tone} />}
      {ceiling && frac > 1 && <p className="pn-hint pn-bad">{t('city.dim.over')}</p>}
    </div>
  )
}

export default function CityPanel({ run, openLocal }: ScreenProps) {
  const can = useCan()
  const names = useContentNames()
  const { bootstrap } = useSession()
  const s = bootstrap?.settlement
  const { view: v, loading } = useVillageView<DevelopmentView>('settlement.development.view', null)
  const name = v?.village ?? s?.name ?? t('city.title')
  const items = cityItemsFor(s ?? {}).filter((it) => it.key !== 'status')
  const next = v?.next ?? []

  return (
    <ScreenScroll>
      <Header title={name} />
      <PSec>{t('city.status')}</PSec>
      {loading && !v && <Empty>{t('common.loading')}</Empty>}
      {v && (
        <div className="cp-readout">
          {(v.dimensions ?? []).map((d) => <Dimension key={d.code} d={d} />)}
          {(v.roles ?? []).length > 0 && (
            <>
              <PSec>{t('city.roles')}</PSec>
              <div className="cp-chips">
                {(v.roles ?? []).map((r) => (
                  <span key={r.role} className="nx-chip nx-chip-gold">{t('city.role.level', { role: hasKey(`role.${r.role}`) ? t(`role.${r.role}` as Key) : '', n: r.level })}</span>
                ))}
              </div>
            </>
          )}
          <PSec>{t('city.next.title')}</PSec>
          {next.length === 0 && <p className="pn-hint">{t('city.next.none')}</p>}
          <CardGrid>
            {next.map((c) => {
              const research = c.kind === 'research'
              const what = research ? names.name('knowledge', c.code, c.name) : names.name('settlement_building', c.code, c.name)
              // only the holder of the permission gets the door (P28); others read the suggestion
              const ok = research ? can('research.start') : can('public.build')
              return (
                <PCard
                  key={`${c.kind}:${c.code}`} icon={research ? 'book' : 'hammer'} title={what} sub={t(research ? 'city.next.research' : 'city.next.build')}
                  onClick={ok ? () => (research ? openLocal('village_knowledge') : openLocal('village_home', { build: '1' })) : undefined}
                />
              )
            })}
          </CardGrid>
        </div>
      )}
      <PSec>{t('city.affairs')}</PSec>
      <div className="hub-grid">
        {items.map((it) => (
          <PTile
            key={it.key} icon={it.icon} title={t(it.label)} tone={it.key === 'leave' ? 'danger' : undefined}
            onClick={() => (it.command ? run(it.command) : openLocal(it.local!, it.args))}
          />
        ))}
      </div>
    </ScreenScroll>
  )
}

