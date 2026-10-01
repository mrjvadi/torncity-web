// Mock data for this area's real, server-backed screens (friends/search), used by ?mock=1
// (src/api/mock.ts) and by this area's own dev harness (src/screens/features/dev). `screen` is the
// fixed name (internal/telegram/screens/views.go) and `view` is structured. The military and war
// screens answer in the neutral contract from src/api/mock_military.ts.

import type { Action, CommandResponse } from './types'

const NAV_BACK = (command: string, label = 'بازگشت'): Action => ({ label, command, row: 9, kind: 'back', icon: 'action:default' })

const FRIENDS: CommandResponse = {
  ok: true, screen: 'friends',
  view: {
    friends: [
      { id: 'p1', name: 'کاوه', status: 'accepted', incoming: false },
      { id: 'p2', name: 'نیلوفر', status: 'pending', incoming: true },
      { id: 'p3', name: 'آرش', status: 'blocked', incoming: false },
    ],
    page: 1, pages: 1,
  },
  actions: [
    { label: 'قبول نیلوفر', command: 'social.friend.accept', args: { id: 'p2' }, row: 0, kind: 'primary', icon: 'action:accept' },
    NAV_BACK('player.profile.get'),
  ],
}

function searchResponse(query: string): CommandResponse {
  if (!query) {
    return { ok: true, screen: 'search', view: { help: true, by: '', query: '', found: null }, actions: [NAV_BACK('player.profile.get')] }
  }
  return {
    ok: true, screen: 'search',
    view: { help: false, by: 'username', query, found: { id: 'p9', code: 'B3C4D5F', name: 'کاوه', self: false } },
    actions: [
      { label: 'افزودن دوست کاوه', command: 'social.friend.add', args: { id: 'p9' }, row: 0, kind: 'primary', icon: 'action:social' },
      { label: 'پرداخت به کاوه', command: 'bank.pay', args: { code: 'B3C4D5F' }, row: 0, kind: 'navigation', icon: 'action:pay' },
      NAV_BACK('player.profile.get'),
    ],
  }
}

/** A mock answer for this area's real, server-backed commands — used by
 * ?mock=1 and by this area's own dev harness. Returns null for anything
 * outside friends/search, so the caller can fall back to its
 * own generic mock. */
export function mockFeatureCommand(command: string, args?: Record<string, unknown>): CommandResponse | null {
  if (command === 'social.friend.list') return FRIENDS
  if (command === 'social.search') return searchResponse(String(args?.query ?? args?.q ?? ''))
  return null
}
