import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { SOCIETY_TILES, type HubTile } from './kit/hubs'
import { useAvailable, useStage } from '../../lib/availability'
import { MOCK_VILLAGE_IDS } from '../../api/mock_village_ids'
import { t } from '../../i18n'

// In offline mock mode there is no world map yet to walk to a neighbouring
// village from, so the hub offers one directly (the coarse, non-member view).
const MOCK = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mock') === '1'

/** A tile that the data says does not exist for this player is not listed at all. */
function HubTileView({ tile, run, openLocal }: { tile: HubTile } & Pick<ScreenProps, 'run' | 'openLocal'>) {
  const stage = useStage()
  const there = useAvailable(tile.needs?.kind ?? '', tile.needs?.code ?? '')
  if (tile.needs && there !== true) return null
  // the village's government is the village head's «دهیاری», not a city government
  const title = tile.key === 'government' && stage === 'village' ? t('hub.government_village') : t(tile.title)
  return (
    <Tile icon={tile.icon} palette={tile.palette} title={title} sub={tile.sub ? t(tile.sub) : undefined}
      onClick={() => (tile.command ? run(tile.command) : openLocal(tile.local!))} />
  )
}

export default function SocietyHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title={t('hub.society')} tone="violet" />
      <div className="nx-hub-body">
        <TileGrid>
        {SOCIETY_TILES.map((tile) => <HubTileView key={tile.key} tile={tile} run={run} openLocal={openLocal} />)}
        {MOCK && <Tile icon="world" palette="sapphire" title={t('hub.neighbour')} onClick={() => openLocal('village_home', { id: MOCK_VILLAGE_IDS.other })} />}
        </TileGrid>
      </div>
    </ScreenScroll>
  )
}
