import type { ScreenComponent } from '../types'
import type { ScreenProps } from '../types'
import Skeleton from '../../ui/Skeleton'
import { Scroll, Card, Hero, Row, ChipRow, Chip } from './kit/parts'
import ActionButtons from './kit/ActionButtons'

// social.* is real (friend.list -> screen "friends", search -> screen
// "search" — internal/telegram/screens/social.go, views.go). Structured
// views, wired since day one, so these read `response.view` directly
// instead of falling back to text.

interface FriendLine { id: string; name: string; status: string; incoming: boolean }
interface FriendsView { friends: FriendLine[] | null; page: number; pages: number }

const STATUS_LABEL: Record<string, string> = {
  pending: 'در انتظار پاسخ', blocked: 'مسدود',
}

const FriendsScreen: ScreenComponent = ({ response, loading, onAction }) => {
  if (loading && !response) return <Scroll><Card><Skeleton lines={5} /></Card></Scroll>
  const v = (response?.view ?? { friends: [], page: 1, pages: 1 }) as unknown as FriendsView
  const friends = v.friends ?? []
  const incoming = friends.filter((f) => f.incoming && f.status === 'pending')
  const rest = friends.filter((f) => !(f.incoming && f.status === 'pending'))

  return (
    <Scroll>
      <Hero tint="sapphire" icon="society" title="دوستان" sub={`صفحه‌ی ${v.page} از ${v.pages}`} />
      {friends.length === 0 && <Card><div className="screen-text">هنوز دوستی ثبت نشده است.</div></Card>}

      {incoming.length > 0 && (
        <div className="ft-section">
          <div className="ft-section-title display">درخواست‌های تازه</div>
          {incoming.map((f) => (
            <Row key={f.id} icon="person" palette="sapphire" title={f.name || 'بازیکن ناشناس'} sub="منتظر پاسخ توست — دکمه‌ی قبول در پایین صفحه" />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="ft-section">
          <div className="ft-section-title display">فهرست</div>
          {rest.map((f) => (
            <Row
              key={f.id}
              icon="person"
              palette={f.status === 'blocked' ? 'ruby' : 'steel'}
              title={f.name || 'بازیکن ناشناس'}
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
      <Hero tint="sapphire" icon="m_search" title="جستجو" sub={v.query ? `عبارت: ${v.query}` : undefined} />

      {v.help && (
        <Card>
          <div className="screen-text">
            یک نام کاربری (با @)، کد بازیکن، یا آیدی تلگرام را بفرستید تا بازیکن پیدا شود.
          </div>
        </Card>
      )}

      {!v.help && !v.found && (
        <Card>
          <div className="screen-text">بازیکنی با این مشخصات پیدا نشد.</div>
        </Card>
      )}

      {v.found && (
        <Card>
          <Row
            icon="person"
            palette={v.found.self ? 'gold' : 'sapphire'}
            title={v.found.name || 'بازیکن ناشناس'}
            sub={v.found.code ? `کد: ${v.found.code}` : undefined}
          />
          {v.found.self && (
            <div style={{ marginTop: 10 }}>
              <ChipRow><Chip text="این خودت هستی" color="var(--gold)" /></ChipRow>
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
