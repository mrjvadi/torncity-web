import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { SOCIETY_TILES } from './kit/hubs'

export default function SocietyHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title="جامعه" tone="violet" />
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
      </TileGrid>
    </ScreenScroll>
  )
}
