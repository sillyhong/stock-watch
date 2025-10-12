// 示例 K 线数据
const klineData = [
    "2025-02-27 09:45,39.94,39.90,40.29,39.78,63138,252419724.00,1.26,-1.09,-0.44,0.99,0",
    "2025-02-27 10:00,39.97,39.81,40.48,39.78,45035,180387518.00,1.75,-0.23,-0.09,0.71,0",
    "2025-02-27 10:15,39.80,39.24,39.80,39.22,46098,181997035.00,1.46,-1.43,-0.57,0.73,0",
    "2025-02-27 10:30,39.25,39.03,39.27,39.00,39590,154839054.00,0.69,-0.54,-0.21,0.62,0"
];

// 提取当天开盘价
const firstKline = klineData[0].split(',');
const openingPrice = 40.34//parseFloat(firstKline[1]);
console.log("🚀 ~ openingPrice:", openingPrice)

// 计算每个 15 分钟节点的涨跌百分比
klineData.forEach((kline) => {
    const klineItems = kline.split(',');
    const timestamp = klineItems[0];
    const closingPrice = parseFloat(klineItems[2]);
    console.log("🚀 ~ klineData.forEach ~ closingPrice:", closingPrice)

    // 计算涨跌百分比
    const changePercentage = ((closingPrice - openingPrice) / openingPrice) * 100;

    console.log(`时间: ${timestamp}, 涨跌百分比: ${changePercentage.toFixed(2)}%`);
});