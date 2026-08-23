/**
 * Loads the default pack and the rejection reasons into the database.
 *
 * Safe to re-run. Rows are matched by name or label and updated rather than
 * duplicated, so running this twice does not leave you with two copies.
 *
 * Run with: npm run seed
 */
import { createClient } from '@supabase/supabase-js'
import {
  DEFAULT_TEMPLATE,
  DEFAULT_REJECTION_REASONS,
  ADVISERS,
  FIRM_NAME,
} from '../src/lib/db/seed'

const TEMPLATE_NAME = 'Standard second charge pack'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function seedTemplate() {
  const db = client()

  const { data: existing, error: findError } = await db
    .from('templates')
    .select('id')
    .eq('name', TEMPLATE_NAME)
    .maybeSingle()

  if (findError) throw findError

  if (existing) {
    const { error } = await db
      .from('templates')
      .update({ items: DEFAULT_TEMPLATE })
      .eq('id', existing.id)
    if (error) throw error
    console.log(`template  updated  "${TEMPLATE_NAME}" (${DEFAULT_TEMPLATE.length} items)`)
    return
  }

  const { error } = await db
    .from('templates')
    .insert({ name: TEMPLATE_NAME, items: DEFAULT_TEMPLATE })
  if (error) throw error
  console.log(`template  created  "${TEMPLATE_NAME}" (${DEFAULT_TEMPLATE.length} items)`)
}

async function seedRejectionReasons() {
  const db = client()

  for (const reason of DEFAULT_REJECTION_REASONS) {
    const { data: existing, error: findError } = await db
      .from('rejection_reasons')
      .select('id')
      .eq('label', reason.label)
      .maybeSingle()

    if (findError) throw findError

    const row = {
      label: reason.label,
      email_copy: reason.emailCopy,
      sms_copy: reason.smsCopy,
      sort_order: reason.sortOrder,
      is_active: true,
    }

    if (existing) {
      const { error } = await db.from('rejection_reasons').update(row).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await db.from('rejection_reasons').insert(row)
      if (error) throw error
    }
  }

  console.log(`reasons   loaded   ${DEFAULT_REJECTION_REASONS.length} rejection reasons`)
}

async function seedAdvisers() {
  const db = client()

  for (const adviser of ADVISERS) {
    const { data: existing, error: findError } = await db
      .from('advisers')
      .select('id, name')
      .eq('email', adviser.email)
      .maybeSingle()

    if (findError) throw findError

    if (existing) {
      // Do not overwrite a name that has already been corrected by hand.
      continue
    }

    const { error } = await db
      .from('advisers')
      .insert({ name: adviser.firstName, email: adviser.email, firm: FIRM_NAME })
    if (error) throw error
  }

  console.log(`advisers  loaded   ${ADVISERS.length} advisers at ${FIRM_NAME}`)
}

async function main() {
  await seedAdvisers()
  await seedTemplate()
  await seedRejectionReasons()
  console.log('\nSeed complete.')
}

main().catch((err) => {
  console.error('Seed failed:', err.message ?? err)
  process.exit(1)
})
