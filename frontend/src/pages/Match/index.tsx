import { Link, useParams } from 'react-router-dom'
import Card from '../../components/atoms/Card'
import LastSixBalls from '../../components/molecules/LastSixBalls'
import MatchHeader from '../../components/molecules/MatchHeader'
import MomentumCard from '../../components/molecules/MomentumCard'
import PlayerToWatch from '../../components/molecules/PlayerToWatch'
import ScoreSummary from '../../components/molecules/ScoreSummary'
import SituationStats from '../../components/molecules/SituationStats'
import AIInsightCard from '../../components/organisms/AIInsightCard'
import AskMatchPulse from '../../components/organisms/AskMatchPulse'
import { useMatch } from '../../hooks/apis/matches'

export default function Match() {
  const { matchId = '' } = useParams()
  const { data: match, isLoading, isError } = useMatch(matchId)

  if (isLoading || isError || !match) {
    return (
      <main className="mx-auto max-w-3xl p-4 sm:p-8">
        <Card isLoading={isLoading} isError={!isLoading} errorText="Match data could not be loaded.">
          <Link to="/" className="text-sm text-emerald-400">← Back to matches</Link>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
      <MatchHeader match={match} />
      <ScoreSummary match={match} />
      <SituationStats matchId={matchId} />
      <AIInsightCard matchId={matchId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MomentumCard matchId={matchId} />
        <PlayerToWatch matchId={matchId} />
      </div>
      <LastSixBalls matchId={matchId} />
      <AskMatchPulse matchId={matchId} />
    </main>
  )
}
