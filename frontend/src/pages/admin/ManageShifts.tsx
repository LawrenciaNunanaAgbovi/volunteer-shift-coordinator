import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './ManageShifts.module.css'

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
  category: string
  _count: { reservations: number }
}

type Filter = 'all' | 'draft' | 'open' | 'closed'

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', open: 'Open', closed: 'Closed' }

const CATEGORY_LABEL: Record<string, string> = {
  food: 'Food', education: 'Education', environment: 'Environment',
  health: 'Health', animals: 'Animals', arts: 'Arts',
  community: 'Community', sports: 'Sports', other: 'Other',
}

export default function ManageShifts() {
  const [shifts, setShifts]               = useState<Shift[]>([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState<Filter>('all')
  const [acting, setActing]               = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ shifts: Shift[] }>('/api/orgs/my/dashboard')
      .then(({ data }) => setShifts(data.shifts))
      .finally(() => setLoading(false))
  }, [])

  const counts = {
    all:    shifts.length,
    draft:  shifts.filter(s => s.status === 'draft').length,
    open:   shifts.filter(s => s.status === 'open').length,
    closed: shifts.filter(s => s.status === 'closed').length,
  }

  const visible = filter === 'all' ? shifts : shifts.filter(s => s.status === filter)

  const changeStatus = async (id: string, status: 'open' | 'closed') => {
    setActing(id)
    try {
      await api.patch(`/api/shifts/${id}/status`, { status })
      setShifts(prev => prev.map(s => s.id === id ? { ...s, status } : s))
    } catch { /* silent */ } finally {
      setActing(null)
    }
  }

  const handleDelete = async (id: string) => {
    setActing(id)
    try {
      await api.delete(`/api/shifts/${id}`)
      setShifts(prev => prev.filter(s => s.id !== id))
    } catch { /* silent */ } finally {
      setActing(null)
      setConfirmDelete(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <Navbar />

      <main className={styles.main}>

        <div className={styles.pageHeader}>
          <div>
            <Link to="/admin/dashboard" className={styles.backLink}>← Back to dashboard</Link>
            <h1 className={styles.pageTitle}>Manage Shifts</h1>
            <p className={styles.pageSub}>View, publish, and manage all your shifts.</p>
          </div>
          <Link to="/admin/shifts/new" className={styles.createBtn}>+ Create Shift</Link>
        </div>

        <div className={styles.tabs}>
          {(['all', 'draft', 'open', 'closed'] as Filter[]).map(f => (
            <button
              key={f}
              className={`${styles.tab} ${filter === f ? styles.tabActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              <span className={`${styles.tabCount} ${filter === f ? styles.tabCountActive : ''}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.card}>
          {loading ? (
            <div className={styles.empty}>Loading shifts…</div>
          ) : visible.length === 0 ? (
            <div className={styles.empty}>
              No {filter !== 'all' ? filter + ' ' : ''}shifts yet.
              {filter === 'all' && (
                <Link to="/admin/shifts/new" className={styles.emptyLink}> Create one →</Link>
              )}
            </div>
          ) : (
            <div className={styles.list}>
              {visible.map((shift, i) => {
                const filled   = shift._count.reservations
                const pct      = Math.min(Math.round((filled / shift.capacity) * 100), 100)
                const isFull   = filled >= shift.capacity
                const startT   = fmtTime(shift.start_time)
                const endT     = fmtTime(shift.end_time)
                const timeStr  = startT ? (endT ? `${startT} – ${endT}` : startT) : null
                const isActing = acting === shift.id

                return (
                  <div key={shift.id} className={`${styles.row} ${i > 0 ? styles.rowBorder : ''}`}>

                    <div className={styles.rowLeft}>
                      <div className={styles.rowTop}>
                        <span className={styles.shiftTitle}>{shift.title}</span>
                        <span className={`${styles.statusBadge} ${styles['s_' + shift.status]}`}>
                          {STATUS_LABEL[shift.status]}
                        </span>
                        <span className={styles.categoryTag}>
                          {CATEGORY_LABEL[shift.category] ?? shift.category}
                        </span>
                      </div>
                      <div className={styles.meta}>
                        <span>📅 {fmtDate(shift.date)}</span>
                        {timeStr && <span>🕐 {timeStr}</span>}
                        <span>📍 {shift.location}</span>
                      </div>
                      <div className={styles.capacityRow}>
                        <span className={styles.capacityLabel} style={{ color: isFull ? '#818CF8' : '#86EFAC' }}>
                          {filled}/{shift.capacity} filled
                        </span>
                        <div className={styles.bar}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${pct}%`, background: isFull ? '#818CF8' : '#22C55E' }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.rowActions}>
                      <Link to={`/admin/shifts/${shift.id}/edit`} className={styles.editBtn}>
                        Edit
                      </Link>
                      <Link to={`/admin/shifts/${shift.id}/reservations`} className={styles.viewBtn}>
                        Reservations
                      </Link>

                      {shift.status === 'draft' && (
                        <button
                          className={styles.publishBtn}
                          disabled={isActing}
                          onClick={() => changeStatus(shift.id, 'open')}
                        >
                          {isActing ? '…' : 'Publish'}
                        </button>
                      )}

                      {shift.status === 'open' && (
                        <button
                          className={styles.closeShiftBtn}
                          disabled={isActing}
                          onClick={() => changeStatus(shift.id, 'closed')}
                        >
                          {isActing ? '…' : 'Close'}
                        </button>
                      )}

                      {shift.status === 'closed' && (
                        <button
                          className={styles.reopenBtn}
                          disabled={isActing}
                          onClick={() => changeStatus(shift.id, 'open')}
                        >
                          {isActing ? '…' : 'Reopen'}
                        </button>
                      )}

                      {confirmDelete === shift.id ? (
                        <span className={styles.confirmRow}>
                          <span className={styles.confirmText}>Delete?</span>
                          <button
                            className={styles.confirmYes}
                            disabled={isActing}
                            onClick={() => handleDelete(shift.id)}
                          >
                            Yes
                          </button>
                          <button className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          className={styles.deleteBtn}
                          disabled={isActing}
                          onClick={() => setConfirmDelete(shift.id)}
                        >
                          Delete
                        </button>
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
