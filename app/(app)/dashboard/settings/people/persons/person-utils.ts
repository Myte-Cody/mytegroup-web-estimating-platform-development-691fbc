export const splitList = (value: string) => {
  return (value || '')
    .split(/[,;\n]/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

export const joinList = (items?: Array<string | null | undefined>) => {
  return (items || [])
    .map((item) => (item || '').trim())
    .filter(Boolean)
    .join(', ')
}

export const toDateInputValue = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export const normalizeOptionalString = (value: string) => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed : null
}

