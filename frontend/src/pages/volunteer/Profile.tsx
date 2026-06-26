import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import styles from './Profile.module.css'

interface UserProfile {
  id: string
  name: string
  email: string
  role: string
  skills: string[]
  created_at: string
  _count: { reservations: number }
}

const initials = (name: string) =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

const fmtJoined = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export default function Profile() {
  const [profile, setProfile]       = useState<UserProfile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]   = useState('')
  const [savingName, setSavingName] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [savingSkill, setSavingSkill] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<UserProfile>('/api/users/me')
      .then(r => { setProfile(r.data); setNameInput(r.data.name) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (editingName) nameRef.current?.focus()
  }, [editingName])

  const saveName = async () => {
    if (!profile || !nameInput.trim() || nameInput.trim() === profile.name) {
      setEditingName(false)
      setNameInput(profile?.name ?? '')
      return
    }
    setSavingName(true)
    try {
      const { data } = await api.patch<UserProfile>('/api/users/me', { name: nameInput.trim() })
      setProfile(data)
      setNameInput(data.name)
      setEditingName(false)
    } catch { /* silent */ } finally {
      setSavingName(false)
    }
  }

  const cancelNameEdit = () => {
    setEditingName(false)
    setNameInput(profile?.name ?? '')
  }

  const addSkill = async () => {
    const tag = skillInput.trim()
    if (!tag || !profile || profile.skills.includes(tag)) { setSkillInput(''); return }
    setSavingSkill(true)
    const next = [...profile.skills, tag]
    try {
      const { data } = await api.patch<UserProfile>('/api/users/me', { skills: next })
      setProfile(data)
      setSkillInput('')
    } catch { /* silent */ } finally {
      setSavingSkill(false)
    }
  }

  const removeSkill = async (tag: string) => {
    if (!profile) return
    const next = profile.skills.filter(s => s !== tag)
    try {
      const { data } = await api.patch<UserProfile>('/api/users/me', { skills: next })
      setProfile(data)
    } catch { /* silent */ }
  }

  const onSkillKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); addSkill() }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.orb1} /><div className={styles.orb2} />
        <Navbar />
        <main className={styles.main}><p className={styles.dimText}>Loading profile…</p></main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className={styles.page}>
        <div className={styles.orb1} /><div className={styles.orb2} />
        <Navbar />
        <main className={styles.main}><p className={styles.dimText}>Could not load profile.</p></main>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <Navbar />

      <main className={styles.main}>

        {/* Avatar + name */}
        <div className={styles.hero}>
          <div className={styles.avatar}>{initials(profile.name)}</div>
          <div className={styles.heroInfo}>
            {editingName ? (
              <div className={styles.nameEditRow}>
                <input
                  ref={nameRef}
                  className={styles.nameInput}
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') cancelNameEdit() }}
                  disabled={savingName}
                  maxLength={80}
                />
                <button className={styles.saveBtn} onClick={saveName} disabled={savingName}>
                  {savingName ? '…' : 'Save'}
                </button>
                <button className={styles.cancelEditBtn} onClick={cancelNameEdit} disabled={savingName}>
                  Cancel
                </button>
              </div>
            ) : (
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.name}</h1>
                <button className={styles.editBtn} onClick={() => setEditingName(true)}>Edit</button>
              </div>
            )}
            <p className={styles.email}>{profile.email}</p>
            <p className={styles.joined}>Member since {fmtJoined(profile.created_at)}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{profile._count.reservations}</span>
            <span className={styles.statLabel}>Total shifts signed up</span>
          </div>
        </div>

        {/* Skills */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skills & interests</h2>

          {profile.skills.length > 0 && (
            <div className={styles.tags}>
              {profile.skills.map(s => (
                <span key={s} className={styles.tag}>
                  {s}
                  <button
                    className={styles.tagRemove}
                    onClick={() => removeSkill(s)}
                    aria-label={`Remove ${s}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className={styles.addSkillRow}>
            <input
              className={styles.skillInput}
              placeholder="Add a skill or interest…"
              value={skillInput}
              onChange={e => setSkillInput(e.target.value)}
              onKeyDown={onSkillKey}
              disabled={savingSkill}
              maxLength={40}
            />
            <button
              className={styles.addBtn}
              onClick={addSkill}
              disabled={savingSkill || !skillInput.trim()}
            >
              {savingSkill ? '…' : '+ Add'}
            </button>
          </div>
          {profile.skills.length === 0 && (
            <p className={styles.emptySkills}>No skills added yet — tell orgs what you're good at.</p>
          )}
        </section>

        {/* Account info */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          <div className={styles.infoCard}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Email</span>
              <span className={styles.infoValue}>{profile.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Role</span>
              <span className={styles.infoValue}>Volunteer</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Account ID</span>
              <span className={`${styles.infoValue} ${styles.mono}`}>{profile.id.slice(0, 8)}…</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
