import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusBadge from '../../components/atoms/StatusBadge'
import Card from '../../components/atoms/Card'
import { useMatches } from '../../hooks/apis/matches'

export default function Dashboard() {
  const { data, isLoading, isError } = useMatches()

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <p className="text-xs font-black tracking-[0.3em] text-emerald-400">MATCHPULSE</p>
      <h1 className="mt-1 text-3xl font-black">Don't just see the score. Understand the game.</h1>

      <div className="mt-8 space-y-3">
        {(isLoading || isError || !data?.length) && (
          <Card isLoading={isLoading} isError={isError} errorText="Matches could not be loaded.">
            <p className="text-sm text-zinc-500">No matches available yet.</p>
          </Card>
        )}
        {data?.map((m) => (
          <Link
            key={m.id}
            to={`/matches/${m.id}`}
            className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-emerald-500/50"
          >
            <div>
              <p className="font-semibold">{m.teams.map((t) => t.name).join(' vs ') || m.name}</p>
              <p className="mt-1 text-sm text-zinc-500">{m.format ?? m.sport.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={m.status} />
              <ChevronRight size={18} className="text-zinc-600" />
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
