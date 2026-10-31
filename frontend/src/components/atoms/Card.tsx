import type { ReactNode } from 'react'

interface Props {
  title?: string
  isLoading?: boolean
  isError?: boolean
  errorText?: string
  className?: string
  children: ReactNode
}

// Card with a built-in loading / error state so every API-driven section handles both.
export default function Card({ title, isLoading, isError, errorText, className = '', children }: Props) {
  return (
    <section className={`rounded-xl border border-zinc-800 bg-zinc-900 p-5 ${className}`}>
      {title && <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">{title}</h2>}
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-800" />
        </div>
      ) : isError ? (
        <p className="text-sm text-zinc-500">{errorText ?? 'Could not be loaded right now.'}</p>
      ) : (
        children
      )}
    </section>
  )
}
