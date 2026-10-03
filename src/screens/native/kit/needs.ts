import type { CourseNeed } from '../../../api/views.gen'
import type { ContentNames } from '../../../village/useVillage'
import { t } from '../../../i18n'

/** What a place still lacks for something it does not offer, one line each, in everyday words: research the head can
 * do, a building the head can raise, a teacher. Names come from the catalogue, the server's authored name last. */
export function needLines(needs: CourseNeed[] | null | undefined, names: ContentNames, buildingName: (code: string, authored?: string) => string): string[] {
  const out: string[] = []
  for (const n of needs ?? []) {
    switch (n.kind) {
      case 'knowledge': out.push(t('education.gap.need.knowledge', { name: names.name('knowledge', n.code, n.name || n.code) })); break
      case 'building': out.push(t('education.gap.need.building', { name: n.code ? buildingName(n.code, n.name) : names.name('building_role', n.role, n.role) })); break
      case 'teacher': out.push(t('education.gap.need.teacher', { name: names.name('building_role', n.role, n.role) })); break
      default: break
    }
  }
  return out
}
