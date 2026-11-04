import { RefreshCw, Sparkles } from 'lucide-react'
import { useMatchInsights } from '../../hooks/apis/ai'
import { apiErrorMessage } from '../../utils/errors'
import Card from '../atoms/Card'

const Block = ({ label, text }: { label: string; text: string }) => (
  <div>
    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400">{label}</h3>
    <p className="mt-1 text-zinc-300">{text}</p>
  </div>
)

export default function AIInsightCard({ matchId }: { matchId: string }) {
  const { data, isLoading, isError, error, isFetching, refetch } = useMatchInsights(matchId)
  const message = apiErrorMessage(error, 'AI insights are unavailable right now.')

  return (
    // A failed refresh keeps the last insight on screen; the error card only replaces an empty one.
    <Card className="border-emerald-500/30" isLoading={isLoading} isError={isError && !data} errorText={message}>
      <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
        <Sparkles size={14} className="text-emerald-400" /> What just changed?
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Generate a fresh insight for the current match state"
          className="ml-auto inline-flex items-center gap-1 rounded text-[11px] font-semibold normal-case tracking-normal text-zinc-400 hover:text-emerald-400 disabled:opacity-40"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> {isFetching ? 'Updating…' : 'Refresh'}
        </button>
      </div>
      {data ? (
        <div className="space-y-4">
          <p className="text-xl font-semibold">{data.headline}</p>
          <Block label="What changed" text={data.whatChanged} />
          <Block label="Why it matters" text={data.whyItMatters} />
          <Block label="Watch next" text={data.watchNext} />
          {isError && <p className="text-xs text-zinc-500">{message}</p>}
        </div>
      ) : (
        <button onClick={() => refetch()} className="mt-3 text-sm text-emerald-400 hover:underline">
          Try again
        </button>
      )}
    </Card>
  )
}
