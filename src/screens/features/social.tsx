import type { ScreenComponent } from '../types'
import type { ScreenProps } from '../types'
import Skeleton from '../../ui/Skeleton'
import { Scroll, Card, Hero, Row, ChipRow, Chip } from './kit/parts'
import ActionButtons from './kit/ActionButtons'
import { t } from '../../i18n'

// social.* is real (friend.list -> screen "friends", search -> screen
// "search" — internal/telegram/screens/social.go, views.go). Structured
// views, wired since day one, so these read `response.view` directly
// instead of falling back to text.

interface FriendLine { id: string; name: string; status: string; incoming: boolean }
interface FriendsView { friends: FriendLine[] | null; page: number; pages: number }

const STATUS_LABEL: Record<string, string> = {
  pending: t('f.social.422'), blocked: t('f.social.423'),
}

const FriendsScreen: ScreenComponent = ({ response, loading, onAction }) => {
  if (loading && !response) return <Scroll><Card><Skeleton lines={5} /></Card></Scroll>
  const v = (response?.view ?? { friends: [], page: 1, pages: 1 }) as unknown as FriendsView
  const friends = v.friends ?? []
  const incoming = friends.filter((f) => f.incoming && f.status === 'pending')
  const rest = friends.filter((f) => !(f.incoming && f.status === 'pending'))

  return (
    <Scroll>
      <Hero tint="sapphire" icon="society" title={t('f.social.424')} sub={t('f.social.425', { p0: v.page, p1: v.pages })} />
      {friends.length === 0 && <Card><div className="screen-text">{t('f.social.426')}</div></Card>}

      {incoming.length > 0 && (
        <div className="ft-section">
          <div className="ft-section-title display">{t('f.social.427')}</div>
          {incoming.map((f) => (
            <Row key={f.id} icon="person" palette="sapphire" title={f.name || t('f.social.428')} sub={t('f.social.429')} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="ft-section">
          <div className="ft-section-title display">{t('f.social.430')}</div>
          {rest.map((f) => (
            <Row
              key={f.id}
              icon="person"
              palette={f.status === 'blocked' ? 'ruby' : 'steel'}
              title={f.name || t('f.social.428')}
              sub={f.status === 'accepted' ? undefined : STATUS_LABEL[f.status] ?? f.status}
              online={f.status === 'accepted'}
            />
          ))}
        </div>
      )}

      {/* Every accept button the server sent is self-labelled ("قبول <نام>")
          and already carries the right command/args — no reconstruction. */}
      <ActionButtons actions={response?.actions} onAction={onAction} />
    </Scroll>
  )
}

interface SearchResult { id: string; code: string; name: string; self: boolean }
interface SearchView { help: boolean; by: string; query: string; found: SearchResult | null }

const SearchScreen: ScreenComponent = (props: ScreenProps) => {
  const { response, loading, onAction } = props
  if (loading && !response) return <Scroll><Card><Skeleton lines={4} /></Card></Scroll>
  const v = (response?.view ?? { help: true, by: '', query: '', found: null }) as unknown as SearchView

  return (
    <Scroll>
      <Hero tint="sapphire" icon="m_search" title={t('f.social.431')} sub={v.query ? t('f.social.432', { p0: v.query }) : undefined} />

      {v.help && (
        <Card>
          <div className="screen-text">
            {t('f.social.433')}
          </div>
        </Card>
      )}

      {!v.help && !v.found && (
        <Card>
          <div className="screen-text">{t('f.social.434')}</div>
        </Card>
      )}

      {v.found && (
        <Card>
          <Row
            icon="person"
            palette={v.found.self ? 'gold' : 'sapphire'}
            title={v.found.name || t('f.social.428')}
            sub={v.found.code ? t('f.social.435', { p0: v.found.code }) : undefined}
          />
          {v.found.self && (
            <div style={{ marginTop: 10 }}>
              <ChipRow><Chip text={t('f.social.436')} color="var(--gold)" /></ChipRow>
            </div>
          )}
        </Card>
      )}

      <ActionButtons actions={response?.actions} onAction={onAction} />
    </Scroll>
  )
}

const SERVER: Record<string, ScreenComponent> = {
  friends: FriendsScreen,
  search: SearchScreen,
}

export default { SERVER, LOCAL: {} }
