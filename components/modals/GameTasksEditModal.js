import { memo } from 'react'
import PropTypes from 'prop-types'

import GameEditModal from './GameEditModal'

const GameTasksEditModal = ({ ...props }) => (
  <GameEditModal
    sectionMode="tasks"
    modalTitleOverride={`Редактор заданий «${props?.selectedGame?.name || 'Без названия'}»`}
    {...props}
  />
)

GameTasksEditModal.propTypes = {
  selectedGame: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
  }),
  isEditModalOpen: PropTypes.bool.isRequired,
}

GameTasksEditModal.defaultProps = {
  selectedGame: null,
}

export default memo(GameTasksEditModal)

