import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './VolunteerDashboard.module.css'

interface Shift {
  id: string
  title: string
  description: string
  location: string
  date: string
  start_time: string
  end_time: string
  capacity: number
  org?: { name: string }
  _count?: { reservations: number }
}

interface Reservation {
  id: string
  status: 'pending' | 'approved' | 'waitlisted'
  waitlist_position?: number | null
  shift: Shift
}

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

const greeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const today = () =>
  new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

export default function VolunteerDashboard() {
  const name = localStorage.getItem('name') || 'Volunteer'
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [shifts, setShifts]             = useState<Shift[]>([])
  const [loading, setLoading]           = useState(true)
  const [cancelling, setCancelling]     = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      api.get<Reservation[]>('/api/reservations/my'),
      api.get<Shift[]>('/api/shifts'),
    ])
      .then(([resRes, shiftRes]) => {
        setReservations(resRes.data)
        setShifts(shiftRes.data)
      })
      .finally(() => setLoading(false))
  }, [])

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

  // Derived state
  const myShiftIds     = new Set(reservations.map(r => r.shift.id))
  const now            = new Date()
  const upcoming       = reservations.filter(r => r.status === 'approved' && new Date(r.shift.date) >= now)
  const pending        = reservations.filter(r => r.status === 'pending')
  const waitlisted     = reservations.filter(r => r.status === 'waitlisted')
  const availableShifts = shifts
    .filter(s => !myShiftIds.has(s.id) && new Date(s.date) >= now)
    .slice(0, 6)

  const STATS = [
    { label: 'Upcoming',         value: upcoming.length,   color: '#22C55E' },
    { label: 'Pending Approval', value: pending.length,    color: '#F59E0B' },
    { label: 'Waitlisted',       value: waitlisted.length, color: '#818CF8' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <Navbar />

      <main className={styles.main}>

        {/* Greeting */}
        <div className={styles.greeting}>
          <div>
            <h1 className={styles.greetTitle}>{greeting()}, {name.split(' ')[0]} 👋</h1>
            <p className={styles.greetSub}>{today()}</p>
          </div>
          <Link to="/shifts" className={styles.browseBtn}>Browse Shifts →</Link>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          {STATS.map(s => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statValue} style={{ color: s.color }}>
                {loading ? '—' : s.value}
              </span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* My Upcoming Shifts */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>My Upcoming Shifts</h2>
            <Link to="/my-reservations" className={styles.seeAll}>See all →</Link>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading your shifts…</div>
          ) : upcoming.length === 0 ? (
            <div className={styles.empty}>
              No confirmed shifts yet.{' '}
              <Link to="/shifts" className={styles.emptyLink}>Browse available shifts →</Link>
            </div>
          ) : (
            <div className={styles.shiftList}>
              {upcoming.slice(0, 4).map(r => (
                <div key={r.id} className={styles.shiftCard}>
                  <div className={styles.shiftCardLeft}>
                    <p className={styles.shiftTitle}>{r.shift.title}</p>
                    {r.shift.org && <p className={styles.shiftOrg}>{r.shift.org.name}</p>}
                    <div className={styles.shiftMeta}>
                      <span>📅 {fmtDate(r.shift.date)}</span>
                      <span>🕐 {fmtTime(r.shift.start_time)} – {fmtTime(r.shift.end_time)}</span>
                      <span>📍 {r.shift.location}</span>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={`${styles.badge} ${styles.badgeApproved}`}>Confirmed</span>
                    <button
                      onClick={() => cancelRes(r.id)}
                      disabled={cancelling === r.id}
                      className={styles.cancelBtn}
                    >
                      {cancelling === r.id ? '…' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending & Waitlisted */}
        {!loading && (pending.length > 0 || waitlisted.length > 0) && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Pending &amp; Waitlisted</h2>
            </div>
            <div className={styles.shiftList}>
              {[...pending, ...waitlisted].map(r => (
                <div key={r.id} className={styles.shiftCard}>
                  <div className={styles.shiftCardLeft}>
                    <p className={styles.shiftTitle}>{r.shift.title}</p>
                    {r.shift.org && <p className={styles.shiftOrg}>{r.shift.org.name}</p>}
                    <div className={styles.shiftMeta}>
                      <span>📅 {fmtDate(r.shift.date)}</span>
                      <span>📍 {r.shift.location}</span>
                    </div>
                  </div>
                  <div className={styles.cardRight}>
                    {r.status === 'pending' && (
                      <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>
                    )}
                    {r.status === 'waitlisted' && (
                      <span className={`${styles.badge} ${styles.badgeWaitlisted}`}>
                        #{r.waitlist_position} Waitlist
                      </span>
                    )}
                    <button
                      onClick={() => cancelRes(r.id)}
                      disabled={cancelling === r.id}
                      className={styles.cancelBtn}
                    >
                      {cancelling === r.id ? '…' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Discover Shifts */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Discover Shifts</h2>
            <Link to="/shifts" className={styles.seeAll}>View all →</Link>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading shifts…</div>
          ) : availableShifts.length === 0 ? (
            <div className={styles.empty}>No new shifts available right now — check back soon.</div>
          ) : (
            <div className={styles.discoverGrid}>
              {availableShifts.map(shift => {
                const spotsLeft = shift.capacity - (shift._count?.reservations ?? 0)
                const isFull    = spotsLeft <= 0
                return (
                  <div key={shift.id} className={styles.discoverCard}>
                    {shift.org && <p className={styles.discoverOrg}>{shift.org.name}</p>}
                    <h3 className={styles.discoverTitle}>{shift.title}</h3>
                    <div className={styles.discoverMeta}>
                      <span>📅 {fmtDate(shift.date)}</span>
                      <span>🕐 {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</span>
                      <span>📍 {shift.location}</span>
                    </div>
                    <div className={styles.discoverFooter}>
                      <span
                        className={styles.spotsLeft}
                        style={{ color: spotsLeft <= 3 && !isFull ? '#F87171' : isFull ? '#818CF8' : '#86EFAC' }}
                      >
                        {isFull ? 'Waitlist open' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                      </span>
                      <Link to={`/shifts/${shift.id}`} className={styles.reserveBtn}>
                        {isFull ? 'Join Waitlist' : 'Reserve'}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
