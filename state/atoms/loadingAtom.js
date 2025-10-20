import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

const loadingAtom = atomFamily(() => atom(false))

export default loadingAtom
