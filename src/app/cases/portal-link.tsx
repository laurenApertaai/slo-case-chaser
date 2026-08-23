'use client'

import { useState } from 'react'

/**
 * The client's portal link, with a copy button.
 *
 * Until the pack can be sent automatically, this is the only way the link
 * reaches the client, so it has to be one click rather than a careful drag
 * across forty-odd characters of random token.
 */
export function PortalLink({ url, note }: { url: string; note?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused. The text is selectable either way.
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  )
}
