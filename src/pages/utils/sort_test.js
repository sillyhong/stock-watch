
// const test = [
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/00700.html?from=classic#fullScreenChart" style="color: green;">腾讯控股</a></td><td>9.625</td><td style="color: red;">立即买入🚀 today: -0.25% </td></tr>',
//     '<tr><td>2025-02-25 10:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/00700.html?from=classic#fullScreenChart" style="color: green;">腾讯控股</a></td><td>9.502</td><td style="color: red;">立即买入🚀 today: -0.21% </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/00700.html?from=classic#fullScreenChart" style="color: green;">腾讯控股</a></td><td>7.358</td><td style="color: red;">立即买入🚀 today: +0.58% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/09988.html?from=classic#fullScreenChart" style="color: green;">阿里巴巴-W</a></td><td>10.044</td><td style="color: red;">立即买入🚀 today: +2.07% </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03690.html?from=classic#fullScreenChart" style="color: green;">美团-W</a></td><td>13.801</td><td style="color: red;">立即买入🚀 today: -0.38% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02015.html?from=classic#fullScreenChart" style="color: green;">理想汽车-W</a></td><td>14.911</td><td style="color: red;">立即买入🚀 today: +12.89% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/01347.html?from=classic#fullScreenChart" style="color: green;">华虹半导体</a></td><td>14.018</td><td style="color: red;">立即买入🚀 today: -1.03% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03896.html?from=classic#fullScreenChart" style="color: green;">金山云</a></td><td>8.492</td><td style="color: red;">立即买入🚀 today: +0.4% </td></tr>',
//     '<tr><td>2025-02-25 10:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03896.html?from=classic#fullScreenChart" style="color: green;">金山云</a></td><td>8.492</td><td style="color: red;">立即买入🚀 today: +0.4% </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03896.html?from=classic#fullScreenChart" style="color: green;">金山云</a></td><td>6.95</td><td style="color: red;">立即买入🚀 today: +1.91% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>14.358</td><td style="color: red;">立即买入🚀 today: -3.74% </td></tr>',
//     '<tr><td>2025-02-25 15:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>10.128</td><td style="color: red;">立即买入🚀 today: +1.47% </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>12.395</td><td style="color: red;">立即买入🚀 today: -1.38% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02013.html?from=classic#fullScreenChart" style="color: green;">微盟集团</a></td><td>13.452</td><td style="color: red;">立即买入🚀 today: 0% </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/09626.html?from=classic#fullScreenChart" style="color: green;">哔哩哔哩-W</a></td><td>14.366</td><td style="color: red;">立即买入🚀 today: -0.37% </td></tr>',
//     '<tr><td>2025-02-24 15:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02533.html?from=classic#fullScreenChart" style="color: green;">黑芝麻智能</a></td><td>13.566</td><td style="color: red;">立即买入🚀 today: 0% next: +0.2%</td></tr>',
//     '<tr><td>2025-02-24 16:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02533.html?from=classic#fullScreenChart" style="color: green;">黑芝麻智能</a></td><td>13.566</td><td style="color: red;">立即买入🚀 today: 0% next: +0.2%</td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02533.html?from=classic#fullScreenChart" style="color: green;">黑芝麻智能</a></td><td>3.374</td><td style="color: red;">立即买入🚀 today: +4.8% </td></tr>',
//     '<tr><td>2025-02-25 10:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/00700.html?from=classic#fullScreenChart" style="color: green;">腾讯控股</a></td><td>19.914</td><td style="color: orange;">建议买入🔥 today: +0.12%  </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/09988.html?from=classic#fullScreenChart" style="color: green;">阿里巴巴-W</a></td><td>19.635</td><td style="color: orange;">建议买入🔥 today: +1.45%  </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03690.html?from=classic#fullScreenChart" style="color: green;">美团-W</a></td><td>18.031</td><td style="color: orange;">建议买入🔥 today: -1.58%  </td></tr>',
//     '<tr><td>2025-02-25 10:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03690.html?from=classic#fullScreenChart" style="color: green;">美团-W</a></td><td>17.314</td><td style="color: orange;">建议买入🔥 today: -1.39%  </td></tr>',
//     '<tr><td>2025-02-25 15:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/03690.html?from=classic#fullScreenChart" style="color: green;">美团-W</a></td><td>19.926</td><td style="color: orange;">建议买入🔥 today: +0.38%  </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/09868.html?from=classic#fullScreenChart" style="color: green;">小鹏汽车-W</a></td><td>16.029</td><td style="color: orange;">建议买入🔥 today: +6.89%  </td></tr>',
//     '<tr><td>2025-02-25 15:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/00981.html?from=classic#fullScreenChart" style="color: green;">中芯国际</a></td><td>17.681</td><td style="color: orange;">建议买入🔥 today: +0.65%  </td></tr>',
//     '<tr><td>2025-02-25 14:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/01347.html?from=classic#fullScreenChart" style="color: green;">华虹半导体</a></td><td>19.197</td><td style="color: orange;">建议买入🔥 today: +0.39%  </td></tr>',
//     '<tr><td>2025-02-25 15:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/01347.html?from=classic#fullScreenChart" style="color: green;">华虹半导体</a></td><td>18.633</td><td style="color: orange;">建议买入🔥 today: +0.65%  </td></tr>',
//     '<tr><td>2025-02-25 15:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/01347.html?from=classic#fullScreenChart" style="color: green;">华虹半导体</a></td><td>19.937</td><td style="color: orange;">建议买入🔥 today: +0.77%  </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02498.html?from=classic#fullScreenChart" style="color: green;">速腾聚创</a></td><td>19.869</td><td style="color: orange;">建议买入🔥 today: +6.35%  </td></tr>',
//     '<tr><td>2025-02-25 10:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>18.346</td><td style="color: orange;">建议买入🔥 today: -2.95%  </td></tr>',
//     '<tr><td>2025-02-25 10:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>17.846</td><td style="color: orange;">建议买入🔥 today: -2.75%  </td></tr>',
//     '<tr><td>2025-02-25 11:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>19.004</td><td style="color: orange;">建议买入🔥 today: -2.56%  </td></tr>',
//     '<tr><td>2025-02-25 14:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>18.944</td><td style="color: orange;">建议买入🔥 today: -0.59%  </td></tr>',
//     '<tr><td>2025-02-25 15:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06682.html?from=classic#fullScreenChart" style="color: green;">第四范式</a></td><td>16.768</td><td style="color: orange;">建议买入🔥 today: +1.18%  </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/01024.html?from=classic#fullScreenChart" style="color: green;">快手-W</a></td><td>16.79</td><td style="color: orange;">建议买入🔥 today: -0.09%  </td></tr>',
//     '<tr><td>2025-02-25 09:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>16.658</td><td style="color: orange;">建议买入🔥 today: -2.34%  </td></tr>',
//     '<tr><td>2025-02-25 10:00</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>15.988</td><td style="color: orange;">建议买入🔥 today: -2.2%  </td></tr>',
//     '<tr><td>2025-02-25 10:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>16.163</td><td style="color: orange;">建议买入🔥 today: -1.51%  </td></tr>',
//     '<tr><td>2025-02-25 10:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>15.37</td><td style="color: orange;">建议买入🔥 today: -1.38%  </td></tr>',
//     '<tr><td>2025-02-25 15:15</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>19.052</td><td style="color: orange;">建议买入🔥 today: -0.14%  </td></tr>',
//     '<tr><td>2025-02-25 15:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>16.092</td><td style="color: orange;">建议买入🔥 today: +0.14%  </td></tr>',
//     '<tr><td>2025-02-25 15:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/06099.html?from=classic#fullScreenChart" style="color: green;">招商证券</a></td><td>16.092</td><td style="color: orange;">建议买入🔥 today: +0.14%  </td></tr>',
//     '<tr><td>2025-02-24 11:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02013.html?from=classic#fullScreenChart" style="color: green;">微盟集团</a></td><td>17.898</td><td style="color: orange;">建议买入🔥 today: -0.69% next: -5.45% </td></tr>',
//     '<tr><td>2025-02-24 11:45</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02013.html?from=classic#fullScreenChart" style="color: green;">微盟集团</a></td><td>15.163</td><td style="color: orange;">建议买入🔥 today: +0.35% next: -4.36% </td></tr>',
//     '<tr><td>2025-02-24 15:30</td><td>15RSI</td><td><a href="https://quote.eastmoney.com/hk/02533.html?from=classic#fullScreenChart" style="color: green;">黑芝麻智能</a></td><td>18.677</td><td style="color: orange;">建议买入🔥 today: -0.6% next: -0.4% </td></tr>'
//   ]

  const test = [
    '[2025-02-25 09:45] [15RSI] 腾讯控股 9.625 ➜ 立即买入🚀 today: -0.25% ',
    '[2025-02-25 10:00] [15RSI] 腾讯控股 9.502 ➜ 立即买入🚀 today: -0.21% ',
    '[2025-02-25 10:15] [15RSI] 腾讯控股 7.358 ➜ 立即买入🚀 today: +0.58% ',
    '[2025-02-25 10:30] [15RSI] 腾讯控股 19.914 ➜ 建议买入🔥 today: +0.12%  ',
    '[2025-02-25 09:45] [15RSI] 阿里巴巴-W 10.044 ➜ 立即买入🚀 today: +2.07% ',
    '[2025-02-25 10:15] [15RSI] 阿里巴巴-W 19.635 ➜ 建议买入🔥 today: +1.45%  ',
    '[2025-02-25 09:45] [15RSI] 美团-W 18.031 ➜ 建议买入🔥 today: -1.58%  ',
    '[2025-02-25 10:00] [15RSI] 美团-W 17.314 ➜ 建议买入🔥 today: -1.39%  ',
    '[2025-02-25 10:15] [15RSI] 美团-W 13.801 ➜ 立即买入🚀 today: -0.38% ',
    '[2025-02-25 15:15] [15RSI] 美团-W 19.926 ➜ 建议买入🔥 today: +0.38%  ',
    '[2025-02-25 09:45] [15RSI] 小鹏汽车-W 16.029 ➜ 建议买入🔥 today: +6.89%  ',
    '[2025-02-25 09:45] [15RSI] 理想汽车-W 14.911 ➜ 立即买入🚀 today: +12.89% ',
    '[2025-02-25 15:45] [15RSI] 中芯国际 17.927 ➜ 建议买入🔥 today: +0.65%  ',
    '[2025-02-25 09:45] [15RSI] 华虹半导体 14.018 ➜ 立即买入🚀 today: -1.03% ',
    '[2025-02-25 14:45] [15RSI] 华虹半导体 19.197 ➜ 建议买入🔥 today: +0.39%  ',
    '[2025-02-25 15:00] [15RSI] 华虹半导体 18.633 ➜ 建议买入🔥 today: +0.65%  ',
    '[2025-02-25 15:45] [15RSI] 华虹半导体 19.937 ➜ 建议买入🔥 today: +0.77%  ',
    '[2025-02-25 09:45] [15RSI] 金山云 8.492 ➜ 立即买入🚀 today: +0.4% ',
    '[2025-02-25 10:00] [15RSI] 金山云 8.492 ➜ 立即买入🚀 today: +0.4% ',
    '[2025-02-25 10:15] [15RSI] 金山云 6.95 ➜ 立即买入🚀 today: +1.91% ',
    '[2025-02-25 09:45] [15RSI] 速腾聚创 19.869 ➜ 建议买入🔥 today: +6.35%  ',
    '[2025-02-25 09:45] [15RSI] 第四范式 14.358 ➜ 立即买入🚀 today: -3.74% ',
    '[2025-02-25 10:15] [15RSI] 第四范式 18.346 ➜ 建议买入🔥 today: -2.95%  ',
    '[2025-02-25 10:30] [15RSI] 第四范式 17.846 ➜ 建议买入🔥 today: -2.75%  ',
    '[2025-02-25 11:00] [15RSI] 第四范式 19.004 ➜ 建议买入🔥 today: -2.56%  ',
    '[2025-02-25 14:45] [15RSI] 第四范式 18.944 ➜ 建议买入🔥 today: -0.59%  ',
    '[2025-02-25 15:00] [15RSI] 第四范式 10.128 ➜ 立即买入🚀 today: +1.47% ',
    '[2025-02-25 15:15] [15RSI] 第四范式 16.768 ➜ 建议买入🔥 today: +1.18%  ',
    '[2025-02-25 09:45] [15RSI] 快手-W 16.79 ➜ 建议买入🔥 today: -0.09%  ',
    '[2025-02-25 09:45] [15RSI] 招商证券 16.658 ➜ 建议买入🔥 today: -2.34%  ',
    '[2025-02-25 10:00] [15RSI] 招商证券 15.988 ➜ 建议买入🔥 today: -2.2%  ',
    '[2025-02-25 10:15] [15RSI] 招商证券 12.395 ➜ 立即买入🚀 today: -1.38% ',
    '[2025-02-25 10:30] [15RSI] 招商证券 16.163 ➜ 建议买入🔥 today: -1.51%  ',
    '[2025-02-25 10:45] [15RSI] 招商证券 15.37 ➜ 建议买入🔥 today: -1.38%  ',
    '[2025-02-25 15:15] [15RSI] 招商证券 19.052 ➜ 建议买入🔥 today: -0.14%  ',
    '[2025-02-25 15:30] [15RSI] 招商证券 16.092 ➜ 建议买入🔥 today: +0.14%  ',
    '[2025-02-25 15:45] [15RSI] 招商证券 16.092 ➜ 建议买入🔥 today: +0.14%  ',
    '[2025-02-24 11:30] [15RSI] 微盟集团 17.898 ➜ 建议买入🔥 today: -0.69% next: -5.45% ',
    '[2025-02-24 11:45] [15RSI] 微盟集团 15.163 ➜ 建议买入🔥 today: +0.35% next: -4.36% ',
    '[2025-02-25 09:45] [15RSI] 微盟集团 13.452 ➜ 立即买入🚀 today: 0% ',
    '[2025-02-25 09:45] [15RSI] 哔哩哔哩-W 14.366 ➜ 立即买入🚀 today: -0.37% ',
    '[2025-02-24 15:30] [15RSI] 黑芝麻智能 18.677 ➜ 建议买入🔥 today: -0.6% next: -0.4% ',
    '[2025-02-24 15:45] [15RSI] 黑芝麻智能 13.566 ➜ 立即买入🚀 today: 0% next: +0.2%',
    '[2025-02-24 16:00] [15RSI] 黑芝麻智能 13.566 ➜ 立即买入🚀 today: 0% next: +0.2%',
    '[2025-02-25 09:45] [15RSI] 黑芝麻智能 3.374 ➜ 立即买入🚀 today: +4.8% '
  ]

   const sortByStockName = (list) => {
    const groupedProfits = list.reduce((acc, item) => {
        const stockName = item.split(' ')[3]; // Assuming stock name is the fourth element in the space-separated string
        const todayProfit = parseFloat(item.split('today: ')[1].split('%')[0]); // Extract today's profit from the string
        console.log("🚀 ~ groupedProfits ~ todayProfit:", todayProfit, 'stockName', stockName)
        if (!acc[stockName]) {
            acc[stockName] = { maxProfit: todayProfit, items: [item] };
        } else {
            if (todayProfit > 0 && todayProfit > acc[stockName].maxProfit) {
                acc[stockName].maxProfit = todayProfit;
            }
            acc[stockName].items.push(item);
        }

        return acc;
    }, {} );

    const sortedKeys = Object.keys(groupedProfits).sort((a, b) => {
        return groupedProfits[b].maxProfit - groupedProfits[a].maxProfit; // Sort by max profit
    });

    return sortedKeys.flatMap(key => {
        const items = groupedProfits[key].items;
        const maxProfit = groupedProfits[key].maxProfit;
        return items.map(item => {
            const todayProfit = parseFloat(item.split('today: ')[1].split('%')[0]); // Extract today's profit from the string
            // Add the max profit identifier only to the item with the max profit and positive value
            if (todayProfit === maxProfit && todayProfit > 0) {
                return item.replace('today', `[Max]`);
            }
            return item;
        });
    });
}

console.log('sortByStockName12', sortByStockName(test))

