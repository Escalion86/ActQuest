import PropTypes from 'prop-types'

import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import CabinetTextareaField from '@components/cabinet/CabinetTextareaField'
import NoticeBanner from '@components/NoticeBanner'

const GamePushBroadcastModal = ({
  isOpen,
  onClose,
  gameName,
  mode,
  onChangeMode,
  customMessage,
  onChangeCustomMessage,
  isSubmitting,
  onSubmit,
  feedback,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={`Рассылка по игре «${gameName || 'Без названия'}»`}
    compactMobile
    footer={(
      <>
        <CabinetButton
          type="button"
          variant="secondary"
          tone="brand"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Отмена
        </CabinetButton>
        <CabinetButton
          type="button"
          variant="primary"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={isSubmitting ? 'cursor-wait' : ''}
        >
          {isSubmitting ? 'Отправляем…' : 'Отправить уведомление'}
        </CabinetButton>
      </>
    )}
  >
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-sm transition hover:border-cyan-300 dark:border-[#00D1FF]/20 dark:bg-[#050012]/65 dark:hover:border-[#00D1FF]/45">
          <input
            type="radio"
            name="game-push-mode"
            value="announce_all_users"
            checked={mode === 'announce_all_users'}
            onChange={() => onChangeMode('announce_all_users')}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4"
          />
          <span className="min-w-0 text-slate-700 dark:text-[#d7e7ff]">
            Отправить анонс игры всем пользователям в городе проведения игры
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-sm transition hover:border-cyan-300 dark:border-[#00D1FF]/20 dark:bg-[#050012]/65 dark:hover:border-[#00D1FF]/45">
          <input
            type="radio"
            name="game-push-mode"
            value="custom_for_registered"
            checked={mode === 'custom_for_registered'}
            onChange={() => onChangeMode('custom_for_registered')}
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4"
          />
          <span className="min-w-0 text-slate-700 dark:text-[#d7e7ff]">
            Отправить кастомное сообщение всем зарегистрированным на игру
          </span>
        </label>
      </div>

      {mode === 'custom_for_registered' ? (
        <CabinetTextareaField
          id="game-push-custom-message"
          label="Текст сообщения"
          value={customMessage}
          onChange={(event) => onChangeCustomMessage(event.target.value)}
          rows={5}
          disabled={isSubmitting}
          placeholder="Введите сообщение для зарегистрированных участников"
          textareaClassName="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none dark:border-[#00D1FF]/25 dark:bg-[#050012]/80 dark:text-slate-100 dark:placeholder:text-slate-400"
        />
      ) : null}

      {feedback ? (
        <NoticeBanner
          tone={feedback.type === 'error' ? 'error' : 'success'}
          variant="neon"
        >
          {feedback.message}
        </NoticeBanner>
      ) : null}
    </div>
  </Modal>
)

GamePushBroadcastModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  gameName: PropTypes.string,
  mode: PropTypes.oneOf(['announce_all_users', 'custom_for_registered'])
    .isRequired,
  onChangeMode: PropTypes.func.isRequired,
  customMessage: PropTypes.string.isRequired,
  onChangeCustomMessage: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  feedback: PropTypes.shape({
    type: PropTypes.oneOf(['success', 'error']),
    message: PropTypes.string,
  }),
}

GamePushBroadcastModal.defaultProps = {
  gameName: '',
  feedback: null,
}

export default GamePushBroadcastModal
