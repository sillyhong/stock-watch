//@ts-nocheck

/**
 * 老版的指标算法
 */

import cloneDeep from 'lodash/cloneDeep'

export function GetConvert(type, bodys2, options = {}):any[][] {


    
    const bodys = cloneDeep(bodys2)

    if(type == 'SAR'){
        return SAR(bodys)
    }
    if(type == 'DMI'){
        return DMI(bodys)
    }
    if(type == 'VAVERAGE'){
        return VolumeMA(bodys)
    }
    if(type == 'MA'){
        return CloseMA(bodys)
    }
    if(type == 'MACD'){
        return countMACD(bodys)
    }

    const converts = Convert(bodys, options);
    

    const data = [];

    const len = converts.length;
    for (let i = 0; i < len; i++) {
        const entity = converts[i];
        let obj = {};
        switch (type) {
            case "VAVERAGE":
                var v5 = typeof (entity.volume5) == "undefined" ? "-" : entity.volume5.toFixed(3) / 1;
                var v10 = typeof (entity.volume10) == "undefined" ? "-" : entity.volume10.toFixed(3) / 1;
                obj = [entity.date, v5, v10];
                data.push(obj);
                break;
            case "MA":
                var a5 = typeof (entity.Average5) == "undefined" ? "-" : entity.Average5;
                var a10 = typeof (entity.Average10) == "undefined" ? "-" : entity.Average10;
                var a20 = typeof (entity.Average20) == "undefined" ? "-" : entity.Average20;
                var a30 = typeof (entity.Average30) == "undefined" ? "-" : entity.Average30;
                // var a60 = typeof (entity.Average60) == "undefined" ? "-" : entity.Average60.toFixed(3) / 1;
                obj = [entity.date, a5, a10, a20, a30];
                data.push(obj);
                break;
            case "FMA":
                var a5 = typeof (entity.Average5) == "undefined" ? "-" : entity.Average5.toFixed(3);
                var a10 = typeof (entity.Average10) == "undefined" ? "-" : entity.Average10.toFixed(3);
                var a20 = typeof (entity.Average20) == "undefined" ? "-" : entity.Average20.toFixed(3);
                var a30 = typeof (entity.Average30) == "undefined" ? "-" : entity.Average30.toFixed(3);
                var a3 = typeof (entity.Average3) == "undefined" ? "-" : entity.Average3.toFixed(3);
                var a6 = typeof (entity.Average6) == "undefined" ? "-" : entity.Average6.toFixed(3);
                var a12 = typeof (entity.Average12) == "undefined" ? "-" : entity.Average12.toFixed(3);
                var a24 = typeof (entity.Average24) == "undefined" ? "-" : entity.Average24.toFixed(3);
                var a50 = typeof (entity.Average50) == "undefined" ? "-" : entity.Average50.toFixed(3);
                var a60 = typeof (entity.Average60) == "undefined" ? "-" : entity.Average60.toFixed(3);
                // var str = entity.date + ",[" + a5 + "," + a10 + "," + a20 + "," + a30 + "," + a3 + "," + a6 + "," + a12 + "," + a24 + "," + a50 + "," + a60 + "]";
                obj[entity.date] = [a5, a10, a20, a30, a3, a6, a12, a24, a50, a60];
                data.push(obj);
                break;
            case "ASI":
                var asi = typeof (entity.ASI) == "undefined" ? "-" : entity.ASI.toFixed(3);
                obj[entity.date] = [asi];
                data.push(obj);
                break;
            case "EXPMA":
                var a12 = typeof (entity.expma12) == "undefined" ? "-" : entity.expma12;
                var a50 = typeof (entity.expma50) == "undefined" ? "-" : entity.expma50;
                // var a12 = typeof (entity.Average12) == "undefined" ? "-" : entity.Average12.toFixed(3);
                // var a50 = typeof (entity.Average50) == "undefined" ? "-" : entity.Average50.toFixed(3);
                obj = [entity.date, a12, a50];
                data.push(obj);
                break;
            case "SAR":
                // var sar = typeof (entity.SAR) == "undefined" ? "-" : entity.SAR.toFixed(3);
                var sar = typeof (entity.SAR) == "undefined" ? "-" : entity.SAR;
                obj = [entity.date, sar];
                data.push(obj);
                break;
            case "BBI":
                // var bbi = typeof (entity.BBI) == "undefined" ? "-" : entity.BBI.toFixed(3);
                var bbi = typeof (entity.BBI) == "undefined" ? "-" : entity.BBI;
                obj = [entity.date, bbi];
                data.push(obj);
                break;
            case "RSI":
                if(i > 22){
                    var rsia = entity.RSI_DN_A == 0 ? "-" : (entity.RSI_UP_A / entity.RSI_DN_A * 100).toFixed(3) / 1;
                    var rsib = entity.RSI_DN_B == 0 ? "-" : (entity.RSI_UP_B / entity.RSI_DN_B * 100).toFixed(3) / 1;
                    var rsic = entity.RSI_DN_C == "0" ? "-" : (entity.RSI_UP_C / entity.RSI_DN_C * 100).toFixed(3) / 1;
                    obj = [entity.date, rsia, rsib, rsic];
                }
                else if(i > 10){
                    var rsia = entity.RSI_DN_A == 0 ? "-" : (entity.RSI_UP_A / entity.RSI_DN_A * 100).toFixed(3) / 1;
                    var rsib = entity.RSI_DN_B == 0 ? "-" : (entity.RSI_UP_B / entity.RSI_DN_B * 100).toFixed(3) / 1;
                    var rsic = entity.RSI_DN_C == "0" ? "-" : (entity.RSI_UP_C / entity.RSI_DN_C * 100).toFixed(3) / 1;
                    obj = [entity.date, rsia, rsib, '-'];
                }
                else if (i > 4) {
                    var rsia = entity.RSI_DN_A == 0 ? "-" : (entity.RSI_UP_A / entity.RSI_DN_A * 100).toFixed(3) / 1;
                    var rsib = entity.RSI_DN_B == 0 ? "-" : (entity.RSI_UP_B / entity.RSI_DN_B * 100).toFixed(3) / 1;
                    var rsic = entity.RSI_DN_C == "0" ? "-" : (entity.RSI_UP_C / entity.RSI_DN_C * 100).toFixed(3) / 1;
                    obj = [entity.date, rsia, '-', '-'];
                }
                else if (i >= 0) {
                    var rsia = entity.RSI_DN_A == 0 ? "-" : (entity.RSI_UP_A / entity.RSI_DN_A * 100).toFixed(3) / 1;
                    var rsib = entity.RSI_DN_B == 0 ? "-" : (entity.RSI_UP_B / entity.RSI_DN_B * 100).toFixed(3) / 1;
                    var rsic = entity.RSI_DN_C == "0" ? "-" : (entity.RSI_UP_C / entity.RSI_DN_C * 100).toFixed(3) / 1;
                    obj = [entity.date, '-', '-', '-'];
                }                
                else {
                    obj = ["-", "-", "-", "-"];
                }
                data.push(obj);
                break;
            case "KDJ":
                var kdjk = typeof (entity.KDJ_K) == "undefined" ? "-" : entity.KDJ_K.toFixed(3) / 1;
                var kdjd = typeof (entity.KDJ_D) == "undefined" ? "-" : entity.KDJ_D.toFixed(3) / 1;
                var kdjj = typeof (entity.KDJ_J) == "undefined" ? "-" : entity.KDJ_J.toFixed(3) / 1;
                obj = [entity.date, kdjk, kdjd, kdjj];
                if(i > 1){
                  data.push(obj);
                }
                else{
                    data.push([entity.date, '-', '-', '-']);
                }
                break;
            case "MACD":
                var MACD_DIF = typeof (entity.MACD_DIF) == "undefined" ? "-" : entity.MACD_DIF.toFixed(3) / 1;
                var MACD_DEA = typeof (entity.MACD_DEA) == "undefined" ? "-" : entity.MACD_DEA.toFixed(3) / 1;

                var MACD = typeof (entity.MACD) == "undefined" ? "-" : entity.MACD.toFixed(3) / 1;
                if (MACD_DIF != "-" && MACD_DEA != "-") {
                    MACD = ((MACD_DIF - MACD_DEA) * 2).toFixed(3) / 1;
                }

                obj = [entity.date, MACD_DIF, MACD_DEA, MACD];
                data.push(obj);
                break;
            case "WR":
                var WR_A = typeof (entity.WR_A) == "undefined" ? "-" : entity.WR_A.toFixed(3) / 1;
                var WR_B = typeof (entity.WR_B) == "undefined" ? "-" : entity.WR_B.toFixed(3) / 1;
                obj = [entity.date, WR_A, WR_B];
                data.push(obj);
                break;
            case "DMI":
                var DMI_PDI = typeof (entity.DMI_PDI) == "undefined" ? "-" : entity.DMI_PDI.toFixed(3) / 1;
                var DMI_MDI = typeof (entity.DMI_MDI) == "undefined" ? "-" : entity.DMI_MDI.toFixed(3) / 1;
                var DMI_ADX = typeof (entity.DMI_ADX) == "undefined" ? "-" : entity.DMI_ADX.toFixed(3) / 1;
                var DMI_ADXR = typeof (entity.DMI_ADXR) == "undefined" ? "-" : entity.DMI_ADXR.toFixed(3) / 1;
                obj = [entity.date, DMI_PDI, DMI_MDI, DMI_ADX, DMI_ADXR];
                data.push(obj);
                break;
            case "BIAS":
                var BIAS_A = typeof (entity.BIAS_A) == "undefined" ? "-" : entity.BIAS_A.toFixed(3) / 1;
                var BIAS_B = typeof (entity.BIAS_B) == "undefined" ? "-" : entity.BIAS_B.toFixed(3) / 1;
                var BIAS_C = typeof (entity.BIAS_C) == "undefined" ? "-" : entity.BIAS_C.toFixed(3) / 1;
                obj = [entity.date, BIAS_A, BIAS_B, BIAS_C];
                data.push(obj);
                break;
            case "OBV":
                var OBV = typeof (entity.OBV) == "undefined" ? "-" : entity.OBV.toFixed(3) / 1;
                var OBV_MA = typeof (entity.OBV_MA) == "undefined" ? "-" : entity.OBV_MA.toFixed(3) / 1;
                obj = [entity.date, OBV, OBV_MA];
                data.push(obj);
                break;
            case "CCI":
                var CCI = typeof (entity.CCI) == "undefined" ? "-" : entity.CCI.toFixed(3) / 1;
                obj = [entity.date, CCI];
                data.push(obj);
                break;
            case "ROC":
                var ROC = typeof (entity.ROC) == "undefined" ? "-" : entity.ROC.toFixed(3) / 1;
                var ROC_MA = typeof (entity.ROC_MA) == "undefined" || isNaN(entity.ROC_MA) ? "-" : entity.ROC_MA.toFixed(3) / 1;
                obj = [entity.date, ROC, ROC_MA];
                data.push(obj);
                break;
            case "CR":
                var CR_A = typeof (entity.CR_A) == "undefined" ? "-" : entity.CR_A.toFixed(3) / 1;
                var CR_B = typeof (entity.CR_B) == "undefined" ? "-" : entity.CR_B.toFixed(3) / 1;
                var CR_C = typeof (entity.CR_C) == "undefined" ? "-" : entity.CR_C.toFixed(3) / 1;
                var CR = typeof (entity.CR) == "undefined" ? "-" : entity.CR.toFixed(3) / 1;
                obj = [entity.date, CR_A, CR_B, CR_C, CR];
                data.push(obj);
                break;
            case "BOLL":
                var BOLL = typeof (entity.BOLL) == "undefined" ? "-" : entity.BOLL.toFixed(3) / 1;
                var BOLL_UPPER = typeof (entity.BOLL_UPPER) == "undefined" ? "-" : entity.BOLL_UPPER.toFixed(3) / 1;
                var BOLL_LOWER = typeof (entity.BOLL_LOWER) == "undefined" ? "-" : entity.BOLL_LOWER.toFixed(3) / 1;
                // var high = typeof (entity.high) == "undefined" ? "-" : entity.high.toFixed(3) / 1;
                // obj = [entity.date, BOLL, BOLL_UPPER, BOLL_LOWER, high];
                obj = [entity.date, BOLL, BOLL_UPPER, BOLL_LOWER];
                data.push(obj);
                break;
        }
    }
    return data;
}
function Convert(bodys, options = {}) {
    if ((bodys == null) || (bodys.length == 0)) {
        console.log("历史行情数据不能为空", options);
    }
    const entities = bodys;
    const len = bodys.length;

    let RSI_UP, RSI_DN;
    for (let i = 0; i < len; i++) {
        if (i > 0) {
            RSI_UP = Math.max(entities[i].close - entities[i - 1].close, 0);
            RSI_DN = Math.abs(entities[i].close - entities[i - 1].close);
            if (i == 1) {
                entities[i].RSI_UP_A = RSI_UP;
                entities[i].RSI_DN_A = RSI_DN;
                entities[i].RSI_UP_B = RSI_UP;
                entities[i].RSI_DN_B = RSI_DN;
                entities[i].RSI_UP_C = RSI_UP;
                entities[i].RSI_DN_C = RSI_DN;
            }
            else {
                entities[i].RSI_UP_A = RSI_UP + entities[i - 1].RSI_UP_A * (6 - 1) / 6;
                entities[i].RSI_DN_A = RSI_DN + entities[i - 1].RSI_DN_A * (6 - 1) / 6;
                entities[i].RSI_UP_B = RSI_UP + entities[i - 1].RSI_UP_B * (12 - 1) / 12;
                entities[i].RSI_DN_B = RSI_DN + entities[i - 1].RSI_DN_B * (12 - 1) / 12;
                entities[i].RSI_UP_C = RSI_UP + entities[i - 1].RSI_UP_C * (24 - 1) / 24;
                entities[i].RSI_DN_C = RSI_DN + entities[i - 1].RSI_DN_C * (24 - 1) / 24;
            }
        }
    }
    return entities;
}