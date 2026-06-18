import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './BrowseShifts.module.css'

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const fmtTime = (t?: string | null) => {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hr = +h
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
}

const CATEGORIES = [
  { value: 'all',         label: 'All',         emoji: '✨' },
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
  food:        'rgba(251,146,60,0.18)',
  education:   'rgba(96,165,250,0.18)',
  environment: 'rgba(34,197,94,0.16)',
  health:      'rgba(251,113,133,0.18)',
  animals:     'rgba(217,119,6,0.18)',
  arts:        'rgba(167,139,250,0.18)',
  community:   'rgba(45,212,191,0.16)',
  sports:      'rgba(34,211,238,0.16)',
  other:       'rgba(148,163,184,0.14)',
}

const CATEGORY_TEXT: Record<string, string> = {
  food:        '#FB923C',
  education:   '#60A5FA',
  environment: '#4ADE80',
  health:      '#FB7185',
  animals:     '#FBBF24',
  arts:        '#A78BFA',
  community:   '#2DD4BF',
  sports:      '#22D3EE',
  other:       '#94A3B8',
}

interface ShiftPosition {
  id: string
  name: string
  description?: string | null
  capacity: number
  _count: { reservations: number }
}

interface Shift {
  id: string
  title: string
  description?: string | null
  location: string
  date: string
  start_time?: string | null
  end_time?: string | null
  capacity: number
  category: string
  requirements?: string | null
  what_to_bring?: string | null
  is_recurring: boolean
  contact_name?: string | null
  contact_email?: string | null
  org?: { name: string; cause_area: string; logo_url?: string | null }
  positions: ShiftPosition[]
  _count: { reservations: number }
}

interface Reservation {
  id: string
  status: 'pending' | 'approved' | 'waitlisted'
  waitlist_position?: number | null
  shift: { id: string }
  position?: { id: string; name: string } | null
}

