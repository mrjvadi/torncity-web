import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { SOCIETY_TILES } from './kit/hubs'
import { MOCK_VILLAGE_IDS } from '../../api/mock_village_ids'
import { t } from '../../i18n'

// In offline mock mode there is no world map yet to walk to a neighbouring
// village from, so the hub offers one directly (the coarse, non-member view).
const MOCK = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mock') === '1'

export default function SocietyHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title={t('hub.society')} tone="violet" />
      <div className="nx-hub-body">
        <TileGrid>
        {SOCIETY_TILES.map((tile) => (
          <Tile
            key={tile.key}
            icon={tile.icon}
            palette={tile.palette}
            title={t(tile.title)}
            sub={tile.sub ? t(tile.sub) : undefined}
            onClick={() => (tile.command ? run(tile.command) : openLocal(tile.local!))}
          />
        ))}
        {MOCK && <Tile icon="world" palette="sapphire" title={t('hub.neighbour')} onClick={() => openLocal('village_home', { id: MOCK_VILLAGE_IDS.other })} />}
        </TileGrid>
      </div>
    </ScreenScroll>
  )
}
