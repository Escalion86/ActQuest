import createTeam from './createTeam'
import delTeam from './delTeam'
import editTeam from './editTeam'
import linkToJoinTeam from './linkToJoinTeam'
import joinedTeams from './joinedTeams'
import joinTeam from './joinTeam'
import mainMenu from './mainMenu'
import menuTeams from './menuTeams'
import menuUser from './menuUser'
import setTeamDesc from './setTeamDesc'
import setTeamName from './setTeamName'
import setUserName from './setUserName'
import teamUsers from './teamUsers'
import delTeamUser from './delTeamUser'
import teamUser from './teamUser'
import menuGames from './menuGames'
import createGame from './createGame'
import menuGamesEdit from './menuGamesEdit'
import editGame from './editGame'
import delGame from './delGame'
import setGameDesc from './setGameDesc'
import setGameName from './setGameName'
import gameTeams from './gameTeams'
import gameTeam from './gameTeam'
import delGameTeam from './delGameTeam'
import game from './game'
import joinGame from './joinGame'
import gameTasksEdit from './gameTasksEdit'
import hideGame from './hideGame'
import unhideGame from './unhideGame'
import unjoinTeam from './unjoinTeam'
import setGameDate from './setGameDate'
import createTask from './createTask'
import editTask from './editTask'
import setGameImage from './setGameImage'
import setTaskT from './setTaskT'
import setTaskN from './setTaskN'
import delTask from './delTask'
import setCodes from './setCodes'
import setTaskI from './setTaskI'
import teams from './teams'
import teamUsersAdmin from './teamUsersAdmin'
import teamUserAdmin from './teamUserAdmin'
import delTeamUserAdmin from './delTeamUserAdmin'
import delTeamUserAdmin2 from './delTeamUserAdmin2'
import delTeamAdmin from './delTeamAdmin'
import editTeamAdmin from './editTeamAdmin'
import joinGameAdmin from './joinGameAdmin'
import teamGamesAdmin from './teamGamesAdmin'
import userAdmin from './userAdmin'
import users from './users'
import userJoinToTeam from './userJoinToTeam'
import gameStart from './gameStart'
import gameStop from './gameStop'
import gameProcess from './gameProcess'
import gameActive from './gameActive'
import setCNum from './setCNum'
import gameResult from './gameResult'
import gameStatus from './gameStatus'
import gameMsg from './gameMsg'
import setTaskDuration from './setTaskDuration'
import setBreakDuration from './setBreakDuration'
import setCluesDuration from './setCluesDuration'
import setTaskPenalty from './setTaskPenalty'
import transferCaptainRights from './transferCaptainRights'
import archiveGames from './archiveGames'
import gameAnonsMsg from './gameAnonsMsg'
import gameResultForm from './gameResultForm'
import setGameIndividualStart from './setGameIndividualStart'
import editPenaltyCodes from './editPenaltyCodes'
import editPenaltyCode from './editPenaltyCode'
import setPenaltyCodeCode from './setPenaltyCodeCode'
import setPenaltyCodePenalty from './setPenaltyCodePenalty'
import setPenaltyCodeDescription from './setPenaltyCodeDescription'
import addPenaltyCode from './addPenaltyCode'
import editBonusCodes from './editBonusCodes'
import editBonusCode from './editBonusCode'
import setBonusCodeCode from './setBonusCodeCode'
import setBonusCodeBonus from './setBonusCodeBonus'
import setBonusCodeDescription from './setBonusCodeDescription'
import addBonusCode from './addBonusCode'
import setTaskPostMessage from './setTaskPostMessage'
import setGameFinishingPlace from './setGameFinishingPlace'
import setGameStartingPlace from './setGameStartingPlace'
import allUsers from './allUsers'
import adminMenu from './adminMenu'
import gameResultShow from './gameResultShow'
import gameResultHide from './gameResultHide'
import checkGameTeamsDoubles from './checkGameTeamsDoubles'
import sendMessageToAll from './sendMessageToAll'
import gameAddings from './gameAddings'
import gameTeamAddings from './gameTeamAddings'
import delGameTeamAddingBonus from './delGameTeamAddingBonus'
import delGameTeamAddingPenalty from './delGameTeamAddingPenalty'
import addGameTeamAddingBonus from './addGameTeamAddingBonus'
import addGameTeamAddingPenalty from './addGameTeamAddingPenalty'
import joinToGameWithCode from './joinToGameWithCode'
import setManyCodesPenalty from './setManyCodesPenalty'
import gameResultAdminBack from './gameResultAdminBack'
import gameTeamAdmin from './gameTeamAdmin'
import gameTeamsAdmin from './gameTeamsAdmin'
import editGameGeneral from './editGameGeneral'
import selectTeamToJoinGameAdmin from './selectTeamToJoinGameAdmin'
import delGameTeamAdmin from './delGameTeamAdmin'
import setGameType from './setGameType'
import editTaskClues from './editTaskClues'
import addTaskClue from './addTaskClue'
import editTaskClue from './editTaskClue'
import delTaskClue from './delTaskClue'
import editTaskCoordinates from './editTaskCoordinates'
import setTaskCoordinateLatitude from './setTaskCoordinateLatitude'
import setTaskCoordinateLongitude from './setTaskCoordinateLongitude'
import setTaskCoordinateRadius from './setTaskCoordinateRadius'
import archiveGamesEdit from './archiveGamesEdit'
import editGamePrices from './editGamePrices'
import editGamePrice from './editGamePrice'
import addGamePrice from './addGamePrice'
import setGamePriceName from './setGamePriceName'
import setGamePricePrice from './setGamePricePrice'
import setBonusForTaskComplite from './setBonusForTaskComplite'
import addSubTask from './addSubTask'
import editSubTasks from './editSubTasks'
import editSubTask from './editSubTask'
import setSubTaskName from './setSubTaskName'
import setSubTaskTask from './setSubTaskTask'
import setSubTaskBonus from './setSubTaskBonus'
import gameTeamsCheckPhotos from './gameTeamsCheckPhotos'
import gameTeamCheckPhotos from './gameTeamCheckPhotos'
import gameTeamCheckPhotosInTask from './gameTeamCheckPhotosInTask'
import gamePhotos from './gamePhotos'
import gameTeamPhotos from './gameTeamPhotos'
import gameTeamPayments from './gameTeamPayments'
import usersStatistics from './usersStatistics'

