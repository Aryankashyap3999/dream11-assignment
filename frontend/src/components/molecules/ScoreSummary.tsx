import { useScorecard } from '../../hooks/apis/matches'
import type { MatchDetails } from '../../types'
import { oversFromBalls } from '../../utils/format'
import Card from '../atoms/Card'

export default function ScoreSummary({ match }: { match: MatchDetails }) {
  const { data, isLoading, isError } = useScorecard(match.id)

  return (
    <Card isLoading={isLoading} isError={isError} errorText="Score could not be loaded.">
      <div className="grid grid-cols-2 items-center gap-4 text-center">
        {match.teams.slice(0, 2).map((team) => {
          const total = data?.totals.find((t) => t.teamId === team.id)
          return (
            <div key={team.id}>
              <p className="text-sm font-semibold tracking-widest text-zinc-400">
                {(team.shortName ?? team.name).toUpperCase()}
              </p>
              <p className="text-4xl font-black tabular-nums sm:text-6xl">
                {total ? `${total.runs}/${total.wickets}` : '—'}
              </p>
              <p className="text-sm text-zinc-500">{total ? `${oversFromBalls(total.balls)} overs` : 'Yet to bat'}</p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
