export interface IFutuStockInfo {
    stockId: string,
    name: string,
    stockCode: string,
    quoteToken: string
}

export interface IFutuApiResponse {
    data?: {
      stockId?: string;
      list?: Array<{
        time: number;
        open: number;
        cc_price: number;
        high: number;
        low: number;
        volume: number;
        turnover: number;
        amplitude: number;
        change: number;
        ratio: number;
        turnoverRate: number;
      }>;
    };
  }