import { DEFAULT_ADDITIONAL_BLOCK } from '@helpers/constants'
import additionalBlocksAtom from '@state/atoms/additionalBlocksAtom'
import { selector } from 'recoil'

const additionalBlockEditSelector = selector({
  key: 'additionalBlockEditSelector',
  get: () => DEFAULT_ADDITIONAL_BLOCK,
  set: ({ set, get }, newItem) => {
    const items = get(additionalBlocksAtom)
    if (!newItem?._id) return
    const findedItem = items.find((item) => item._id === newItem._id)
    // Если мы обновляем существующий атом
    if (findedItem) {
      const newItemsList = items.map((item) => {
        if (item._id === newItem._id) return newItem
        return item
      })
      set(additionalBlocksAtom, newItemsList)
    } else {
      // Если такого атома нет и мы добавляем новый, то просто добавляем атом в список
      set(additionalBlocksAtom, [...items, newItem])
    }
  },
})

export default additionalBlockEditSelector
