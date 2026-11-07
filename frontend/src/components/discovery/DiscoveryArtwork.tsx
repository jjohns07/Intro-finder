export function DiscoveryArtwork() {
  return (
    <svg className="discovery-artwork" viewBox="0 0 460 340" fill="none" aria-hidden="true">
      <g stroke="currentColor" opacity=".15">
        <circle cx="230" cy="170" r="146" />
        <circle cx="230" cy="170" r="102" />
        <circle cx="230" cy="170" r="54" />
        <path d="M0 170h460M230 0v340" strokeDasharray="3 8" />
      </g>
      <g className="discovery-art-lines" stroke="currentColor" strokeWidth="1.3">
        <path d="m90 211 140-41 107-98" pathLength="1" />
        <path d="m230 170 113 92M137 58l93 112" opacity=".3" pathLength="1" />
      </g>
      <g fill="#101014" stroke="currentColor">
        <circle cx="90" cy="211" r="9" /><circle cx="337" cy="72" r="9" />
        <circle cx="343" cy="262" r="5" /><circle cx="137" cy="58" r="5" />
        <circle cx="230" cy="170" r="26" />
      </g>
      <circle cx="230" cy="170" r="5" fill="currentColor" />
      <circle cx="337" cy="72" r="18" stroke="#E8B982" opacity=".4" />
      <path d="M374 45h27m-13.5-13.5v27" stroke="#E8B982" opacity=".5" />
    </svg>
  )
}

export function SearchIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
}
