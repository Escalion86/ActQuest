'use client'

import PropTypes from 'prop-types'
import { useCallback, useEffect, useState } from 'react'

import Modal from '@components/Modal'
import GameReviewCard from '@components/location-game/GameReviewCard'

const GameReviewModal = ({ game, onClose, onSaved }) => {
  const isOpen = Boolean(game?.id && game?.location)
  const formId = game?.id ? `game-review-form-${game.id}` : undefined
  const [formState, setFormState] = useState({
    isDirty: false,
    isSubmitting: false,
    moderationStatus: null,
  })

  useEffect(() => {
    setFormState({
      isDirty: false,
      isSubmitting: false,
      moderationStatus: null,
    })
  }, [game?.id])

  const handleClose = useCallback(() => {
    if (formState.isSubmitting) return
    if (
      formState.isDirty &&
      !window.confirm(
        'Есть несохранённые изменения. Вы уверены, что хотите закрыть окно?',
      )
    ) {
      return
    }
    onClose()
  }, [formState.isDirty, formState.isSubmitting, onClose])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={game?.name ? `Оценка игры «${game.name}»` : 'Оценка игры'}
      dialogClassName="md:max-w-3xl"
      bodyClassName="sm:px-7"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={formState.isSubmitting}
            className="aq-modal-btn aq-modal-btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          {formState.isDirty ? (
            <button
              type="submit"
              form={formId}
              disabled={formState.isSubmitting}
              className="aq-modal-btn aq-modal-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formState.isSubmitting
                ? 'Сохраняем…'
                : formState.moderationStatus === 'rejected'
                  ? 'Отправить на повторную проверку'
                  : 'Сохранить изменения'}
            </button>
          ) : null}
        </>
      }
    >
      {isOpen ? (
        <GameReviewCard
          gameId={String(game.id)}
          location={String(game.location)}
          embedded
          externalSubmit
          formId={formId}
          onFormStateChange={setFormState}
          onSaved={onSaved}
        />
      ) : (
        <span />
      )}
    </Modal>
  )
}

GameReviewModal.propTypes = {
  game: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    location: PropTypes.string.isRequired,
  }),
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
}

GameReviewModal.defaultProps = {
  game: null,
  onSaved: undefined,
}

export default GameReviewModal
