'use client'

import PropTypes from 'prop-types'

const StoryMediaList = ({ media, directory }) => {
  const items = Array.isArray(media) ? media : []
  if (items.length === 0) return null

  return (
    <div className="mt-3 grid gap-3">
      {items.map((item, index) => {
        const url = typeof item?.url === 'string' ? item.url.trim() : ''
        if (!url) return null
        const title = typeof item?.title === 'string' ? item.title.trim() : ''
        const key = item?.id || `${directory}-${index}-${url}`
        if (item?.type === 'audio') {
          return (
            <div key={key} className="rounded-2xl border border-cyan-300/40 p-3">
              {title ? <p className="mb-2 text-sm font-semibold">{title}</p> : null}
              <audio controls preload="none" src={url} className="w-full" />
            </div>
          )
        }
        if (item?.type === 'video') {
          return (
            <div key={key} className="rounded-2xl border border-slate-300 p-3 dark:border-slate-700">
              {title ? <p className="mb-2 text-sm font-semibold">{title}</p> : null}
              <video controls preload="metadata" src={url} className="max-h-96 w-full rounded-xl" />
            </div>
          )
        }
        return (
          <figure key={key} className="rounded-2xl border border-slate-300 p-3 dark:border-slate-700">
            <img src={url} alt={title || 'Материал расследования'} className="max-h-96 w-full rounded-xl object-contain" />
            {title ? <figcaption className="mt-2 text-sm text-slate-500">{title}</figcaption> : null}
          </figure>
        )
      })}
    </div>
  )
}

StoryMediaList.propTypes = {
  media: PropTypes.arrayOf(PropTypes.object),
  directory: PropTypes.string,
}

StoryMediaList.defaultProps = {
  media: [],
  directory: 'story-investigation',
}

export default StoryMediaList
