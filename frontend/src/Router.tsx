import { Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Match from './pages/Match'
import NotFound from './pages/NotFound'

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/matches/:matchId" element={<Match />} />
      <Route path="/*" element={<NotFound />} />
    </Routes>
  )
}
