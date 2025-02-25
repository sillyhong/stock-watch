export const sortByStockName = (list) => {
  const groupedProfits = list.reduce((acc, item) => {
    const stockName = item.includes("</td><td>")
      ? item.split("</td><td>")[2]
      : item.split(" ")[3]; // Handle both formats
    const todayProfit = parseFloat(item.split("today: ")[1].split("%")[0]); // Extract today's profit from the string and convert to float
    if (!acc[stockName]) {
      acc[stockName] = { maxProfit: todayProfit, items: [item] };
    } else {
      if (todayProfit > acc[stockName].maxProfit) {
        acc[stockName].maxProfit = todayProfit;
      }
      acc[stockName].items.push(item);
    }
    return acc;
  }, {});

  const sortedKeys = Object.keys(groupedProfits).sort((a, b) => {
    return groupedProfits[b].maxProfit - groupedProfits[a].maxProfit; // Sort by max profit
  });

  return sortedKeys.flatMap((key) => {
    const items = groupedProfits[key].items;
    const maxProfit = groupedProfits[key].maxProfit;
    return items.map((item) => {
      const todayProfit = parseFloat(item.split("today: ")[1].split("%")[0]); // Extract today's profit from the string
      // Add the max profit identifier only to the item with the max profit and positive value
      if (todayProfit === maxProfit && todayProfit > 0) {
        return item.replace("today", `[Max]`);
      }
      return item;
    });
  });
};

export const normalSortByStockName = (list) => {
  return list.sort((a, b) => {
    const stockNameA = a.split("</td><td>")[2]; // Assuming stock name is in the third column
    const stockNameB = b.split("</td><td>")[2];
    return stockNameA.localeCompare(stockNameB);
  });
};

// Sort buyList: '立即买入🚀' should come first
export const sortListBySuggestion = (list, suggestion) => {
  return list.sort((a, b) => {
    if (a.includes(suggestion) && !b.includes(suggestion)) return -1;
    if (!a.includes(suggestion) && b.includes(suggestion)) return 1;
    return 0;
  });
};
