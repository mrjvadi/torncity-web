import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { SOCIETY_TILES } from './kit/hubs'
import { MOCK_VILLAGE_IDS } from '../../api/mock_village_ids'

// In offline mock mode there is no world map yet to walk to a neighbouring
// village from, so the hub offers one directly (the coarse, non-member view).
const MOCK = typeof location !== 'undefined' && new URLSearchParams(location.search).get('mock') === '1'

export default function SocietyHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title="جامعه" tone="violet" />
      <div className="nx-hub-body">
        <TileGrid>
        {SOCIETY_TILES.map((t) => (
          <Tile
            key={t.key}
            icon={t.icon}
            palette={t.palette}
            title={t.title}
            sub={t.sub}
            onClick={() => (t.command ? run(t.command) : openLocal(t.local!))}
          />
        ))}
        {MOCK && <Tile icon="world" palette="sapphire" title="روستای همسایه" onClick={() => openLocal('village_home', { id: MOCK_VILLAGE_IDS.other })} />}
        </TileGrid>
      </div>
    </ScreenScroll>
  )
}
