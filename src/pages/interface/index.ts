import { Dayjs } from "dayjs";
import { EReqType, ERSISuggestion } from "../utils/config";

export enum EStockType {
  A = "A",
  HK = "HK",
  US = "US",
}

export enum EReqUrlType {
  "XUE_QIU" = "XUE_QIU",
  "DONG_FANG_CAI_FU" = "DONG_FANG_CAI_FU",
}

export const MarketType = {
  0: "sz",
  1: "sh",
  105: "us/", // 美股
  106: "us/", // 美股
  116: "hk/", // 港股
};

export enum EKLT {
  "5M" = 5,
  "15M" = 15,
  "30M" = 30,
  "60M" = 60,
  "DAY" = 101,
}

export const getEKLTDesc = (klt: EKLT) => {
  if (klt === EKLT["5M"]) {
    return "5RSI";
  } else if (klt === EKLT["15M"]) {
    return "15RSI";
  }else if (klt === EKLT["30M"]) {
    return "30RSI";
  }else if (klt === EKLT["60M"]) {
    return "60RSI";
  } else if (klt === EKLT.DAY) {
    return "DAYRSI";
  }
};

export interface IFetchUSRSIParams {
  klt: number;
  currentDate?: Dayjs;
  sendEmail?: boolean;
  isBacktesting?: boolean;
  reqType?: EReqType;
}

export interface IStockData {
  market?: number;
  code?: string;
  name?: string;
  decimal?: number;
  dktotal?: number;
  preKPrice?: number;
  klines?: string[];
}


export interface IPriceChangeData {
  priceChange: Record<string, string>;
  tradeDirection: Record<string, boolean>;
}

export interface IEmailListItem {
  time: string;
  indicator: string;
  name: string;
  rsiValue: number;
  suggestion: ERSISuggestion;
}

export interface IRequestFailureInfo {
  stockId: string | number;
  stockName?: string;
  requestType: string;
  errorType: string;
  errorMessage: string;
  batchIndex: number;
  timestamp: string;
}



export interface IEastmoneyApiResponse {
  data?: {
    data?: IStockData;
  };
}


export interface IKlineItem {
  date: string | Date;
  close: number;
  volume: number;
}

export interface IRSICalculationData {
  full_klines: IKlineItem[];
}