import NextAuth from 'next-auth'

import { authOptions } from '@server/auth/authOptions'

export { authOptions }

export default function auth(req, res) {
  return NextAuth(req, res, authOptions)
}

