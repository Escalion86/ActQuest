import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

const errorAtom = atomFamily(() => atom(false))

export default errorAtom
