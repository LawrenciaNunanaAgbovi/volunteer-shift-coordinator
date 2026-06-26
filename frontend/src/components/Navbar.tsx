import { NavLink, Link, useNavigate } from 'react-router-dom'
import styles from './Navbar.module.css'

interface NavItem {
  to: string
  label: string
}

const VOLUNTEER_LINKS: NavItem[] = [
  { to: '/dashboard',        label: 'Dashboard' },
  { to: '/shifts',           label: 'Browse Shifts' },
  { to: '/my-reservations',  label: 'My Reservations' },
]

const ADMIN_LINKS: NavItem[] = [
  { to: '/admin/dashboard',  label: 'Dashboard' },
  { to: '/admin/shifts',     label: 'Manage Shifts' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const name = localStorage.getItem('name') || 'User'
  const role = localStorage.getItem('role') as 'volunteer' | 'org_admin' | null

  const links = role === 'org_admin' ? ADMIN_LINKS : VOLUNTEER_LINKS

  const logout = () => {
    localStorage.clear()
    navigate('/auth')
  }

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link to={role === 'org_admin' ? '/admin/dashboard' : '/dashboard'} className={styles.logo}>
          <div className={styles.logoMark}>◎</div>
          ShiftCoord
        </Link>

        <div className={styles.links}>
          {links.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.link} ${isActive ? styles.linkActive : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className={styles.user}>
          {role === 'volunteer' ? (
            <Link to="/profile" className={styles.profileLink}>
              <div className={styles.avatar}>{name.charAt(0).toUpperCase()}</div>
              <span className={styles.userName}>{name}</span>
            </Link>
          ) : (
            <>
              <div className={styles.avatar}>{name.charAt(0).toUpperCase()}</div>
              <span className={styles.userName}>{name}</span>
            </>
          )}
          <button onClick={logout} className={styles.logoutBtn}>Sign out</button>
        </div>
      </div>
    </nav>
  )
}
