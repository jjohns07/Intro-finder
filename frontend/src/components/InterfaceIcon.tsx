import type { LucideIcon } from 'lucide-react'

// Interface icons are decorative; their accompanying labels name the action.
export function InterfaceIcon({ icon: SvgIcon, className = '' }: { icon: LucideIcon; className?: string }) {
  return <SvgIcon className={`icon interface-icon ${className}`.trim()} size={20} strokeWidth={1.5} aria-hidden="true" focusable="false" />
}
