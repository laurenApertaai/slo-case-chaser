import { NextResponse } from 'next/server'
import { currentAdviser } from '@/lib/auth/supabase'
import { serverClient } from '@/lib/db/client'
import { signedDownload } from '@/lib/files/storage'

/**
 * An adviser downloading a file a client sent, exactly as it arrived, under
 * its original name. The file must belong to this case.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string; uploadId: string }> }) {
  if (!(await currentAdviser())) return new NextResponse('Please sign in.', { status: 401 })

  const { id, uploadId } = await context.params
  const { data, error } = await serverClient()
    .from('uploads')
    .select('storage_path, original_filename, deleted_at, requirements!inner(case_id)')
    .eq('id', uploadId)
    .eq('requirements.case_id', id)
    .maybeSingle()

  if (error) throw error
  if (!data || data.deleted_at) return new NextResponse('That file is not on this case.', { status: 404 })

  return NextResponse.redirect(await signedDownload(data.storage_path, data.original_filename))
}
