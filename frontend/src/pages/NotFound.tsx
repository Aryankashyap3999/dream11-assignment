import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="p-8 text-center">
      <p className="text-zinc-400">Page not found.</p>
      <Link to="/" className="text-emerald-400">Back to matches</Link>
    </main>
  )
}
