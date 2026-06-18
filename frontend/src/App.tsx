import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/auth/AuthPage'
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard'
import BrowseShifts from './pages/volunteer/BrowseShifts'
import AdminDashboard from './pages/admin/AdminDashboard'
import CreateShift from './pages/admin/CreateShift'
import ShiftDetail from './pages/volunteer/ShiftDetail'
import ManageShifts from './pages/admin/ManageShifts'
import EditShift from './pages/admin/EditShift'
import ShiftReservations from './pages/admin/ShiftReservations'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="volunteer">
              <VolunteerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shifts"
          element={
            <ProtectedRoute role="volunteer">
              <BrowseShifts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shifts/:id"
          element={
            <ProtectedRoute role="volunteer">
              <ShiftDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute role="org_admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/shifts/new"
          element={
            <ProtectedRoute role="org_admin">
              <CreateShift />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/shifts"
          element={
            <ProtectedRoute role="org_admin">
              <ManageShifts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/shifts/:id/edit"
          element={
            <ProtectedRoute role="org_admin">
              <EditShift />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/shifts/:id/reservations"
          element={
            <ProtectedRoute role="org_admin">
              <ShiftReservations />
            </ProtectedRoute>
          }
        />

        {/* Future routes go here */}

        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
