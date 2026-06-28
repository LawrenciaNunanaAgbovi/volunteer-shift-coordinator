import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Navbar from '../../components/Navbar'
import RichTextEditor from '../../components/RichTextEditor'
import styles from './CreateShift.module.css'

const CATEGORIES = [
  { value: 'food',        label: 'Food' },
  { value: 'education',   label: 'Education' },
  { value: 'environment', label: 'Environment' },
  { value: 'health',      label: 'Health' },
  { value: 'animals',     label: 'Animals' },
  { value: 'arts',        label: 'Arts' },
  { value: 'community',   label: 'Community' },
  { value: 'sports',      label: 'Sports' },
  { value: 'other',       label: 'Other' },
]

interface PositionDraft {
  _key: string
  name: string
  description: string
  capacity: string
}

interface FormState {
  title: string
  description: string
  date: string
  start_time: string
  end_time: string
  duration: string
  location: string
  capacity: string
  category: string
  requirements: string
  what_to_bring: string
  is_recurring: boolean
  recurrence_note: string
  contact_name: string
  contact_email: string
}

const EMPTY: FormState = {
  title: '', description: '', date: '', start_time: '', end_time: '',
  duration: '', location: '', capacity: '', category: 'other',
  requirements: '', what_to_bring: '', is_recurring: false,
  recurrence_note: '', contact_name: '', contact_email: '',
}

interface AiContent { description: string; requirements: string; what_to_bring: string }

