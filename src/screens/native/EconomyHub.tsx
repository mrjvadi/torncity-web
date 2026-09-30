import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { ECONOMY_TILES } from './kit/hubs'
import { t } from '../../i18n'

export default function EconomyHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title={t('hub.economy')} tone="emerald" />
      <div className="nx-hub-body">
        <TileGrid>
        {ECONOMY_TILES.map((tile) => (
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
