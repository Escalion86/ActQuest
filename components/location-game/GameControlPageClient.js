'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function GameControlPageClient({ location, result }) {
  const [input, setInput] = useState('')
  const router = useRouter()

  const buttons = useMemo(
    () => (result?.keyboard?.inline_keyboard ? result.keyboard.inline_keyboard : []),
    [result],
  )

  return (
    <>
      <div
        className="w-full"
        dangerouslySetInnerHTML={{
          __html: String(result?.text || '').replaceAll('\n', '<br />'),
        }}
      />
      <div className="flex justify-center">
        <div className="flex flex-col items-center gap-1 phoneV:w-full px-1 phoneH:w-[400px] tablet:w-[500px]">
          {buttons.map((array, rowIndex) => (
            <div className="flex w-full gap-1" key={rowIndex}>
              {array.map(({ text, callback_data, url }) => (
                <Link
                  className="flex-1 px-2 py-1 text-sm text-center duration-300 border border-gray-600 rounded cursor-pointer hover:bg-blue-200"
                  href={url || `/${location}/control/${callback_data}`}
                  key={callback_data || `${rowIndex}-${text}`}
                >
                  {text}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center w-full pb-5 mt-1 gap-x-1">
        Сообщение:
        <input
          className="border border-gray-600 rounded"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <button
          onClick={() => {
            const encoded = JSON.stringify({ message: input })
            router.push(`/${location}/control/${encoded}`)
          }}
        >
          Отправить
        </button>
      </div>
    </>
  )
}
