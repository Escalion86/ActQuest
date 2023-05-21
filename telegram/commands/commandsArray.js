import create_team from './create_team'
import edit_team from './edit_team'
import main_menu from './main_menu'
import menu_teams from './menu_teams'
import menu_user from './menu_user'
import set_team_description from './set_team_description'
import set_team_name from './set_team_name'
import set_user_name from './set_user_name'

const commandsArray = {
  set_user_name,
  set_team_name,
  set_team_description,
  create_team,
  menu_teams,
  main_menu,
  edit_team,
  menu_user,
}

export default commandsArray
