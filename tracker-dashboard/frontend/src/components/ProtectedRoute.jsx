import { Navigate } from 'react-router-dom'
import { getAuth } from '../lib/auth'

export default function ProtectedRoute({ children }) {
  const { authed } = getAuth()
  if (!authed) return <Navigate to="/login" replace />
  return children
}
