import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { loader } from './phoneVerification.fixture.mjs'
const require = createRequire(import.meta.url)
const React = require('react')
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)]
function componentFixture(file, mocks = {}, props = {}) {
  const states = [], refs = [], effects = []
  let slot = 0, refSlot = 0
  const hooks = { ...React, useState: initial => { const i = slot++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useRef: value => { const i = refSlot++; return refs[i] ||= { current: value } }, useEffect: fn => effects.push(fn), useMemo: fn => fn(), useCallback: fn => fn }
  const load = loader({ react: hooks, ...mocks })
  const Component = load(file).default
  let tree
  return { render() { slot = refSlot = 0; tree = Component(props); return tree }, nodes: () => nodes(tree), effects, states }
}
const flush = () => new Promise(resolve => setImmediate(resolve))
test('реальный JSX настройки: загрузка, подтверждённый выбор, оба направления, отказ и повтор', async () => {
  const f = componentFixture('@components/cabinet/PhoneVerificationPrioritySetting')
  const original = globalThis.fetch, requests = []; let failLoad = true, failSave = false, selected = 'call'
  globalThis.fetch = async (_url, opts) => { requests.push(opts); if (opts.method === 'PATCH') { if (failSave) return Response.json({ success: false }, { status: 403 }); selected = JSON.parse(opts.body).phoneVerificationPrimaryMethod } else if (failLoad) throw new Error('offline'); return Response.json({ success: true, data: { phoneVerificationPrimaryMethod: selected, allowSmsVerification: false } }) }
  const radio = value => f.nodes().find(n => n.type === 'input' && n.props.value === value)
  try {
    f.render(); assert.equal(f.nodes().find(n => n.type === 'fieldset').props.disabled, true)
    f.effects[0](); await flush(); f.render(); assert.ok(f.nodes().find(n => n.props?.role === 'alert'))
    failLoad = false; f.nodes().find(n => n.props?.children === 'Повторить загрузку').props.onClick(); f.effects.at(-1)(); await flush(); f.render()
    assert.equal(radio('call').props.checked, true)
    const pending = radio('sms').props.onChange(); f.render(); assert.equal(radio('call').props.checked, true); assert.equal(f.nodes().find(n => n.type === 'fieldset').props.disabled, true)
    await pending; f.render(); assert.equal(radio('sms').props.checked, true)
    failSave = true; await radio('call').props.onChange(); f.render(); assert.equal(radio('sms').props.checked, true); assert.ok(f.nodes().find(n => n.props?.role === 'alert'))
    failSave = false; await radio('call').props.onChange(); f.render(); assert.equal(radio('call').props.checked, true)
    assert.deepEqual(JSON.parse(requests.at(-1).body), { phoneVerificationPrimaryMethod: 'call' })
  } finally { globalThis.fetch = original }
})
const mocks = {
  'next/link': props => React.createElement('a', props),
  'next/navigation': { useRouter: () => ({ replace() {} }), usePathname: () => '/cabinet/register', useSearchParams: () => new URLSearchParams() },
  'next-auth/react': { useSession: () => ({ status: 'unauthenticated', data: null, update: async () => {} }), signIn: async () => ({ ok: true }) },
  '@helpers/usePwaNotifications': () => ({}),
  '@components/cabinet/CabinetLayout': props => React.createElement('div', null, props.children),
  '@components/cabinet/auth/AuthSplitLayout': props => React.createElement('div', null, props.children),
  '@components/cabinet/auth/AuthLocationSelect': props => React.createElement('select', { ...props, onChange: e => props.onChange(e.target.value) }),
}
for (const name of ['CabinetInputField', 'CabinetSelectField', 'CabinetTextareaField', 'FormSectionCard', 'ImagesInput']) mocks[`@components/cabinet/${name}`] = props => React.createElement('div', props, props.children)
for (const name of ['NeonCheckbox', 'FeedbackToast', 'NoticeBanner', 'Modal']) mocks[`@components/${name}`] = props => React.createElement('div', props, props.children)
// Функции страниц выполняются целиком; дочерние визуальные компоненты не монтируются.
for (const flow of ['register', 'recovery', 'change_phone']) for (const withFallback of [false, true]) test(`реальная web-форма ${flow} fallback=${withFallback}: preferred SMS без callId, код, звонок/fallback`, async () => {
  const profile = flow === 'change_phone'
  const f = componentFixture(profile ? '@components/cabinet/app-router/ProfilePageClient' : '@components/cabinet/app-router/CabinetRegisterPageClient', mocks, profile ? { initialProfile: { id: 'me', name: 'Тест', phone: '79000000000' } } : { authIntent: flow, isVkAuthVisible: false })
  const original = globalThis.fetch, requests = []; let resolvePolling
  globalThis.fetch = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : {}; requests.push({ url, body })
    if (url.endsWith('/check') && !url.includes('/sms/')) return new Promise(resolve => { resolvePolling = resolve })
    if (url.endsWith('/precheck')) return Response.json({ success: true, data: { allowed: true } })
    if (url.endsWith('/start') && !url.includes('/sms/')) return Response.json({ success: true, data: body.method === 'call' ? { method: 'call', id: 123, auth_phone: '88005553535' } : { method: 'sms', status: 'sms_pending' } })
    return Response.json({ success: true, data: { status: 'ok' } })
  }
  try {
    f.render()
    if (profile) {
      const open = f.nodes().find(n => n.props?.children === 'Изменить номер') || f.nodes().find(n => n.props?.children === 'Изменить телефон')
      assert.ok(open, 'кнопка смены номера'); open.props.onClick(); f.render()
    } else {
      // Реальный select города, клиентское состояние после эффекта монтирования.
      f.effects[0](); f.render()
      const select = f.nodes().find(n => n.props?.onChange && (n.props?.label?.includes?.('Город') || n.type === mocks['@components/cabinet/auth/AuthLocationSelect']))
      if (select) select.props.onChange({ target: { value: 'krsk' } })
      else f.states[0] = 'krsk'
      f.render()
    }
    const phone = f.nodes().find(n => n.props?.type === 'tel' && typeof n.props.onChange === 'function'); assert.ok(phone); phone.props.onChange({ target: { value: '+7 900 123-45-67' } }); f.render()
    const submit = () => f.nodes().find(n => n.type === 'form' && n.props.onSubmit && (!profile || n.props.id === 'profile-change-phone-form')).props.onSubmit({ preventDefault() {} })
    await submit(); f.render()
    assert.equal(requests.find(r => r.url.endsWith('/start')).body.method, 'preferred'); assert.equal(requests.find(r => r.url.endsWith('/start')).body.flow, flow)
    const otp = () => f.nodes().find(n => n.type === 'input' && n.props.autoComplete === 'one-time-code')
    assert.ok(otp(), 'поле SMS видно без callId')
    const fallback = f.nodes().find(n => n.props?.children === 'Подтвердить звонком'); assert.ok(fallback)
    if (withFallback) {
    await fallback.props.onClick(); f.render(); assert.equal(requests.at(-1).body.method, 'call'); assert.equal(otp(), undefined)
    let tick
    const originalInterval = globalThis.setInterval
    globalThis.setInterval = (fn, delay) => { assert.equal(delay, 3000); tick = fn; return 123 }
    try { [...f.effects].reverse().find(fn => String(fn).includes('3000'))() } finally { globalThis.setInterval = originalInterval }
    assert.ok(tick); tick(); await flush(); assert.ok(resolvePolling)
    const sms = f.nodes().find(n => n.props?.children === 'Не получилось позвонить — получить код по SMS'); assert.ok(sms); await sms.props.onClick(); f.render()
    resolvePolling(Response.json({ success: true, data: { status: 'ok' } })); await flush(); f.render(); assert.ok(otp(), 'запоздалый polling не закрывает SMS')
    }
    otp().props.onChange({ target: { value: '4826' } }); f.render(); await submit(); f.render()
    assert.ok(requests.some(r => r.url.endsWith('/sms/check') && r.body.code === '4826'))
    assert.equal(requests.filter(r => r.url.endsWith('/start') && !r.url.includes('/sms/')).length, withFallback ? 2 : 1)
    if (!profile) assert.ok(f.nodes().find(n => n.props?.type === 'password'))
    else assert.ok(f.nodes().find(n => n.props?.children === 'Сохранить номер'))
  } finally { globalThis.fetch = original }
})
