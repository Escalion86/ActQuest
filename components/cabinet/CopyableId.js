import { useCallback, useState } from 'react'
import PropTypes from 'prop-types'

import copyToClipboard from '@helpers/copyToClipboard'

const CopyableId = ({ id, label }) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = useCallback(
    (event) => {
      event.stopPropagation()
      if (!id) return
      copyToClipboard(id).then(() => {
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 1500)
      })
    },
    [id],
  )

  if (!id) return null

  const shortId = id.length > 8 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
      title={`${label ? `${label}: ` : ''}${id} — нажмите, чтобы скопировать`}
    >
      {isCopied ? '✓' : shortId}
    </button>
  )
}

CopyableId.propTypes = {
  id: PropTypes.string,
  label: PropTypes.string,
}

CopyableId.defaultProps = {
  id: null,
  label: 'ID',
}

export default CopyableId
