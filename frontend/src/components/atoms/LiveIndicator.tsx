export default function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-red-500/15 px-2 py-0.5 text-xs font-bold tracking-widest text-red-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
      LIVE
    </span>
  )
}
