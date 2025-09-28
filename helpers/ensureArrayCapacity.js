const ensureArrayCapacity = (source, minLength, fillValue) => {
  const defaultValue = arguments.length >= 3 ? fillValue : undefined
  const sourceIsArray = Array.isArray(source)
  const sourceLength = sourceIsArray ? source.length : 0
  const resultLength = Math.max(sourceLength, minLength)
  const result = new Array(resultLength)

  if (sourceIsArray) {
    for (let i = 0; i < sourceLength; i += 1) {
      result[i] = source[i]
    }
  }

  for (let i = sourceLength; i < resultLength; i += 1) {
    result[i] = defaultValue
  }

  return result
}

export default ensureArrayCapacity
