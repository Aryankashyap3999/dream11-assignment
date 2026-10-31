import { useMatchAnalysis } from '../../hooks/apis/analysis'
import type { RecentBall } from '../../types'
import Card from '../atoms/Card'

const ballStyle = (b: RecentBall) =>
  b.isWicket
    ? 'bg-red-500 text-white'
    : b.isBoundary
      ? 'bg-emerald-500 text-zinc-950'
      : 'bg-zinc-800 text-zinc-300'

export default function LastSixBalls({ matchId }: { matchId: string }) {
  const { data, isLoading, isError } = useMatchAnalysis(matchId)
  const balls = data?.recentForm.last6Balls ?? []

  return (
    <Card title="Last 6 balls" isLoading={isLoading} isError={isError} errorText="Recent balls not available.">
      {balls.length ? (
        <div className="flex gap-2">
          {balls.map((b, i) => (
            <span
              key={i}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${ballStyle(b)}`}
            >
              {b.isWicket ? 'W' : b.totalRuns}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No balls bowled yet</p>
      )}
    </Card>
  )
}
