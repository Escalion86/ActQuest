import { faTimes } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSnackbar as notistackUseSnackbar } from 'lib/notistack'

const useSnackbar = () => {
  const { enqueueSnackbar, closeSnackbar } = notistackUseSnackbar()

  const variants = ['default', 'error', 'success', 'warning', 'info']
  const result = {}
  variants.forEach((variant) => {
    result[variant] = (text) => {
      const key = enqueueSnackbar(text, {
        variant,
        // onClick: () => {
        //   closeSnackbar(key)
        // },
        className: `aq-snackbar aq-snackbar--${variant} flex flex-nowrap`,
        // autoHideDuration: 100000,
        action: (
          // <div className="w-8 -ml-2">
          <FontAwesomeIcon
            onClick={() => {
              closeSnackbar(key)
            }}
            icon={faTimes}
            className="aq-snackbar__close w-5 h-5 cursor-pointer"
          />
          // </div>
        ),
      })
    }
  })
  return result
}

export default useSnackbar
