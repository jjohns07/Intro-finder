import { useEffect, useId, useRef, useState } from 'react'
import { ApiError } from '../../services/api'
import { historyName, searchHistoryService, type SearchHistoryService } from '../../services/history'
import type { RecentSearch } from '../dashboard/data'

export function DeleteSearchButton({ record, onDeleted, service = searchHistoryService }: {
  record: RecentSearch
  onDeleted: () => void
  service?: SearchHistoryService
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => requestRef.current?.abort(), [])

  const remove = async () => {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setDeleting(true)
    setError('')
    try {
      try { await service.remove(record.id, { signal: controller.signal }) }
      catch (error) { if (!(error instanceof ApiError && error.status === 404)) throw error }
      if (controller.signal.aborted) return
      dialogRef.current?.close()
      onDeleted()
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'The saved search could not be deleted.')
    } finally {
      if (!controller.signal.aborted) setDeleting(false)
      if (requestRef.current === controller) requestRef.current = null
    }
  }

  return <>
    <button type="button" className="history-delete" aria-label={`Delete search for ${historyName(record)}`} onClick={() => {
      setError('')
      dialogRef.current?.showModal()
      cancelRef.current?.focus()
    }}>Delete</button>
    <dialog ref={dialogRef} className="history-delete-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { if (deleting) event.preventDefault() }}>
      <p className="presentation-eyebrow">Search history</p>
      <h2 id={titleId}>Delete this saved search?</h2>
      <p id={descriptionId}>The saved search for <strong>{historyName(record)}</strong> and its original result will be removed. This cannot be undone.</p>
      {error && <p className="history-delete-error" role="alert">{error}</p>}
      <div className="history-dialog-actions">
        <button ref={cancelRef} type="button" className="button button--secondary" disabled={deleting} onClick={() => dialogRef.current?.close()}>Keep search</button>
        <button type="button" className="button button--primary" disabled={deleting} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete search'}</button>
      </div>
      <span className="sr-only" role="status">{deleting ? 'Deleting saved search.' : ''}</span>
    </dialog>
  </>
}
