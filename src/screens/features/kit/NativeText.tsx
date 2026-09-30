import type { ScreenProps } from '../../types'
import { sanitizeTelegramHtml } from '../../../lib/sanitizeHtml'
import Skeleton from '../../../ui/Skeleton'
import { Scroll, Card, Hero } from './parts'
import ActionButtons from './ActionButtons'
import { FEATURE_META, type FeatureMeta } from './theme'
import { t } from '../../../i18n'

/**
 * A real server screen the client has not been given a structured `view`
 * for yet (api/client-api.md §3.1: "a screen not reached from a client
 * yet — currently the production, company, military and war screens —
 * carries no view; its `text` is still the full Telegram rendering").
 *
 * So this renders exactly what the server sent — its text, its actions —
 * inside the prototype's card/hero language instead of a bare list: real
 * data, dressed like the feature it is. When the view lands, this screen
 * can be replaced by one built on its fields without moving the registry
 * key.
 */
export default function NativeText({ response, loading, onAction }: ScreenProps) {
  const meta: FeatureMeta = FEATURE_META[response?.screen ?? ''] ?? { title: t('f.NativeText.247'), icon: 'shield', tint: 'steel' }

  if (loading && !response) {
    return (
      <Scroll>
        <Card><Skeleton lines={5} /></Card>
      </Scroll>
    )
  }

  return (
    <Scroll>
      <Hero tint={meta.tint} icon={meta.icon} title={meta.title} />
      {response?.text && (
        <Card>
          <div className="screen-text" dangerouslySetInnerHTML={{ __html: sanitizeTelegramHtml(response.text) }} />
        </Card>
      )}
      <ActionButtons actions={response?.actions} onAction={onAction} />
    </Scroll>
  )
}
