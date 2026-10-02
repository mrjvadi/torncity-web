// The companies of a city, drawn from the view and the actions of each answer (docs/adr/0039-presentation-split.md):
// the registry, a company's page, the kinds of business a player may found, founding one, the companies a player
// runs, its openings and staff, an opening as a job seeker sees it, closing a company, and a refused request.
// Content names (kinds of business, careers, places, cities) come from the content catalogue.

import type {
  CompanyAppliedView, CompanyCloseView, CompanyFoundedView, CompanyMineView, CompanyOpeningView, CompanyOpeningsView, CompanyPageView,
  CompanyRefusalView, CompanyRegistryView, CompanyStaffView, CompanyTypeView, CompanyTypesView, CompanyOpeningLine,
} from '../../api/views.gen'
import { ListRow, Stat, StatPair } from '../native/kit/Parts'
import Popup, { ActionButton, ActionRow } from '../../ui/Popup'
import { hasKey, t, type Key } from '../../i18n'
import { Btns, flow, isBack, registerFlow } from '../village/flow'
import { Purses } from '../economy/kit'
import { bps } from '../economy/kit'
import {
  BackBtn, Checks, Facts, Hint, Lead, Notice, NotReached, One, Page, Panel, Stars, WalkTo, byId, find, formatNumber, go, money, nameOf, roughDuration,
  reqLabel, typeReason,
} from './kit'
import { TABLES, goodName, jobTitle, careerName, namedOf } from './wording'

const key = (k: string) => k as Key
const col = { display: 'flex', flexDirection: 'column', gap: 8 } as const

/** A city's name from the catalogue. */
const cityOf = (ctx: { names: { name: (t: string[], c: string, a?: string) => string } }, code: string, name: string) => ctx.names.name([...TABLES.city], code, name)

/** The line under a company in a list: its kind of business, its staff and the places it is hiring for. */
function lineSub(type: string, staff: number, openings: number): string {
  return openings > 0
    ? t('co.line.hiring', { type, staff: formatNumber(staff), openings: formatNumber(openings) })
    : t('co.line.staff', { type, staff: formatNumber(staff) })
}

// -- the registry, a company's page ------------------------------------------------------------

const Registry = flow<CompanyRegistryView>(({ view: v, ctx }) => (
  <Page title={v.no_city ? t('co.registry.heading') : t('co.registry.title', { city: cityOf(ctx, v.city_code, v.city) })} tone="emerald">
    {v.no_city ? <Notice>{t('co.no_city')}</Notice> : (
      <>
        <Hint>{t('co.registry.hint')}</Hint>
        {(v.companies ?? []).length === 0 && <Notice>{t('co.registry.none')}</Notice>}
        <div style={col}>
          {(v.companies ?? []).map((l) => (
            <ListRow key={l.ref.code} icon="factory" palette={l.mine ? 'gold' : 'emerald'} title={l.ref.name}
              sub={lineSub(nameOf(ctx, TABLES.type, l.ref.type), l.staff, l.openings)} right={<Stars stars={l.stars} rated={l.rated} />}
              onClick={go(ctx, 'company.open', { code: l.ref.code })} />
          ))}
        </div>
        <Btns ctx={ctx} list={byId(ctx, 'company.register', 'company.mine')} />
      </>
    )}
    <BackBtn ctx={ctx} />
  </Page>
))

function OpeningRows({ ctx, list }: { ctx: Parameters<typeof go>[0]; list: CompanyOpeningLine[] }) {
  return (
    <div style={col}>
      {list.map((o) => (
        <ListRow key={o.no} icon="work" palette="gold" title={jobTitle(ctx.names, o.job)}
          sub={t('co.opening.sub', { career: careerName(ctx.names, o.job), wage: money(o.wage), free: formatNumber(Math.max(0, o.positions - o.filled)) })}
          onClick={go(ctx, 'company.opening', { no: o.no })} />
      ))}
    </div>
  )
}

