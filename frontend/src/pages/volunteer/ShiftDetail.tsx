import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './ShiftDetail.module.css'

const fmtDate = (d?: string | null) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
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
  duration?: string | null
  capacity: number
  category: string
  requirements?: string | null
  what_to_bring?: string | null
  is_recurring: boolean
  recurrence_note?: string | null
  contact_name?: string | null
  contact_email?: string | null
  org?: { name: string; cause_area: string }
  positions: ShiftPosition[]
  _count: { reservations: number }
}

interface MyReservation {
  id: string
  status: 'pending' | 'approved' | 'waitlisted'
  waitlist_position?: number | null
  shift: { id: string }
  position?: { id: string; name: string } | null
}

interface Headcount {
  shiftId: string
  capacity: number
  approved: number
  pending: number
  waitlisted: number
  spotsLeft: number
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const dayOfWeek = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'long' })

export default function ShiftDetail() {
  const { id } = useParams<{ id: string }>()
  const [shift, setShift]                   = useState<Shift | null>(null)
  const [myReservations, setMyReservations] = useState<MyReservation[]>([])
  const [headcount, setHeadcount]           = useState<Headcount | null>(null)
  const [loading, setLoading]               = useState(true)
  const [reserving, setReserving]           = useState<string | null>(null)
  const [cancelling, setCancelling]         = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<Shift>(`/api/shifts/${id}`),
      api.get<MyReservation[]>('/api/reservations/my'),
    ]).then(([shiftRes, resRes]) => {
      setShift(shiftRes.data)
      setMyReservations(resRes.data.filter(r => r.shift.id === id))
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id) return
    const socket = io(SOCKET_URL)
    socketRef.current = socket
    socket.emit('shift:join', { shiftId: id })
    socket.on('shift:headcount', (data: Headcount) => setHeadcount(data))
    return () => {
      socket.emit('shift:leave', { shiftId: id })
      socket.disconnect()
    }
  }, [id])

  const shiftRes = useMemo(
    () => myReservations.find(r => !r.position) ?? null,
    [myReservations],
  )
  const reservationByPosition = useMemo(
    () => new Map(myReservations.filter(r => r.position).map(r => [r.position!.id, r])),
    [myReservations],
  )

  const reserve = async (positionId?: string) => {
    const key = positionId ?? 'shift'
    setReserving(key)
    try {
      const { data } = await api.post<MyReservation>('/api/reservations', {
        shift_id: id,
        ...(positionId && { position_id: positionId }),
      })
      setMyReservations(prev => [...prev, data])
    } catch { /* silent */ } finally {
      setReserving(null)
    }
  }

  const cancelRes = async (reservationId: string) => {
    setCancelling(reservationId)
    try {
      await api.delete(`/api/reservations/${reservationId}`)
      setMyReservations(prev => prev.filter(r => r.id !== reservationId))
    } catch { /* silent */ } finally {
      setCancelling(null)
    }
  }

  const catInfo = (val: string) =>
    CATEGORIES.find(c => c.value === val) ?? { label: val, emoji: '💡' }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.orb1} /><div className={styles.orb2} />
        <Navbar />
        <main className={styles.main}><p className={styles.dimText}>Loading shift…</p></main>
      </div>
    )
  }

  if (!shift) {
    return (
      <div className={styles.page}>
        <div className={styles.orb1} /><div className={styles.orb2} />
        <Navbar />
        <main className={styles.main}>
          <Link to="/shifts" className={styles.backLink}>← Back to browse</Link>
          <p className={styles.dimText}>Shift not found.</p>
        </main>
      </div>
    )
  }

  const startT    = fmtTime(shift.start_time)
  const endT      = fmtTime(shift.end_time)
  const timeStr   = startT ? (endT ? `${startT} – ${endT}` : startT) : null
  const cat       = catInfo(shift.category)

  const filledCount = headcount ? headcount.approved + headcount.pending : shift._count.reservations
  const spotsLeft   = headcount ? headcount.spotsLeft : Math.max(0, shift.capacity - shift._count.reservations)
  const pct         = Math.min(Math.round((filledCount / shift.capacity) * 100), 100)
  const isFull      = spotsLeft <= 0
  const hasPositions = shift.positions.length > 0
  const isReservedSimple = !!shiftRes

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <Navbar />

      <main className={styles.main}>
        <Link to="/shifts" className={styles.backLink}>← Back to browse</Link>

        <div className={styles.layout}>

          {/* ── Left: main content ── */}
          <div className={styles.content}>

            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerBadges}>
                <span
                  className={styles.catBadge}
                  style={{
                    background: CATEGORY_COLORS[shift.category] ?? CATEGORY_COLORS.other,
                    color: CATEGORY_TEXT[shift.category] ?? CATEGORY_TEXT.other,
                  }}
                >
                  {cat.emoji} {cat.label}
                </span>
                {shift.is_recurring && (
                  <span className={styles.recurringBadge}>Every {dayOfWeek(shift.date)}</span>
                )}
              </div>
              {shift.org && <p className={styles.orgName}>{shift.org.name}</p>}
              <h1 className={styles.shiftTitle}>{shift.title}</h1>
            </div>

            {/* Meta chips */}
            <div className={styles.metaChips}>
              <span className={styles.metaChip}>📅 {fmtDate(shift.date)}</span>
              {timeStr && <span className={styles.metaChip}>🕐 {timeStr}</span>}
              <span className={styles.metaChip}>📍 {shift.location}</span>
              {shift.duration && <span className={styles.metaChip}>⏱ {shift.duration}</span>}
              {(shift.contact_name || shift.contact_email) && (
                <span className={styles.metaChip}>
                  👤 Contact: {shift.contact_name || shift.contact_email}
                </span>
              )}
            </div>

            {/* Live headcount */}
            <div className={styles.headcountCard}>
              <div className={styles.headcountTop}>
                <span className={styles.headcountLabel}>Availability</span>
                <span
                  className={styles.headcountValue}
                  style={{ color: isFull ? '#818CF8' : spotsLeft <= 3 ? '#F87171' : '#86EFAC' }}
                >
                  {isFull ? 'Full — waitlist open' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                </span>
              </div>
              <div className={styles.headcountBar}>
                <div
                  className={styles.headcountFill}
                  style={{
                    width: `${pct}%`,
                    background: isFull ? '#818CF8' : pct >= 75 ? '#F59E0B' : '#22C55E',
                  }}
                />
              </div>
              <div className={styles.headcountSub}>
                {filledCount} of {shift.capacity} spots filled
                {headcount && <span className={styles.liveTag}>· Live</span>}
              </div>
            </div>

            {/* Description */}
            {shift.description && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>About this shift</h2>
                <div className={styles.richText} dangerouslySetInnerHTML={{ __html: shift.description }} />
              </section>
            )}

            {/* Requirements */}
            {shift.requirements && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Requirements</h2>
                <div className={styles.richText} dangerouslySetInnerHTML={{ __html: shift.requirements }} />
              </section>
            )}

            {/* What to bring */}
            {shift.what_to_bring && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>What to bring</h2>
                <div className={styles.richText} dangerouslySetInnerHTML={{ __html: shift.what_to_bring }} />
              </section>
            )}

          </div>

          {/* ── Right: sidebar (positions only) ── */}
          {hasPositions && (
            <div className={styles.sidebar}>
              <h2 className={styles.sectionTitle}>Volunteer roles</h2>
              <div className={styles.positions}>
                {shift.positions.map(pos => {
                  const posRes    = reservationByPosition.get(pos.id)
                  const posSpots  = pos.capacity - pos._count.reservations
                  const posFull   = posSpots <= 0
                  const isLoading = reserving === pos.id

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
                        {posRes ? (
                          <div className={styles.statusGroup}>
                            <span className={styles.reservedTag}>
                              {posRes.status === 'waitlisted'
                                ? `#${posRes.waitlist_position} Waitlist`
                                : '✓ Reserved'}
                            </span>
                            <button
                              onClick={() => cancelRes(posRes.id)}
                              disabled={cancelling === posRes.id}
                              className={styles.cancelBtn}
                            >
                              {cancelling === posRes.id ? '…' : 'Cancel'}
                            </button>
                          </div>
                        ) : isReservedSimple ? (
                          <span className={styles.alreadyReservedNote}>Already reserved</span>
                        ) : (
                          <button
                            onClick={() => reserve(pos.id)}
                            disabled={isLoading}
                            className={styles.reserveBtn}
                          >
                            {isLoading ? '…' : posFull ? 'Waitlist' : 'Reserve'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Reserve button — bottom right, after reading ── */}
        {!hasPositions && (
          <div className={styles.reserveRow}>
            {isReservedSimple ? (
              <div className={styles.statusGroup}>
                <span className={styles.reservedTag}>
                  {shiftRes!.status === 'waitlisted'
                    ? `#${shiftRes!.waitlist_position} on waitlist`
                    : shiftRes!.status === 'approved'
                    ? '✓ Confirmed'
                    : '✓ Pending approval'}
                </span>
                <button
                  onClick={() => cancelRes(shiftRes!.id)}
                  disabled={cancelling === shiftRes!.id}
                  className={styles.cancelBtn}
                >
                  {cancelling === shiftRes!.id ? '…' : 'Cancel reservation'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => reserve()}
                disabled={reserving === 'shift'}
                className={styles.reserveBtn}
              >
                {reserving === 'shift' ? 'Reserving…' : isFull ? 'Join Waitlist' : 'Reserve a Spot'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
