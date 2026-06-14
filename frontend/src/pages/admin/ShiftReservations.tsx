import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './ShiftReservations.module.css'

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

interface Shift {
  id: string
  title: string
  date: string
  start_time?: string | null
  end_time?: string | null
  location: string
  status: 'draft' | 'open' | 'closed'
  capacity: number
  _count: { reservations: number }
}

interface Reservation {
  id: string
  status: 'pending' | 'approved' | 'denied' | 'waitlisted'
  waitlist_position: number | null
  created_at: string
  volunteer: { id: string; name: string; email: string; skills: string[] }
  position: { id: string; name: string } | null
}

type Filter = 'all' | 'pending' | 'approved' | 'denied' | 'waitlisted'

const SHIFT_STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' }
const RES_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', denied: 'Denied', waitlisted: 'Waitlisted',
}

export default function ShiftReservations() {
  const { id } = useParams<{ id: string }>()
  const [shift, setShift]               = useState<Shift | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState<Filter>('all')
  const [acting, setActing]             = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get<Shift>(`/api/shifts/${id}`),
      api.get<Reservation[]>(`/api/shifts/${id}/reservations`),
    ]).then(([shiftRes, resRes]) => {
      setShift(shiftRes.data)
      setReservations(resRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  const decide = async (reservationId: string, status: 'approved' | 'denied') => {
    setActing(reservationId)
    try {
      await api.patch(`/api/reservations/${reservationId}/status`, { status })
      setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status } : r))
    } catch { /* silent */ } finally {
      setActing(null)
    }
  }

  const counts = {
    all:        reservations.length,
    pending:    reservations.filter(r => r.status === 'pending').length,
    approved:   reservations.filter(r => r.status === 'approved').length,
    denied:     reservations.filter(r => r.status === 'denied').length,
    waitlisted: reservations.filter(r => r.status === 'waitlisted').length,
  }

  const visible = filter === 'all' ? reservations : reservations.filter(r => r.status === filter)

  if (loading) {
    return (
      <div className={styles.page}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.empty}>Loading…</div>
        </main>
      </div>
    )
  }

  const startT = fmtTime(shift?.start_time)
  const endT   = fmtTime(shift?.end_time)
  const timeStr = startT ? (endT ? `${startT} – ${endT}` : startT) : null

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <Navbar />

      <main className={styles.main}>

        <Link to="/admin/shifts" className={styles.backLink}>← Back to shifts</Link>

        {/* Shift summary */}
        {shift && (
          <div className={styles.shiftCard}>
            <div className={styles.shiftCardLeft}>
              <h1 className={styles.shiftTitle}>{shift.title}</h1>
              <div className={styles.shiftMeta}>
                <span>📅 {fmtDate(shift.date)}</span>
                {timeStr && <span>🕐 {timeStr}</span>}
                <span>📍 {shift.location}</span>
              </div>
            </div>
            <div className={styles.shiftCardRight}>
              <span className={`${styles.shiftStatusBadge} ${styles['ss_' + shift.status]}`}>
                {SHIFT_STATUS_LABEL[shift.status]}
              </span>
              <span className={styles.capacityChip}>
                {shift._count.reservations}/{shift.capacity} filled
              </span>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.sv_pending}`}>{counts.pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.sv_approved}`}>{counts.approved}</span>
            <span className={styles.statLabel}>Approved</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.sv_denied}`}>{counts.denied}</span>
            <span className={styles.statLabel}>Denied</span>
          </div>
          <div className={styles.statItem}>
            <span className={`${styles.statValue} ${styles.sv_waitlisted}`}>{counts.waitlisted}</span>
            <span className={styles.statLabel}>Waitlisted</span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className={styles.tabs}>
          {(['all', 'pending', 'approved', 'denied', 'waitlisted'] as Filter[]).map(f => (
            <button
              key={f}
              className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : RES_LABEL[f]}
              <span className={`${styles.tabCount} ${filter === f ? styles.tabCountActive : ''}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Reservation list */}
        <div className={styles.listCard}>
          {visible.length === 0 ? (
            <div className={styles.empty}>
              No {filter !== 'all' ? RES_LABEL[filter].toLowerCase() + ' ' : ''}reservations yet.
            </div>
          ) : (
            <div className={styles.list}>
              {visible.map((r, i) => {
                const canAct   = r.status === 'pending' || r.status === 'waitlisted'
                const isActing = acting === r.id

                return (
                  <div key={r.id} className={`${styles.resRow} ${i > 0 ? styles.rowBorder : ''}`}>
                    <div className={styles.avatar}>
                      {r.volunteer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.volunteerInfo}>
                      <p className={styles.volunteerName}>{r.volunteer.name}</p>
                      <p className={styles.volunteerEmail}>{r.volunteer.email}</p>
                      {r.position && (
                        <span className={styles.posTag}>{r.position.name}</span>
                      )}
                      {r.volunteer.skills.length > 0 && (
                        <div className={styles.skills}>
                          {r.volunteer.skills.slice(0, 4).map(sk => (
                            <span key={sk} className={styles.skill}>{sk}</span>
                          ))}
                          {r.volunteer.skills.length > 4 && (
                            <span className={styles.skill}>+{r.volunteer.skills.length - 4}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.resRight}>
                      <span className={`${styles.resBadge} ${styles['rb_' + r.status]}`}>
                        {RES_LABEL[r.status]}
                        {r.status === 'waitlisted' && r.waitlist_position != null
                          ? ` #${r.waitlist_position}` : ''}
                      </span>
                      {canAct && (
                        <div className={styles.actionBtns}>
                          <button
                            className={styles.approveBtn}
                            disabled={isActing}
                            onClick={() => decide(r.id, 'approved')}
                          >
                            {isActing ? '…' : 'Approve'}
                          </button>
                          <button
                            className={styles.denyBtn}
                            disabled={isActing}
                            onClick={() => decide(r.id, 'denied')}
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
