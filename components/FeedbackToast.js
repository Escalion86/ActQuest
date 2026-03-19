import { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import useSnackbar from '@helpers/useSnackbar'

const FeedbackToast = ({ event }) => {
  const snackbar = useSnackbar()
  const lastShownIdRef = useRef(null)

  useEffect(() => {
    if (!event || !event.id || !event.message) {
      return
    }

    if (lastShownIdRef.current === event.id) {
      return
    }

    lastShownIdRef.current = event.id

    if (event.type === 'success') {
      snackbar.success(event.message)
      return
    }

    if (event.type === 'warning') {
      snackbar.warning(event.message)
      return
    }

    if (event.type === 'info') {
      snackbar.info(event.message)
      return
    }

    snackbar.error(event.message)
  }, [event, snackbar])

  return null
}

FeedbackToast.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']),
    message: PropTypes.string,
  }),
}

FeedbackToast.defaultProps = {
  event: null,
}

export default FeedbackToast
