import { Navigate } from 'react-router-dom'

interface Props {
  children: React.ReactNode
  role?: 'volunteer' | 'org_admin'
}

export default function ProtectedRoute({ children, role }: Props) {
  const token    = localStorage.getItem('token')
  const userRole = localStorage.getItem('role')

  if (!token) return <Navigate to="/auth" replace />
  if (role && userRole !== role) return <Navigate to="/auth" replace />

  return <>{children}</>
}
