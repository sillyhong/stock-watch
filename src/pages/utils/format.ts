export const formatPriceChange = (value = '') => {
    // 处理空值或无效值的情况
    if (!value || value === '' || value === 'undefined' || value === 'null') {
        return '无效';
    }
    
    const isNegativeNumber = value?.includes('-')
    const currentValue = isNegativeNumber ? value : `+${value}`
    return `${currentValue}%`
}