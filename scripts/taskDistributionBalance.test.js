import test from 'node:test'
import assert from 'node:assert/strict'
import { buildBalancedTaskSequences, prepareTaskDistributionForStart, isTaskSequenceCompatibleWithTemplate } from '../helpers/taskDistribution.js'

const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const template = [[0, 1, 2], [3], [4]]
const verifyBalance = (sequences, blocks) => {
  let offset = 0
  for (const block of blocks) {
    for (let step = offset; step < offset + block.length; step++) {
      const counts = block.map(task => sequences.filter(sequence => sequence[step] === task).length)
      assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `Шаг ${step}: ${counts}`)
    }
    offset += block.length
  }
}

test('23 команды: 8/8/7 на каждом из первых трёх шагов, хвост фиксирован', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const sequences = buildBalancedTaskSequences(Array.from({ length: 23 }, () => ({ template })), [], seeded(seed))
    verifyBalance(sequences, template)
    sequences.forEach(sequence => assert.equal(isTaskSequenceCompatibleWithTemplate(sequence, template, 5), true))
  }
})

test('баланс сохраняется для разных размеров блоков и числа команд', () => {
  for (let size = 2; size <= 12; size++) {
    const blocks = [Array.from({ length: size }, (_, i) => i), [size], [size + 1, size + 2]]
    for (let count = 1; count <= 37; count++) {
      const sequences = buildBalancedTaskSequences(Array.from({ length: count }, () => ({ template: blocks })), [], seeded(count * size))
      verifyBalance(sequences, blocks)
      sequences.forEach(sequence => assert.equal(isTaskSequenceCompatibleWithTemplate(sequence, blocks, size + 3), true))
    }
  }
})

test('случайность сохраняется: команды не привязаны к одной стартовой точке', () => {
  const routes = new Set()
  for (let seed = 1; seed <= 40; seed++) {
    routes.add(buildBalancedTaskSequences(Array.from({ length: 23 }, () => ({ template })), [], seeded(seed))[0].slice(0, 3).join(','))
  }
  assert.equal(routes.size, 6)
})

test('сохранённые маршруты учитываются при старте, но не перезаписываются', () => {
  const teams = Array.from({ length: 23 }, (_, _id) => ({ _id }))
  teams[0].taskSequence = [2, 0, 1, 3, 4]
  teams[1].taskSequence = [2, 1, 0, 3, 4]
  teams[0].taskSequenceSource = 'game_template'
  teams[1].taskSequenceSource = 'game_template'
  const before = structuredClone(teams)
  const result = prepareTaskDistributionForStart({ type: 'classic', taskDistributionMode: 'random', tasks: Array(5).fill({}), taskDistributionTemplate: template }, teams)
  assert.deepEqual(result.errors, [])
  assert.equal(result.updates.length, 21)
  assert.deepEqual(teams, before)
  verifyBalance([...teams.slice(0, 2).map(team => team.taskSequence), ...result.updates.map(item => item.taskSequence)], template)
})

test('новые команды заполняют наименее занятые позиции готовых маршрутов', () => {
  const sequences = [[0, 1, 2, 3, 4], [1, 2, 0, 3, 4]]
  for (let i = 0; i < 21; i++) {
    sequences.push(buildBalancedTaskSequences([{ template }], sequences.map(taskSequence => ({ template, taskSequence })), seeded(i + 10))[0])
    verifyBalance(sequences, template)
  }
})

test('индивидуальные шаблоны и начатые префиксы не нарушаются', () => {
  const requests = [
    { template, lockedPrefix: [2, 0] },
    { template: [[2], [0, 1], [3], [4]], lockedPrefix: [2] },
    { template: [[4], [3], [0, 1, 2]], lockedPrefix: [] },
  ]
  const before = structuredClone(requests)
  const sequences = buildBalancedTaskSequences(requests, [], seeded(20))
  assert.deepEqual(requests, before)
  sequences.forEach((sequence, index) => {
    assert.deepEqual(sequence.slice(0, requests[index].lockedPrefix.length), requests[index].lockedPrefix)
    assert.equal(isTaskSequenceCompatibleWithTemplate(sequence, requests[index].template, 5), true)
  })
})


test('разные шаблоны изолированы, одинаковые блоки объединены независимо от порядка внутри блока', () => {
  const other = [[0, 1, 2], [4], [3]]
  const requests = Array.from({ length: 23 }, (_, i) => ({ template: i % 2 ? [[2, 0, 1], [3], [4]] : template }))
  const fixed = Array.from({ length: 40 }, () => ({ template: other, taskSequence: [0, 1, 2, 4, 3] }))
  for (let seed = 1; seed <= 30; seed++) {
    const baseline = buildBalancedTaskSequences(requests, [], seeded(seed))
    assert.deepEqual(buildBalancedTaskSequences(requests, fixed, seeded(seed)), baseline)
    const mixed = buildBalancedTaskSequences([...requests, ...Array.from({ length: 17 }, () => ({ template: other }))], [], seeded(seed))
    verifyBalance(mixed.slice(0, 23), template)
    verifyBalance(mixed.slice(23), other)
  }
})

test('ручные маршруты сохранены и не влияют на баланс автоматических команд при старте', () => {
  const manual = Array.from({ length: 20 }, (_, i) => ({ _id: `manual-${i}`, taskSequence: [0, 1, 2, 3, 4], taskSequenceSource: 'linear' }))
  const teams = [...manual, ...Array.from({ length: 23 }, (_, _id) => ({ _id }))]
  const before = structuredClone(teams)
  const result = prepareTaskDistributionForStart({ type: 'classic', taskDistributionMode: 'random', tasks: Array(5).fill({}), taskDistributionTemplate: template }, teams)
  assert.deepEqual(result.errors, [])
  assert.equal(result.updates.length, 23)
  assert.deepEqual(teams, before)
  verifyBalance(result.updates.map(item => item.taskSequence), template)
})
