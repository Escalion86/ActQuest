import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const hashCode = (code, salt) =>
  scryptSync(String(code), String(salt), 32).toString('hex')

const createPhoneVerificationCodeHash = (code) => {
  const salt = randomBytes(16).toString('hex')
  return {
    hash: hashCode(code, salt),
    salt,
  }
}

const verifyPhoneVerificationCode = (code, hash, salt) => {
  if (!code || !hash || !salt) return false

  const expected = Buffer.from(String(hash), 'hex')
  const actual = Buffer.from(hashCode(code, salt), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export { createPhoneVerificationCodeHash, verifyPhoneVerificationCode }
