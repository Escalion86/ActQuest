import { memo } from 'react'
import PropTypes from 'prop-types'

import GameSettingsEditModal from './GameSettingsEditModal'
import GameTasksEditModal from './GameTasksEditModal'
import GameTeamsModal from './GameTeamsModal'
import GameRegisterModal from './GameRegisterModal'
import GameCreateModal from './GameCreateModal'
import GameDescriptionModal from './GameDescriptionModal'
import GameFinancesModal from './GameFinancesModal'
import GameResultsModal from './GameResultsModal'
import GameTasksViewModal from './GameTasksViewModal'
import GameHistoryModal from './GameHistoryModal'

const GameModals = ({
  selectedGame,
  editGame,
  isEditModalOpen,
  handleCloseEditModal,
  isTasksModalOpen,
  handleCloseTasksModal,
  canEditSelectedGame,
  isSaving,
  location,
  isDirty,
  handleModalPrimaryAction,
  handleTasksModalPrimaryAction,
  handleResetChanges,
  updateSelectedGame,
  GAME_TYPE_OPTIONS,
  CLUE_EARLY_MODE_OPTIONS,
  toMinutes,
  toSeconds,
  handleAddTask,
  handleReorderTask,
  isTaskReorderLocked,
  startedGameLockedTaskCount,
  handleRemoveTask,
  handleTaskFieldChange,
  handleTaskNumberChange,
  handleTaskOptionalNumberChange,
  handleTaskCheckboxChange,
  handleTaskCoordinateChange,
  handleAddTaskCode,
  handleTaskCodeChange,
  handleTaskCodePhotoChange,
  handleRemoveTaskCode,
  handleAddTaskImage,
  handleTaskImageChange,
  handleRemoveTaskImage,
  handleAddClue,
  handleReorderClue,
  handleTaskClueChange,
  handleRemoveClue,
  handleAddSubTask,
  handleSubTaskChange,
  handleRemoveSubTask,
  handleAddPenaltyCode,
  handlePenaltyCodeChange,
  handleRemovePenaltyCode,
  handleAddBonusCode,
  handleBonusCodeChange,
  handleRemoveBonusCode,
  handleAddPrice,
  handlePriceChange,
  handleRemovePrice,
  handleAddFinance,
  handleFinanceChange,
  handleRemoveFinance,
  isFinancesModalOpen,
  handleCloseFinancesModal,
  handleFinancesModalPrimaryAction,
  isGameHistoryModalOpen,
  handleCloseGameHistoryModal,
  handleGameHistoryRollbackSuccess,
  canGenerateResults,
  isGeneratingResults,
  handleGenerateResults,
  generateResultsButtonLabel,
  currencyFormatter,
  financesSummary,
  balanceClass,
  expandedTaskIds,
  toggleTaskExpansion,
  isTeamsModalOpen,
  handleCloseTeamsModal,
  teamsModalState,
  removingTeamIds,
  updatingOutOfCompetitionTeamIds,
  selectedTeamToAdd,
  setSelectedTeamToAdd,
  handleAddTeamToGame,
  isAddingTeam,
  handleRemoveTeamFromGame,
  handleToggleTeamOutOfCompetition,
  handleRefreshTeamsModalData,
  isTeamsModalReadOnly,
  isRegisterModalOpen,
  handleCloseRegisterModal,
  isRegisterSubmitting,
  handleSubmitRegister,
  registerTeamId,
  registerGameId,
  setRegisterTeamId,
  setRegisterGameId,
  isRegisterModalFromCard,
  registerModalGameName,
  shouldHideRegisterGameIdField,
  registerFeedback,
  isRegisterTeamsLoading,
  registerTeams,
  currentUserId,
  currentUserRole,
  canViewCodePhotos,
  isCreateGameModalOpen,
  handleCloseCreateGameModal,
  isCreatingGame,
  handleCreateGame,
  newGameName,
  setNewGameName,
  newGameIsRated,
  setNewGameIsRated,
  createGameMode,
  setCreateGameMode,
  cloneSourceGameId,
  setCloneSourceGameId,
  createGameCloneSourceOptions,
  isCloneSourceGamesLoading,
  createGameLocation,
  setCreateGameLocation,
  createGameSeasonId,
  setCreateGameSeasonId,
  createGameSeasons,
  isCreateGameSeasonsLoading,
  isCreateGameSeasonCreating,
  handleCreateSeasonForCreateGame,
  createGameLocationOptions,
  createGameCloneOptions,
  handleChangeCreateGameCloneOption,
  isCreateGameActionDisabled,
  createGameFeedback,
  isDescriptionModalOpen,
  handleCloseDescriptionModal,
  isTasksViewModalOpen,
  handleCloseTasksViewModal,
  gameTypeLabel,
  plannedStartLabel,
  canViewRestrictedGameInfo,
  canViewGameResults,
  handleOpenResultsModal,
  participationSummaryLabel,
  canJoinGameFromDescription,
  canEnterGameFromDescription,
  canCancelGameRegistrationFromDescription,
  handleJoinGameFromDescription,
  handleEnterGameFromDescription,
  handleCancelGameRegistrationFromDescription,
  isGameRegistrationSubmittingFromDescription,
  selectedGameModerators,
  availableModeratorsForSelect,
  availableModeratorsMap,
  availableOrganizersForSelect,
  selectedModeratorToAdd,
  setSelectedModeratorToAdd,
  handleAddModerator,
  handleRemoveModerator,
  selectedGameAgents,
  availableAgentsForSelect,
  availableAgentsMap,
  selectedAgentToAdd,
  setSelectedAgentToAdd,
  handleAddAgent,
  handleRemoveAgent,
  editGameLocationOptions,
  editGameSeasons,
  isEditGameSeasonsLoading,
  isEditGameSeasonCreating,
  handleCreateSeasonForEditGame,
  handleSaveAndOpenTaskPreview,
  taskDurationLabel,
  cluesDurationLabel,
  clueModeDetails,
  breakDurationLabel,
  taskFailurePenaltyLabel,
  manyCodesLimitLabel,
  manyCodesPenaltyLabel,
  isResultsModalOpen,
  handleCloseResultsModal,
  resultsModalState,
}) => {
  const gameForEdit = editGame ?? selectedGame
  const hasSelectedGame = Boolean(selectedGame)

  return (
    <>
      {gameForEdit ? (
        <GameSettingsEditModal
          selectedGame={gameForEdit}
          isEditModalOpen={isEditModalOpen}
          handleCloseEditModal={handleCloseEditModal}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          location={location}
          isDirty={isDirty}
          handleModalPrimaryAction={handleModalPrimaryAction}
          handleResetChanges={handleResetChanges}
          updateSelectedGame={updateSelectedGame}
          GAME_TYPE_OPTIONS={GAME_TYPE_OPTIONS}
          CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
          toMinutes={toMinutes}
          toSeconds={toSeconds}
          handleAddTask={handleAddTask}
          handleReorderTask={handleReorderTask}
          isTaskReorderLocked={isTaskReorderLocked}
          startedGameLockedTaskCount={startedGameLockedTaskCount}
          handleRemoveTask={handleRemoveTask}
          handleTaskFieldChange={handleTaskFieldChange}
          handleTaskNumberChange={handleTaskNumberChange}
          handleTaskOptionalNumberChange={handleTaskOptionalNumberChange}
          handleTaskCheckboxChange={handleTaskCheckboxChange}
          handleTaskCoordinateChange={handleTaskCoordinateChange}
          handleAddTaskCode={handleAddTaskCode}
          handleTaskCodeChange={handleTaskCodeChange}
          handleTaskCodePhotoChange={handleTaskCodePhotoChange}
          handleRemoveTaskCode={handleRemoveTaskCode}
          handleAddTaskImage={handleAddTaskImage}
          handleTaskImageChange={handleTaskImageChange}
          handleRemoveTaskImage={handleRemoveTaskImage}
          handleAddClue={handleAddClue}
          handleReorderClue={handleReorderClue}
          handleTaskClueChange={handleTaskClueChange}
          handleRemoveClue={handleRemoveClue}
          handleAddSubTask={handleAddSubTask}
          handleSubTaskChange={handleSubTaskChange}
          handleRemoveSubTask={handleRemoveSubTask}
          handleAddPenaltyCode={handleAddPenaltyCode}
          handlePenaltyCodeChange={handlePenaltyCodeChange}
          handleRemovePenaltyCode={handleRemovePenaltyCode}
          handleAddBonusCode={handleAddBonusCode}
          handleBonusCodeChange={handleBonusCodeChange}
          handleRemoveBonusCode={handleRemoveBonusCode}
          handleAddPrice={handleAddPrice}
          handlePriceChange={handlePriceChange}
          handleRemovePrice={handleRemovePrice}
          handleAddFinance={handleAddFinance}
          handleFinanceChange={handleFinanceChange}
          handleRemoveFinance={handleRemoveFinance}
          canGenerateResults={canGenerateResults}
          isGeneratingResults={isGeneratingResults}
          handleGenerateResults={handleGenerateResults}
          generateResultsButtonLabel={generateResultsButtonLabel}
          currencyFormatter={currencyFormatter}
          financesSummary={financesSummary}
          balanceClass={balanceClass}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
          selectedGameModerators={selectedGameModerators}
          availableModeratorsForSelect={availableModeratorsForSelect}
          availableModeratorsMap={availableModeratorsMap}
          availableOrganizersForSelect={availableOrganizersForSelect}
          selectedModeratorToAdd={selectedModeratorToAdd}
          setSelectedModeratorToAdd={setSelectedModeratorToAdd}
          handleAddModerator={handleAddModerator}
          handleRemoveModerator={handleRemoveModerator}
          selectedGameAgents={selectedGameAgents}
          availableAgentsForSelect={availableAgentsForSelect}
          availableAgentsMap={availableAgentsMap}
          selectedAgentToAdd={selectedAgentToAdd}
          setSelectedAgentToAdd={setSelectedAgentToAdd}
          handleAddAgent={handleAddAgent}
          handleRemoveAgent={handleRemoveAgent}
          editGameLocationOptions={editGameLocationOptions}
          editGameSeasons={editGameSeasons}
          isEditGameSeasonsLoading={isEditGameSeasonsLoading}
          isEditGameSeasonCreating={isEditGameSeasonCreating}
          handleCreateSeasonForEditGame={handleCreateSeasonForEditGame}
          handleSaveAndOpenTaskPreview={handleSaveAndOpenTaskPreview}
          canViewCodePhotos={canViewCodePhotos}
        />
      ) : null}

      {gameForEdit ? (
        <GameTasksEditModal
          selectedGame={gameForEdit}
          isEditModalOpen={isTasksModalOpen}
          handleCloseEditModal={handleCloseTasksModal}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          location={location}
          isDirty={isDirty}
          handleModalPrimaryAction={handleTasksModalPrimaryAction}
          handleResetChanges={handleResetChanges}
          updateSelectedGame={updateSelectedGame}
          GAME_TYPE_OPTIONS={GAME_TYPE_OPTIONS}
          CLUE_EARLY_MODE_OPTIONS={CLUE_EARLY_MODE_OPTIONS}
          toMinutes={toMinutes}
          toSeconds={toSeconds}
          handleAddTask={handleAddTask}
          handleReorderTask={handleReorderTask}
          isTaskReorderLocked={isTaskReorderLocked}
          startedGameLockedTaskCount={startedGameLockedTaskCount}
          handleRemoveTask={handleRemoveTask}
          handleTaskFieldChange={handleTaskFieldChange}
          handleTaskNumberChange={handleTaskNumberChange}
          handleTaskOptionalNumberChange={handleTaskOptionalNumberChange}
          handleTaskCheckboxChange={handleTaskCheckboxChange}
          handleTaskCoordinateChange={handleTaskCoordinateChange}
          handleAddTaskCode={handleAddTaskCode}
          handleTaskCodeChange={handleTaskCodeChange}
          handleTaskCodePhotoChange={handleTaskCodePhotoChange}
          handleRemoveTaskCode={handleRemoveTaskCode}
          handleAddTaskImage={handleAddTaskImage}
          handleTaskImageChange={handleTaskImageChange}
          handleRemoveTaskImage={handleRemoveTaskImage}
          handleAddClue={handleAddClue}
          handleReorderClue={handleReorderClue}
          handleTaskClueChange={handleTaskClueChange}
          handleRemoveClue={handleRemoveClue}
          handleAddSubTask={handleAddSubTask}
          handleSubTaskChange={handleSubTaskChange}
          handleRemoveSubTask={handleRemoveSubTask}
          handleAddPenaltyCode={handleAddPenaltyCode}
          handlePenaltyCodeChange={handlePenaltyCodeChange}
          handleRemovePenaltyCode={handleRemovePenaltyCode}
          handleAddBonusCode={handleAddBonusCode}
          handleBonusCodeChange={handleBonusCodeChange}
          handleRemoveBonusCode={handleRemoveBonusCode}
          handleAddPrice={handleAddPrice}
          handlePriceChange={handlePriceChange}
          handleRemovePrice={handleRemovePrice}
          handleAddFinance={handleAddFinance}
          handleFinanceChange={handleFinanceChange}
          handleRemoveFinance={handleRemoveFinance}
          canGenerateResults={canGenerateResults}
          isGeneratingResults={isGeneratingResults}
          handleGenerateResults={handleGenerateResults}
          generateResultsButtonLabel={generateResultsButtonLabel}
          currencyFormatter={currencyFormatter}
          financesSummary={financesSummary}
          balanceClass={balanceClass}
          expandedTaskIds={expandedTaskIds}
          toggleTaskExpansion={toggleTaskExpansion}
          selectedGameModerators={selectedGameModerators}
          availableModeratorsForSelect={availableModeratorsForSelect}
          availableModeratorsMap={availableModeratorsMap}
          availableOrganizersForSelect={availableOrganizersForSelect}
          selectedModeratorToAdd={selectedModeratorToAdd}
          setSelectedModeratorToAdd={setSelectedModeratorToAdd}
          handleAddModerator={handleAddModerator}
          handleRemoveModerator={handleRemoveModerator}
          selectedGameAgents={selectedGameAgents}
          availableAgentsForSelect={availableAgentsForSelect}
          availableAgentsMap={availableAgentsMap}
          selectedAgentToAdd={selectedAgentToAdd}
          setSelectedAgentToAdd={setSelectedAgentToAdd}
          handleAddAgent={handleAddAgent}
          handleRemoveAgent={handleRemoveAgent}
          editGameLocationOptions={editGameLocationOptions}
          editGameSeasons={editGameSeasons}
          isEditGameSeasonsLoading={isEditGameSeasonsLoading}
          isEditGameSeasonCreating={isEditGameSeasonCreating}
          handleCreateSeasonForEditGame={handleCreateSeasonForEditGame}
          handleSaveAndOpenTaskPreview={handleSaveAndOpenTaskPreview}
          canViewCodePhotos={canViewCodePhotos}
        />
      ) : null}

      {hasSelectedGame ? (
        <GameTeamsModal
          selectedGame={selectedGame}
          isTeamsModalOpen={isTeamsModalOpen}
          handleCloseTeamsModal={handleCloseTeamsModal}
          teamsModalState={teamsModalState}
          removingTeamIds={removingTeamIds}
          updatingOutOfCompetitionTeamIds={updatingOutOfCompetitionTeamIds}
          selectedTeamToAdd={selectedTeamToAdd}
          setSelectedTeamToAdd={setSelectedTeamToAdd}
          handleAddTeamToGame={handleAddTeamToGame}
          isAddingTeam={isAddingTeam}
          handleRemoveTeamFromGame={handleRemoveTeamFromGame}
          handleToggleTeamOutOfCompetition={handleToggleTeamOutOfCompetition}
          handleRefreshTeamsModalData={handleRefreshTeamsModalData}
          currentUserRole={currentUserRole}
          isReadOnly={isTeamsModalReadOnly}
        />
      ) : null}

      <GameRegisterModal
        isRegisterModalOpen={isRegisterModalOpen}
        handleCloseRegisterModal={handleCloseRegisterModal}
        isRegisterSubmitting={isRegisterSubmitting}
        handleSubmitRegister={handleSubmitRegister}
        registerTeamId={registerTeamId}
        registerGameId={registerGameId}
        setRegisterTeamId={setRegisterTeamId}
        setRegisterGameId={setRegisterGameId}
        isRegisterModalFromCard={isRegisterModalFromCard}
        registerModalGameName={registerModalGameName}
        shouldHideRegisterGameIdField={shouldHideRegisterGameIdField}
        registerFeedback={registerFeedback}
        isRegisterTeamsLoading={isRegisterTeamsLoading}
        registerTeams={registerTeams}
        location={location}
        currentUserId={currentUserId}
      />

      <GameCreateModal
        isCreateGameModalOpen={isCreateGameModalOpen}
        handleCloseCreateGameModal={handleCloseCreateGameModal}
        isCreatingGame={isCreatingGame}
        handleCreateGame={handleCreateGame}
        newGameName={newGameName}
        setNewGameName={setNewGameName}
        newGameIsRated={newGameIsRated}
        setNewGameIsRated={setNewGameIsRated}
        createGameMode={createGameMode}
        setCreateGameMode={setCreateGameMode}
        cloneSourceGameId={cloneSourceGameId}
        setCloneSourceGameId={setCloneSourceGameId}
        cloneSourceGames={createGameCloneSourceOptions}
        isCloneSourceGamesLoading={isCloneSourceGamesLoading}
        createGameLocation={createGameLocation}
        setCreateGameLocation={setCreateGameLocation}
        createGameSeasonId={createGameSeasonId}
        setCreateGameSeasonId={setCreateGameSeasonId}
        createGameSeasons={createGameSeasons}
        isCreateGameSeasonsLoading={isCreateGameSeasonsLoading}
        isCreateGameSeasonCreating={isCreateGameSeasonCreating}
        handleCreateSeasonForCreateGame={handleCreateSeasonForCreateGame}
        createGameLocationOptions={createGameLocationOptions}
        cloneOptions={createGameCloneOptions}
        onCloneOptionChange={handleChangeCreateGameCloneOption}
        isCreateGameActionDisabled={isCreateGameActionDisabled}
        createGameFeedback={createGameFeedback}
      />

      {gameForEdit ? (
        <GameFinancesModal
          selectedGame={gameForEdit}
          isOpen={isFinancesModalOpen}
          onClose={handleCloseFinancesModal}
          canEditSelectedGame={canEditSelectedGame}
          isSaving={isSaving}
          isDirty={isDirty}
          location={location}
          handlePrimaryAction={handleFinancesModalPrimaryAction}
          handleResetChanges={handleResetChanges}
          handleAddFinance={handleAddFinance}
          handleFinanceChange={handleFinanceChange}
          handleRemoveFinance={handleRemoveFinance}
          currencyFormatter={currencyFormatter}
          financesSummary={financesSummary}
          balanceClass={balanceClass}
        />
      ) : null}

      {hasSelectedGame ? (
        <GameHistoryModal
          selectedGame={selectedGame}
          isOpen={isGameHistoryModalOpen}
          onClose={handleCloseGameHistoryModal}
          onRollbackSuccess={handleGameHistoryRollbackSuccess}
          currentUserRole={currentUserRole}
        />
      ) : null}

      {hasSelectedGame ? (
        <GameDescriptionModal
          selectedGame={selectedGame}
          isDescriptionModalOpen={isDescriptionModalOpen}
          handleCloseDescriptionModal={handleCloseDescriptionModal}
          gameTypeLabel={gameTypeLabel}
          plannedStartLabel={plannedStartLabel}
          canViewRestrictedGameInfo={canViewRestrictedGameInfo}
          canViewGameResults={canViewGameResults}
          handleOpenResultsModal={handleOpenResultsModal}
          participationSummaryLabel={participationSummaryLabel}
          canJoinGame={canJoinGameFromDescription}
          canEnterGame={canEnterGameFromDescription}
          canCancelRegistration={canCancelGameRegistrationFromDescription}
          onJoinGame={handleJoinGameFromDescription}
          onEnterGame={handleEnterGameFromDescription}
          onCancelRegistration={handleCancelGameRegistrationFromDescription}
          isRegistrationSubmitting={isGameRegistrationSubmittingFromDescription}
          taskDurationLabel={taskDurationLabel}
          cluesDurationLabel={cluesDurationLabel}
          clueModeDetails={clueModeDetails}
          breakDurationLabel={breakDurationLabel}
          taskFailurePenaltyLabel={taskFailurePenaltyLabel}
          manyCodesLimitLabel={manyCodesLimitLabel}
          manyCodesPenaltyLabel={manyCodesPenaltyLabel}
          currencyFormatter={currencyFormatter}
        />
      ) : null}

      <GameResultsModal
        isResultsModalOpen={isResultsModalOpen}
        handleCloseResultsModal={handleCloseResultsModal}
        resultsModalState={resultsModalState}
      />

      {hasSelectedGame ? (
        <GameTasksViewModal
          isTasksViewModalOpen={isTasksViewModalOpen}
          handleCloseTasksViewModal={handleCloseTasksViewModal}
          selectedGame={selectedGame}
          canViewCodePhotos={canViewCodePhotos}
        />
      ) : null}
    </>
  )
}

