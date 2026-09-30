import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { ACTIVITY_TILES } from './kit/hubs'
import { t } from '../../i18n'

export default function ActivityHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title={t('hub.activity')} tone="violet" />
      <div className="nx-hub-body">
        <TileGrid>
        {ACTIVITY_TILES.map((tile) => (
          <Tile
            key={tile.key}
            icon={tile.icon}
            palette={tile.palette}
            title={t(tile.title)}
            sub={tile.sub ? t(tile.sub) : undefined}
            onClick={() => (tile.command ? run(tile.command) : openLocal(tile.local!))}
          />
        ))}
        </TileGrid>
      </div>
    </ScreenScroll>
  )
}