export default function CreateShift() {
  const navigate = useNavigate()
  const [form, setForm]             = useState<FormState>(EMPTY)
  const [positions, setPositions]   = useState<PositionDraft[]>([])
  const [error, setError]           = useState('')
  const [submitting, setSubmitting] = useState<null | 'draft' | 'publish'>(null)
  const [aiNotes, setAiNotes]       = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiContent, setAiContent]   = useState<AiContent | null>(null)

  const generateWithAI = async () => {
    if (!form.title.trim()) { setError('Add a shift title first so AI has context.'); return }
    setError('')
    setAiGenerating(true)
    try {
      const { data } = await api.post<AiContent>('/api/ai/generate-description', {
        title:       form.title.trim(),
        category:    form.category,
        location:    form.location.trim() || undefined,
        date:        form.date || undefined,
        extra_notes: aiNotes.trim() || undefined,
      })
      setAiContent(data)
      setForm(prev => ({ ...prev, description: data.description, requirements: data.requirements, what_to_bring: data.what_to_bring }))
    } catch {
      setError('AI generation failed. Please try again.')
    } finally {
      setAiGenerating(false)
    }
  }

  const set = (field: keyof FormState, value: string | boolean) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const addPosition = () =>
    setPositions(prev => [...prev, { _key: crypto.randomUUID(), name: '', description: '', capacity: '' }])

  const updatePos = (key: string, field: keyof Omit<PositionDraft, '_key'>, value: string) =>
    setPositions(prev => prev.map(p => p._key === key ? { ...p, [field]: value } : p))

  const removePos = (key: string) =>
    setPositions(prev => prev.filter(p => p._key !== key))

  const validate = (): string | null => {
    if (!form.title.trim())                   return 'Shift title is required.'
    if (!form.date)                           return 'Date is required.'
    if (!form.location.trim())                return 'Location is required.'
    if (!form.capacity || +form.capacity < 1) return 'Capacity must be at least 1.'
    for (const p of positions) {
      if (!p.name.trim())                     return 'Each position must have a name.'
      if (!p.capacity || +p.capacity < 1)     return 'Each position must have a capacity of at least 1.'
    }
    return null
  }

  const submit = async (publish: boolean) => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSubmitting(publish ? 'publish' : 'draft')
    try {
      const { data } = await api.post('/api/shifts', {
        title:         form.title.trim(),
        description:   form.description.trim() || undefined,
        date:          form.date,
        start_time:    form.start_time || undefined,
        end_time:      form.end_time || undefined,
        duration:      form.duration.trim() || undefined,
        location:      form.location.trim(),
        capacity:      +form.capacity,
        category:      form.category,
        requirements:  form.requirements.trim() || undefined,
        what_to_bring: form.what_to_bring.trim() || undefined,
        is_recurring:    form.is_recurring,
        recurrence_note: form.is_recurring ? (form.recurrence_note.trim() || undefined) : undefined,
        contact_name:  form.contact_name.trim() || undefined,
        contact_email: form.contact_email.trim() || undefined,
        positions: positions.map(p => ({
          name:        p.name.trim(),
          description: p.description.trim() || undefined,
          capacity:    +p.capacity,
        })),
      })
      if (publish) {
        await api.patch(`/api/shifts/${data.id}/status`, { status: 'open' })
      }
      navigate('/admin/dashboard')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <Navbar />

      <main className={styles.main}>

        {/* Header */}
        <div>
          <Link to="/admin/dashboard" className={styles.backLink}>← Back to dashboard</Link>
          <h1 className={styles.pageTitle}>Create a new shift</h1>
          <p className={styles.pageSub}>Shifts start as drafts. Publish when you're ready for volunteers to sign up.</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <div className={styles.formBody}>

          {/* ── Shift details ── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Shift details</h2>

            <div className={styles.field}>
              <label className={styles.label}>Title <span className={styles.req}>*</span></label>
              <input
                className={styles.input}
                placeholder="e.g. Community Kitchen Helper"
                value={form.title}
                onChange={e => set('title', e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Description</label>
              <div className={styles.aiBar}>
                <span className={styles.aiLabel}>✨ Generate with AI</span>
                <input
                  className={styles.aiInput}
                  placeholder="Optional keywords (e.g. outdoor, bilingual, heavy lifting…)"
                  value={aiNotes}
                  onChange={e => setAiNotes(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                  disabled={aiGenerating}
                />
                <button
                  type="button"
                  className={styles.aiBtn}
                  onClick={generateWithAI}
                  disabled={aiGenerating}
                >
                  {aiGenerating ? 'Generating…' : 'Generate'}
                </button>
              </div>
              <RichTextEditor
                value={form.description}
                onChange={v => set('description', v)}
                placeholder="What will volunteers be doing? Give a friendly overview."
                externalContent={aiContent?.description}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Category</label>
              <div className={styles.pills}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    className={`${styles.pill} ${form.category === cat.value ? styles.pillActive : ''}`}
                    onClick={() => set('category', cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── Schedule ── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Schedule</h2>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Date <span className={styles.req}>*</span></label>
                <input
                  type="date"
                  className={styles.input}
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Duration</label>
                <input
                  className={styles.input}
                  placeholder="e.g. 2hrs, 90mins"
                  value={form.duration}
                  onChange={e => set('duration', e.target.value)}
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Start time</label>
                <input
                  type="time"
                  className={styles.input}
                  value={form.start_time}
                  onChange={e => set('start_time', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>End time</label>
                <input
                  type="time"
                  className={styles.input}
                  value={form.end_time}
                  onChange={e => set('end_time', e.target.value)}
                />
              </div>
            </div>

            <label className={styles.checkRow}>
              <div
                className={`${styles.checkBox} ${form.is_recurring ? styles.checkActive : ''}`}
                onClick={() => set('is_recurring', !form.is_recurring)}
              >
                {form.is_recurring && '✓'}
              </div>
              <span className={styles.checkLabel}>This is a recurring shift</span>
            </label>

            {form.is_recurring && (
              <div className={styles.field}>
                <label className={styles.label}>Recurrence schedule</label>
                <input
                  className={styles.input}
                  placeholder="e.g. Every Thursday 9am – 12pm, First Saturday of each month"
                  value={form.recurrence_note}
                  onChange={e => set('recurrence_note', e.target.value)}
                />
              </div>
            )}
          </section>

          {/* ── Location & capacity ── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Location & capacity</h2>
            <div className={styles.row}>
              <div className={`${styles.field} ${styles.fieldGrow}`}>
                <label className={styles.label}>Location <span className={styles.req}>*</span></label>
                <input
                  className={styles.input}
                  placeholder="e.g. 123 Main St, Atlanta, GA"
                  value={form.location}
                  onChange={e => set('location', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Total capacity <span className={styles.req}>*</span></label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="e.g. 20"
                  min="1"
                  value={form.capacity}
                  onChange={e => set('capacity', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Requirements ── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Requirements <span className={styles.optional}>(optional)</span>
            </h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Skills & requirements</label>
                <RichTextEditor
                  value={form.requirements}
                  onChange={v => set('requirements', v)}
                  placeholder="Age restrictions, physical demands, certifications needed…"
                  externalContent={aiContent?.requirements}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>What to bring / wear</label>
                <RichTextEditor
                  value={form.what_to_bring}
                  onChange={v => set('what_to_bring', v)}
                  placeholder="Closed-toe shoes, gloves, ID card…"
                  externalContent={aiContent?.what_to_bring}
                />
              </div>
            </div>
          </section>

          {/* ── Contact ── */}
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              Contact person <span className={styles.optional}>(optional)</span>
            </h2>
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  placeholder="Contact person's name"
                  value={form.contact_name}
                  onChange={e => set('contact_name', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="contact@org.com"
                  value={form.contact_email}
                  onChange={e => set('contact_email', e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* ── Positions ── */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  Positions <span className={styles.optional}>(optional)</span>
                </h2>
                <p className={styles.cardHint}>
                  Break the shift into roles (e.g. "Greeter", "Server"). Each position tracks its own headcount.
                </p>
              </div>
              <button type="button" className={styles.addPositionBtn} onClick={addPosition}>
                + Add position
              </button>
            </div>

            {positions.length === 0 ? (
              <div className={styles.positionEmpty}>
                No positions added — capacity will be tracked at the shift level.
              </div>
            ) : (
              <div className={styles.positionList}>
                {positions.map((pos, i) => (
                  <div key={pos._key} className={styles.positionRow}>
                    <div className={styles.positionIndex}>{i + 1}</div>
                    <div className={styles.positionFields}>
                      <div className={styles.row}>
                        <div className={`${styles.field} ${styles.fieldGrow}`}>
                          <label className={styles.label}>Role name</label>
                          <input
                            className={styles.input}
                            placeholder="e.g. Greeter"
                            value={pos.name}
                            onChange={e => updatePos(pos._key, 'name', e.target.value)}
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Slots</label>
                          <input
                            type="number"
                            className={styles.input}
                            placeholder="e.g. 5"
                            min="1"
                            value={pos.capacity}
                            onChange={e => updatePos(pos._key, 'capacity', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Description <span className={styles.optional}>(optional)</span>
                        </label>
                        <input
                          className={styles.input}
                          placeholder="Brief description of this role"
                          value={pos.description}
                          onChange={e => updatePos(pos._key, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.removePositionBtn}
                      onClick={() => removePos(pos._key)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Actions ── */}
          <div className={styles.actions}>
            <Link to="/admin/dashboard" className={styles.cancelLink}>Cancel</Link>
            <div className={styles.submitGroup}>
              <button
                type="button"
                className={styles.draftBtn}
                disabled={submitting !== null}
                onClick={() => submit(false)}
              >
                {submitting === 'draft' ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                type="button"
                className={styles.publishBtn}
                disabled={submitting !== null}
                onClick={() => submit(true)}
              >
                {submitting === 'publish' ? 'Publishing…' : 'Save & Publish'}
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
