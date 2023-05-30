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
}

export default commandsArray
