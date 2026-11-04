import type { ReactNode } from 'react'

export function PlaceholderPage({
  title,
  description,
  stage,
  icon,
}: {
  title: string
  description: string
  stage: string
  icon: ReactNode
}) {
  return (
    <div className="flex min-h-[62vh] items-center justify-center">
      <div className="panel-highlight w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-indigo-300">
          {icon}
        </div>
        <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
          {description}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[13px] text-amber-300">
          Stage: {stage}
        </div>
        <p className="mt-4 text-[13px] text-slate-500">
          This module ships in a later iteration; its algorithms and model calls are not implemented yet.
        </p>
      </div>
    </div>
  )
}
