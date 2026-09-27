import type { ScreenSet } from '../types'

import ActivityHub from './ActivityHub'
import EconomyHub from './EconomyHub'
import SocietyHub from './SocietyHub'

import Profile from './Profile'
import Dashboard from './Dashboard'
import Bank from './Bank'
import Inventory from './Inventory'
import { Market, Book } from './Market'
import JobStatus from './JobStatus'
import CrimeHub, { CrimeList } from './CrimeHub'
import Education from './Education'
import Life from './Life'
import { PropertyMarket, PropertyMine } from './Property'
import { Exchange, Portfolio } from './Stocks'
import { FactionHome, FactionList } from './Factions'
import { Elections, Election } from './Elections'
import Governance from './Governance'
import { TravelOptions, TravelStatus } from './Travel'
import Missions from './Missions'
import Leaderboard from './Leaderboard'
import Hospital from './Hospital'
import { InboxHub, InboxCategory } from './Inbox'

// Native layouts for server screens, by the server's `screen` name, and the
// three hubs (client-only, opened by the dock). See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    profile: Profile,
    dashboard: Dashboard,
    bank: Bank,
    inventory: Inventory,
    market: Market,
    book: Book,
    job_status: JobStatus,
    crime_hub: CrimeHub,
    crime_list: CrimeList,
    education: Education,
    life: Life,
    property_market: PropertyMarket,
    property_mine: PropertyMine,
    exchange: Exchange,
    portfolio: Portfolio,
    faction_home: FactionHome,
    faction_list: FactionList,
    elections: Elections,
    election: Election,
    city_governance: Governance,
    travel_options: TravelOptions,
    travel_status: TravelStatus,
    mission_board: Missions,
    leaderboard: Leaderboard,
    hospital: Hospital,
    inbox_hub: InboxHub,
    inbox_category: InboxCategory,
  },
  LOCAL: {
    activity_hub: ActivityHub,
    economy_hub: EconomyHub,
    society_hub: SocietyHub,
  },
}

export default screens
