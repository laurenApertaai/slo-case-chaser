import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import { decryptBankDetails, encryptBankDetails } from '@/lib/crypto/bankDetails'

const newKey = () => randomBytes(32).toString('base64')

const details = {
  account_name: 'D Walker',
  account_number: '12345678',
  sort_code: '123456',
  bank_name: 'Halifax',
}

describe('surviving a change of key', () => {
  it('opens what the current key sealed', () => {
    const key = newKey()
    expect(decryptBankDetails(encryptBankDetails(details, key), [key])).toEqual(details)
  })

  it('still opens what an older key sealed', () => {
    const old = newKey()
    const current = newKey()
    const sealed = encryptBankDetails(details, old)

    // The key was replaced. Anything already stored must not be stranded.
    expect(decryptBankDetails(sealed, [current, old])).toEqual(details)
  })

  it('refuses rubbish rather than returning it', () => {
    const sealed = encryptBankDetails(details, newKey())
    expect(() => decryptBankDetails(sealed, [newKey()])).toThrow(/cannot be opened/)
  })

  it('says plainly what to do when no key works', () => {
    const sealed = encryptBankDetails(details, newKey())
    expect(() => decryptBankDetails(sealed, [newKey()])).toThrow(/escrow copy/)
  })

  it('refuses a key that is not 32 bytes', () => {
    expect(() => encryptBankDetails(details, 'dG9vIHNob3J0')).toThrow(/32 bytes/)
  })
})
