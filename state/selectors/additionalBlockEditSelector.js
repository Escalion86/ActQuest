import { atom } from 'jotai'
import { DEFAULT_ADDITIONAL_BLOCK } from '@helpers/constants'
import additionalBlocksAtom from '@state/atoms/additionalBlocksAtom'

const additionalBlockEditSelector = atom(
  () => DEFAULT_ADDITIONAL_BLOCK,
  (get, set, newItem) => {
    const items = get(additionalBlocksAtom)
    if (!newItem?._id) return
    const findedItem = items.find((item) => item._id === newItem._id)
    if (findedItem) {
      const newItemsList = items.map((item) => {
        if (item._id === newItem._id) return newItem
        return item
      })
      set(additionalBlocksAtom, newItemsList)
    } else {
      set(additionalBlocksAtom, [...items, newItem])
    }
  }
)

export default additionalBlockEditSelector