const registerFeedbackShape = PropTypes.shape({
  type: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
})

const teamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  teamName: PropTypes.string,
  teamDescription: PropTypes.string,
  teamId: PropTypes.string,
  outOfCompetition: PropTypes.bool,
})

const availableTeamShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  members: PropTypes.array,
  membersCount: PropTypes.number,
})

const moderatorShape = PropTypes.oneOfType([
  PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    username: PropTypes.string,
    telegramId: PropTypes.string,
  }),
  PropTypes.string,
])

const moderatorOptionShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string,
  username: PropTypes.string,
  telegramId: PropTypes.string,
})

const agentShape = PropTypes.shape({
  id: PropTypes.string,
  userId: PropTypes.string,
  name: PropTypes.string,
  username: PropTypes.string,
  telegramId: PropTypes.string,
})

GameModals.propTypes = {
  selectedGame: PropTypes.shape({ id: PropTypes.string }),
  editGame: PropTypes.shape({ id: PropTypes.string }),
  isEditModalOpen: PropTypes.bool.isRequired,
  handleCloseEditModal: PropTypes.func.isRequired,
  isTasksModalOpen: PropTypes.bool.isRequired,
  handleCloseTasksModal: PropTypes.func.isRequired,
  canEditSelectedGame: PropTypes.bool.isRequired,
  isSaving: PropTypes.bool.isRequired,
  location: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({ city: PropTypes.string }),
  ]),
  isDirty: PropTypes.bool.isRequired,
  handleModalPrimaryAction: PropTypes.func.isRequired,
  handleTasksModalPrimaryAction: PropTypes.func.isRequired,
  handleResetChanges: PropTypes.func.isRequired,
  updateSelectedGame: PropTypes.func.isRequired,
  GAME_TYPE_OPTIONS: PropTypes.array.isRequired,
  CLUE_EARLY_MODE_OPTIONS: PropTypes.array.isRequired,
  toMinutes: PropTypes.func.isRequired,
  toSeconds: PropTypes.func.isRequired,
  handleAddTask: PropTypes.func.isRequired,
  handleReorderTask: PropTypes.func.isRequired,
  isTaskReorderLocked: PropTypes.func.isRequired,
  startedGameLockedTaskCount: PropTypes.number,
  handleRemoveTask: PropTypes.func.isRequired,
  handleTaskFieldChange: PropTypes.func.isRequired,
  handleTaskNumberChange: PropTypes.func.isRequired,
  handleTaskOptionalNumberChange: PropTypes.func.isRequired,
  handleTaskCheckboxChange: PropTypes.func.isRequired,
  handleTaskCoordinateChange: PropTypes.func.isRequired,
  handleAddTaskCode: PropTypes.func.isRequired,
  handleTaskCodeChange: PropTypes.func.isRequired,
  handleTaskCodePhotoChange: PropTypes.func.isRequired,
  handleRemoveTaskCode: PropTypes.func.isRequired,
  handleAddTaskImage: PropTypes.func.isRequired,
  handleTaskImageChange: PropTypes.func.isRequired,
  handleRemoveTaskImage: PropTypes.func.isRequired,
  handleAddClue: PropTypes.func.isRequired,
  handleReorderClue: PropTypes.func.isRequired,
  handleTaskClueChange: PropTypes.func.isRequired,
  handleRemoveClue: PropTypes.func.isRequired,
  handleAddSubTask: PropTypes.func.isRequired,
  handleSubTaskChange: PropTypes.func.isRequired,
  handleRemoveSubTask: PropTypes.func.isRequired,
  handleAddPenaltyCode: PropTypes.func.isRequired,
  handlePenaltyCodeChange: PropTypes.func.isRequired,
  handleRemovePenaltyCode: PropTypes.func.isRequired,
  handleAddBonusCode: PropTypes.func.isRequired,
  handleBonusCodeChange: PropTypes.func.isRequired,
  handleRemoveBonusCode: PropTypes.func.isRequired,
  handleAddPrice: PropTypes.func.isRequired,
  handlePriceChange: PropTypes.func.isRequired,
  handleRemovePrice: PropTypes.func.isRequired,
  handleAddFinance: PropTypes.func.isRequired,
  handleFinanceChange: PropTypes.func.isRequired,
  handleRemoveFinance: PropTypes.func.isRequired,
  isFinancesModalOpen: PropTypes.bool.isRequired,
  handleCloseFinancesModal: PropTypes.func.isRequired,
  handleFinancesModalPrimaryAction: PropTypes.func.isRequired,
  isGameHistoryModalOpen: PropTypes.bool.isRequired,
  handleCloseGameHistoryModal: PropTypes.func.isRequired,
  handleGameHistoryRollbackSuccess: PropTypes.func.isRequired,
  canGenerateResults: PropTypes.bool.isRequired,
  isGeneratingResults: PropTypes.bool.isRequired,
  handleGenerateResults: PropTypes.func.isRequired,
  generateResultsButtonLabel: PropTypes.string.isRequired,
  currencyFormatter: PropTypes.instanceOf(Intl.NumberFormat).isRequired,
  financesSummary: PropTypes.shape({
    income: PropTypes.number.isRequired,
    expense: PropTypes.number.isRequired,
    balance: PropTypes.number.isRequired,
  }).isRequired,
  balanceClass: PropTypes.string.isRequired,
  expandedTaskIds: PropTypes.instanceOf(Set).isRequired,
  toggleTaskExpansion: PropTypes.func.isRequired,
  isTeamsModalOpen: PropTypes.bool.isRequired,
  handleCloseTeamsModal: PropTypes.func.isRequired,
  teamsModalState: PropTypes.shape({
    error: PropTypes.string,
    isLoading: PropTypes.bool.isRequired,
    gameTeams: PropTypes.arrayOf(teamShape).isRequired,
    availableTeams: PropTypes.arrayOf(availableTeamShape).isRequired,
  }).isRequired,
  removingTeamIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  updatingOutOfCompetitionTeamIds: PropTypes.arrayOf(PropTypes.string)
    .isRequired,
  selectedTeamToAdd: PropTypes.string,
  setSelectedTeamToAdd: PropTypes.func.isRequired,
  handleAddTeamToGame: PropTypes.func.isRequired,
  isAddingTeam: PropTypes.bool.isRequired,
  handleRemoveTeamFromGame: PropTypes.func.isRequired,
  handleToggleTeamOutOfCompetition: PropTypes.func.isRequired,
  handleRefreshTeamsModalData: PropTypes.func,
  isTeamsModalReadOnly: PropTypes.bool,
  isRegisterModalOpen: PropTypes.bool.isRequired,
  handleCloseRegisterModal: PropTypes.func.isRequired,
  isRegisterSubmitting: PropTypes.bool.isRequired,
  handleSubmitRegister: PropTypes.func.isRequired,
  registerTeamId: PropTypes.string.isRequired,
  registerGameId: PropTypes.string.isRequired,
  setRegisterTeamId: PropTypes.func.isRequired,
  setRegisterGameId: PropTypes.func.isRequired,
  isRegisterModalFromCard: PropTypes.bool,
  registerModalGameName: PropTypes.string,
  shouldHideRegisterGameIdField: PropTypes.bool,
  registerFeedback: registerFeedbackShape,
  isRegisterTeamsLoading: PropTypes.bool.isRequired,
  registerTeams: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired }),
  ).isRequired,
  currentUserId: PropTypes.string,
  currentUserRole: PropTypes.string,
  canViewCodePhotos: PropTypes.bool,
  isCreateGameModalOpen: PropTypes.bool.isRequired,
  handleCloseCreateGameModal: PropTypes.func.isRequired,
  isCreatingGame: PropTypes.bool.isRequired,
  handleCreateGame: PropTypes.func.isRequired,
  newGameName: PropTypes.string.isRequired,
  setNewGameName: PropTypes.func.isRequired,
  newGameIsRated: PropTypes.bool.isRequired,
  setNewGameIsRated: PropTypes.func.isRequired,
  createGameMode: PropTypes.oneOf(['empty', 'clone']).isRequired,
  setCreateGameMode: PropTypes.func.isRequired,
  cloneSourceGameId: PropTypes.string.isRequired,
  setCloneSourceGameId: PropTypes.func.isRequired,
  createGameCloneSourceOptions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      location: PropTypes.string,
    }),
  ).isRequired,
  isCloneSourceGamesLoading: PropTypes.bool,
  createGameLocation: PropTypes.string.isRequired,
  setCreateGameLocation: PropTypes.func.isRequired,
  createGameSeasonId: PropTypes.string.isRequired,
  setCreateGameSeasonId: PropTypes.func.isRequired,
  createGameSeasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string,
    }),
  ),
  isCreateGameSeasonsLoading: PropTypes.bool,
  isCreateGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForCreateGame: PropTypes.func.isRequired,
  createGameLocationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  createGameCloneOptions: PropTypes.shape({
    basic: PropTypes.bool,
    rules: PropTypes.bool,
    captainRules: PropTypes.bool,
    tasks: PropTypes.bool,
    locations: PropTypes.bool,
    moderators: PropTypes.bool,
    publication: PropTypes.bool,
    prices: PropTypes.bool,
  }).isRequired,
  handleChangeCreateGameCloneOption: PropTypes.func.isRequired,
  isCreateGameActionDisabled: PropTypes.bool.isRequired,
  createGameFeedback: registerFeedbackShape,
  isDescriptionModalOpen: PropTypes.bool.isRequired,
  handleCloseDescriptionModal: PropTypes.func.isRequired,
  isTasksViewModalOpen: PropTypes.bool.isRequired,
  handleCloseTasksViewModal: PropTypes.func.isRequired,
  gameTypeLabel: PropTypes.string.isRequired,
  plannedStartLabel: PropTypes.string.isRequired,
  canViewRestrictedGameInfo: PropTypes.bool.isRequired,
  canViewGameResults: PropTypes.bool.isRequired,
  handleOpenResultsModal: PropTypes.func.isRequired,
  participationSummaryLabel: PropTypes.string,
  canJoinGameFromDescription: PropTypes.bool,
  canEnterGameFromDescription: PropTypes.bool,
  canCancelGameRegistrationFromDescription: PropTypes.bool,
  handleJoinGameFromDescription: PropTypes.func,
  handleEnterGameFromDescription: PropTypes.func,
  handleCancelGameRegistrationFromDescription: PropTypes.func,
  isGameRegistrationSubmittingFromDescription: PropTypes.bool,
  selectedGameModerators: PropTypes.arrayOf(moderatorShape).isRequired,
  availableModeratorsForSelect:
    PropTypes.arrayOf(moderatorOptionShape).isRequired,
  availableModeratorsMap: PropTypes.instanceOf(Map).isRequired,
  availableOrganizersForSelect: PropTypes.arrayOf(
    PropTypes.shape({
      telegramId: PropTypes.string.isRequired,
      name: PropTypes.string,
      username: PropTypes.string,
    }),
  ).isRequired,
  selectedModeratorToAdd: PropTypes.string.isRequired,
  setSelectedModeratorToAdd: PropTypes.func.isRequired,
  handleAddModerator: PropTypes.func.isRequired,
  handleRemoveModerator: PropTypes.func.isRequired,
  selectedGameAgents: PropTypes.arrayOf(agentShape).isRequired,
  availableAgentsForSelect: PropTypes.arrayOf(agentShape).isRequired,
  availableAgentsMap: PropTypes.instanceOf(Map).isRequired,
  selectedAgentToAdd: PropTypes.string.isRequired,
  setSelectedAgentToAdd: PropTypes.func.isRequired,
  handleAddAgent: PropTypes.func.isRequired,
  handleRemoveAgent: PropTypes.func.isRequired,
  editGameLocationOptions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
  editGameSeasons: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      location: PropTypes.string,
    }),
  ),
  isEditGameSeasonsLoading: PropTypes.bool,
  isEditGameSeasonCreating: PropTypes.bool,
  handleCreateSeasonForEditGame: PropTypes.func.isRequired,
  handleSaveAndOpenTaskPreview: PropTypes.func.isRequired,
  taskDurationLabel: PropTypes.string.isRequired,
  cluesDurationLabel: PropTypes.string.isRequired,
  clueModeDetails: PropTypes.shape({
    modeLabel: PropTypes.string.isRequired,
    valueLabel: PropTypes.string.isRequired,
  }).isRequired,
  breakDurationLabel: PropTypes.string.isRequired,
  taskFailurePenaltyLabel: PropTypes.string.isRequired,
  manyCodesLimitLabel: PropTypes.string,
  manyCodesPenaltyLabel: PropTypes.string,
  isResultsModalOpen: PropTypes.bool.isRequired,
  handleCloseResultsModal: PropTypes.func.isRequired,
  resultsModalState: PropTypes.shape({
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    gameId: PropTypes.string,
    gameName: PropTypes.string,
    rows: PropTypes.array,
    teamsCount: PropTypes.number,
    participantsCount: PropTypes.number,
    computed: PropTypes.object,
    interactiveResultsUrl: PropTypes.string,
    userParticipationTeamIds: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
}

GameModals.defaultProps = {
  selectedGame: null,
  editGame: null,
  location: null,
  isRegisterModalFromCard: false,
  registerModalGameName: '',
  shouldHideRegisterGameIdField: false,
  registerFeedback: null,
  currentUserId: null,
  currentUserRole: null,
  canViewCodePhotos: false,
  startedGameLockedTaskCount: 0,
  isCloneSourceGamesLoading: false,
  selectedTeamToAdd: '',
  handleRefreshTeamsModalData: undefined,
  createGameSeasons: [],
  isCreateGameSeasonsLoading: false,
  isCreateGameSeasonCreating: false,
  createGameLocationOptions: [],
  createGameFeedback: null,
  participationSummaryLabel: '',
  canJoinGameFromDescription: false,
  canEnterGameFromDescription: false,
  canCancelGameRegistrationFromDescription: false,
  handleJoinGameFromDescription: undefined,
  handleEnterGameFromDescription: undefined,
  handleCancelGameRegistrationFromDescription: undefined,
  isGameRegistrationSubmittingFromDescription: false,
  editGameLocationOptions: [],
  editGameSeasons: [],
  isEditGameSeasonsLoading: false,
  isEditGameSeasonCreating: false,
  manyCodesLimitLabel: null,
  manyCodesPenaltyLabel: null,
}

export default memo(GameModals)
