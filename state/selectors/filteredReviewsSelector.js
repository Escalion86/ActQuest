import { atom } from 'jotai'
import reviewsAtom from '@state/atoms/reviewsAtom'

const filteredReviewsSelector = atom((get) => {
  const reviews = get(reviewsAtom)
  return reviews.filter((review) => review.showOnSite)
})

export default filteredReviewsSelector
