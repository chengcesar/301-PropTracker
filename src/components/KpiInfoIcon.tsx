export function KpiInfoIcon({
  tip,
  multiline,
  className,
}: {
  tip: string
  /** Wider, wrapping tooltip (e.g. section intros). */
  multiline?: boolean
  className?: string
}) {
  const rootClass = ['kpi-info', className].filter(Boolean).join(' ')
  const tipClass = multiline ? 'kpi-info-tip kpi-info-tip--multiline' : 'kpi-info-tip'
  return (
    <span className={rootClass}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <g clipPath="url(#ki)">
          <path d="M7 1.244a5.756 5.756 0 110 11.512 5.756 5.756 0 010-11.512ZM7 0a7 7 0 100 14A7 7 0 007 0Z" fill="#9CA3AF"/>
          <path d="M7.54 8.497h-1.078v-.674c-.012-.227.019-.454.09-.665a2.4 2.4 0 01.397-.569l.69-.8a1.06 1.06 0 00.22-.683 .87.87 0 00-.23-.68.72.72 0 00-.59-.17.7.7 0 00-.607.259 1.04 1.04 0 00-.277.69H5c.037-.594.276-1.148.663-1.54A1.7 1.7 0 017.083 3c.501-.025.994.166 1.381.535.357.357.535.856.535 1.498a1.6 1.6 0 01-.315 1.104 5 5 0 01-.277.376l-.253.281-.253.281-.177.173a.79.79 0 00-.147.515l.001.502Zm.211 1.633a.7.7 0 01-.22.615.69.69 0 01-.53.255.69.69 0 01-.531-.254.7.7 0 01-.22-.614.7.7 0 01.22-.614.69.69 0 01.53-.254.69.69 0 01.531.254.7.7 0 01.22.612Z" fill="#9CA3AF"/>
        </g>
        <defs><clipPath id="ki"><rect width="14" height="14" fill="white"/></clipPath></defs>
      </svg>
      <span className={tipClass}>{tip}</span>
    </span>
  )
}
