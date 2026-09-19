import { useRef, useState } from 'react'
import type { Contract, ContractDocument, Property } from '../../lib/types'
import { uploadContractFile, deleteContractFile } from '../../lib/photoStorage'

type Props = {
  prop: Property
  contract: Contract
  onUpdateProp: (fn: (p: Property) => Property) => void
}

type DocKind = 'contract' | 'insurance'

function fieldForKind(kind: DocKind): 'contractDocs' | 'insuranceDocs' {
  return kind === 'contract' ? 'contractDocs' : 'insuranceDocs'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UploadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}

export function ContractDocsControls({ prop, contract, onUpdateProp }: Props) {
  const [uploading, setUploading] = useState<DocKind | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const contractFileRef = useRef<HTMLInputElement>(null)
  const insuranceFileRef = useRef<HTMLInputElement>(null)

  const contractDocs = contract.contractDocs ?? []
  const insuranceDocs = contract.insuranceDocs ?? []
  const allDocs: (ContractDocument & { kind: DocKind })[] = [
    ...contractDocs.map((d) => ({ ...d, kind: 'contract' as const })),
    ...insuranceDocs.map((d) => ({ ...d, kind: 'insurance' as const })),
  ]

  const openDownload = () => {
    setSelected(new Set(allDocs.map((d) => d.id)))
    setDlOpen(true)
  }

  const handleUpload = async (kind: DocKind, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(kind)
    try {
      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') continue
        const url = await uploadContractFile(prop.id, contract.id, kind, file)
        const doc: ContractDocument = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          url,
          name: file.name,
          uploadedAt: new Date().toISOString(),
        }
        const field = fieldForKind(kind)
        onUpdateProp((p) => ({
          ...p,
          contracts: p.contracts.map((c) =>
            c.id === contract.id ? { ...c, [field]: [...(c[field] ?? []), doc] } : c,
          ),
        }))
      }
    } finally {
      setUploading(null)
    }
  }

  const removeDoc = async (kind: DocKind, doc: ContractDocument) => {
    try {
      await deleteContractFile(doc.url)
    } catch {
      /* already deleted or local */
    }
    const field = fieldForKind(kind)
    onUpdateProp((p) => ({
      ...p,
      contracts: p.contracts.map((c) =>
        c.id === contract.id ? { ...c, [field]: (c[field] ?? []).filter((d) => d.id !== doc.id) } : c,
      ),
    }))
    setSelected((s) => {
      const next = new Set(s)
      next.delete(doc.id)
      return next
    })
  }

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const downloadSelected = () => {
    for (const doc of allDocs) {
      if (!selected.has(doc.id)) continue
      const a = document.createElement('a')
      a.href = doc.url
      a.download = doc.name
      a.target = '_blank'
      a.rel = 'noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    setDlOpen(false)
  }

  return (
    <>
      <input
        ref={contractFileRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          handleUpload('contract', e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={insuranceFileRef}
        type="file"
        accept="application/pdf"
        multiple
        hidden
        onChange={(e) => {
          handleUpload('insurance', e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="ghost fs12"
        disabled={uploading === 'contract'}
        onClick={() => contractFileRef.current?.click()}
      >
        <span className="flex align-center gap4">
          <UploadIcon />
          {uploading === 'contract' ? 'Uploading…' : `Upload contract${contractDocs.length ? ` (${contractDocs.length})` : ''}`}
        </span>
      </button>
      <button
        type="button"
        className="ghost fs12"
        disabled={uploading === 'insurance'}
        onClick={() => insuranceFileRef.current?.click()}
      >
        <span className="flex align-center gap4">
          <UploadIcon />
          {uploading === 'insurance' ? 'Uploading…' : `Upload insurance${insuranceDocs.length ? ` (${insuranceDocs.length})` : ''}`}
        </span>
      </button>
      <button
        type="button"
        className={`fs12 ${allDocs.length ? 'primary' : 'ghost'}`}
        style={{ padding: '5px 10px' }}
        title="Contract documents"
        disabled={allDocs.length === 0}
        onClick={openDownload}
      >
        <DocIcon />
      </button>
      {dlOpen && (
        <div className="modal-overlay" onClick={() => setDlOpen(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Contract documents</div>
                <div className="modal-sub">Select files to download</div>
              </div>
            </div>
            <div className="modal-body" style={{ padding: '4px 8px 12px' }}>
              <div
                className="flex align-center gap12"
                style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}
              >
                <span style={{ width: 16, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>Name</span>
                <span style={{ width: 90, flexShrink: 0 }}>Type</span>
                <span style={{ width: 110, flexShrink: 0 }}>Uploaded</span>
                <span style={{ width: 28, flexShrink: 0 }} />
              </div>
              {allDocs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex align-center gap12"
                  style={{ padding: '12px 14px', cursor: 'pointer', borderTop: '1px solid var(--border)' }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleSelected(doc.id)}
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    className="fs13 fw5"
                    style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={doc.name}
                  >
                    {doc.name}
                  </span>
                  <span style={{ width: 90, flexShrink: 0 }}>
                    <span className={`badge ${doc.kind === 'contract' ? 'active-c' : 'draft-c'}`}>
                      {doc.kind === 'contract' ? 'Contract' : 'Insurance'}
                    </span>
                  </span>
                  <span className="fs12 text3" style={{ width: 110, flexShrink: 0 }}>
                    {formatDate(doc.uploadedAt)}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    title="Delete"
                    style={{ padding: 4, color: 'var(--red)', flexShrink: 0, width: 28 }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeDoc(doc.kind, doc)
                    }}
                  >
                    <TrashIcon />
                  </button>
                </label>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="ghost" onClick={() => setDlOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={selected.size === 0} onClick={downloadSelected}>
                Download selected ({selected.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
