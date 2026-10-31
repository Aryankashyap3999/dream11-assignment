import { Eye } from 'lucide-react'
import { useMatchAnalysis } from '../../hooks/apis/analysis'
import Card from '../atoms/Card'

export default function PlayerToWatch({ matchId }: { matchId: string }) {
  const { data, isLoading, isError } = useMatchAnalysis(matchId)
  const p = data?.playerToWatch

  return (
    <Card title="Player to watch" isLoading={isLoading} isError={isError} errorText="Player data not available.">
      {p ? (
        <div className="flex items-start gap-3">
          <Eye size={20} className="mt-1 text-emerald-400" />
          <div>
            <p className="text-xl font-bold">{p.name}</p>
            {p.role && <p className="text-xs uppercase tracking-wider text-zinc-500">{p.role}</p>}
            <p className="mt-1 text-sm text-zinc-400">{p.reason}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No specific player to watch</p>
      )}
    </Card>
  )
}
