import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './AdminDashboard.module.css'

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

interface ShiftPosition {
  id: string
  capacity: number
  _count: { reservations: number }
}

interface Shift {
  id: string
  title: string
  date: string
  start_time?: string | null
  end_time?: string | null
  location: string
  status: 'draft' | 'open' | 'closed'
  capacity: number
  category: string
  positions: ShiftPosition[]
  _count: { reservations: number }
}

interface PendingReservation {
  id: string
  created_at: string
  volunteer: { id: string; name: string; email: string }
  shift: { id: string; title: string; date: string; start_time?: string | null }
  position?: { id: string; name: string } | null
}

interface Org {
  id: string
  name: string
  cause_area: string
  description?: string | null
  logo_url?: string | null
}

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' }
const STATUS_CLASS: Record<string, string> = {
  draft:  'statusDraft',
  open:   'statusOpen',
  closed: 'statusClosed',
}

export default function AdminDashboard() {
  const name = localStorage.getItem('name') || 'Admin'
  const [org, setOrg]                       = useState<Org | null>(null)
  const [shifts, setShifts]                 = useState<Shift[]>([])
  const [pending, setPending]               = useState<PendingReservation[]>([])
  const [loading, setLoading]               = useState(true)
  const [acting, setActing]                 = useState<string | null>(null)

  useEffect(() => {
    api.get<{ org: Org; shifts: Shift[]; pendingReservations: PendingReservation[] }>(
      '/api/orgs/my/dashboard',
    ).then(({ data }) => {
      setOrg(data.org)
      setShifts(data.shifts)
      setPending(data.pendingReservations)
    }).finally(() => setLoading(false))
  }, [])

  const decide = async (reservationId: string, status: 'approved' | 'denied') => {
    setActing(reservationId)
    try {
      await api.patch(`/api/reservations/${reservationId}/status`, { status })
      setPending(prev => prev.filter(r => r.id !== reservationId))
    } catch {
      // silent
    } finally {
      setActing(null)
    }
  }

  // Stats derived from data
  const totalShifts   = shifts.length
  const openShifts    = shifts.filter(s => s.status === 'open').length
  const totalFilled   = shifts.reduce((sum, s) => sum + s._count.reservations, 0)
  const pendingCount  = pending.length

  const STATS = [
    { label: 'Total Shifts',      value: totalShifts,  color: '#60A5FA' },
    { label: 'Open Shifts',       value: openShifts,   color: '#22C55E' },
    { label: 'Volunteers Booked', value: totalFilled,  color: '#A78BFA' },
    { label: 'Pending Approval',  value: pendingCount, color: '#F59E0B', urgent: pendingCount > 0 },
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
            <p className={styles.greetSub}>{org ? org.name : 'Loading your organization…'}</p>
          </div>
          <Link to="/admin/shifts/new" className={styles.createBtn}>+ Create Shift</Link>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          {STATS.map(s => (
            <div key={s.label} className={`${styles.statCard} ${s.urgent ? styles.statUrgent : ''}`}>
              <span className={styles.statValue} style={{ color: s.color }}>
                {loading ? '—' : s.value}
              </span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Pending Approvals */}
        {!loading && pending.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Pending Approvals
                <span className={styles.urgentDot} />
              </h2>
            </div>
            <div className={styles.approvalList}>
              {pending.map(r => (
                <div key={r.id} className={styles.approvalCard}>
                  <div className={styles.approvalLeft}>
                    <div className={styles.volunteerAvatar}>
                      {r.volunteer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.approvalInfo}>
                      <p className={styles.volunteerName}>{r.volunteer.name}</p>
                      <p className={styles.volunteerEmail}>{r.volunteer.email}</p>
                      <p className={styles.approvalShift}>
                        {r.shift.title}
                        {r.position && <span className={styles.approvalPos}> · {r.position.name}</span>}
                        <span className={styles.approvalDate}> · {fmtDate(r.shift.date)}{r.shift.start_time ? ` at ${fmtTime(r.shift.start_time)}` : ''}</span>
                      </p>
                    </div>
                  </div>
                  <div className={styles.approvalActions}>
                    <button
                      onClick={() => decide(r.id, 'approved')}
                      disabled={acting === r.id}
                      className={styles.approveBtn}
                    >
                      {acting === r.id ? '…' : 'Approve'}
                    </button>
                    <button
                      onClick={() => decide(r.id, 'denied')}
                      disabled={acting === r.id}
                      className={styles.denyBtn}
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Shifts */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>My Shifts</h2>
            <Link to="/admin/shifts" className={styles.seeAll}>Manage all →</Link>
          </div>

          {loading ? (
            <div className={styles.empty}>Loading shifts…</div>
          ) : shifts.length === 0 ? (
            <div className={styles.empty}>
              No shifts yet.{' '}
              <Link to="/admin/shifts/new" className={styles.emptyLink}>Create your first shift →</Link>
            </div>
          ) : (
            <div className={styles.shiftList}>
              {shifts.slice(0, 6).map(shift => {
                const filled   = shift._count.reservations
                const pct      = Math.min(Math.round((filled / shift.capacity) * 100), 100)
                const isFull   = filled >= shift.capacity

                return (
                  <div key={shift.id} className={styles.shiftRow}>
                    <div className={styles.shiftRowLeft}>
                      <p className={styles.shiftTitle}>{shift.title}</p>
                      <div className={styles.shiftMeta}>
                        <span>📅 {fmtDate(shift.date)}</span>
                        {shift.start_time && <span>🕐 {fmtTime(shift.start_time)}</span>}
                        <span>📍 {shift.location}</span>
                      </div>
                    </div>

                    <div className={styles.shiftRowRight}>
                      <div className={styles.capacityWrap}>
                        <span className={styles.capacityLabel} style={{ color: isFull ? '#818CF8' : '#86EFAC' }}>
                          {filled}/{shift.capacity}
                        </span>
                        <div className={styles.capacityBar}>
                          <div
                            className={styles.capacityFill}
                            style={{
                              width: `${pct}%`,
                              background: isFull ? '#818CF8' : '#22C55E',
                            }}
                          />
                        </div>
                      </div>
                      <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[shift.status]]}`}>
                        {STATUS_LABEL[shift.status]}
                      </span>
                      <Link to={`/admin/shifts/${shift.id}/reservations`} className={styles.viewBtn}>
                        View →
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
