import { atom } from 'jotai'
import additionalBlocksAtom from '@state/atoms/additionalBlocksAtom'

const filteredAdditionalBlocksSelector = atom((get) => {
  const additionalBlocks = get(additionalBlocksAtom)
  return additionalBlocks.filter((additionalBlock) => additionalBlock.showOnSite)
})

export default filteredAdditionalBlocksSelector
