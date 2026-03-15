import crypto from 'crypto'

const SALT_BYTES = 16
const KEY_BYTES = 64
const COST = 16384
const BLOCK_SIZE = 8
const PARALLELIZATION = 1

export const validatePassword = (password) => {
  const value = typeof password === 'string' ? password : ''
  return value.length >= 8
}

export const createPasswordHash = (password) => {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, KEY_BYTES, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
    })
    .toString('hex')

  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt}$${hash}`
}

export const verifyPasswordHash = (password, storedHash) => {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false
  }

  const parts = storedHash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false
  }

  const [, nRaw, rRaw, pRaw, salt, hashHex] = parts
  const n = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false
  }

  const expected = Buffer.from(hashHex, 'hex')
  const derived = crypto.scryptSync(password, salt, expected.length, {
    N: n,
    r,
    p,
  })

  if (expected.length !== derived.length) return false
  return crypto.timingSafeEqual(expected, derived)
}
