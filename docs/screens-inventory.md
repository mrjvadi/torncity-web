# Screens inventory (2026-09-30)

How the web client turns a `POST /api/v1/command` answer into a screen, which
screens are native (built from the structured `view`), and which still fall
back to the server's Telegram text.

## The render path

1. `Shell` (src/ui/Shell.tsx) runs the command; `useScreen` returns the
   `CommandResponse` `{ok, screen, text, view, actions, notice}`.
2. `SERVER_SCREENS[response.screen]` (src/screens/registry.ts, filled from
   `native/`, `more/`, `features/`, `village/`, `founding/`) is the native
   component. It gets `ScreenProps` and reads `response.view`.
3. No entry: **`GenericScreen`** (src/ui/GenericScreen.tsx) prints
   `response.text` (the exact Telegram rendering, sanitized HTML) in one card,
   then every action as a button. This is the "copied from Telegram" look.
4. `LOCAL_SCREENS[name]` are client-only (hubs, previews of features the
   server lacks, the founding form, the village).

## Coverage

The server names 195 screens (`Screen*` in internal/telegram/screens/views.go);
**every one except `hunger_notice` carries a structured `view`** (see
`testdata/view-snapshots/*/*.json`); production, company, military and war
have no view at all (contract 3.1).

| how it renders | count | screens |
|---|---|---|
| Native from `view` (before this work) | 57 | profile, dashboard, bank, inventory, market, book, job_status, job_openings, job_detail, crime_hub/list/detail/result/started, education, life, skills, achievements, card, settings, shops, finance_hub, property_market/mine, exchange, portfolio, faction_home/list, elections, election, city_governance, travel_options/status, mission_board, leaderboard, hospital, inbox_hub/category, friends/search, village *, founding |
| **Telegram-text fallback** (`GenericScreen`) | ~138 | see the groups below |
| Client-only local | ~40 | hubs, war, family, dating, chats, press, casino, misc: previews of features the server has not built |

### The fallback screens, by group

* **Result / notice screens (about 45)**: shift_worked, shift_started, job_hired, job_promoted, item_used/given/dropped, enrolled, course_completed, treated, walk_started, travel_started/arrived, pay_sent, payment_notice, order_placed/cancelled, bid_placed, shop_bought/sold, faction_founded/left/answered/linked, stood, voted, policy_announced, appoint_done, achievement_notice, rank_notice, *_notice pushes.
* **Refusals (about 25)**: refusal, not_here, crime_refusal, market_refusal, shop_refusal, faction_refusal, finance_refusal, health_refusal, property_refusal, item_refusal, life_refusal, auction_refusal, bill_refusal, diplomacy_refusal, election_refusal, recruit_refusal, village_refusal, policy_refused, appoint_refusal, payment_declined, sanction_blocked.
* **Confirmation screens (about 15)**: pay_confirm, drop_confirm, treat_confirm, insure_confirm, loan_confirm, shop_checkout, market_checkout, travel_checkout, report_confirm, faction_confirm, policy_confirm, allocation_confirm, appoint/dismiss_confirm, settlement_build_confirm.
* **Real content screens (about 50)**: city_map, cities, item_detail, jail, course_detail, crime_record, cases, my_orders, sell_offers, stock, stock_order, listing, dividend, gold, gold_trade, savings, insurance, loan_offer/detail, faction_page/members/bank/crime, property/property_type/offer/leave, my_office, lever_edit, allocation_edit, budget, bills/bill, treaties/propose/end_treaty/sanctions/impose/lift/diplomacy_history, auctions/auction_detail/new/opened/my_auctions, mission/missions_mine, recruit_*, specialists, devices, device_link, avatars, history, pay, sleep_pay, shop_detail.

The mock (`src/api/mock*.ts`) answers 53 screens; the rest cannot be opened in
mock mode.

## Language

Before: `t()` had Persian only, and ~1,400 Persian literals were inlined in
screens and shell. There was no language switch and `dir` was hard-wired RTL.

## Priority (what to port, in order)

1. **Language infrastructure**: fa/en, `dir`, digits, fonts, switch + server sync (done here).
2. **Profile** (the home of the "me" tab) in the proto's frame: identity card, wealth grid, needs, achievements medals, language switch (done here).
3. **Native fallback family** (one component set covers ~85 screens): result, refusal and confirmation screens drawn from their views with the kit (done here).
4. Basic screens' text through `t()`: inventory, bank, job, education, life, skills, settings, hospital, travel, market, hubs (done here).
5. Content screens with a proto counterpart and no native screen: city_map, cities, item_detail, jail, course_detail, savings/insurance/loans, my_orders, missions_mine, devices.
6. The remaining content screens (governance edits, diplomacy, auctions, factions deep pages, recruit).
7. Client-only previews (features/*): text still Persian-only; move to `t()` when the server builds them.
