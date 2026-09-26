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
  sent = false,
}: {
  token: string
  requirementId: string
  /** true once something has already been sent against this item */
  sent?: boolean
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
        className={
          sent
            ? 'btn-quiet w-full px-6 py-2.5 text-sm sm:w-auto'
            : 'btn-brand w-full px-6 py-3 text-sm sm:w-auto'
        }
      >
        {sending ? 'Sending…' : sent ? 'Add or replace a file' : 'Upload'}
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
