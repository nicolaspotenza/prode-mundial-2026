export default function ScoreInput({ value, onChange, disabled, label }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      aria-label={label}
      className="h-11 w-11 rounded-lg bg-bg text-center text-lg font-head font-semibold
                 transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-pitch"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === '' ? null : Math.max(0, parseInt(e.target.value, 10) || 0))
      }
    />
  )
}
