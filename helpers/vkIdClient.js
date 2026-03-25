const VK_SDK_URL = 'https://unpkg.com/@vkid/sdk@2.6.5/dist-sdk/umd/index.js'

let vkSdkLoadPromise = null

export const loadVkSdk = () => {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.VKIDSDK) return Promise.resolve(true)
  if (vkSdkLoadPromise) return vkSdkLoadPromise

  vkSdkLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = VK_SDK_URL
    script.async = true
    script.onload = () => resolve(Boolean(window.VKIDSDK))
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })

  return vkSdkLoadPromise
}

export const resolveVkIdCallbackUrl = (explicitCallbackUrl) => {
  if (typeof window === 'undefined') return ''

  const fallback = `${window.location.origin}/api/vk-id/callback`
  if (!explicitCallbackUrl || typeof explicitCallbackUrl !== 'string') {
    return fallback
  }

  try {
    return new URL(explicitCallbackUrl, window.location.origin).toString()
  } catch {
    return fallback
  }
}

export const parseVkAppId = (value) => {
  const raw = String(value || '').trim().replace(/^['"]|['"]$/g, '')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export const normalizeEnvUrl = (value) => {
  const raw = String(value || '').trim().replace(/^['"]|['"]$/g, '')
  if (!raw) return ''

  try {
    return new URL(raw).toString()
  } catch {
    return ''
  }
}
