import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useMatchAnalysis } from '../../hooks/apis/analysis'
import Card from '../atoms/Card'

const STYLE = {
  POSITIVE: { Icon: TrendingUp, text: 'text-emerald-400', bar: 'bg-emerald-500' },
  NEGATIVE: { Icon: TrendingDown, text: 'text-red-400', bar: 'bg-red-500' },
  NEUTRAL: { Icon: Minus, text: 'text-zinc-400', bar: 'bg-zinc-500' },
}

export default function MomentumCard({ matchId }: { matchId: string }) {
  const { data, isLoading, isError } = useMatchAnalysis(matchId)
  const m = data?.momentum
  const style = STYLE[m?.direction ?? 'NEUTRAL']

  return (
    <Card title="Momentum" isLoading={isLoading} isError={isError} errorText="Momentum not available.">
      {m && (
        <>
          <div className={`flex items-center gap-2 ${style.text}`}>
            <style.Icon size={22} />
            <span className="text-sm font-bold tracking-widest">{m.direction}</span>
          </div>
          <p className={`mt-1 text-4xl font-black tabular-nums ${style.text}`}>
            {m.score > 0 ? '+' : ''}
            {m.score}
          </p>
          {/* bar width is display scaling only; the score itself comes from the backend */}
          <div className="mt-3 h-1.5 rounded bg-zinc-800">
            <div className={`h-full rounded ${style.bar}`} style={{ width: `${Math.min(Math.abs(m.score), 100)}%` }} />
          </div>
        </>
      )}
    </Card>
  )
}
