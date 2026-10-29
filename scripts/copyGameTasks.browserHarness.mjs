// Изолированный стенд: настоящие редактор заданий, настройки, модалка копирования и CSS.
// Сессии/API и не относящиеся к сценарию тяжёлые дочерние редакторы заменены фикстурами.
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
const require = createRequire(import.meta.url), root = process.cwd()
const output = process.env.COPY_TASKS_QA_OUTPUT
if (!output) throw new Error('Укажите COPY_TASKS_QA_OUTPUT внутри scratch/actquest-copy-qa')
await mkdir(output, { recursive: true })
await writeFile(path.join(output, 'stub.jsx'), 'export default function Stub() { return null }; export const PrestartPageEditor = Stub')
await writeFile(path.join(output, 'swc-loader.cjs'), `const swc = require(${JSON.stringify(require.resolve('next/dist/build/swc'))}); module.exports = function(source) { return swc.transformSync(source, { filename: this.resourcePath, jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } }, module: { type: 'es6' } }).code }`)
await writeFile(path.join(output, 'entry.jsx'), `import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import Editor from ${JSON.stringify(path.join(root, 'components/modals/game-tasks/GameTasksEditModal.js'))};
const noop = () => {}; const source = {id:'111111111111111111111111', name:'Исходная игра', type:location.pathname === '/story' ? 'story' : 'classic', status:location.pathname === '/closed' ? 'closed' : 'active', tasks:[], location:'krsk'};
const handlers = ${JSON.stringify(Object.fromEntries(['beginTaskEditing','cancelTaskEditing','handleResetChanges','handleAddTask','handleReorderTask','handleRemoveTask','handleTaskFieldChange','handleTaskNumberChange','handleTaskOptionalNumberChange','handleTaskCheckboxChange','handleTaskCoordinateChange','handleAddTaskCode','handleTaskCodeChange','handleTaskCodePhotoChange','handleRemoveTaskCode','handleAddClue','handleReorderClue','handleTaskClueChange','handleRemoveClue','handleAddSubTask','handleSubTaskChange','handleRemoveSubTask','handleAddPenaltyCode','handlePenaltyCodeChange','handleRemovePenaltyCode','handleAddBonusCode','handleBonusCodeChange','handleRemoveBonusCode','handleSaveAndOpenTaskPreview','handleOpenGameMap','updateSelectedGame'].map(name => [name,null])))}; Object.keys(handlers).forEach(name => { handlers[name] = noop });
function App() { const [game,setGame] = useState(source), [dirty,setDirty] = useState(location.pathname === '/dirty'), [open,setOpen] = useState(true), [opened,setOpened] = useState('');
return <><h1>Проверка копирования заданий ActQuest</h1><output>{opened}</output><Editor {...handlers} currentUserRole="admin" selectedGame={game} isEditModalOpen={open} handleCloseEditModal={() => setOpen(false)} handleModalPrimaryAction={() => setOpen(false)} canEditSelectedGame={game.status !== 'closed'} isGameClosed={game.status === 'closed'} isSaving={false} location="krsk" isDirty={dirty} isTaskReorderLocked={() => false} startedGameLockedTaskCount={0} selectedGameAgents={[]} canViewCodePhotos={true} canViewGameMap={false}
onSaveBeforeCopy={async () => { const response = await fetch('/fixture-save',{method:'POST'}); if (!response.ok) return null; setDirty(false); return game }}
onTasksCopied={() => { window.copyNotifications = (window.copyNotifications || 0) + 1 }}
onOpenCopiedTasks={async id => { const response = await fetch('/fixture-target'); if (!response.ok) throw new Error('Не удалось открыть задания'); setGame({...source,id,name:'Игра назначения'}); setOpened('Открыты задания: '+id) }}/></> }
createRoot(document.getElementById('root')).render(<App/>);`)
const aliases = Object.fromEntries(['components','helpers','server','utils','schemas','state','lib'].map(name => [`@${name}`, path.join(root,name)]))
for (const file of ['components/modals/game-tasks/ClassicStageTaskItem.js','components/modals/game-tasks/ClassicItemsSection.js','components/modals/game-tasks/PrestartPageSection.js','components/modals/game-edit/sections/PrequelSection.js']) aliases[path.join(root,file)+'$'] = path.join(output, 'stub.jsx')
const webpack = require('next/dist/compiled/webpack/webpack').webpack
await new Promise((resolve,reject) => webpack({mode:'development',devtool:false,context:root,entry:path.join(output,'entry.jsx'),output:{path:output,filename:'browser.js'},resolve:{alias:aliases,modules:[path.join(root,'node_modules')],extensions:['.js','.jsx','.json']},module:{rules:[{test:/\.(js|jsx)$/,exclude:/node_modules/,use:path.join(output,'swc-loader.cjs')}] } },(err,stats) => err || stats.hasErrors() ? reject(err || new Error(stats.toString({all:false,errors:true}))) : resolve()))
const css = await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile(path.join(root,'styles/global.css'),'utf8'),{from:path.join(root,'styles/global.css')})
await writeFile(path.join(output,'browser.css'),css.css)
const server = createServer(async (req,res) => {
  if (req.url === '/__stop' && req.method === 'POST') { res.end('stopped'); server.close(() => process.exit(0)); return }
  if (['/browser.js','/browser.css'].includes(req.url)) { res.setHeader('Content-Type',req.url.endsWith('.css') ? 'text/css' : 'application/javascript'); res.end(await readFile(path.join(output,req.url.slice(1)))); return }
  if (req.url.startsWith('/api/') || req.url.startsWith('/fixture-')) { res.writeHead(501,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:false,error:'Требуется явный mock API'})); return }
  res.setHeader('Content-Type','text/html; charset=utf-8'); res.end('<!doctype html><html><head><title>ActQuest — копирование заданий QA</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/browser.css"></head><body><main id="root"></main><script>window.process={env:{NODE_ENV:"development"}}</script><script src="/browser.js"></script></body></html>')
}).listen(Number(process.env.COPY_TASKS_QA_PORT || 3295),'127.0.0.1',() => console.log('Стенд копирования готов: http://127.0.0.1:'+server.address().port))
