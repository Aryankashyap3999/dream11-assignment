import { Sparkles } from 'lucide-react'
import { useMatchInsights } from '../../hooks/apis/ai'
import Card from '../atoms/Card'

const Block = ({ label, text }: { label: string; text: string }) => (
  <div>
    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400">{label}</h3>
    <p className="mt-1 text-zinc-300">{text}</p>
  </div>
)

export default function AIInsightCard({ matchId }: { matchId: string }) {
  const { data, isLoading, isError, refetch } = useMatchInsights(matchId)

  return (
    <Card
      className="border-emerald-500/30"
      isLoading={isLoading}
      isError={isError}
      errorText="AI insights are unavailable right now."
    >
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
        <Sparkles size={14} className="text-emerald-400" /> What just changed?
      </div>
      {data ? (
        <div className="space-y-4">
          <p className="text-xl font-semibold">{data.headline}</p>
          <Block label="What changed" text={data.whatChanged} />
          <Block label="Why it matters" text={data.whyItMatters} />
          <Block label="Watch next" text={data.watchNext} />
        </div>
      ) : (
        <button onClick={() => refetch()} className="mt-3 text-sm text-emerald-400 hover:underline">
          Try again
        </button>
      )}
    </Card>
  )
}
