import type { CourseNeed, TripHint } from '../../../api/views.gen'
import type { ContentNames } from '../../../village/useVillage'
import { t } from '../../../i18n'
import { money, roughDuration } from './format'

/** What a place still lacks for something it does not offer, one line each, in everyday words: research the head can
 * do, a building the head can raise, a teacher. Names come from the catalogue, the server's authored name last. */
export function needLines(needs: CourseNeed[] | null | undefined, names: ContentNames, buildingName: (code: string, authored?: string) => string): string[] {
  const out: string[] = []
  for (const n of needs ?? []) {
    switch (n.kind) {
      case 'knowledge': out.push(t('education.gap.need.knowledge', { name: names.name('knowledge', n.code, n.name || n.code) })); break
      case 'building': out.push(t('education.gap.need.building', { name: n.code ? buildingName(n.code, n.name) : names.name('building_role', n.role, n.role) })); break
      case 'teacher': out.push(n.role ? t('education.gap.need.teacher', { name: names.name('building_role', n.role, n.role) }) : t('education.gap.need.teacher_post')); break
      default: break
    }
  }
  return out
}

/** How far the nearest place is, from the travel quote the server attached (fare and wait); empty when it is not known. */
export function tripLine(trip: TripHint | null | undefined): string {
  return trip ? t('trip.hint', { fare: money(trip.fare), wait: roughDuration(trip.wait_seconds) }) : ''
}
