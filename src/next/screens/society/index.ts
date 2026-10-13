// جامعه (society) in the new UI: messages, friends, elections, factions and the city's government. The hub itself is
// the local `society` screen in screens/hubs; these are the server screens it leads to, keyed by the answer's
// `screen`. Diplomacy, unions, the legislature and war are drawn by the generic screen until they have their own.

import type { NArea } from '../../registry'
import { InboxCategory, InboxHub } from './Inbox'
import { FriendAccepted, FriendDetail, FriendRemoveAsk, FriendRemoved, FriendRequested, Friends, Search } from './Friends'
import { Election, ElectionRefusal, Elections, Stood, Voted } from './Elections'
import {
  FactionAnswered, FactionApplied, FactionBank, FactionConfirm, FactionCrime, FactionFound, FactionFounded, FactionHome, FactionInvited, FactionLeft,
  FactionLinked, FactionList, FactionMembers, FactionPage, FactionRefusal,
} from './Factions'
import {
  AllocationConfirm, AllocationEdit, AppointConfirm, AppointDone, AppointRefusal, CityGovernance, DismissConfirm, GovHistory, LeverEdit, MyOffice,
  PolicyAnnounced, PolicyConfirm, PolicyRefused,
} from './Governance'

const area: NArea = {
  server: {
    // messages
    inbox_hub: InboxHub, inbox_category: InboxCategory,
    // friends
    friends: Friends, search: Search, friend_detail: FriendDetail, friend_remove_ask: FriendRemoveAsk, friend_removed: FriendRemoved,
    friend_requested: FriendRequested, friend_accepted: FriendAccepted,
    // elections
    elections: Elections, election: Election, stood: Stood, voted: Voted, election_refusal: ElectionRefusal,
    // factions
    faction_home: FactionHome, faction_list: FactionList, faction_page: FactionPage, faction_members: FactionMembers, faction_bank: FactionBank,
    faction_crime: FactionCrime, faction_found: FactionFound, faction_founded: FactionFounded, faction_confirm: FactionConfirm,
    faction_invited: FactionInvited, faction_applied: FactionApplied, faction_answered: FactionAnswered, faction_left: FactionLeft,
    faction_linked: FactionLinked, faction_refusal: FactionRefusal,
    // the city's government
    city_governance: CityGovernance, my_office: MyOffice, lever_edit: LeverEdit, policy_confirm: PolicyConfirm, policy_announced: PolicyAnnounced,
    policy_refused: PolicyRefused, allocation_edit: AllocationEdit, allocation_confirm: AllocationConfirm, gov_history: GovHistory,
    appoint_confirm: AppointConfirm, dismiss_confirm: DismissConfirm, appoint_done: AppointDone, appoint_refusal: AppointRefusal,
  },
}
export default area
