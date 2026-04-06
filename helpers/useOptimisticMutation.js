import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Хук для мутаций с оптимистическими обновлениями
 * @param {Object} options
 * @param {string} options.queryKey - React Query queryKey для инвалидации
 * @param {Function} options.mutationFn - Функция для выполнения мутации
 * @param {Function} options.onSuccess - Callback при успехе
 * @param {Function} options.onError - Callback при ошибке
 * @param {Function} options.updateCache - Функция для оптимистического обновления кэша (опционально)
 * @returns {Object} Объект мутации от useMutation
 */
export default function useOptimisticMutation({
  queryKey,
  mutationFn,
  onSuccess,
  onError,
  updateCache,
}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onMutate: async (newData) => {
      // Отменяем текущие запросы чтобы не переписали наши оптимистичные данные
      await queryClient.cancelQueries({ queryKey })

      // Сохраняем старые данные для отката
      const previousData = queryClient.getQueryData(queryKey)

      // Оптимистически обновляем кэш если передана функция
      if (updateCache) {
        queryClient.setQueryData(queryKey, (oldData) =>
          updateCache(oldData, newData),
        )
      }

      return { previousData }
    },
    onError: (err, newData, context) => {
      // Откатываем на старые данные при ошибке
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData)
      }

      // Вызываем пользовательский callback
      if (onError) {
        onError(err, newData, context)
      }
    },
    onSuccess: (data, variables, context) => {
      // Инвалидируем для свежести (фоновый refetch)
      queryClient.invalidateQueries({ queryKey })

      // Вызываем пользовательский callback
      if (onSuccess) {
        onSuccess(data, variables, context)
      }
    },
  })
}
