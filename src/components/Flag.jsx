import { flagCode } from '../data/teams.js'

// Imagen de bandera real (flagcdn) — evita el problema de Windows que no renderiza
// emojis de bandera y los muestra como código de 2 letras.
export default function Flag({ team, className = 'h-5 w-7' }) {
  const code = flagCode(team)
  if (!code) {
    return (
      <span className={`inline-block ${className}`} aria-hidden="true">
        🏳️
      </span>
    )
  }
  return (
    <img
      src={`https://flagcdn.com/w80/${code}.png`}
      srcSet={`https://flagcdn.com/w160/${code}.png 2x`}
      alt={team}
      loading="lazy"
      width="80"
      height="60"
      className={`inline-block shrink-0 rounded-sm object-cover ${className}`}
    />
  )
}
