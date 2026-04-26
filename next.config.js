const parseAllowedDevOrigins = () => {
  const raw = process.env.NEXT_ALLOWED_DEV_ORIGINS
  if (typeof raw !== 'string') {
    return []
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

const allowedDevOrigins = parseAllowedDevOrigins()

module.exports = {
  ...(allowedDevOrigins.length > 0
    ? { allowedDevOrigins }
    : {}),
  experimental: {
    largePageDataBytes: 5 * 1024 * 1024, // 5 MB
  },
  reactStrictMode: true,
  env: {
    MODE: process.env.MODE ?? process.env.NODE_ENV,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/krasnoyarsk',
        destination: '/krsk',
        permanent: true,
      },
      {
        source: '/norilsk',
        destination: '/nrsk',
        permanent: true,
      },
      {
        source: '/ekaterinburg',
        destination: '/ekb',
        permanent: true,
      },
    ]
  },
}
