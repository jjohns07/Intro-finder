import { Fragment, type CSSProperties } from 'react'

// No text duplication or extra inter-word spacing. Existing heading/accent
// elements retain their layout and the full phrase remains accessible.
export function WordReveal({ text, start = 0 }: { text: string; start?: number }) {
  return <>{text.split(/(\s+)/).map((part, index) => !part ? null : /^\s+$/.test(part)
    ? <Fragment key={index}>{part}</Fragment>
    : <span className="motion-word" key={index} style={{ '--word-delay': `${Math.min(start + Math.floor(index / 2), 8) * 45}ms` } as CSSProperties}>{part}</span>)}</>
}
