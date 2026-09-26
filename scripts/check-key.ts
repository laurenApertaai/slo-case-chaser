/**
 * Proves the bank details key on this machine is the right one.
 *
 * Checks it is present and the right size, that it matches the escrow copy,
 * and that every set of bank details already stored can actually be opened.
 *
 * Run it after setting up a new machine, after restoring from a backup, and
 * before anybody relies on this tool holding real client details.
 *
 *   npm run check-key
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { allBankKeys, bankKey, decryptBankDetails, fromBytea } from '../src/lib/crypto/bankDetails'

const ESCROW =
  String.raw`C:\Users\laure\OneDrive - Secured Lending Options\SLO - Internal Docs\Case Chaser keys\BANK DETAILS KEY - DO NOT DELETE.txt`

let failed = false
const bad = (m: string) => { console.error(`  FAIL  ${m}`); failed = true }
const ok = (m: string) => console.log(`  ok    ${m}`)

async function main() {
  console.log('\nBank details key\n')

  const key = bankKey()
  if (Buffer.from(key, 'base64').length !== 32) bad('the key is not 32 bytes')
  else ok('the key is present and the right size')

  if (!existsSync(ESCROW)) {
    bad('no escrow copy found. A laptop failing would take the data with it.')
    console.error(`        expected at: ${ESCROW}`)
  } else {
    const escrowed = readFileSync(ESCROW, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('BANK_DETAILS_KEY='))
      ?.slice('BANK_DETAILS_KEY='.length)
      .trim()

    if (!escrowed) bad('the escrow file has no key in it')
    else if (escrowed !== key) {
      bad('the escrow copy does NOT match the key in use')
      console.error('        one of them is wrong. Do not store any more bank details until this is settled.')
    } else ok('the escrow copy matches the key in use')
  }

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await db.from('cases').select('case_ref, bank_details_enc').not('bank_details_enc', 'is', null)
  if (error) { bad(`could not read the cases: ${error.message}`); }
  else if ((data ?? []).length === 0) ok('no bank details are stored yet, so nothing is at risk')
  else {
    for (const row of data!) {
      try {
        decryptBankDetails(fromBytea(row.bank_details_enc as unknown as string))
        ok(`${row.case_ref}: opens correctly`)
      } catch {
        bad(`${row.case_ref}: CANNOT be opened with any key on this machine`)
      }
    }
  }

  console.log(`\n${allBankKeys().length} key(s) available: the current one${allBankKeys().length > 1 ? ' plus retired ones' : ''}.`)
  console.log(failed ? '\nSomething is wrong. Do not ignore this.\n' : '\nAll good.\n')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
