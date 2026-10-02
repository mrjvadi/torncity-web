import type { ScreenSet } from '../types'

import ActivityHub from './ActivityHub'
import EconomyHub from './EconomyHub'
import SocietyHub from './SocietyHub'

import Profile from './Profile'
import Dashboard from './Dashboard'
import Inventory from './Inventory'
import JobStatus from './JobStatus'
import CrimeHub, { CrimeList } from './CrimeHub'
import Education from './Education'
import Life from './Life'
import { PropertyMarket, PropertyMine } from './Property'
import Missions from './Missions'
import Hospital from './Hospital'
import WorkHome from './WorkHome'
import HealthHome from './HealthHome'
import { InboxHub, InboxCategory } from './Inbox'

// Native layouts for server screens, by the server's `screen` name, and the
// three hubs (client-only, opened by the dock). See ../registry.ts.
const screens: ScreenSet = {
  SERVER: {
    profile: Profile,
    dashboard: Dashboard,
    inventory: Inventory,
    job_status: JobStatus,
    crime_hub: CrimeHub,
    crime_list: CrimeList,
    education: Education,
    life: Life,
    property_market: PropertyMarket,
    property_mine: PropertyMine,
    mission_board: Missions,
    hospital: Hospital,
    work_home: WorkHome,
    health_home: HealthHome,
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
