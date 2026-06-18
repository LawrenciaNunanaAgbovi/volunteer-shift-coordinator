import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './MyReservations.module.css'

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const fmtTime = (t?: string | null) => {
  if (!t) return null
  const [h, m] = t.split(':')
  const hr = +h
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

const CATEGORIES = [
  { value: 'food',        label: 'Food',        emoji: '🍽️' },
  { value: 'education',   label: 'Education',   emoji: '📚' },
  { value: 'environment', label: 'Environment', emoji: '🌿' },
  { value: 'health',      label: 'Health',      emoji: '🏥' },
  { value: 'animals',     label: 'Animals',     emoji: '🐾' },
  { value: 'arts',        label: 'Arts',        emoji: '🎨' },
  { value: 'community',   label: 'Community',   emoji: '🤝' },
  { value: 'sports',      label: 'Sports',      emoji: '⚽' },
  { value: 'other',       label: 'Other',       emoji: '💡' },
]

const CATEGORY_COLORS: Record<string, string> = {
  food: 'rgba(251,146,60,0.18)', education: 'rgba(96,165,250,0.18)',
  environment: 'rgba(34,197,94,0.16)', health: 'rgba(251,113,133,0.18)',
  animals: 'rgba(217,119,6,0.18)', arts: 'rgba(167,139,250,0.18)',
  community: 'rgba(45,212,191,0.16)', sports: 'rgba(34,211,238,0.16)',
  other: 'rgba(148,163,184,0.14)',
}

const CATEGORY_TEXT: Record<string, string> = {
  food: '#FB923C', education: '#60A5FA', environment: '#4ADE80',
  health: '#FB7185', animals: '#FBBF24', arts: '#A78BFA',
  community: '#2DD4BF', sports: '#22D3EE', other: '#94A3B8',
}

interface Reservation {
  id: string
  status: 'pending' | 'approved' | 'waitlisted'
  waitlist_position?: number | null
  shift: {
    id: string
    title: string
    date: string
    start_time?: string | null
    end_time?: string | null
    location: string
    category: string
    org?: { name: string } | null
  }
  position?: { id: string; name: string } | null
}

type Tab = 'all' | 'upcoming' | 'waitlisted' | 'past'

const statusLabel = (r: Reservation, isPast: boolean) => {
  if (isPast)                      return 'Attended'
  if (r.status === 'approved')     return '✓ Confirmed'
  if (r.status === 'pending')      return 'Pending'
  return `#${r.waitlist_position} Waitlist`
}

const statusStyle = (r: Reservation, isPast: boolean): React.CSSProperties => {
  if (isPast)                      return { background: 'rgba(255,255,255,0.06)',    color: 'rgba(255,255,255,0.35)',  border: '1px solid rgba(255,255,255,0.1)'  }
  if (r.status === 'approved')     return { background: 'rgba(34,197,94,0.14)',      color: 'rgba(134,239,172,0.95)', border: '1px solid rgba(34,197,94,0.25)'   }
  if (r.status === 'pending')      return { background: 'rgba(245,158,11,0.13)',     color: 'rgba(252,211,77,0.92)',  border: '1px solid rgba(245,158,11,0.25)'  }
  return                                  { background: 'rgba(129,140,248,0.13)',    color: 'rgba(165,180,252,0.92)', border: '1px solid rgba(129,140,248,0.25)' }
}

export default function MyReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading]           = useState(true)
  const [cancelling, setCancelling]     = useState<string | null>(null)
  const [tab, setTab]                   = useState<Tab>('upcoming')

  useEffect(() => {
    api.get<Reservation[]>('/api/reservations/my')
      .then(r => setReservations(r.data))
      .finally(() => setLoading(false))
  }, [])

  const cancelRes = async (reservationId: string) => {
    setCancelling(reservationId)
    try {
      await api.delete(`/api/reservations/${reservationId}`)
      setReservations(prev => prev.filter(r => r.id !== reservationId))
    } catch { /* silent */ } finally {
      setCancelling(null)
    }
  }

  const now = new Date()

  const upcoming   = useMemo(() => reservations.filter(r => r.status !== 'waitlisted' && new Date(r.shift.date) >= now), [reservations])
  const waitlisted = useMemo(() => reservations.filter(r => r.status === 'waitlisted'), [reservations])
  const past       = useMemo(() => reservations.filter(r => new Date(r.shift.date) < now), [reservations])

  const filtered =
    tab === 'upcoming'   ? upcoming
    : tab === 'waitlisted' ? waitlisted
    : tab === 'past'       ? past
    : reservations

  const catInfo = (val: string) => CATEGORIES.find(c => c.value === val) ?? { label: val, emoji: '💡' }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: reservations.length },
    { key: 'upcoming',   label: 'Upcoming',   count: upcoming.length     },
    { key: 'waitlisted', label: 'Waitlisted', count: waitlisted.length   },
    { key: 'past',       label: 'Past',       count: past.length         },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <Navbar />

      <main className={styles.main}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>My Reservations</h1>
            <p className={styles.subtitle}>
              {loading ? 'Loading…' : `${reservations.length} reservation${reservations.length !== 1 ? 's' : ''} total`}
            </p>
          </div>
          <Link to="/shifts" className={styles.browseBtn}>Browse Shifts →</Link>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
            >
              {t.label}
              <span className={`${styles.tabCount} ${tab === t.key ? styles.tabCountActive : ''}`}>
                {loading ? '—' : t.count}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className={styles.empty}>Loading your reservations…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {tab === 'waitlisted' && "You're not on any waitlists."}
            {tab === 'past'       && 'No past shifts yet.'}
            {(tab === 'upcoming' || tab === 'all') && (
              <>No upcoming shifts — <Link to="/shifts" className={styles.emptyLink}>browse available shifts →</Link></>
            )}
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(r => {
              const isPast = new Date(r.shift.date) < now
              const cat    = catInfo(r.shift.category)
              const startT = fmtTime(r.shift.start_time)
              const endT   = fmtTime(r.shift.end_time)
              const timeStr = startT ? (endT ? `${startT} – ${endT}` : startT) : null

              return (
                <div key={r.id} className={`${styles.card} ${isPast ? styles.cardPast : ''}`}>

                  {/* Category badge */}
                  <span
                    className={styles.catBadge}
                    style={{
                      background: CATEGORY_COLORS[r.shift.category] ?? CATEGORY_COLORS.other,
                      color: CATEGORY_TEXT[r.shift.category] ?? CATEGORY_TEXT.other,
                    }}
                  >
                    {cat.emoji} {cat.label}
                  </span>

                  {/* Info */}
                  {r.shift.org && <p className={styles.orgName}>{r.shift.org.name}</p>}
                  <Link to={`/shifts/${r.shift.id}`} className={styles.shiftTitle}>
                    {r.shift.title}
                  </Link>
                  <div className={styles.meta}>
                    <span>📅 {fmtDate(r.shift.date)}</span>
                    <span>🕐 {timeStr ?? '—'}</span>
                    <span>📍 {r.shift.location}</span>
                  </div>
                  {r.position && (
                    <p className={styles.positionNote}>Role: {r.position.name}</p>
                  )}

                  {/* Footer: status · cancel · view details */}
                  <div className={styles.cardFooter}>
                    <span className={styles.statusBadge} style={statusStyle(r, isPast)}>
                      {statusLabel(r, isPast)}
                    </span>
                    <div className={styles.footerActions}>
                      {!isPast && (
                        <button
                          onClick={() => cancelRes(r.id)}
                          disabled={cancelling === r.id}
                          className={styles.cancelBtn}
                        >
                          {cancelling === r.id ? '…' : 'Cancel'}
                        </button>
                      )}
                      <Link to={`/shifts/${r.shift.id}`} className={styles.viewBtn}>
                        View details →
                      </Link>
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}

      </main>
    </div>
  )
}
