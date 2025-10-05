import { TLoginButton, TLoginButtonSize } from 'react-telegram-auth'

import getTelegramBotNameByLocation from '@utils/telegram/getTelegramBotNameByLocation'

const TelegramLogin = ({ availableLocations, location, onLocationChange, onAuth, isClient }) => {
  const botName = getTelegramBotNameByLocation(location)

  return (
    <div className="mx-auto mt-12 max-w-4xl rounded-3xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-primary">Войти через Telegram</h2>
      <p className="mt-3 text-gray-600">
        Выберите игровой регион и подтвердите вход через официальный виджет Telegram. Все данные
        синхронизируются с ботом, поэтому вы сразу продолжите работу с квестами, командами и играми.
      </p>
      <div className="mt-6 flex flex-col gap-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700">
          Регион
          <select
            className="rounded-xl border border-gray-200 px-4 py-3 text-base shadow-sm focus:border-blue-400 focus:outline-none focus:ring"
            value={location}
            onChange={(event) => onLocationChange(event.target.value)}
          >
            {availableLocations.map((item) => (
              <option key={item.key} value={item.key}>
                {item.townRu[0].toUpperCase() + item.townRu.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col items-start gap-4">
          {botName && isClient ? (
            <TLoginButton
              botName={botName}
              buttonSize={TLoginButtonSize.Large}
              lang="ru"
              cornerRadius={16}
              usePic
              requestAccess="write"
              onAuthCallback={onAuth}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-gray-500">
              Укажите название бота для региона в переменной окружения{' '}
              <code className="rounded bg-gray-200 px-1">NEXT_PUBLIC_TELEGRAM_{location.toUpperCase()}_BOT_NAME</code>
            </div>
          )}
          <p className="text-sm text-gray-500">
            Нажимая кнопку входа, вы разрешаете ActQuest использовать данные вашей Telegram учетной записи для
            авторизации и работы с ботом.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TelegramLogin
