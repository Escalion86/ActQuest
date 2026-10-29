import { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import Modal from '@components/Modal'
import CabinetButton from '@components/cabinet/CabinetButton'
import requestApiJson from '@helpers/requestApiJson'

const CopyGameTasksModal = ({ sourceGame, isDirty, onSave, onClose, onCopied, onOpenTarget }) => {
  const [step, setStep] = useState(isDirty ? 'dirty' : 'loading')
  const [tasks, setTasks] = useState([])
  const [targets, setTargets] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [targetId, setTargetId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const inFlight = useRef(false)
  const operation = useRef(null)
  const alive = useRef(true)
  const sourceId = sourceGame.mongoId || sourceGame.id
  const endpoint = `/api/cabinet/games/${encodeURIComponent(sourceId)}/copy-tasks`
  const selectedTarget = targets.find((game) => game.id === targetId)
  const available = tasks.filter((task) => !task.blockedReason)
  const allSelected = available.length > 0 && available.every((task) => selectedIds.includes(task.id))

  const load = async () => {
    setStep('loading')
    setError('')
    try {
      const { json } = await requestApiJson(endpoint, { cache: 'no-store', fallbackMessage: 'Не удалось загрузить задания и игры' })
      if (!alive.current) return
      setTasks(json.data.tasks)
      setTargets(json.data.targets)
      setSelectedIds([])
      setStep('tasks')
    } catch (err) {
      if (alive.current) { setError(err.message); setStep('load-error') }
    }
  }

  useEffect(() => {
    alive.current = true
    if (!isDirty) void load()
    return () => { alive.current = false }
    // Окно монтируется заново для каждого источника; dirty проверяется при входе.
  }, [])

  const saveFirst = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      const saved = await onSave()
      if (!saved) throw new Error('Изменения не сохранены. Исправьте ошибки или отмените копирование и вернитесь в редактор.')
      await load()
    } catch (err) { setError(err.message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  const copy = async () => {
    if (inFlight.current || !targetId || !selectedIds.length) return
    inFlight.current = true
    setBusy(true)
    setError('')
    // Один ключ и неизменный набор сохраняются для повтора после сетевого обрыва.
    if (!operation.current) operation.current = { targetGameId: targetId, taskIds: selectedIds, requestId: crypto.randomUUID() }
    try {
      const { json } = await requestApiJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(operation.current), fallbackMessage: 'Не удалось скопировать задания' })
      setResult(json.data)
      setStep('success')
      onCopied(json.data)
    } catch (err) { setError(err.message) }
    finally { inFlight.current = false; setBusy(false) }
  }

  const close = () => { if (!inFlight.current) onClose() }
  const back = () => { setError(''); setStep(step === 'confirm' ? 'targets' : 'tasks') }
  const footer = <>
    <CabinetButton variant="secondary" onClick={close} disabled={busy}>{step === 'success' ? 'Закрыть' : 'Отмена'}</CabinetButton>
    {['targets', 'confirm'].includes(step) && !operation.current ? <CabinetButton variant="secondary" onClick={back} disabled={busy}>Назад</CabinetButton> : null}
    {step === 'dirty' ? <CabinetButton onClick={saveFirst} disabled={busy}>Сохранить и продолжить</CabinetButton> : null}
    {step === 'tasks' ? <CabinetButton disabled={selectedIds.length === 0 || busy} onClick={() => setStep('targets')}>Выбрать игру, куда копировать</CabinetButton> : null}
    {step === 'targets' ? <CabinetButton disabled={!targetId || busy} onClick={() => setStep('confirm')}>Продолжить</CabinetButton> : null}
    {step === 'confirm' ? <CabinetButton disabled={busy} onClick={copy}>Скопировать</CabinetButton> : null}
    {step === 'success' ? <CabinetButton disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onOpenTarget(result.targetGameId) } catch (err) { setError(err.message || 'Не удалось открыть задания') } finally { setBusy(false) } }}>Открыть задания целевой игры</CabinetButton> : null}
  </>

  return <Modal isOpen title={`Скопировать задания из «${sourceGame.name || 'Без названия'}»`} onClose={close} footer={footer}>
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200" aria-busy={busy || step === 'loading'}>
      {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</p> : null}
      {step === 'dirty' ? <p>Есть несохранённые изменения. Сначала сохраните их, чтобы скопировать актуальные задания.</p> : null}
      {step === 'loading' ? <p role="status">Загружаем сохранённые задания и доступные игры…</p> : null}
      {step === 'load-error' ? <CabinetButton onClick={load}>Повторить загрузку</CabinetButton> : null}
      {step === 'tasks' ? <>
        <p>Выберите задания. Они будут добавлены в конец другой игры в исходном порядке.</p>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-300 p-3 dark:border-slate-600">
          <input type="checkbox" checked={allSelected} disabled={!available.length} onChange={(event) => setSelectedIds(event.target.checked ? available.map((task) => task.id) : [])} />
          Выбрать все
        </label>
        {tasks.length ? tasks.map((task, index) => <label key={task.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <input className="mt-1 shrink-0" type="checkbox" checked={selectedIds.includes(task.id)} disabled={Boolean(task.blockedReason)} onChange={(event) => setSelectedIds((previous) => event.target.checked ? [...previous, task.id] : previous.filter((id) => id !== task.id))} />
          <span className="min-w-0 break-words"><span>{index + 1}. {task.title}</span>{task.blockedReason ? <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{task.blockedReason}</span> : null}</span>
        </label>) : <p>В исходной игре нет сохранённых заданий.</p>}
        <p>Выбрано заданий: {selectedIds.length}</p>
      </> : null}
      {step === 'targets' ? <>
        <p>Предстоящие игры того же типа в этом городе, доступные вам для редактирования.</p>
        {targets.length ? targets.map((game) => <label key={game.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <input type="radio" name="copy-target-game" className="mt-1" checked={targetId === game.id} onChange={() => setTargetId(game.id)} />
          <span className="min-w-0 break-words">{game.name || 'Без названия'}</span>
        </label>) : <p>Нет подходящих игр. Создайте предстоящую игру того же типа или проверьте права доступа.</p>}
      </> : null}
      {step === 'confirm' ? <>
        <p>Игра назначения: <strong>{selectedTarget?.name || 'Без названия'}</strong></p>
        <p>Количество заданий: <strong>{selectedIds.length}</strong>. Добавить в конец игры?</p>
        <p>Существующие задания и настройки игры сохранятся. Назначения агентов не переносятся.</p>
        {busy ? <p role="status">Копируем задания…</p> : null}
      </> : null}
      {step === 'success' ? <p role="status">Скопировано заданий: {result.count}. Игра: «{selectedTarget?.name || 'Без названия'}».</p> : null}
    </div>
  </Modal>
}

CopyGameTasksModal.propTypes = {
  sourceGame: PropTypes.shape({ id: PropTypes.string.isRequired, mongoId: PropTypes.string, name: PropTypes.string, type: PropTypes.string }).isRequired,
  isDirty: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCopied: PropTypes.func.isRequired,
  onOpenTarget: PropTypes.func.isRequired,
}

export default CopyGameTasksModal
