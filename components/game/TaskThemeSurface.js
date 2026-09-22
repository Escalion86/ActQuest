import PropTypes from 'prop-types'
import { getTaskThemeStyle, normalizeTaskTheme } from '@helpers/taskThemes'

const TaskThemeSurface = ({ theme, children }) => (
  <div
    className="aq-task-theme"
    data-task-theme={normalizeTaskTheme(theme)}
    style={getTaskThemeStyle(theme)}
  >
    {children}
  </div>
)

TaskThemeSurface.propTypes = {
  theme: PropTypes.string,
  children: PropTypes.node,
}

export default TaskThemeSurface