const Page_ = flow<CompanyPageView>(({ view: v, ctx }) => {
  const products = (v.products ?? []).map((g) => goodName(ctx.names, g))
  const published = (v.published ?? []).map((n) => namedOf(ctx.names, TABLES.tech, n))
  return (
    <Page title={v.ref.name} tone="emerald">
      {v.dissolved && <Notice alert>{t('co.page.dissolved')}</Notice>}
      <Panel>
        <Facts rows={[
          { label: t('co.page.type'), value: nameOf(ctx, TABLES.type, v.ref.type) },
          { label: t('co.page.place'), value: `${ctx.names.name([...TABLES.place], v.place.code, v.place.name)}، ${cityOf(ctx, v.city_code, v.city)}` },
          { label: t('co.page.owner'), value: v.owner.name },
          ...(v.manager ? [{ label: t('co.page.manager'), value: v.manager.name }] : []),
          { label: t('co.page.staff'), value: t('co.of', { a: formatNumber(v.staff), b: formatNumber(v.max_staff) }) },
          { label: t('co.page.rating'), value: <Stars stars={v.stars} rated={v.rated} /> },
        ]} />
        {products.length > 0 && <Hint>{t('co.page.products', { list: products.join('، ') })}</Hint>}
        {published.length > 0 && <Hint>{t('co.page.published', { list: published.join('، ') })}</Hint>}
      </Panel>
      {(v.openings ?? []).length > 0 && !v.dissolved && (
        <>
          <Lead>{t('co.page.hiring')}</Lead>
          <OpeningRows ctx={ctx} list={v.openings ?? []} />
        </>
      )}
      <Btns ctx={ctx} list={byId(ctx, 'company.manage')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

// -- founding a company -----------------------------------------------------------------------------

const Types = flow<CompanyTypesView>(({ view: v, ctx }) => {
  const types = v.types ?? []
  const open = types.filter((x) => !x.unavailable)
  const locked = types.filter((x) => x.unavailable)
  const travel = find(ctx, 'support.travel')
  const near = locked.find((x) => x.unavailable?.nearest)?.unavailable?.nearest
  return (
    <Page title={v.no_city ? t('co.register.heading') : t('co.register.title', { city: cityOf(ctx, v.city_code, v.city) })} tone="emerald">
      {v.no_city ? <Notice>{t('co.no_city')}</Notice> : (
        <>
          <Hint>{t('co.register.intro')}</Hint>
          {v.max > 0 && v.owned >= v.max && <Notice alert>{t('co.at_limit', { max: formatNumber(v.max) })}</Notice>}
          {types.length === 0 && <Notice>{t('co.types.none')}</Notice>}
          <div style={col}>
            {open.map((x) => (
              <ListRow key={x.type.code} icon="factory" palette="emerald" title={nameOf(ctx, TABLES.type, x.type)}
                sub={t('co.type.cost', { fee: money(x.fee), upkeep: money(x.upkeep) })}
                right={x.licensed ? t('co.type.licensed') : undefined}
                onClick={go(ctx, 'company.type', { type: x.type.code })} />
            ))}
          </div>
          {locked.length > 0 && (
            <>
              <Lead>{t('co.types.locked')}</Lead>
              <div style={col}>
                {locked.map((x) => (
                  <ListRow key={x.type.code} icon="m_lock" palette="steel" title={nameOf(ctx, TABLES.type, x.type)}
                    sub={x.unavailable ? typeReason(ctx, x.unavailable) : undefined} />
                ))}
              </div>
              {travel && near && <One ctx={ctx} id="support.travel" tone="gold" label={t('eco.na.go', { city: cityOf(ctx, near.code, near.name) })} />}
            </>
          )}
        </>
      )}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const TypeDetail = flow<CompanyTypeView>(({ view: v, ctx }) => {
  const name = nameOf(ctx, TABLES.type, v.type)
  const place = ctx.names.name([...TABLES.place], v.place.code, v.place.name)
  const careers = (v.careers ?? []).map((j) => careerName(ctx.names, j)).join('، ')
  const found = byId(ctx, 'company.found_cash', 'company.found_card')
  const rank = v.rank?.career_code ? ctx.names.name(['career_tier'], `${v.rank.career_code}.${v.rank.rank}`, v.rank.title) : ''
  return (
    <Page title={t('co.type.title', { type: name, city: cityOf(ctx, v.city_code, v.city) })} tone="emerald">
      <Panel>
        <Facts rows={[
          { label: t('co.type.place'), value: place },
          ...(careers ? [{ label: t('co.type.careers'), value: careers }] : []),
          { label: t('co.type.max_staff'), value: formatNumber(v.max_staff) },
          { label: t('co.type.fee'), value: money(v.fee), gold: true },
          { label: t('co.type.upkeep'), value: t('co.type.upkeep_value', { amount: money(v.upkeep), period: roughDuration(v.period_seconds) }) },
        ]} />
        <Hint>{t('co.type.explain')}</Hint>
      </Panel>
      {v.blocked === 'stage' && v.unavailable && (
        <Panel tone="sapphire"><NotReached ctx={ctx} u={v.unavailable} /></Panel>
      )}
      {v.blocked === 'limit' && <Notice alert>{t('co.at_limit', { max: formatNumber(v.max) })}</Notice>}
      {v.blocked === 'no_place' && <Notice alert>{t('co.type.no_place', { place, city: cityOf(ctx, v.city_code, v.city) })}</Notice>}
      {v.blocked === 'no_city' && <Notice>{t('co.no_city')}</Notice>}
      {v.blocked === 'defence' && (
        <Panel>
          <Lead tone="bad">{t('co.type.defence')}</Lead>
          <Hint>{t('co.type.defence_rank', { career: v.rank?.career_code ? careerName(ctx.names, v.rank) : '', rank })}</Hint>
          <Hint>{t('co.type.defence_contractor')}</Hint>
          <Btns ctx={ctx} list={byId(ctx, 'job.openings')} />
        </Panel>
      )}
      {!v.blocked && v.way && <WalkTo way={v.way} ctx={ctx} />}
      {!v.blocked && !v.way && v.payment && (
        <Panel>
          <Purses p={v.payment} />
          {found.length > 0 ? (
            <>
              <Hint>{t('co.type.found_how', { lo: formatNumber(v.name_min), hi: formatNumber(v.name_max) })}</Hint>
              <Btns ctx={ctx} list={found} tone="gold" />
            </>
          ) : <Lead tone="bad">{t('co.type.cannot_pay')}</Lead>}
        </Panel>
      )}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Founded = flow<CompanyFoundedView>(({ view: v, ctx }) => (
  <Page title={t('co.founded.title')} tone="emerald">
    <Panel tone="emerald">
      <Lead tone="good">{t('co.founded.body', { name: v.ref.name, city: cityOf(ctx, v.city_code, v.city) })}</Lead>
      <Hint>{t(v.method === 'card' ? 'co.founded.paid_card' : 'co.founded.paid_cash', { fee: money(v.fee) })}</Hint>
      <Hint>{t('co.founded.next')}</Hint>
    </Panel>
    <Btns ctx={ctx} list={byId(ctx, 'company.manage', 'company.page')} />
    <BackBtn ctx={ctx} />
  </Page>
))

// -- the companies a player runs --------------------------------------------------------------------

const Mine = flow<CompanyMineView>(({ view: v, ctx }) => (
  <Page title={t('co.mine.title')} tone="emerald">
    {(v.companies ?? []).length === 0 && <Notice>{t('co.mine.none')}</Notice>}
    <div style={col}>
      {(v.companies ?? []).map((l) => (
        <ListRow key={l.ref.code} icon="factory" palette={l.mine ? 'gold' : 'emerald'} title={l.ref.name}
          sub={lineSub(nameOf(ctx, TABLES.type, l.ref.type), l.staff, l.openings)}
          right={t(l.mine ? 'co.mine.owner' : 'co.mine.manager')}
          onClick={go(ctx, 'company.manage', { company: l.ref.code })} />
      ))}
    </div>
    <Btns ctx={ctx} list={byId(ctx, 'company.register')} />
    <BackBtn ctx={ctx} />
  </Page>
))

const Openings = flow<CompanyOpeningsView>(({ view: v, ctx }) => {
  const posts = byId(ctx, 'company.post')
  return (
    <Page title={t('co.openings.title', { name: v.ref.name })} tone="emerald">
      {(v.openings ?? []).length === 0 && <Notice>{t('co.openings.none')}</Notice>}
      {(v.openings ?? []).map((o) => (
        <Panel key={o.no}>
          <ListRow icon="work" palette="gold" title={jobTitle(ctx.names, o.job)}
            sub={t('co.openings.line', { wage: money(o.wage), filled: formatNumber(o.filled), positions: formatNumber(o.positions) })} />
          <Btns ctx={ctx} row list={ctx.acts.filter((a) => a.args?.no === String(o.no) && ['company.slot_up', 'company.slot_down', 'company.slot_close'].includes(a.id ?? ''))} />
        </Panel>
      ))}
      <Hint>{t('co.openings.citizens')}</Hint>
      {v.at_max ? <Notice alert>{t('co.openings.at_max')}</Notice> : v.room <= 0 ? <Notice alert>{t('co.openings.full')}</Notice> : (
        posts.length > 0 && (
          <Panel>
            <Lead>{t('co.openings.post', { wage: money(v.minimum_wage) })}</Lead>
            <Btns ctx={ctx} list={posts} />
          </Panel>
        )
      )}
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Staff = flow<CompanyStaffView>(({ view: v, ctx }) => {
  const f = v.firing
  return (
    <Page title={t('co.staff.title', { name: v.ref.name })} tone="emerald">
      {v.decided && <Notice>{t(v.hired ? 'co.staff.hired' : 'co.staff.rejected', { player: v.decided.player.name, title: jobTitle(ctx.names, v.decided.job) })}</Notice>}
      {(v.applications ?? []).length > 0 && (
        <>
          <Lead>{t('co.staff.applications')}</Lead>
          {(v.applications ?? []).map((ap) => (
            <Panel key={ap.no}>
              <ListRow icon="person" palette="gold" title={ap.player.name}
                sub={t('co.staff.application', { title: jobTitle(ctx.names, ap.job), level: formatNumber(ap.level) })} />
              <Btns ctx={ctx} row list={ctx.acts.filter((a) => a.args?.no === String(ap.no) && ['company.accept', 'company.reject'].includes(a.id ?? ''))} />
            </Panel>
          ))}
        </>
      )}
      {(v.employees ?? []).length === 0 && <Notice>{t('co.staff.none')}</Notice>}
      <div style={col}>
        {(v.employees ?? []).map((e) => {
          const fire = ctx.acts.find((a) => a.id === 'company.fire' && a.args?.player === e.player.code)
          return (
            <Panel key={e.player.code}>
              <ListRow icon="person" palette={e.working ? 'emerald' : 'steel'} title={e.player.name}
                sub={t(e.working ? 'co.staff.employee_working' : 'co.staff.employee', { title: jobTitle(ctx.names, e.job), wage: money(e.wage), shifts: formatNumber(e.shifts) })} />
              {fire && <Btns ctx={ctx} list={[fire]} />}
            </Panel>
          )
        })}
      </div>
      {v.citizens.vacant > 0 && (
        <Hint>{v.citizens.workers > 0
          ? t('co.citizens.working', { workers: formatNumber(v.citizens.workers), vacant: formatNumber(v.citizens.vacant), wages: money(v.citizens.wages) })
          : t('co.citizens.unpaid', { vacant: formatNumber(v.citizens.vacant) })}</Hint>
      )}
      <BackBtn ctx={ctx} />
      {f && (
        <Popup open onClose={() => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }} title={t('co.staff.fire_title')} tone="red"
          footer={(
            <ActionRow>
              {ctx.acts.filter((a) => a.id === 'company.fire_confirm').map((a) => (
                <ActionButton key="y" tone="red" disabled={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>
              ))}
              <ActionButton tone="steel" onClick={() => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }}>{t('vx.cancel')}</ActionButton>
            </ActionRow>
          )}>
          <p className="pp-note">{t('co.staff.fire_confirm', { player: f.player.name, title: jobTitle(ctx.names, f.job) })}</p>
        </Popup>
      )}
    </Page>
  )
})

// -- an opening as a job seeker sees it ---------------------------------------------------------------

const Opening = flow<CompanyOpeningView>(({ view: v, ctx }) => {
  const title = jobTitle(ctx.names, v.job)
  return (
    <Page title={title} tone="gold">
      <Panel>
        <Facts rows={[
          { label: t('co.opening.employer'), value: v.company.name },
          { label: t('co.opening.career'), value: careerName(ctx.names, v.job) },
          { label: t('co.opening.where'), value: `${ctx.names.name([...TABLES.place], v.place.code, v.place.name)}، ${cityOf(ctx, v.city_code, v.city)}` },
          { label: t('co.opening.free'), value: formatNumber(v.free) },
        ]} />
        <StatPair
          left={<Stat icon="coins" palette="gold" label={t('co.opening.wage')} value={money(v.wage)} />}
          right={<Stat icon="energy" palette="emerald" label={t('co.opening.energy')} value={formatNumber(v.energy_cost)} />}
        />
        <Hint>{t('co.opening.shift', { t: roughDuration(v.shift_length_seconds) })}</Hint>
      </Panel>
      {(v.requirements ?? []).length > 0 && (
        <Panel>
          <Lead>{t('co.opening.requirements')}</Lead>
          <Checks lines={(v.requirements ?? []).map((r) => ({ label: reqLabel(ctx, r), met: r.met }))} />
        </Panel>
      )}
      {v.closed && <Notice alert>{t('co.opening.closed')}</Notice>}
      {v.applied && <Notice>{t('co.opening.applied')}</Notice>}
      {v.employed && <Notice>{t('co.opening.employed')}</Notice>}
      {v.auto_accept && !v.applied && <Hint>{t('co.opening.auto')}</Hint>}
      <Btns ctx={ctx} list={byId(ctx, 'company.apply')} tone="gold" />
      <Btns ctx={ctx} list={byId(ctx, 'company.page')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

const Applied = flow<CompanyAppliedView>(({ view: v, ctx }) => (
  <Page title={t('co.applied.title')} tone="gold">
    <Panel tone="emerald">
      <Lead tone="good">{t('co.applied.body', { title: jobTitle(ctx.names, v.job), company: v.company.name })}</Lead>
    </Panel>
    <Btns ctx={ctx} list={byId(ctx, 'job.openings', 'company.page')} />
    <BackBtn ctx={ctx} />
  </Page>
))

// -- closing a company -------------------------------------------------------------------------------

const Close = flow<CompanyCloseView>(({ view: v, ctx }) => {
  if (v.done) {
    return (
      <Page title={t('co.close.done_title')} tone="emerald">
        <Panel>
          <Lead>{t('co.close.done', { name: v.ref.name })}</Lead>
          <Hint>{t('co.close.done_money', { net: money(v.net), tax: money(v.tax) })}</Hint>
        </Panel>
        <Btns ctx={ctx} list={byId(ctx, 'company.registry')} />
        <BackBtn ctx={ctx} />
      </Page>
    )
  }
  const cancel = () => { const b = ctx.acts.find(isBack); if (b) ctx.go(b) }
  return (
    <>
      <Page title={t('co.close.title')} tone="ruby"><BackBtn ctx={ctx} /></Page>
      <Popup open onClose={cancel} title={t('co.close.confirm', { name: v.ref.name })} tone="red"
        footer={(
          <ActionRow>
            {ctx.acts.filter((a) => a.id === 'company.close_confirm').map((a) => (
              <ActionButton key="y" tone="red" disabled={ctx.busy} onClick={() => ctx.go(a)}>{ctx.label(a)}</ActionButton>
            ))}
            <ActionButton tone="steel" onClick={cancel}>{t('vx.cancel')}</ActionButton>
          </ActionRow>
        )}>
        <p className="pp-note">{t('co.close.money', { debt: money(v.debt_paid), tax: money(v.tax), net: money(v.net) })}</p>
        {v.staff > 0 && <p className="pp-note">{t('co.close.staff', { staff: formatNumber(v.staff) })}</p>}
        <p className="pp-note pp-note-bad">{t('co.close.final')}</p>
      </Popup>
    </>
  )
})

// -- a refused request -------------------------------------------------------------------------------

/** What a refusal of this area says, by its kind, with the numbers and names it carries. */
export const CompanyRefusal = flow<CompanyRefusalView>(({ view: v, ctx }) => {
  const k = `co.refused.company.${v.kind}`
  const wage = money(v.min)
  return (
    <Page title={t('co.refused.title')} tone="ruby">
      <Panel>
        <Lead tone="bad">{hasKey(k) ? t(key(k), {
          name: v.ref.name, need: money(v.need), have: money(v.have), lo: formatNumber(v.min), hi: formatNumber(v.max), max: formatNumber(v.max), wage,
          city: cityOf(ctx, v.city_code, v.city),
        }) : t('refusal.unknown')}</Lead>
      </Panel>
      <Btns ctx={ctx} list={byId(ctx, 'job.my_job')} />
      <BackBtn ctx={ctx} />
    </Page>
  )
})

/** The rating of a period's quality, in percent. */
export const quality = (b: number) => bps(b)

registerFlow({
  company_registry: Registry, company_page: Page_, company_types: Types, company_type_detail: TypeDetail, company_founded: Founded,
  company_mine: Mine, company_openings: Openings, company_staff: Staff, company_opening: Opening, company_applied: Applied,
  company_close: Close, company_refusal: CompanyRefusal,
})

export const COMPANY_SCREENS = [
  'company_registry', 'company_page', 'company_types', 'company_type_detail', 'company_founded', 'company_mine', 'company_openings',
  'company_staff', 'company_opening', 'company_applied', 'company_close', 'company_refusal',
]