export default function BrowseShifts() {
  const [shifts, setShifts]           = useState<Shift[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading]         = useState(true)
  const [cancelling, setCancelling]   = useState<string | null>(null)
  const [search, setSearch]           = useState('')
  const [category, setCategory]       = useState('all')
  const [dateFilter, setDateFilter]   = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Shift[]>('/api/shifts'),
      api.get<Reservation[]>('/api/reservations/my'),
    ])
      .then(([shiftRes, resRes]) => {
        setShifts(shiftRes.data)
        setReservations(resRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Quick lookup maps for reservation state
  const reservationByShift    = useMemo(
    () => new Map(reservations.map(r => [r.shift.id, r])),
    [reservations],
  )
  const reservationByPosition = useMemo(
    () => new Map(reservations.filter(r => r.position).map(r => [r.position!.id, r])),
    [reservations],
  )

  const cancelRes = async (reservationId: string) => {
    setCancelling(reservationId)
    try {
      await api.delete(`/api/reservations/${reservationId}`)
      setReservations(prev => prev.filter(r => r.id !== reservationId))
    } catch {
      // silent
    } finally {
      setCancelling(null)
    }
  }

  const filtered = useMemo(() => {
    const q      = search.toLowerCase()
    const cutoff = dateFilter ? new Date(dateFilter) : null
    return shifts.filter(s => {
      if (category !== 'all' && s.category !== category) return false
      if (cutoff && new Date(s.date) < cutoff) return false
      if (q && !(
        s.title.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.org?.name.toLowerCase().includes(q)
      )) return false
      return true
    })
  }, [shifts, category, search, dateFilter])

  const catEmoji = (val: string) => CATEGORIES.find(c => c.value === val)?.emoji ?? '💡'
  const catLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label ?? val

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <Navbar />

      <main className={styles.main}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Browse Shifts</h1>
            <p className={styles.subtitle}>
              {loading ? 'Loading…' : `${filtered.length} shift${filtered.length !== 1 ? 's' : ''} available`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filterBar}>
          <input
            type="text"
            placeholder="Search by title, location, or org…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className={styles.dateInput}
          />
        </div>

        {/* Category pills */}
        <div className={styles.categoryRow}>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`${styles.catPill} ${category === c.value ? styles.catActive : ''}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className={styles.empty}>Loading shifts…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No shifts match your filters — try broadening your search.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(shift => {
              const shiftRes    = reservationByShift.get(shift.id)
              const isReserved  = !!shiftRes
              const spotsLeft   = shift.capacity - shift._count.reservations
              const isFull      = spotsLeft <= 0
              const hasPositions = shift.positions.length > 0

              return (
                <div key={shift.id} className={styles.card}>

                  {/* Card top row */}
                  <div className={styles.cardTopRow}>
                    <span
                      className={styles.catBadge}
                      style={{
                        background: CATEGORY_COLORS[shift.category] ?? CATEGORY_COLORS.other,
                        color: CATEGORY_TEXT[shift.category] ?? CATEGORY_TEXT.other,
                      }}
                    >
                      {catEmoji(shift.category)} {catLabel(shift.category)}
                    </span>
                    {shift.is_recurring && (
                      <span className={styles.recurringBadge}>↻ Recurring</span>
                    )}
                  </div>

                  {/* Org + title */}
                  {shift.org && <p className={styles.orgName}>{shift.org.name}</p>}
                  <h3 className={styles.shiftTitle}>{shift.title}</h3>
                  {/* Meta */}
                  <div className={styles.meta}>
                    <span>📅 {fmtDate(shift.date)}</span>
                    <span>🕐 {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</span>
                    <span>📍 {shift.location}</span>
                  </div>

                  {/* Positions or simple reserve */}
                  <div className={styles.cardFooter}>
                    {hasPositions ? (
                      <div className={styles.positions}>
                        <p className={styles.positionsLabel}>Volunteer roles</p>
                        {shift.positions.map(pos => {
                          const posRes         = reservationByPosition.get(pos.id)
                          const posReserved    = !!posRes || (isReserved && !shiftRes?.position)
                          const posSpots       = pos.capacity - pos._count.reservations
                          const posFull        = posSpots <= 0

                          return (
                            <div key={pos.id} className={styles.positionRow}>
                              <div className={styles.positionInfo}>
                                <span className={styles.positionName}>{pos.name}</span>
                                {pos.description && (
                                  <span className={styles.positionDesc}>{pos.description}</span>
                                )}
                              </div>
                              <div className={styles.positionRight}>
                                <span
                                  className={styles.posSpots}
                                  style={{ color: posFull ? '#818CF8' : posSpots <= 3 ? '#F87171' : '#86EFAC' }}
                                >
                                  {posFull ? 'Full' : `${posSpots} left`}
                                </span>
                                {posReserved ? (
                                  <div className={styles.statusGroup}>
                                    <span className={styles.reservedTag}>
                                      {posRes?.status === 'waitlisted' ? `#${posRes.waitlist_position} Waitlist` : '✓ Reserved'}
                                    </span>
                                    {posRes && (
                                      <button
                                        onClick={() => cancelRes(posRes.id)}
                                        disabled={cancelling === posRes.id}
                                        className={styles.cancelBtn}
                                      >
                                        {cancelling === posRes.id ? '…' : 'Cancel'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <Link to={`/shifts/${shift.id}`} className={styles.reserveBtn}>
                                    {posFull ? 'Waitlist' : 'Reserve'}
                                  </Link>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={styles.simpleFooter}>
                        <span
                          className={styles.spotsLeft}
                          style={{ color: isFull ? '#818CF8' : spotsLeft <= 3 ? '#F87171' : '#86EFAC' }}
                        >
                          {isFull ? 'Waitlist open' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                        </span>
                        {isReserved ? (
                          <div className={styles.statusGroup}>
                            <span className={styles.reservedTag}>
                              {shiftRes?.status === 'waitlisted'
                                ? `#${shiftRes.waitlist_position} Waitlist`
                                : shiftRes?.status === 'approved' ? '✓ Confirmed' : '✓ Pending'}
                            </span>
                            <button
                              onClick={() => cancelRes(shiftRes!.id)}
                              disabled={cancelling === shiftRes!.id}
                              className={styles.cancelBtn}
                            >
                              {cancelling === shiftRes!.id ? '…' : 'Cancel'}
                            </button>
                          </div>
                        ) : (
                          <Link to={`/shifts/${shift.id}`} className={styles.reserveBtn}>
                            {isFull ? 'Join Waitlist' : 'Reserve'}
                          </Link>
                        )}
                      </div>
                    )}
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
