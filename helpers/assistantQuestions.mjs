export const ASSISTANT_QUICK_QUESTIONS = [
  'Что такое автоквест?', 'Какие ближайшие игры?', 'Как записаться?',
  'Можно участвовать без команды?', 'Как подготовиться?', 'Как связаться с организатором?',
]
const aliases = new Map([
  ...ASSISTANT_QUICK_QUESTIONS.map((text, i) => [text, ['about', 'schedule', 'register', 'no-team', 'prepare', 'organizer'][i]]),
  ['Подробнее об игре', 'details'], ['Хочу записаться', 'register'],
  ['Какие правила?', 'prepare'], ['Что взять с собой?', 'prepare'],
  ['Можно с ребёнком?', 'prepare'], ['Что делать новичку?', 'prepare'],
])
export const strictAssistantIntent = question => aliases.get(question) || null
