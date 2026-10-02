// The mock's copy of GET /api/v1/content for what the activities screens name (crime, work, study, skills, health,
// missions). Each area's mock file lists its own tables; this joins them. The web never shows the view's authored
// English name: it words every content entry from these tables.

import { CRIME_CONTENT } from './mock_act_crime'
import { WORK_CONTENT } from './mock_act_work'
import { HEALTH_CONTENT } from './mock_act_health'

export type ContentEntry = { code: string; name: { en: string; fa: string } }
export type ContentTables = Record<string, ContentEntry[]>

function join(...parts: ContentTables[]): ContentTables {
  const out: ContentTables = {}
  for (const p of parts) {
    for (const [table, entries] of Object.entries(p)) {
      const have = out[table] ?? (out[table] = [])
      for (const e of entries) if (!have.some((h) => h.code === e.code)) have.push(e)
    }
  }
  return out
}

export const ACTIVITIES_CONTENT: ContentTables = join(CRIME_CONTENT, WORK_CONTENT, HEALTH_CONTENT)
