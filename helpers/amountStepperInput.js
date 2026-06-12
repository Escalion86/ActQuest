export const normalizeAmountStepperValue = (value, fallback = 0) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

export const normalizeAmountStepperDisplayValue = (value, fallback = 0) => {
  const normalizedValue = normalizeAmountStepperValue(value, fallback)
  return String(normalizedValue)
}
