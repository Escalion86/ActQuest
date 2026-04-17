import { memo } from 'react'
import PropTypes from 'prop-types'

import GameEditModal from './GameEditModal'

const GameSettingsEditModal = ({ ...props }) => (
  <GameEditModal sectionMode="full" {...props} />
)

GameSettingsEditModal.propTypes = {
  selectedGame: PropTypes.shape({ id: PropTypes.string }),
  isEditModalOpen: PropTypes.bool.isRequired,
}

GameSettingsEditModal.defaultProps = {
  selectedGame: null,
}

export default memo(GameSettingsEditModal)

