import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import {
  decryptBankDetails,
  encryptBankDetails,
  fromBytea,
  maskAccount,
  toBytea,
} from '@/lib/crypto/bankDetails'

const key = randomBytes(32).toString('base64')
const details = {
  account_name: 'Jean Smith',
  account_number: '12345678',
  sort_code: '123456',
  bank_name: 'Nationwide',
}

describe('bank details encryption', () => {
  it('comes back exactly as it went in', () => {
    expect(decryptBankDetails(encryptBankDetails(details, key), key)).toEqual(details)
  })

  it('never contains the account number in readable form', () => {
    const sealed = encryptBankDetails(details, key)
    expect(sealed.toString('utf8')).not.toContain('12345678')
    expect(sealed.toString('latin1')).not.toContain('Nationwide')
  })

  it('is different every time, so two identical accounts cannot be matched up', () => {
    expect(encryptBankDetails(details, key).equals(encryptBankDetails(details, key))).toBe(false)
  })

  it('refuses to open with the wrong key', () => {
    const sealed = encryptBankDetails(details, key)
    expect(() => decryptBankDetails(sealed, randomBytes(32).toString('base64'))).toThrow()
  })

  it('refuses to open anything that has been tampered with', () => {
    const sealed = encryptBankDetails(details, key)
    sealed[sealed.length - 1] ^= 0xff
    expect(() => decryptBankDetails(sealed, key)).toThrow()
  })

  it('refuses a key that is not 32 bytes', () => {
    expect(() => encryptBankDetails(details, randomBytes(16).toString('base64'))).toThrow(/32 bytes/)
  })

  it('survives the round trip through the database column', () => {
    const sealed = encryptBankDetails(details, key)
    expect(decryptBankDetails(fromBytea(toBytea(sealed)), key)).toEqual(details)
  })
})

describe('maskAccount', () => {
  it('shows the last four digits only', () => {
    expect(maskAccount('12345678')).toBe('•••• 5678')
  })
})
