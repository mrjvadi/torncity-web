import type { ScreenProps } from '../types'
import { Header, ScreenScroll, Tile, TileGrid } from './kit/Parts'
import { ACTIVITY_TILES } from './kit/hubs'

export default function ActivityHub({ run, openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title="فعالیت" tone="violet" />
      <TileGrid>
        {ACTIVITY_TILES.map((t) => (
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
