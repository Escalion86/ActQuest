// const withImages = require('next-images')
// module.exports = withImages()
module.exports = {
  // webpack: (config) => {
  //   // config.experiments = { topLevelAwait: true }
  //   return config
  // },
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
  // images: {
  //   domains: ['uniplatform.ru, dev.uniplatform.ru, localhost'],
  // },
  // webpack(config, options) {
  //   config.module.rules.push({
  //     loader: '@svgr/webpack',
  //     issuer: /\.[jt]sx?$/,
  //     options: {
  //       prettier: false,
  //       svgo: true,
  //       svgoConfig: {
  //         plugins: [
  //           {
  //             name: 'preset-default',
  //             params: {
  //               override: {
  //                 removeViewBox: false,
  //               },
  //             },
  //           },
  //         ],
  //       },
  //       titleProp: true,
  //     },
  //     test: /\.svg$/,
  //   })

  //   return config
  // },
}
