import cloneDeep from "lodash/cloneDeep";
import { numberFixedCut } from "../index";

/**
 * 计算MACD指标
 * @param data
 * @returns
 */
export function countMACD(
  data: Array<{
    date: string;
    close: number;
  }>
) {
  const list = cloneDeep(data) as Array<any>;

  list.forEach((v: any, i) => {
    if (i == 0) {
      v.MACD_AX = v.close
      v.MACD_BX = v.close
      v.MACD_DIF = 0
      v.MACD_DEA = 0
    } else {
      v.MACD_AX = (2 * v.close + 11 * list[i - 1].MACD_AX) / 13
      v.MACD_BX = (2 * v.close + 25 * list[i - 1].MACD_BX) / 27
      v.MACD_DIF = v.MACD_AX - v.MACD_BX
      v.MACD_DEA = (2 * v.MACD_DIF + 8 * list[i - 1].MACD_DEA) / 10
    }

    v.MACD = "-"
    if (v.MACD_DIF != "-" && v.MACD_DEA != "-") {
      v.MACD = (v.MACD_DIF - v.MACD_DEA) * 2
    }
  })

  return list.map((v) => {
    return [
      v.date,
      numberFixedCut(v.MACD_DIF, 3),
      numberFixedCut(v.MACD_DEA, 3),
      numberFixedCut(v.MACD, 3),
    ]
  })
}
