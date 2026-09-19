/**
 * Bank details, sealed.
 *
 * Name on account, account number, sort code and bank name are encrypted as one
 * bundle with AES-256-GCM and stored in `cases.bank_details_enc`. They never go
 * into the ordinary answers table, never appear in an email or text, and are
 * shown on the dashboard masked. Only the last four digits of the account
 * number are kept in the clear, for recognising the account at a glance.
 *
 * GCM both hides the details and detects tampering: anything altered, or opened
 * with the wrong key, fails loudly rather than returning rubbish.
 *
 * Server side only. The key is BANK_DETAILS_KEY, 32 random bytes, base64.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export type BankDetails = {
  account_name: string
  account_number: string
  sort_code: string
  bank_name: string
}

const IV_BYTES = 12
const TAG_BYTES = 16

function keyBytes(key: string): Buffer {
  const bytes = Buffer.from(key, 'base64')
  if (bytes.length !== 32) throw new Error('BANK_DETAILS_KEY must be 32 bytes, base64 encoded')
  return bytes
}

export function bankKey(): string {
  const key = process.env.BANK_DETAILS_KEY
  if (!key) throw new Error('BANK_DETAILS_KEY is not set')
  return key
}

/** Sealed layout: 12 byte nonce, 16 byte tag, then the ciphertext. */
export function encryptBankDetails(details: BankDetails, key: string = bankKey()): Buffer {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(details), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

export function decryptBankDetails(sealed: Buffer, key: string = bankKey()): BankDetails {
  const iv = sealed.subarray(0, IV_BYTES)
  const tag = sealed.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const body = sealed.subarray(IV_BYTES + TAG_BYTES)

  const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(body), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as BankDetails
}

/** How a `bytea` column is written through the database API. */
export function toBytea(bytes: Buffer): string {
  return `\\x${bytes.toString('hex')}`
}

/** How a `bytea` column comes back from the database API. */
export function fromBytea(value: string): Buffer {
  return Buffer.from(value.startsWith('\\x') ? value.slice(2) : value, 'hex')
}

export function maskAccount(accountNumber: string): string {
  return `•••• ${accountNumber.slice(-4)}`
}
