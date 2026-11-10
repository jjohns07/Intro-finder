import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountPageLayout, type AccountPageProps } from './AccountPageLayout'
import { NETWORK_CSV_HEADER, networkService, type NetworkPreview, type NetworkStatus } from '../../services/network'

export function NetworkPage(props: AccountPageProps) {
  const [status, setStatus] = useState<NetworkStatus>()
  const [preview, setPreview] = useState<NetworkPreview>()
  const [csv, setCsv] = useState('')
  const [filename, setFilename] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [removeConfirmed, setRemoveConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const selection = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    networkService.status(controller.signal).then(setStatus).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [])

  const chooseFile = async (file?: File) => {
    const current = ++selection.current
    setPreview(undefined); setCsv(''); setFilename(file?.name ?? ''); setConfirmed(false); setError(''); setNotice('')
    if (!file) return
    if (file.size > 1_000_000) { setError('Choose a UTF-8 CSV file smaller than 1 MB.'); return }
    setBusy(true)
    try {
      const content = await file.text()
      const result = await networkService.preview(content)
      if (selection.current === current) { setPreview(result); setCsv(content) }
    } catch (error) { if (selection.current === current) setError(error instanceof Error ? error.message : 'Could not validate this file.') }
    finally { if (selection.current === current) setBusy(false) }
  }
  const importFile = async () => {
    if (!status || !preview || !confirmed || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await networkService.importCsv(csv, status.revision)
      setStatus(result); setPreview(undefined); setCsv(''); setConfirmed(false)
      if (fileRef.current) fileRef.current.value = ''
      setNotice(result.unchanged ? 'This exact file is already your active network. No duplicate records were added.' : 'Your private network was imported. Select a company candidate and confirm their identity to find paths.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Import failed. Your current network is unchanged.'); setStatus(await networkService.status().catch(() => undefined)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!status || !removeConfirmed || busy) return
    setBusy(true); setError('')
    try { setStatus(await networkService.remove(status.revision)); setRemoveConfirmed(false); setNotice('Your network and its candidate identity matches were removed. Company searches remain in history.') }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not remove your network.') }
    finally { setBusy(false) }
  }

  return <AccountPageLayout {...props} title="Your network">
    <main className="account-main network-main" id="account-page-content" tabIndex={-1}>
      <header className="account-hero"><p className="presentation-eyebrow">Your connections, your control</p><h1>Your private network.</h1><p>Import relationships you are authorised to use. Intro Finder can then look for evidenced paths to a company’s founders and executives.</p></header>
      <section className="network-panel" aria-labelledby="network-status-heading">
        <h2 id="network-status-heading">Network status</h2>
        {!status ? <p>{error ? 'Network status could not be loaded.' : 'Loading network status…'}</p> : <><p>{status.imported ? `${status.personCount} contacts · ${status.relationshipCount} relationship records` : 'No network imported yet.'}</p>{status.updatedAt && <p>Last changed: <time dateTime={status.updatedAt}>{new Date(status.updatedAt).toLocaleString()}</time></p>}</>}
        <p>LinkedIn and X integrations are unavailable. CSV import is supported. Follows and mutual follows alone do not qualify as introduction relationships.</p>
      </section>
      <section className="network-panel" aria-labelledby="network-import-heading">
        <h2 id="network-import-heading">Import a connection CSV</h2>
        <p>Up to 1,000 directed relationships and 1,500 contacts per file. Importing a new file replaces your current network and resets candidate identity confirmations.</p>
        <a className="presentation-inline-action" download="intro-finder-connections.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(NETWORK_CSV_HEADER + '\n')}`}>Download empty CSV template ↗</a>
        <details className="network-instructions"><summary>CSV structure and evidence rules</summary>
          <dl><div><dt>source_id / destination_id</dt><dd>Your own stable contact identifiers. Use <code>me</code> for yourself; Intro Finder uses your signed-in identity.</dd></div>
            <div><dt>source_name / destination_name</dt><dd>Required contact names. Leave the name and profile URL blank for <code>me</code>. Repeated contact IDs must have consistent details.</dd></div>
            <div><dt>source_profile_url / destination_profile_url</dt><dd>Optional HTTPS profile URLs without query strings. They are references; Intro Finder does not scrape them.</dd></div>
            <div><dt>relationship_type</dt><dd><code>direct_connection</code>, <code>user_confirmed</code>, <code>follows</code>, or <code>mutual_follow</code>. Each row records only the source-to-destination direction.</dd></div>
            <div><dt>verification_status</dt><dd><code>unverified</code> or <code>user_confirmed</code>. Only direct or user-confirmed relationships with your explicit confirmation are eligible for paths.</dd></div>
            <div><dt>evidence / observed_at</dt><dd>A 10–500 character plain-text explanation of how you know the relationship, plus the last genuine observation date as YYYY-MM-DD. Future dates and duplicate edges are rejected. Evidence older than 365 days is excluded from paths.</dd></div></dl>
          <p>A CSV assertion is your confirmation, not independent provider verification or a promise that someone will introduce you. Optional <code>source_title</code> and <code>destination_title</code> columns are supported.</p>
        </details>
        <label className="network-file-label" htmlFor="network-csv">Choose your authorised CSV</label>
        <input ref={fileRef} id="network-csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={event => void chooseFile(event.target.files?.[0])} />
        {preview && <div className="network-preview"><h3>Review {filename}</h3><p>{preview.personCount} contacts · {preview.relationshipCount} relationships · {preview.confirmedCount} confirmed direct/personal records before freshness checks.</p>
          <p>First contacts: {preview.people.map(person => person.name).join(', ') || 'No contacts'}</p>
          <label className="network-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />I am authorised to use this data, the user-confirmed relationships have supporting evidence, and I understand this replaces my current network.</label>
          <button type="button" className="button button--primary" disabled={!confirmed || !status || busy} onClick={() => void importFile()}>Import private network</button>
        </div>}
      </section>
      {status?.imported && <section className="network-panel"><h2>Remove imported data</h2><p>This removes your current contacts, relationships and candidate identity matches. Saved company results remain; subsequent history reads will have no network paths.</p>
        <label className="network-check"><input type="checkbox" checked={removeConfirmed} onChange={event => setRemoveConfirmed(event.target.checked)} disabled={busy} />Remove my imported network and identity confirmations.</label>
        <button className="button button--secondary" type="button" disabled={!removeConfirmed || busy} onClick={() => void remove()}>Delete imported network</button></section>}
      {busy && <p role="status">Processing network data…</p>}{error && <p className="network-error" role="alert">{error}</p>}{notice && <p className="network-notice" role="status">{notice}</p>}
      <Link className="presentation-inline-action" to="/find-introductions">Find a company ↗</Link>
    </main>
  </AccountPageLayout>
}
