import PropTypes from 'prop-types'
import dynamic from 'next/dynamic'
import RichTaskContentView from '@components/game/RichTaskContentView'
import { normalizeComparableRichText } from '../game-edit/sharedHelpers'

const TaskRichEditor = dynamic(
  () => import('@components/cabinet/TaskRichEditor'),
  { ssr: false },
)

const PrestartPageSection = ({ selectedGame, disabled, onOpen }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onOpen}
    aria-haspopup="dialog"
    className="block w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500 dark:hover:bg-slate-800"
  >
    <span className="flex items-center justify-between gap-3 font-semibold text-slate-800 dark:text-white">
      <span>Предстартовая страница</span>
      <span aria-hidden="true">→</span>
    </span>
    <span className="mt-2 block text-sm text-slate-500 dark:text-slate-300">
      Приветствие, легенда, правила или инструкции для игроков до запуска игры.
    </span>
    <span className="mt-2 block text-sm font-medium text-cyan-700 dark:text-cyan-300">
      {selectedGame.prestartDescriptionRich ? 'Описание заполнено' : 'Описание не заполнено'} · Открыть редактор
    </span>
  </button>
)

export const PrestartPageEditor = ({ selectedGame, disabled, updateSelectedGame }) => {
  const html = selectedGame.prestartDescriptionRich || ''

  return (
    <div>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        Описание для игроков, которые вошли в игру до запуска: приветствие,
        легенда, правила или инструкции.
      </p>
      {!selectedGame.showEnterButton ? (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
          Чтобы игроки могли открыть страницу, включите в настройках игры
          показ кнопки «Зайти в игру» до запуска.
        </p>
      ) : null}
        <div className="mt-4">
          {disabled ? (
            <RichTaskContentView
              html={html}
              text="Описание не заполнено. Игроки увидят сообщение об ожидании старта."
            />
          ) : (
            <TaskRichEditor
              value={html}
              directory={`games/${selectedGame.id || 'draft'}/prestart/editor`}
              contentMaxHeight="none"
              placeholder="Что должны увидеть игроки до начала игры?"
              onChange={({ html: nextHtml }) => {
                const normalizedHtml = normalizeComparableRichText(nextHtml, '')
                if (normalizedHtml !== normalizeComparableRichText(html, '')) {
                  updateSelectedGame({ prestartDescriptionRich: normalizedHtml })
                }
              }}
            />
          )}
        </div>
    </div>
  )
}

PrestartPageSection.propTypes = {
  selectedGame: PropTypes.shape({
    prestartDescriptionRich: PropTypes.string,
  }).isRequired,
  disabled: PropTypes.bool.isRequired,
  onOpen: PropTypes.func.isRequired,
}

PrestartPageEditor.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    prestartDescriptionRich: PropTypes.string,
    showEnterButton: PropTypes.bool,
  }).isRequired,
  disabled: PropTypes.bool.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
}

export default PrestartPageSection
