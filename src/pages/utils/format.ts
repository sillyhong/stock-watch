export const formatPriceChange = (value = '') => {
    const isNegativeNumber = value?.includes('-')
    const currentValue = isNegativeNumber ? value : `+${value}`
    return `${currentValue}%`
}