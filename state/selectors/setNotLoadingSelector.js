import { atom } from 'jotai'
import loadingAtom from '@state/atoms/loadingAtom'

const setNotLoadingSelector = atom(
  () => false,
  (_get, set, itemNameId) => {
    set(loadingAtom(itemNameId), false)
  }
)

export default setNotLoadingSelector
