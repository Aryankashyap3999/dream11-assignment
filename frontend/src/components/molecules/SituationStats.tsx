import { useMatchAnalysis } from '../../hooks/apis/analysis'
import { orDash } from '../../utils/format'
import Card from '../atoms/Card'

export default function SituationStats({ matchId }: { matchId: string }) {
  const { data, isLoading, isError } = useMatchAnalysis(matchId)
  const s = data?.situation

  const stats = [
    { label: 'Runs needed', value: orDash(s?.runsRequired) },
    { label: 'Balls left', value: orDash(s?.ballsRemaining) },
    { label: 'Required RR', value: orDash(s?.requiredRunRate) },
  ]

  return (
    <Card title="Current situation" isLoading={isLoading} isError={isError} errorText="Match data could not be loaded.">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((st) => (
          <div key={st.label}>
            <p className="text-2xl font-bold tabular-nums">{st.value}</p>
            <p className="text-xs text-zinc-500">{st.label}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
