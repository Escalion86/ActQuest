import { MiniSiteError, fail } from '@server/miniSites/config'

// Считаем реальные байты до formData/JSON, независимо от Content-Length и chunked.
export async function boundedBody(request, limit, signal) {
  const length = request.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) fail('Превышен размер тела запроса.', 413)
  if (!request.body) fail('Пустое тело запроса.')
  const reader = request.body.getReader()
  const chunks = []; let size = 0
  let aborted
  const cancellation = new Promise((_, reject) => {
    aborted = () => { reject(new MiniSiteError('Загрузка прервана или истекло время.', 408)); void reader.cancel().catch(() => {}) }
    signal.addEventListener('abort', aborted, { once: true })
    if (signal.aborted) aborted()
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), cancellation])
      if (signal.aborted) fail('Загрузка прервана или истекло время.', 408)
      if (done) break
      size += value.byteLength
      if (size > limit) fail('Превышен фактический размер тела запроса.', 413)
      chunks.push(Buffer.from(value))
    }
    if (length !== null && Number(length) !== size) fail('Content-Length не совпадает с фактическим размером.')
    return Buffer.concat(chunks, size)
  } finally { signal.removeEventListener('abort', aborted); void reader.cancel().catch(() => {}) }
}