export const numToCommand = {}
export const commandToNum = {}

const commandsArray = {
  setUserName,
  setTeamName,
  setTeamDesc,
  createTeam,
  menuTeams,
  mainMenu,
  editTeam,
  menuUser,
  delTeam,
  joinTeam,
  joinedTeams,
  teamUsers,
  linkToJoinTeam,
  teamUser,
  delTeamUser,
  menuGames,
  createGame,
  menuGamesEdit,
  editGame,
  delGame,
  setGameDesc,
  setGameName,
  gameTeams,
  gameTeam,
  delGameTeam,
  game,
  joinGame,
  gameTasksEdit,
  hideGame,
  unhideGame,
  unjoinTeam,
  setGameDate,
  createTask,
  editTask,
  setGameImage,
  setTaskT,
  setTaskN,
  delTask,
  delTaskClue,
  editTaskClue,
  setCodes,
  setTaskI,
  teams,
  teamUsersAdmin,
  teamUserAdmin,
  delTeamUserAdmin,
  delTeamAdmin,
  editTeamAdmin,
  joinGameAdmin,
  teamGamesAdmin,
  userAdmin,
  users,
  userJoinToTeam,
  gameStart,
  gameStop,
  gameProcess,
  gameActive,
  setCNum,
  gameResult,
  gameStatus,
  gameMsg,
  setTaskDuration,
  setBreakDuration,
  setCluesDuration,
  setTaskPenalty,
  transferCaptainRights,
  archiveGames,
  gameAnonsMsg,
  gameResultForm,
  setGameIndividualStart,
  editPenaltyCodes,
  editPenaltyCode,
  setPenaltyCodeCode,
  setPenaltyCodePenalty,
  setPenaltyCodeDescription,
  addPenaltyCode,
  editBonusCodes,
  editBonusCode,
  setBonusCodeCode,
  setBonusCodeBonus,
  setBonusCodeDescription,
  addBonusCode,
  setTaskPostMessage,
  setGameFinishingPlace,
  setGameStartingPlace,
  allUsers,
  adminMenu,
  delTeamUserAdmin2,
  gameResultShow,
  gameResultHide,
  checkGameTeamsDoubles,
  sendMessageToAll,
  gameAddings,
  gameTeamAddings,
  delGameTeamAddingBonus,
  addGameTeamAddingBonus,
  joinToGameWithCode,
  setManyCodesPenalty,
  gameResultAdminBack,
  gameTeamAdmin,
  gameTeamsAdmin,
  addGameTeamAddingPenalty,
  delGameTeamAddingPenalty,
  editGameGeneral,
  selectTeamToJoinGameAdmin,
  delGameTeamAdmin,
  setGameType,
  editTaskClues,
  addTaskClue,
  editTaskCoordinates,
  setTaskCoordinateLatitude,
  setTaskCoordinateLongitude,
  setTaskCoordinateRadius,
  archiveGamesEdit,
  editGamePrices,
  editGamePrice,
  addGamePrice,
  setGamePriceName,
  setGamePricePrice,
  setBonusForTaskComplite,
  addSubTask,
  editSubTasks,
  editSubTask,
  setSubTaskName,
  setSubTaskTask,
  setSubTaskBonus,
  gameTeamsCheckPhotos,
  gameTeamCheckPhotos,
  gameTeamCheckPhotosInTask,
  gamePhotos,
  gameTeamPhotos,
  gameTeamPayments,
  usersStatistics,
}

var i = 0
for (const key in commandsArray) {
  // const command = commandsArray[key]
  numToCommand[i] = key
  commandToNum[key] = i
  i++
}

export default commandsArray
