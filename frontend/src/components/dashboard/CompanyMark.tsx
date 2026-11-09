import { useState } from 'react'

export function CompanyMark({ name, logoUrl }: { name: string; logoUrl?: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  return <span className="company-mark" aria-hidden="true">
    {logoUrl && failed !== logoUrl
      ? <img src={logoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(logoUrl)} />
      : name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}
  </span>
}
