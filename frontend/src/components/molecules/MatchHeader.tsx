import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MatchDetails } from '../../types'
import LiveIndicator from '../atoms/LiveIndicator'

export default function MatchHeader({ match }: { match: MatchDetails }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={12} /> All matches
        </Link>
        <p className="text-xs font-black tracking-[0.3em] text-emerald-400">MATCHPULSE</p>
        <h1 className="text-lg font-semibold">{match.name}</h1>
        <p className="text-sm text-zinc-500">{[match.format, match.venue].filter(Boolean).join(' · ')}</p>
      </div>
      <LiveIndicator />
    </header>
  )
}
