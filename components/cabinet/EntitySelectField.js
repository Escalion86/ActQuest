import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'

import Modal from '@components/Modal'

const PAGE_SIZE = 10

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

const mergeUniqueById = (prev, next) => {
  if (!Array.isArray(next) || next.length === 0) {
    return prev
  }

  const existing = new Set(prev.map((item) => item.id))
  const merged = [...prev]
  next.forEach((item) => {
    if (!item?.id || existing.has(item.id)) {
      return
    }
    existing.add(item.id)
    merged.push(item)
  })
  return merged
}

const EntitySelectField = ({
  label,
  placeholder,
  modalTitle,
  searchPlaceholder,
  endpoint,
  queryParams,
  mapOption,
  selectedOption,
  onSelect,
  onClear,
  disabled,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)
  const searchTimeoutRef = useRef(null)

  const selectedLabel = useMemo(() => {
    if (!selectedOption) {
      return placeholder
    }
    return selectedOption.title || placeholder
  }, [placeholder, selectedOption])

  const selectedMeta = selectedOption?.subtitle || ''

  const fetchPage = useCallback(
    async ({ offset = 0, replace = false, searchValue = '' }) => {
      const currentRequestId = requestIdRef.current + 1
      requestIdRef.current = currentRequestId

      if (replace) {
        setIsLoading(true)
      } else {
        setIsLoadingMore(true)
      }
      setError('')

      try {
        const params = new URLSearchParams()
        params.set('offset', String(offset))
        params.set('limit', String(PAGE_SIZE))

        if (typeof searchValue === 'string' && searchValue.trim()) {
          params.set('q', searchValue.trim())
        }

        if (queryParams && typeof queryParams === 'object') {
          Object.entries(queryParams).forEach(([key, value]) => {
            if (value === null || value === undefined || value === '') {
              return
            }
            params.set(key, String(value))
          })
        }

        const response = await fetch(`${endpoint}?${params.toString()}`)
        const json = await response.json()
        if (!response.ok || json?.success === false) {
          throw new Error(json?.error || 'Не удалось загрузить список')
        }

        if (requestIdRef.current !== currentRequestId) {
          return
        }

        const nextItems = Array.isArray(json?.data)
          ? json.data
              .map((item) => mapOption(item))
              .filter((option) => option?.id && option?.title)
          : []

        if (replace) {
          setItems(nextItems)
        } else {
          setItems((prev) => mergeUniqueById(prev, nextItems))
        }
        setHasMore(Boolean(json?.meta?.hasMore))
      } catch (fetchError) {
        if (requestIdRef.current === currentRequestId) {
          setError(fetchError.message || 'Ошибка загрузки')
        }
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [endpoint, mapOption, queryParams],
  )

  const openModal = useCallback(() => {
    setIsModalOpen(true)
    setSearch('')
    setItems([])
    setHasMore(false)
    fetchPage({ offset: 0, replace: true, searchValue: '' })
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading) {
      return
    }
    fetchPage({ offset: items.length, replace: false, searchValue: search })
  }, [fetchPage, hasMore, isLoading, isLoadingMore, items.length, search])

  const handleSearchChange = useCallback(
    (nextValue) => {
      setSearch(nextValue)
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current)
      }
      const timeoutId = window.setTimeout(() => {
        fetchPage({ offset: 0, replace: true, searchValue: nextValue })
      }, 300)
      searchTimeoutRef.current = timeoutId
    },
    [fetchPage],
  )

  useEffect(
    () => () => {
      if (searchTimeoutRef.current !== null) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    },
    [],
  )

  const handleSelect = useCallback(
    (option) => {
      onSelect?.(option)
      setIsModalOpen(false)
    },
    [onSelect],
  )

  return (
    <div className="space-y-1.5">
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
          {label}
        </p>
      ) : null}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={openModal}
          disabled={disabled}
          className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-left transition ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900`}
        >
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
            {selectedLabel}
          </p>
          {selectedMeta ? (
            <p className="truncate text-xs text-slate-500 dark:text-slate-300">
              {selectedMeta}
            </p>
          ) : null}
        </button>
        {selectedOption ? (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="h-[44px] w-[44px] cursor-pointer rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label="Сбросить выбор"
          >
            ×
          </button>
        ) : null}
      </div>

      <Modal
        isOpen={isModalOpen}
        title={modalTitle}
        onClose={() => setIsModalOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="aq-modal-btn aq-modal-btn-secondary"
          >
            Закрыть
          </button>
        }
      >
        <div className="space-y-3">
          <input
            className={INPUT_CLASS}
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
          />

          {error ? (
            <p className="rounded-xl border border-rose-300 bg-rose-100/80 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            {items.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-cyan-400 hover:bg-cyan-50 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-cyan-500/50 dark:hover:bg-cyan-500/10"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {option.title}
                </p>
                {option.subtitle ? (
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {option.subtitle}
                  </p>
                ) : null}
              </button>
            ))}
          </div>

          {!isLoading && items.length === 0 && !error ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Ничего не найдено
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Загружаем...
            </p>
          ) : null}

          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
            >
              {isLoadingMore ? 'Загружаем...' : 'Загрузить ещё'}
            </button>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

EntitySelectField.propTypes = {
  label: PropTypes.string,
  placeholder: PropTypes.string,
  modalTitle: PropTypes.string.isRequired,
  searchPlaceholder: PropTypes.string,
  endpoint: PropTypes.string.isRequired,
  queryParams: PropTypes.object,
  mapOption: PropTypes.func.isRequired,
  selectedOption: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
  }),
  onSelect: PropTypes.func,
  onClear: PropTypes.func,
  disabled: PropTypes.bool,
}

EntitySelectField.defaultProps = {
  label: '',
  placeholder: 'Выберите значение',
  searchPlaceholder: 'Поиск',
  queryParams: null,
  selectedOption: null,
  onSelect: undefined,
  onClear: undefined,
  disabled: false,
}

export default EntitySelectField
