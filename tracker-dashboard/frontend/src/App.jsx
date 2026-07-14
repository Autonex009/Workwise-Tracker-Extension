import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import TeamOverview from './pages/TeamOverview'
import EmployeeDetail from './pages/EmployeeDetail'
import StatusBoard from './pages/StatusBoard'

const Page = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Page><TeamOverview /></Page>} />
      <Route path="/employee/:email" element={<Page><EmployeeDetail /></Page>} />
      <Route path="/live" element={<Page><StatusBoard /></Page>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
