export const sortByStockName = (list) => {
    return list.sort((a, b) => {
      const stockNameA = a.split('</td><td>')[2]; // Assuming stock name is in the third column
      const stockNameB = b.split('</td><td>')[2];
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