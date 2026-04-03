const normalizeMediaUrl = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  const prepared = value.trim()
  if (!prepared) {
    return ''
  }

  if (
    prepared.startsWith('/') ||
    /^https?:\/\//i.test(prepared) ||
    /^data:/i.test(prepared) ||
    /^blob:/i.test(prepared)
  ) {
    return prepared
  }

  if (!prepared.includes('/') && !prepared.includes('.')) {
    return ''
  }

  if (/^[a-z0-9/_\-.]+$/i.test(prepared)) {
    return `/${prepared.replace(/^\/+/, '')}`
  }

  return ''
}

const getUserAvatarSrc = (user) => {
  const photoUrl = normalizeMediaUrl(user?.photoUrl)

  if (photoUrl) {
    return photoUrl
  }

  if (Array.isArray(user?.images) && user.images.length > 0) {
    const firstImage = normalizeMediaUrl(user.images[0])
    if (firstImage) {
      return firstImage
    }
  }

  return '/img/avatars/user.png'
}

export default getUserAvatarSrc
