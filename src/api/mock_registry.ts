// The land registry of the mock (ADR 0072), ?mock=1&reg=...: parcels, zones, claims, foundations, the quote then the confirm of every act, and the refusals.
// Commands: settlement.land.registry, parcel.join|split, zone.open|close, claim, foundation.lay. A lot token is "x-y" (m before a negative number).
import { A, back, mockOk } from './mock_neutral'
import type { ClaimLine, LandQuote, LandRegistryView, ParcelLine, RegCell, ZoneLine } from './views.gen'

const mode = () => { try { return new URLSearchParams(location.search).get('reg') ?? '' } catch { return '' } }
const N = (code: string, name: string) => ({ code, name })
const num = (s: string) => (s.startsWith('m') ? -Number(s.slice(1)) : Number(s))
const tok = (s: unknown): RegCell | null => { const m = /^(m?\d+)-(m?\d+)$/.exec(String(s ?? '').trim()); return m ? { x: num(m[1]), y: num(m[2]) } : null }
const rect = (a: RegCell, b: RegCell): RegCell[] => { const out: RegCell[] = []; for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push({ x, y }); return out }

const st = {
  seq: 5, notice: '', cash: 12450, stone: 3,
  parcels: [
    { id: 'p1', mine: true, treasury: false, cells: rect({ x: 3, y: 0 }, { x: 4, y: 1 }), use: 'home', zone: null as null | { code: string; name: string } },
    { id: 'p2', mine: true, treasury: false, cells: [{ x: 3, y: 2 }], use: 'home', zone: null },
    { id: 'p3', mine: false, treasury: true, cells: rect({ x: 1, y: 4 }, { x: 2, y: 4 }), use: 'commons', zone: N('z1', 'چراگاه شهر') },
    { id: 'p4', mine: false, treasury: false, cells: [{ x: 3, y: 4 }], use: 'home', zone: N('z2', 'بازار') },
  ],
  zones: [{ id: 'z1', name: 'چراگاه شهر', kind: 'commons', cells: 2, effective: true, at: -1 }] as { id: string; name: string; kind: string; cells: number; effective: boolean; at: number }[],
  claims: [{ id: 'c1', face: 2, gx: 411, gy: 233, ago: 6, until: 24 }, { id: 'c2', face: 2, gx: 412, gy: 233, ago: 2, until: 24 }],
  foundations: 1,
}
const ask = { act: '', args: {} as Record<string, string> }
const iso = (days: number) => new Date(Date.now() + days * 86400_000).toISOString()

