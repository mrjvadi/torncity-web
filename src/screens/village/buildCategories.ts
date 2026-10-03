// The build catalogue's categories. The server owns the grouping (storage and market audit; ADR 0046 build menu): each
// menu line carries `category` (and the catalogue's `build_category`), one of the codes below, and the content's table
// `build_category` words them. This file only orders the groups and words them for the tab strip; a code the server
// adds that is not listed here still shows, at the end, under «سایر».

import type { Key } from '../../i18n'

export type BuildCat = string

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

const KNOWN = new Set(BUILD_CATS.map((c) => c.code))

/** The tab of a menu line: the server's own category (an unknown one is «سایر»). */
export const buildCatOf = (category: string | undefined): BuildCat => (category && KNOWN.has(category) ? category : 'other')
