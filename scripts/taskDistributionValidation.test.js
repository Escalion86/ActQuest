import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareTaskDistributionForStart, getTaskDistributionStartErrors, buildTaskSequenceFromTemplate, isTaskSequenceCompatibleWithTemplate } from '../helpers/taskDistribution.js'

const game = (template = [[0, 1], [2], [3, 4]]) => ({ type: 'classic', taskDistributionMode: 'random', tasks: Array(5).fill({}), taskDistributionTemplate: template })
const row = (sequence = [1, 0, 2, 4, 3], template) => ({ _id: 'registration', teamId: 'team-id', name: 'Искатели', taskSequence: sequence, taskDistributionTemplate: template })

test('порядок блоков и фиксированные позиции соблюдаются, внутри блока любая перестановка', () => {
  assert.deepEqual(getTaskDistributionStartErrors(game(), [row()]), [])
  assert.deepEqual(getTaskDistributionStartErrors(game([[1, 0], [2], [4, 3]]), [row()]), [])
  for (const sequence of [[2, 0, 1, 4, 3], [1, 0, 3, 4, 2], [1, 3, 2, 4, 0]]) {
    const result = prepareTaskDistributionForStart(game(), [row(sequence), { _id: 'empty' }])
    assert.equal(result.errors.length, 1)
    assert.match(result.errors[0], /Искатели.*шаблон.*Распределите/)
    assert.deepEqual(result.updates, [])
  }
})
test('изменение общего шаблона после генерации блокирует старый маршрут, совместимое изменение допустимо', () => {
  const sequence = buildTaskSequenceFromTemplate([[0, 1], [2], [3, 4]], () => 0)
  assert.deepEqual(getTaskDistributionStartErrors(game(), [row(sequence)]), [])
  assert.equal(getTaskDistributionStartErrors(game([[2], [0, 1], [3, 4]]), [row(sequence)]).length, 1)
  assert.deepEqual(getTaskDistributionStartErrors(game([[0, 1, 2], [3, 4]]), [row(sequence)]), [])
})
test('индивидуальный шаблон приоритетен, изменение и сброс проверяют новый применимый шаблон', () => {
  const individual = [[3, 4], [2], [0, 1]]
  const team = row([4, 3, 2, 1, 0], individual)
  assert.deepEqual(getTaskDistributionStartErrors(game(), [team]), [])
  assert.equal(getTaskDistributionStartErrors(game(), [{ ...team, taskDistributionTemplate: [[2], [3, 4], [0, 1]] }]).length, 1)
  assert.equal(getTaskDistributionStartErrors(game(), [{ ...team, taskDistributionTemplate: [] }]).length, 1)
  assert.deepEqual(getTaskDistributionStartErrors(game(individual), [{ ...team, taskDistributionTemplate: null }]), [])
})
test('дубли, пропуски, нецелые значения маршрутов и шаблонов блокируют, id стабилен без названия', () => {
  for (const sequence of [[0, 0, 2, 3, 4], [0, 1], [0, 1, 2, 3, 4.5]]) {
    assert.match(getTaskDistributionStartErrors(game(), [{ ...row(sequence), name: undefined }])[0], /team-id.*повреждён/)
  }
  for (const template of [[[0, 1, 2, 3, 4, 1.5]], [[0, 1, 2, 3, 4, null]], [[0, 1], [2], [3]], [[0, 1], [2], [3, 3]]]) {
    assert.ok(getTaskDistributionStartErrors(game(template), [row()]).length > 0)
  }
})
test('пустые маршруты не блокируют проверку и генерируются на старте, неверный шаблон блокирует', () => {
  for (const sequence of [[], null, undefined]) {
    assert.deepEqual(getTaskDistributionStartErrors(game(), [{ ...row(), taskSequence: sequence }]), [])
    assert.equal(prepareTaskDistributionForStart(game(), [{ ...row(), taskSequence: sequence }]).updates.length, 1)
  }
  assert.ok(getTaskDistributionStartErrors(game([[0]]), [row([])]).length > 0)
})
test('сравнение само отвергает нецелые значения шаблона', () => {
  assert.equal(isTaskSequenceCompatibleWithTemplate([0, 1, 2], [[0, 1, 2, 1.5]], 3), false)
})

test('linear/story не проверяют распределение', () => {
  for (const override of [{ type: 'story' }, { taskDistributionMode: 'linear' }]) {
    assert.deepEqual(prepareTaskDistributionForStart({ ...game([[0]]), ...override }, [row([0, 0])]), { updates: [], errors: [] })
    assert.deepEqual(getTaskDistributionStartErrors({ ...game([[0]]), ...override }, [row([0, 0])]), [])
  }
})
