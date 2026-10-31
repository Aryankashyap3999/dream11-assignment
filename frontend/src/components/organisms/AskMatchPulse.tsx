import { Send } from 'lucide-react'
import { useState } from 'react'
import { useAskMatchPulse } from '../../hooks/apis/ai'
import Card from '../atoms/Card'

const SUGGESTIONS = ['What just changed?', 'Why is momentum positive?', 'Who should I watch?']

export default function AskMatchPulse({ matchId }: { matchId: string }) {
  const [question, setQuestion] = useState('')
  const ask = useAskMatchPulse(matchId)

  const submit = (q: string) => {
    if (q.trim()) ask.mutate(q.trim())
  }

  return (
    <Card title="Ask MatchPulse">
      <div className="mb-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setQuestion(s)
              submit(s)
            }}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 hover:border-emerald-500 hover:text-emerald-400"
          >
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(question)
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Why is the chasing team not under heavy pressure?"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          disabled={ask.isPending || !question.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40"
        >
          <Send size={14} /> Ask
        </button>
      </form>
      <div className="mt-4 text-sm">
        {ask.isPending && <p className="text-zinc-500">Thinking…</p>}
        {ask.isError && <p className="text-zinc-500">MatchPulse couldn't answer right now. Please try again.</p>}
        {ask.data && <p className="text-zinc-300">{ask.data.answer}</p>}
      </div>
    </Card>
  )
}
