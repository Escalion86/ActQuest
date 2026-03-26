const getUserAvatarSrc = (user) => {
  const photoUrl =
    typeof user?.photoUrl === 'string' && user.photoUrl.trim().length > 0
      ? user.photoUrl.trim()
      : null

  if (photoUrl) {
    return photoUrl
  }

  if (Array.isArray(user?.images) && user.images.length > 0) {
    const firstImage =
      typeof user.images[0] === 'string' ? user.images[0].trim() : ''
    if (firstImage) {
      return firstImage
    }
  }

  return '/img/avatars/user.png'
}

export default getUserAvatarSrc
