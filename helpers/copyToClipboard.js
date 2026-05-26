const copyWithExecCommand = (text) => {
  if (typeof document === 'undefined' || !document?.body?.appendChild) {
    throw new Error('Clipboard API is unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = String(text ?? '')
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'

  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('Clipboard API is unavailable')
  }
}

const copyToClipboard = async (text) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(text ?? ''))
    return
  }

  copyWithExecCommand(text)
}

export default copyToClipboard
