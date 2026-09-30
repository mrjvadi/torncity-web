// The village tab of a player with no village: the call to found one.

import type { ScreenProps } from '../types'
import { Card, Header, ScreenScroll } from '../native/kit/Parts'
import { Slab } from '../../kit'
import { t } from '../../i18n'
import './village.css'

export default function VillageCall({ openLocal }: ScreenProps) {
  return (
    <ScreenScroll>
      <Header title={t('village.title')} tone="emerald" />
      <Card tone="emerald">
        <div className="vc-title display">{t('village.call.title')}</div>
        <div className="vc-body">{t('village.call.body')}</div>
        <div className="vs-btns">
          <Slab tone="gold" radius={14} lip={4} onClick={() => openLocal('founding_form')}>{t('village.call.form')}</Slab>
        </div>
      </Card>
    </ScreenScroll>
  )
}
