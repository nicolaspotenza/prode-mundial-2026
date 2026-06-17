export default function LiveBadge({ minuto }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/20 px-2 py-0.5 text-xs font-semibold text-danger">
      <span className="animate-live h-2 w-2 rounded-full bg-danger" aria-hidden="true" />
      EN VIVO{minuto != null ? ` ${minuto}'` : ''}
    </span>
  )
}