const view = (notice = '', quote: LandQuote | null = null): LandRegistryView => {
  const m = mode()
  const zoningStart = m === 'rule' ? iso(1) : null
  const slopeStart = m === 'rule' ? iso(7) : null
  const parcels: ParcelLine[] = st.parcels.map((p) => ({
    id: p.id, owner: p.treasury ? N('', '') : p.mine ? N('me', 'تو') : N('x', 'سارا'), treasury: p.treasury, mine: p.mine, cells: p.cells, use: p.use, zone: p.zone,
    can_join: p.mine ? st.parcels.filter((q) => q.mine && q.id !== p.id && p.cells.some((a) => q.cells.some((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1))).map((q) => q.id) : null,
    can_split: p.mine && p.cells.length > 1,
  }))
  const zones: ZoneLine[] = st.zones.map((z) => ({ id: z.id, name: z.name, kind: z.kind, cells: z.cells, effective: z.effective, effective_at: z.effective ? null : iso(1), opened_by: N('me', 'تو'), can_close: m !== 'viewer' }))
  const claims: ClaimLine[] = st.claims.map((c) => ({ id: c.id, face: c.face, gx: c.gx, gy: c.gy, claimed_at: iso(-c.ago), paid_through: iso(c.until), rect: c.id === 'c1' ? { x: 0, y: 3, w: 2, d: 2 } : c.id === 'c2' ? { x: 3, y: 0, w: 1, d: 2 } : null }))
  return {
    village: 'آمل', notice, parcels, zones, claims, quote, foundations: st.foundations, zoning_on: m !== 'rule', zoning_starts_at: zoningStart, slope_on: m !== 'rule', slope_starts_at: slopeStart,
    can_zone: m !== 'viewer', can_close_zone: m !== 'viewer', can_claim: m !== 'viewer', can_lay_foundation: m !== 'viewer', zone_kinds: ['commons', 'core', 'residential', 'farm', 'industry', 'port', 'site', 'open'],
    parcel_max_cells: 24, zone_max_cells: 60, claim_max_tiles: 6, parcel_change_fee: 150, zone_open_fee: 40, claim_cost: 2500, claim_upkeep_per_day: 60, foundation_stone: 6, foundation_wage: 300,
    slope_flat_m: 5, slope_gentle_m: 15, slope_unusable_m: 30,
  }
}
const refuse = (kind: string) => mockOk('village_refusal', { kind, back: { command: 'settlement.land.registry', args: null }, remaining_seconds: 0, min: 0, max: 0, lots: null, missing: 0, action: '', subject: N('', ''), needs: null, personal: null, obstacles: null, foundation: null }, [back('settlement.land.registry')])
const quote = (act: string, cells: number, money: number, o: Partial<LandQuote> = {}): LandQuote => ({ act, args: [], cells, lot: null, money, stone_need: 0, stone_have: 0, stone_buy: 0, cash: st.cash, ...o })
const out = (notice = '', q: LandQuote | null = null) => mockOk('settlement_land_registry', view(notice, q), [back('settlement.land'), A('refresh', 'settlement.land.registry', {})])

export function mockRegistryCommand(command: string, a: Record<string, unknown>): unknown | null {
  const confirm = String(a.confirm ?? '') === 'confirm'
  switch (command) {
    case 'settlement.land.registry': return out()
    case 'settlement.parcel.join': {
      const k = st.parcels.find((p) => p.id === String(a.parcel)), w = st.parcels.find((p) => p.id === String(a.with))
      if (!k || !w || !k.mine || !w.mine) return refuse('land_not_yours')
      if (!confirm) return out('', quote('settlement:parcel.join', k.cells.length + w.cells.length, 150))
      k.cells = [...k.cells, ...w.cells]; st.parcels = st.parcels.filter((p) => p !== w); st.cash -= 150; return out('parcel_joined')
    }
    case 'settlement.parcel.split': {
      const p = st.parcels.find((x) => x.id === String(a.parcel)); const f = tok(a.from), t = tok(a.to)
      if (!p || !p.mine) return refuse('land_not_yours')
      if (!f || !t) return refuse('land_bad_cells')
      const cut = rect(f, t).filter((c) => p.cells.some((d) => d.x === c.x && d.y === c.y))
      if (!cut.length || cut.length !== rect(f, t).length) return refuse('land_not_one_parcel')
      if (cut.length === p.cells.length) return refuse('land_whole_parcel')
      if (!confirm) return out('', quote('settlement:parcel.split', cut.length, 150))
      p.cells = p.cells.filter((c) => !cut.some((d) => d.x === c.x && d.y === c.y)); st.parcels.push({ id: `p${++st.seq}`, mine: true, treasury: false, cells: cut, use: p.use, zone: null }); st.cash -= 150; return out('parcel_split')
    }
    case 'settlement.zone.open': {
      const f = tok(a.from), t = tok(a.to), name = String(a.name ?? '').trim(), kind = String(a.kind ?? '')
      if (name.length < 1 || name.length > 40) return refuse('land_zone_name')
      if (!kind) return refuse('land_zone_kind')
      if (!f || !t) return refuse('land_bad_cells')
      const cells = rect(f, t)
      if (cells.length > 60) return refuse('land_zone_size')
      if (cells.some((c) => st.parcels.some((p) => p.zone && p.cells.some((d) => d.x === c.x && d.y === c.y)))) return refuse('land_cell_zoned')
      if (cells.some((c) => st.parcels.some((p) => !p.mine && !p.treasury && p.cells.some((d) => d.x === c.x && d.y === c.y)))) return refuse('land_cell_owned')
      if (!confirm) return out('', quote('settlement:zone.open', cells.length, 40 * cells.length))
      st.zones.push({ id: `z${++st.seq}`, name, kind, cells: cells.length, effective: false, at: 1 }); st.cash -= 40 * cells.length; return out('zone_opened')
    }
    case 'settlement.zone.close': { const z = st.zones.find((x) => x.id === String(a.zone)); if (!z) return refuse('land_zone_none'); st.zones = st.zones.filter((x) => x !== z); return out('zone_closed') }
    case 'settlement.claim': {
      const c = tok(a.lot); if (!c) return refuse('land_bad_cells')
      if (st.claims.length >= 6) return refuse('land_claim_limit')
      if (c.x >= 0 && c.y >= 0 && c.x < 5 && c.y < 5) return refuse('land_tile_apart')
      if (!confirm) return out('', quote('settlement:claim', 1, 2500, { lot: c }))
      st.claims.push({ id: `c${++st.seq}`, face: 2, gx: 413, gy: 233, ago: 0, until: 24 }); st.cash -= 2500; return out('claimed')
    }
    case 'settlement.foundation.lay': {
      const c = tok(a.lot); if (!c) return refuse('land_bad_cells')
      if (c.x === 4 && c.y === 4) return refuse('land_too_steep')
      if (c.x === 2 && c.y === 2) return refuse('land_no_foundation_needed')
      if (!confirm) return out('', quote('settlement:foundation.lay', 1, 300, { lot: c, stone_need: 6, stone_have: st.stone, stone_buy: Math.max(0, 6 - st.stone) }))
      st.foundations++; return out('foundation_laid')
    }
  }
  return null
}
export const registryAsk = ask
void ask
