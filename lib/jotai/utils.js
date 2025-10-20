const defaultAreEqual = (a, b) => Object.is(a, b)

export const atomFamily = (initializeAtom, areEqual = defaultAreEqual) => {
  const cache = []

  return (param) => {
    for (const [key, cachedAtom] of cache) {
      if (areEqual(key, param)) {
        return cachedAtom
      }
    }

    const createdAtom = initializeAtom(param)
    cache.push([param, createdAtom])
    return createdAtom
  }
}

export default {
  atomFamily,
}
