import { TLoginButton, TLoginButtonSize } from 'react-telegram-auth'

import getTelegramBotNameByLocation from '@utils/telegram/getTelegramBotNameByLocation'

const TelegramLogin = ({
  availableLocations,
  location,
  onLocationChange,
  onAuth,
  isClient,
}) => {
  const botName = getTelegramBotNameByLocation(location)

  return (
    <div className="max-w-4xl p-8 mx-auto mt-12 bg-white shadow-lg rounded-3xl dark:border dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40">
      <h2 className="text-2xl font-bold text-primary dark:text-white">
        Войти в личный кабинет через Telegram
      </h2>
      <p className="mt-3 text-gray-600 dark:text-slate-300">
        Выберите игровой регион и подтвердите вход через официальный виджет
        Telegram. Все данные синхронизируются с ботом, поэтому вы сразу
        продолжите работу с квестами, командами и играми.
      </p>
      <div className="flex flex-col gap-6 mt-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-gray-700 dark:text-slate-200">
          Регион
          <select
            className="px-4 py-3 text-base border border-gray-200 shadow-sm rounded-xl focus:border-blue-400 focus:outline-none focus:ring dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
              key={botName}
              botName={botName}
              buttonSize={TLoginButtonSize.Large}
              lang="ru"
              cornerRadius={16}
              usePic
              requestAccess="write"
              onAuthCallback={onAuth}
            />
          ) : (
            <div className="px-4 py-6 text-gray-500 border border-gray-300 border-dashed rounded-2xl bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Укажите название бота для региона в переменной окружения{' '}
              <code className="px-1 bg-gray-200 rounded dark:bg-slate-700 dark:text-slate-100">
                NEXT_PUBLIC_TELEGRAM_{location.toUpperCase()}_BOT_NAME
              </code>
            </div>
          )}
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Нажимая кнопку входа, вы разрешаете ActQuest использовать данные
            вашей Telegram учетной записи для авторизации и работы с ботом.
          </p>
        </div>
      </div>
    </div>
  )
}

export default TelegramLogin
