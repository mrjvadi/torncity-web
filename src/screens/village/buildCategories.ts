// The build catalogue's categories. The content carries each building's `role` (settlement_buildings.yml) and the
// build menu line passes it on, but no category field exists yet, so the grouping is derived from the role here.
// Server follow-up: a `build_category` on each settlement building (and function) so content owns this table.

import type { Key } from '../../i18n'

export type BuildCat = 'housing' | 'shops' | 'construction' | 'production' | 'farming' | 'public' | 'security' | 'other'

export const BUILD_CATS: { code: BuildCat; label: Key }[] = [
  { code: 'housing', label: 'build.cat.housing' },
  { code: 'shops', label: 'build.cat.shops' },
  { code: 'construction', label: 'build.cat.construction' },
  { code: 'production', label: 'build.cat.production' },
  { code: 'farming', label: 'build.cat.farming' },
  { code: 'public', label: 'build.cat.public' },
  { code: 'security', label: 'build.cat.security' },
  { code: 'other', label: 'build.cat.other' },
]

const BY_ROLE: Record<string, BuildCat> = {
  housing: 'housing',
  market: 'shops', finance: 'shops',
  infrastructure: 'construction', forestry: 'construction', extraction: 'construction', storage: 'construction',
  craft: 'production',
  food: 'farming', water_infra: 'farming',
  governance: 'public', health: 'public', education: 'public', recreation: 'public', transport: 'public',
  security: 'security', military: 'security',
}

export const buildCatOf = (role: string | undefined): BuildCat => BY_ROLE[role ?? ''] ?? 'other'
