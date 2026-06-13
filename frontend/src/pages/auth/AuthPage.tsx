import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import styles from './AuthPage.module.css'

const PHRASES = [
  'Every shift is a step toward change.',
  'Communities thrive when people show up.',
  'Your time. Their hope. Real impact.',
  'Build bridges, not barriers.',
  'Show up. Stand out. Make a difference.',
  'One volunteer at a time, we transform the world.',
]

const PASSWORD_RULES = [
  { label: 'At least 8 characters',        test: (p: string) => p.length >= 8 },
  { label: 'Contains a number',             test: (p: string) => /\d/.test(p) },
  { label: 'Contains a special character',  test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
]

type Mode = 'login' | 'register'
type Role = 'volunteer' | 'org_admin'

interface FormState {
  name: string
  email: string
  password: string
  orgName: string
  causeArea: string
}

interface Curve {
  x1: number; y1: number
  _x1: number; _y1: number
  _x2: number; _y2: number
  x2: number; y2: number
  a1: number; a2: number; a3: number
}

export default function AuthPage() {
  const navigate    = useNavigate()
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const [mode, setMode]           = useState<Mode>('login')
  const [role, setRole]           = useState<Role>('volunteer')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [visible, setVisible]     = useState(true)
  const [form, setForm]           = useState<FormState>({
    name: '', email: '', password: '', orgName: '', causeArea: '',
  })

  // ── Bezier-curve canvas animation ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let w = canvas.width  = window.innerWidth
    let h = canvas.height = window.innerHeight
    let u = 120  // start near green in the hue wheel
    let rafId: number

    const mkCurve = (): Curve => ({
      x1: w,   y1: h,
      _x1: w - Math.random() * w,
      _y1: h - Math.random() * h,
      _x2: w - Math.random() * w,
      _y2: h - Math.random() * h,
      x2: -w + Math.random() * w,
      y2: -h + Math.random() * h,
      a1: Math.random() * 10,
      a2: Math.random() * 10,
      a3: Math.random() * 10,
    })

    const arr: Curve[] = Array.from({ length: 20 }, mkCurve)

    const draw = () => {
      u -= 0.18

      // Very slow fade so old lines dissolve rather than linger forever
      ctx.fillStyle = 'rgba(3, 12, 6, 0.018)'
      ctx.fillRect(0, 0, w, h)

      for (const b of arr) {
        b._x1 *= Math.sin(b.a1 -= 0.001)
        b._y1 *= Math.sin(b.a1)
        b._x2 -= Math.sin(b.a2 += 0.001)
        b._y1 += Math.sin(b.a2)
        b.x1  -= Math.sin(b.a3 += 0.001)
        b.y1  += Math.sin(b.a3)
        b.x2  -= Math.sin((b.a3 -= 0.001))
        b.y2  += Math.sin(b.a3)

        ctx.save()
        ctx.globalAlpha = 0.035
        ctx.lineWidth   = 1.5
        ctx.strokeStyle = `hsla(${u}, 80%, 62%, 0.9)`
        ctx.beginPath()
        ctx.moveTo(b.x1, b.y1)
        ctx.bezierCurveTo(b._x1, b._y1, b._x2, b._y2, b.x2, b.y2)
        ctx.stroke()
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }

    draw()

    const onResize = () => {
      w = canvas.width  = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ── Cycling catchphrases ────────────────────────────────
  useEffect(() => {
    const showTimer = setTimeout(() => {
      setVisible(false)
      const switchTimer = setTimeout(() => {
        setPhraseIndex(i => (i + 1) % PHRASES.length)
        setVisible(true)
      }, 600)
      return () => clearTimeout(switchTimer)
    }, 3800)
    return () => clearTimeout(showTimer)
  }, [phraseIndex])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'login') {
        const { data } = await api.post('/api/auth/login', {
          email: form.email,
          password: form.password,
        })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.user.role)
        localStorage.setItem('name', data.user.name)
        navigate(data.user.role === 'org_admin' ? '/admin/dashboard' : '/dashboard')
      } else {
        const { data } = await api.post('/api/auth/register', {
          name: form.name,
          email: form.email,
          password: form.password,
          role,
        })
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.user.role)
        localStorage.setItem('name', data.user.name)
        if (role === 'org_admin') {
          await api.post('/api/orgs', { name: form.orgName, cause_area: form.causeArea })
          navigate('/admin/dashboard')
        } else {
          navigate('/dashboard')
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setForm({ name: '', email: '', password: '', orgName: '', causeArea: '' })
  }

  const words        = PHRASES[phraseIndex].split(' ')
  const showStrength = mode === 'register' && form.password.length > 0

  return (
    <div className={styles.page}>
      {/* Background orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      {/* Animated bezier-curve canvas */}
      <canvas ref={canvasRef} className={styles.canvas} />

      <div className={styles.card}>

        {/* ── Left Panel ── */}
        <div className={styles.leftPanel}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>◎</div>
            ShiftCoord
          </div>

          <div className={styles.phraseWrap}>
            <p className={`${styles.phrase} ${visible ? styles.phraseVisible : styles.phraseHidden}`}>
              {words.map((word, i) => (
                <span
                  key={`${phraseIndex}-${i}`}
                  className={styles.word}
                  style={{ '--delay': `${i * 0.075}s` } as React.CSSProperties}
                >
                  {word}
                </span>
              ))}
            </p>
          </div>

          <p className={styles.tagline}>
            Connecting volunteers with organizations that need them most.
          </p>
        </div>

        {/* ── Right Panel ── */}
        <div className={styles.rightPanel}>
          <div className={styles.divider} />

          <div className={styles.toggle}>
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`${styles.toggleBtn} ${mode === m ? styles.toggleActive : ''}`}
              >
                {m === 'login' ? 'Log In' : 'Register'}
              </button>
            ))}
          </div>

          <h2 className={styles.heading}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className={styles.subheading}>
            {mode === 'login'
              ? 'Sign in to see your shifts and reservations.'
              : 'Join as a volunteer or start coordinating for your org.'}
          </p>

          <form onSubmit={handleSubmit} className={styles.form}>

            {mode === 'register' && (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Full name</label>
                  <input
                    name="name" value={form.name} onChange={handleChange}
                    placeholder="Your full name" required
                    className={styles.input}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>I am a...</label>
                  <div className={styles.roleGrid}>
                    {([
                      { value: 'volunteer' as Role, label: '🙋 Volunteer' },
                      { value: 'org_admin' as Role, label: '🏢 Org Admin' },
                    ]).map(({ value, label }) => (
                      <button
                        key={value} type="button" onClick={() => setRole(value)}
                        className={`${styles.roleBtn} ${role === value ? styles.roleActive : ''}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {role === 'org_admin' && (
                  <div className={styles.formRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Organization name</label>
                      <input
                        name="orgName" value={form.orgName} onChange={handleChange}
                        placeholder="Your organization" required
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Cause area</label>
                      <input
                        name="causeArea" value={form.causeArea} onChange={handleChange}
                        placeholder="e.g. Environment, Education" required
                        className={styles.input}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email + Password — side-by-side on register, direct form children on login */}
            {mode === 'register' ? (
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@example.com" required
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input
                    name="password" type="password" value={form.password} onChange={handleChange}
                    placeholder="••••••••" required
                    className={styles.input}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    name="email" type="email" value={form.email} onChange={handleChange}
                    placeholder="you@example.com" required
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Password</label>
                  <input
                    name="password" type="password" value={form.password} onChange={handleChange}
                    placeholder="••••••••" required
                    className={styles.input}
                  />
                </div>
              </>
            )}

            {/* Password strength rules — register only */}
            {showStrength && (
              <div className={styles.strengthWrap}>
                {PASSWORD_RULES.map(rule => (
                  <div key={rule.label} className={styles.strengthRow}>
                    <span className={`${styles.dot} ${rule.test(form.password) ? styles.dotMet : styles.dotUnmet}`} />
                    <span className={styles.strengthText}>{rule.label}</span>
                  </div>
                ))}
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading
                ? 'Please wait...'
                : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
