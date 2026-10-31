export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
      {status}
    </span>
  )
}
