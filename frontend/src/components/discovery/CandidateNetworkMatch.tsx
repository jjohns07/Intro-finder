import { useId, useState } from 'react'
import { networkService, type IdentityEvidence, type NetworkPeople } from '../../services/network'
import { safeWebUrl, type DiscoveryPerson, type DiscoveryResult } from '../../services/discovery'

export function CandidateNetworkMatch({ person, companyId, searchId, identity, revision, onResult }: {
  person: DiscoveryPerson; companyId: string; searchId: string; identity?: IdentityEvidence; revision?: number; onResult: (result: DiscoveryResult) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<NetworkPeople>()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState('')
  const [statement, setStatement] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const find = async (q = query) => {
    setBusy(true); setError(''); setSelected('')
    try { setContacts(await networkService.people(q)) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load your contacts.') }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (!contacts || !selected || !confirmed || busy) return
    setBusy(true); setError('')
    try { onResult(await networkService.link({ searchId, companyId, candidateId: person.id, personId: selected, revision: contacts.revision, statement, confirmed: true })); setOpen(false) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm this identity.') }
    finally { setBusy(false) }
  }
  const clear = async () => {
    if (revision === undefined || busy) return
    setBusy(true); setError('')
    try { onResult(await networkService.unlink({ searchId, companyId, candidateId: person.id, revision })) }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove this identity match.') }
    finally { setBusy(false) }
  }
  return <div className="candidate-network-match">
    {identity && <details className="discovery-evidence"><summary>Identity match: confirmed by you</summary><p>Imported contact: {identity.name}</p><p>{identity.statement}</p><p>Confirmed: <time dateTime={identity.confirmedAt}>{new Date(identity.confirmedAt).toLocaleString()}</time></p>{safeWebUrl(identity.profileUrl) && <a href={safeWebUrl(identity.profileUrl)} target="_blank" rel="noopener noreferrer">Imported contact profile ↗</a>}<button type="button" className="presentation-inline-action" disabled={busy} onClick={() => void clear()}>Remove identity confirmation</button></details>}
    <button type="button" className="presentation-inline-action" disabled={busy} aria-expanded={open} aria-controls={id} onClick={() => { setOpen(!open); if (!open) void find('') }}>{identity ? 'Change network identity' : 'Match to your network'}</button>
    {open && <form id={id} className="network-match-form" onSubmit={event => { event.preventDefault(); void save() }}>
      <p>Confirm who this candidate is using your own evidence. Matching names alone is insufficient; Skrapp’s executive list does not supply an individual profile ID.</p>
      <label>Find an imported contact<input value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /></label>
      <button type="button" className="button button--secondary" disabled={busy} onClick={() => void find()}>Search contacts</button>
      <label>Contact for {person.name}<select value={selected} onChange={event => setSelected(event.target.value)} required disabled={busy}>
        <option value="">Choose a contact</option>{contacts?.people.map(contact => <option key={contact.localId} value={contact.localId}>{contact.name}{contact.title ? ` · ${contact.title}` : ''} · {contact.localId}</option>)}
      </select></label>
      {contacts && <p>{contacts.people.length} of {contacts.total} matching contacts. Narrow the contact search if needed.</p>}
      {selected && safeWebUrl(contacts?.people.find(contact => contact.localId === selected)?.profileUrl) && <a href={safeWebUrl(contacts?.people.find(contact => contact.localId === selected)?.profileUrl)} target="_blank" rel="noopener noreferrer">Inspect selected contact’s profile ↗</a>}
      <label>Evidence for this identity<textarea value={statement} minLength={10} maxLength={500} required onChange={event => setStatement(event.target.value)} /></label>
      <label className="network-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I confirm this imported contact is {person.name} at the selected company, based on the evidence above.</label>
      <button type="submit" className="button button--primary" disabled={!selected || !confirmed || statement.trim().length < 10 || busy}>Confirm identity and find paths</button>
    </form>}
    {busy && <p role="status">Checking your network…</p>}{error && <p className="network-error" role="alert">{error}</p>}
  </div>
}
