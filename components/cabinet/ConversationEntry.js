const formatText = (text) =>
  (text || '')
    .split('\n')
    .map((part) => part.trim())
    .join('\n')

const BotMessage = ({ text }) => {
  if (!text) return null

  return (
    <div
      className="rounded-2xl bg-white p-4 shadow-sm"
      dangerouslySetInnerHTML={{ __html: formatText(text).replaceAll('\n', '<br />') }}
    />
  )
}

const ConversationEntry = ({ entry }) => {
  if (entry.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-xl rounded-2xl bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-sm">
          {entry.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-3xl space-y-2">
        <BotMessage text={entry.text} />
        {entry.keyboard?.length ? (
          <div className="flex flex-col gap-2">
            {entry.keyboard.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="flex flex-wrap gap-2">
                {row.map((button) => {
                  if (button.url) {
                    return (
                      <a
                        key={button.url}
                        href={button.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      >
                        {button.text}
                      </a>
                    )
                  }

                  return (
                    <button
                      key={button.callback_data || button.text}
                      className="flex-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                      onClick={() => entry.onAction?.(button)}
                      type="button"
                    >
                      {button.text}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ConversationEntry
