'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The client's Upload button for one item.
 *
 * On a phone it offers the camera or the photo library; on a computer, a file
 * picker. Several files can go at once. Every word here is client-facing, so
 * contractions are spelled out in full.
 */
export function UploadButton({
  token,
  requirementId,
}: {
  token: string
  requirementId: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)

  async function send(files: FileList | null) {
    if (!files || files.length === 0) return
    setSending(true)
    setMessage(null)

    const form = new FormData()
    form.set('requirement_id', requirementId)
    for (const file of Array.from(files)) form.append('files', file)

    try {
      const response = await fetch(`/api/portal/${token}/upload`, { method: 'POST', body: form })
      const result = await response.json()

      if (!result.ok) {
        setMessage({ tone: 'bad', text: result.message ?? 'That did not send. Please try again.' })
      } else if (result.complete) {
        setMessage({ tone: 'good', text: 'Thank you, we have received this.' })
        router.refresh()
      } else {
        setMessage({
          tone: 'good',
          text: `Thank you. ${result.sentSoFar} of ${result.expected} sent so far. Please send the rest when you can.`,
        })
        router.refresh()
      }
    } catch {
      setMessage({ tone: 'bad', text: 'That did not send. Please check your connection and try again.' })
    } finally {
      setSending(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="mt-3">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf,.heic,.heif"
        className="hidden"
        onChange={(event) => send(event.target.files)}
      />
      <button
        type="button"
        disabled={sending}
        onClick={() => input.current?.click()}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
      >
        {sending ? 'Sending…' : 'Upload'}
      </button>

      {message && (
        <p
          role={message.tone === 'bad' ? 'alert' : 'status'}
          className={`mt-2 text-sm ${message.tone === 'bad' ? 'text-red-700' : 'text-green-800'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
