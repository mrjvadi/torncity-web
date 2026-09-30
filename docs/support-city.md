# Support city and travel (client)

The village tab shows where the player is (`src/support/location.ts`):
Support (3D city, `support_home`), on the road (`support_journey`), their own
village (`village_home`) or a foreign one (`village_visit`, the coarse layout).
Players never live in Support: the city shows "visiting" and a return button.

## Server contract the client codes against (mocked with `?mock=1&loc=support|village|foreign|travel`)

- `bootstrap.location`: `{kind: city|settlement|travelling, code, name, settlement_id?, from?, to?, mode_code?, mode_name?, remaining_seconds?, total_seconds?, arrives_at?}`.
  Absent = old behaviour (own village or the founding call).
- `travel.destinations` -> view `{destinations: [{kind: city|village, code, name, settlement_id?, emblem?, motto?, distance_km, duration_seconds?, fare?}]}`;
  falls back to `map.cities`.
- `travel.options {city: code}` / `travel.start {city, mode, max}` as documented; `city` is the destination's `code` (a village's code too).
- On arrival the bootstrap's `location` moves to the destination; the client polls the bootstrap while the journey runs.

## Service -> building (src/support/services.ts)
Each service is a kit building; a tap opens the command's screen. Districts in `cityPlan.ts`.
