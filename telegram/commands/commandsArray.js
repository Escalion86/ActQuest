import createTeam from './createTeam'
import deleteTeam from './deleteTeam'
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
import deleteGame from './deleteGame'
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
import setClue1 from './setClue1'
import setClue2 from './setClue2'
import setCodes from './setCodes'
import setTaskI from './setTaskI'
import teams from './teams'
import teamUsersAdmin from './teamUsersAdmin'
import teamUserAdmin from './teamUserAdmin'
import delTeamUserAdmin from './delTeamUserAdmin'
import deleteTeamAdmin from './deleteTeamAdmin'
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
  deleteTeam,
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
  deleteGame,
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
  setClue1,
  setClue2,
  setCodes,
  setTaskI,
  teams,
  teamUsersAdmin,
  teamUserAdmin,
  delTeamUserAdmin,
  deleteTeamAdmin,
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
}

var i = 0
for (const key in commandsArray) {
  // const command = commandsArray[key]
  numToCommand[i] = key
  commandToNum[key] = i
  i++
}

export default commandsArray
