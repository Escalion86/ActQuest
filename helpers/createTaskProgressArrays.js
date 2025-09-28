const createArray = (length, factory) => Array.from({ length }, factory)

export const createTaskAnswersArray = (length) =>
  createArray(length, () => [])

export const createTaskPhotoEntry = () => ({ photos: [], checks: {} })

export const createTaskPhotosArray = (length) =>
  createArray(length, createTaskPhotoEntry)

const createTaskProgressArrays = (length) => ({
  findedCodes: createTaskAnswersArray(length),
  wrongCodes: createTaskAnswersArray(length),
  findedPenaltyCodes: createTaskAnswersArray(length),
  findedBonusCodes: createTaskAnswersArray(length),
  photos: createTaskPhotosArray(length),
})

export default createTaskProgressArrays
