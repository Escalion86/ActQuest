'use client'

import { useEffect } from 'react'
import PropTypes from 'prop-types'

const loadExternalScriptOnce = ({ id, src }) => {
  if (typeof document === 'undefined' || document.getElementById(id)) {
    return
  }

  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

const ClientRuntimeScripts = ({
  diagnosticsScript,
  yandexMetrikaId,
  gaMeasurementId,
}) => {
  useEffect(() => {
    if (typeof window === 'undefined' || !diagnosticsScript) {
      return
    }

    try {
      Function(diagnosticsScript)()
    } catch {
      // Диагностика не должна ломать приложение.
    }
  }, [diagnosticsScript])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (Number.isFinite(yandexMetrikaId) && yandexMetrikaId > 0) {
      loadExternalScriptOnce({
        id: 'aq-yandex-metrika-loader',
        src: `https://mc.yandex.ru/metrika/tag.js?id=${yandexMetrikaId}`,
      })

      window.ym =
        window.ym ||
        function ymStub(...args) {
          window.ym.a = window.ym.a || []
          window.ym.a.push(args)
        }
      window.ym.l = window.ym.l || Number(new Date())
      window.__AQ_YM_ID = yandexMetrikaId
      window.ym(yandexMetrikaId, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: window.location.href,
      })
    }

    const normalizedGaId =
      typeof gaMeasurementId === 'string' ? gaMeasurementId.trim() : ''
    if (normalizedGaId) {
      window.dataLayer = window.dataLayer || []
      window.gtag =
        window.gtag ||
        function gtagStub(...args) {
          window.dataLayer.push(args)
        }
      window.__AQ_GA_ID = normalizedGaId
      loadExternalScriptOnce({
        id: 'aq-ga4-loader',
        src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
          normalizedGaId,
        )}`,
      })
      window.gtag('js', new Date())
      window.gtag('config', normalizedGaId, {
        send_page_view: true,
      })
    }
  }, [gaMeasurementId, yandexMetrikaId])

  return null
}

ClientRuntimeScripts.propTypes = {
  diagnosticsScript: PropTypes.string,
  yandexMetrikaId: PropTypes.number,
  gaMeasurementId: PropTypes.string,
}

ClientRuntimeScripts.defaultProps = {
  diagnosticsScript: '',
  yandexMetrikaId: 0,
  gaMeasurementId: '',
}

export default ClientRuntimeScripts
