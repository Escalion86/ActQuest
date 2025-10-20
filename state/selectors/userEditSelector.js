import { atom } from 'jotai'
import { DEFAULT_USER } from '@helpers/constants'
import usersAtom from '@state/atoms/usersAtom'

const userEditSelector = atom(
  () => DEFAULT_USER,
  (get, set, newItem) => {
    const items = get(usersAtom)
    if (!newItem?._id) return
    const findedItem = items.find((event) => event._id === newItem._id)
    if (findedItem) {
      const newItemsList = items.map((event) => {
        if (event._id === newItem._id) return newItem
        return event
      })
      set(usersAtom, newItemsList)
    } else {
      set(usersAtom, [...items, newItem])
    }
  }
)

export default userEditSelector
