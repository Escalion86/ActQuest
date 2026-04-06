import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const PUBLIC_FILE = /\.[^/]+$/

const isExcludedPath = (pathname) => {
  if (!pathname) return true
  if (pathname.startsWith('/api')) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/cabinet')) return true
  if (pathname.startsWith('/game')) return true
  if (/^\/[^/]+\/game(\/|$)/.test(pathname)) return true
  if (/^\/[^/]+\/game\/result\/[^/]+\/?$/.test(pathname)) return true
  if (pathname.startsWith('/static')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true
  if (PUBLIC_FILE.test(pathname)) return true

  return false
}

export async function proxy(req) {
  const { pathname } = req.nextUrl

  if (isExcludedPath(pathname)) {
    return NextResponse.next()
  }

  const token = await getToken({
    req,
    secret: process.env.SECRET,
  })

  if (token) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/cabinet'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/:path*',
}
