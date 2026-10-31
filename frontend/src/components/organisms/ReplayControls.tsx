import Card from '../atoms/Card'
import { useReplay, useReplayAction } from '../../hooks/apis/demo'

export default function ReplayControls({ matchId }: { matchId: string }) {
  const { data } = useReplay(matchId)
  const { mutate, isPending } = useReplayAction(matchId)
  const buttons = [
    { action: 'start', label: 'Start', disabled: data?.status === 'RUNNING' || data?.status === 'COMPLETED' },
    { action: 'pause', label: 'Pause', disabled: data?.status !== 'RUNNING' },
    { action: 'reset', label: 'Reset', disabled: false },
  ] as const

  return (
    <Card title="Live replay">
      <div className="flex flex-wrap items-center gap-2">
        {buttons.map((b) => (
          <button
            key={b.action}
            onClick={() => mutate(b.action)}
            disabled={isPending || b.disabled}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-700 disabled:opacity-40"
          >
            {b.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500">
          {data?.status ?? '…'}
          {data?.currentSequence != null && ` · ball #${data.currentSequence}`}
        </span>
      </div>
    </Card>
  )
}
