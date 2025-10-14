const urlBase64ToUint8Array = (base64String) => {
  if (!base64String) return new Uint8Array()

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }

  const buffer = Buffer.from(base64, 'base64')
  const outputArray = new Uint8Array(buffer.length)

  for (let i = 0; i < buffer.length; i += 1) {
    outputArray[i] = buffer[i]
  }

  return outputArray
}

export default urlBase64ToUint8Array
