//@ts-nocheck

/**
 * 老版的指标算法
 */

const { SAR }  = require('../modules/tools/indicator/sar');
const { DMI } = require('../modules/tools/indicator/dmi');
const { VolumeMA } = require('../modules/tools/indicator/volume_ma');
const { CloseMA } = require('../modules/tools/indicator/ma');
const { countMACD } = require('../modules/tools/indicator/macd');
const cloneDeep = require('lodash/cloneDeep');


 function GetConvert(type, bodys2) {

    
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

    const converts = Convert(bodys);
    

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


let SAR_BULL = true;
let SAR_FIRSTDAY = true;
let SAR_AF = 0.02;
let SAR_LOW = 0;
let SAR_HIGH = 0;
function Convert(bodys) {
    if ((bodys == null) || (bodys.length == 0)) {
        console.log("历史行情数据不能为空");
        return bodys
    }
    const entities = bodys;
    const len = bodys.length;
    // for (var i = 0; i < len; i++) {
    //     var line = bodys[i].split(",");

    //     var cus = GetEntity();
    //     cus.date = line[0];
    //     cus.open = parseFloat(line[1]);
    //     cus.close = parseFloat(line[2]);
    //     cus.high = parseFloat(line[3]);
    //     cus.low = parseFloat(line[4]);
    //     cus.volume = Number(line[5]);
    //     entities.push(cus);
    // }

    // console.info(entities)
    


    let sum, v5sum, v10sum;
    let LC, AA, BB, CC, DD, R, X;
    let BOLL_MD;
    let CCI_MA, CCI_TYP_MA;
    let CR_AX_SUM, CR_BX_SUM;
    let HD, LD, DMI_TR_SUM, DMI_DMP_SUM, DMI_DMM_SUM, DMI_ADX_SUM, DMI_ADXR_SUM;
    let LLV, HHV;
    let OBV_SUM;
    let ROC_N;
    let RSI_UP, RSI_DN;
    let TH, TL, TQ;
    const SAR_BULL = true;
    let SAR_FIRSTDAY = true;
    let SAR_AF = 0.02;
    let SAR_low = 0;
    let SAR_high = 0;
    let VR_SUM;
    for (let i = 0; i < len; i++) {

        if (i >= 4) {
            sum = 0;
            v5sum = 0;
            for (var j = 0; j < 5; j++) {
                sum += entities[i - j].close;
                v5sum += entities[i - j].volume;
            }
            entities[i].Average5 = sum / 5;
            entities[i].volume5 = v5sum / 5;
        }
        if (i >= 9) {
            sum = 0;
            v5sum = 0;
            for (var j = 0; j < 10; j++) {
                sum += entities[i - j].close;
                v5sum += entities[i - j].volume;
            }
            entities[i].Average10 = sum / 10;
            entities[i].volume10 = v5sum / 10;
        }
        if (i >= 19) {
            sum = 0;
            for (var j = 0; j < 20; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average20 = sum / 20;
        }
        if (i >= 29) {
            sum = 0;
            for (var j = 0; j < 30; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average30 = sum / 30;
        }
        if (i >= 2) {
            sum = 0;
            for (var j = 0; j < 3; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average3 = sum / 3;
        }
        if (i >= 5) {
            sum = 0;
            for (var j = 0; j < 6; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average6 = sum / 6;
        }
        if (i >= 11) {
            sum = 0;
            for (var j = 0; j < 12; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average12 = sum / 12;
        }
        if (i >= 23) {
            sum = 0;
            for (var j = 0; j < 24; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average24 = sum / 24;
        }
        if (i >= 49) {
            sum = 0;
            for (var j = 0; j < 50; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average50 = sum / 50;
        }
        if (i >= 59) {
            sum = 0;
            for (var j = 0; j < 60; j++) {
                sum += entities[i - j].close;
            }
            entities[i].Average60 = sum / 60;
        }

        if (i >= 1) {
            LC = entities[i - 1].close;
            AA = Math.abs(entities[i].high - LC);
            BB = Math.abs(entities[i].low - LC);
            CC = Math.abs(entities[i].high - entities[i - 1].low);
            DD = Math.abs(LC - entities[i - 1].open);
            if ((AA > BB) && (AA > CC)) {
                R = AA + BB / 2 + DD / 4;
            }
            else if ((BB > CC) && (BB > AA)) {
                R = BB + AA / 2 + DD / 4;
            }
            else {
                R = CC + DD / 4;
            }
            X = entities[i].close + (entities[i].close - entities[i].open) / 2 - entities[i - 1].open;
            if (R != 0) {
                entities[i].ASI = entities[i - 1].ASI + 16 * X / R * Math.max(AA, BB);
            }
        }

        if (i >= 5) {
            sum = 0;
            for (var j = 0; j < 6; j++) {
                sum += entities[i - j].close;
            }
            if (sum != 0) {
                entities[i].BIAS_A = (entities[i].close / (sum / 6) - 1) * 100;
            }
        }
        if (i >= 11) {
            sum = 0;
            for (var j = 0; j < 12; j++) {
                sum += entities[i - j].close;
            }
            if (sum != 0) {
                entities[i].BIAS_B = (entities[i].close / (sum / 12) - 1) * 100;
            }
        }
        if (i >= 23) {
            sum = 0;
            for (var j = 0; j < 24; j++) {
                sum += entities[i - j].close;
            }
            if (sum != 0) {
                entities[i].BIAS_C = (entities[i].close / (sum / 24) - 1) * 100;
            }
        }

        // old BOLL        
        if (i >= 19) {
            sum = 0;
            for (var j = 0; j < 20; j++) {
                sum += entities[i - j].close;
            }
            entities[i].BOLL = sum / 20;
            sum = 0;
            for (var j = 0; j < 20; j++) {
                sum += Math.pow(entities[i - j].close - entities[i].BOLL,2) //(entities[i - j].close - entities[i].BOLL) * (entities[i - j].close - entities[i].BOLL);
            }
            BOLL_MD = Math.sqrt(sum / 20)
            // console.info(BOLL_MD)
            
            
            entities[i].BOLL_UPPER = entities[i].BOLL + BOLL_MD * 2;
            entities[i].BOLL_LOWER = entities[i].BOLL - BOLL_MD * 2;
        }


        entities[i].CCI_TYP = (entities[i].high + entities[i].low + entities[i].close) / 3;
        if (i >= 13) {
            sum = 0;
            for (var j = 0; j < 14; j++) {
                sum += entities[i - j].close;
            }
            CCI_MA = sum / 14;
            sum = 0;
            for (var j = 0; j < 14; j++) {
                sum += entities[i - j].CCI_TYP;
            }
            CCI_TYP_MA = sum / 14;
            sum = 0;
            for (var j = 0; j < 14; j++) {
                sum += Math.abs(entities[i - j].CCI_TYP - CCI_TYP_MA);
            }
            if (sum != 0) {
                // console.info(entities[i].CCI_TYP, CCI_TYP_MA, sum)
                
                entities[i].CCI = (entities[i].CCI_TYP - CCI_TYP_MA) / (0.015 * (sum / 14));
            }
        }

        //EXPMA
        const pre_expma12 = i == 0 ? entities[i].close : entities[i - 1].expma12
        entities[i].expma12 = [entities[i].close*2+pre_expma12*(12-1)]/(12+1)

        const pre_expma50 = i == 0 ? entities[i].close : entities[i - 1].expma50
        entities[i].expma50 = [entities[i].close*2+pre_expma50*(50-1)]/(50+1)        

        
        // old CR
        // entities[i].CR_MID = (entities[i].high + entities[i].low) / 2;
        // if (i == 0) {
        //     entities[i].CR = 100;
        //     entities[i].CR_AX = Math.max(entities[i].high - entities[i].CR_MID, 0);
        //     entities[i].CR_BX = Math.max(entities[i].CR_MID - entities[i].low, 0);
        // }
        // else {
        //     entities[i].CR_AX = Math.max(entities[i].high - entities[i - 1].CR_MID, 0);
        //     entities[i].CR_BX = Math.max(entities[i - 1].CR_MID - entities[i].low, 0);
        //     CR_AX_SUM = CR_BX_SUM = 0;
        //     for (var j = 0; j < 26 && j < i + 1; j++) {
        //         CR_AX_SUM += entities[i - j].CR_AX;
        //         CR_BX_SUM += entities[i - j].CR_BX;
        //     }
        //     if (CR_BX_SUM != 0) {
        //         entities[i].CR = CR_AX_SUM / CR_BX_SUM * 100;
        //     }
        //     if (i >= 9) {
        //         sum = 0;
        //         for (var j = 0; j < 10; j++) {
        //             sum += entities[i - j].CR;
        //         }
        //         if (i + 5 < entities.length) {   
        //             entities[i + 5].CR_A = sum / 10;
        //         }
        //     }
        //     if (i >= 19) {
        //         sum = 0;
        //         for (var j = 0; j < 20; j++) {
        //             sum += entities[i - j].CR;
        //         }
        //         if (i + 9 < entities.length) {
        //             entities[i + 9].CR_B = sum / 20;
        //         }
        //     }
        //     if (i >= 39) {
        //         sum = 0;
        //         for (var j = 0; j < 40; j++) {
        //             sum += entities[i - j].CR;
        //         }
        //         if (i + 17 < entities.length) {
        //             entities[i + 17].CR_C = sum / 40;
        //         }
        //     }
        // }


        entities[i].CR_MID = (entities[i].high + entities[i].low) / 2;
        if (i == 0) {
            // entities[i].CR = 100;
            entities[i].CR_AX = 0;
            entities[i].CR_BX = 0;
        }
        if(i > 0) {
            entities[i].CR_AX = Math.max(entities[i].high - entities[i - 1].CR_MID, 0);
            entities[i].CR_BX = Math.max(entities[i - 1].CR_MID - entities[i].low, 0);
            CR_AX_SUM = CR_BX_SUM = 0;
            for (var j = 0; j < 26 && j < i + 1; j++) {
                CR_AX_SUM += entities[i - j].CR_AX;
                CR_BX_SUM += entities[i - j].CR_BX;
            }
            if (CR_BX_SUM != 0) {
                entities[i].CR = CR_AX_SUM / CR_BX_SUM * 100;
            }
            if (i >= 9) {
                sum = 0;
                for (var j = 0; j < 10; j++) {
                    sum += entities[i - j].CR;
                }
                if (i + 5 < entities.length) {   
                    entities[i + 5].CR_A = sum / 10;
                }
            }
            if (i >= 19) {
                sum = 0;
                for (var j = 0; j < 20; j++) {
                    sum += entities[i - j].CR;
                }
                if (i + 9 < entities.length) {
                    entities[i + 9].CR_B = sum / 20;
                }
            }
            if (i >= 39) {
                sum = 0;
                for (var j = 0; j < 40; j++) {
                    sum += entities[i - j].CR;
                }
                if (i + 17 < entities.length) {
                    entities[i + 17].CR_C = sum / 40;
                }
            }
        }



        if (i == 0) {
            entities[i].DMI_TR = Math.max(Math.max(entities[i].high - entities[i].low, Math.abs(entities[i].high - entities[i].close)), Math.abs(entities[i].close - entities[i].low));
            HD = 0;
            LD = 0;
        }
        else {
            entities[i].DMI_TR = Math.max(Math.max(entities[i].high - entities[i].low, Math.abs(entities[i].high - entities[i - 1].close)), Math.abs(entities[i - 1].close - entities[i].low));
            HD = entities[i].high - entities[i - 1].high;
            LD = entities[i - 1].low - entities[i].low;
        }
        if ((HD > 0) && (HD > LD)) {
            entities[i].DMI_DMP = HD;
        }
        else {
            entities[i].DMI_DMP = 0;
        }
        if ((LD > 0) && (LD > HD)) {
            entities[i].DMI_DMM = LD;
        }
        else {
            entities[i].DMI_DMM = 0;
        }
        if (i >= 13) {
            if (i == 13) {
                DMI_TR_SUM = DMI_DMP_SUM = DMI_DMM_SUM = 0;
                for (var j = 0; j < 14; j++) {
                    DMI_TR_SUM += entities[i - j].DMI_TR;
                    DMI_DMP_SUM += entities[i - j].DMI_DMP;
                    DMI_DMM_SUM += entities[i - j].DMI_DMM;
                }
                entities[i].DMI_EXPMEMA_TR = DMI_TR_SUM / 14;
                entities[i].DMI_EXPMEMA_DMP = DMI_DMP_SUM / 14;
                entities[i].DMI_EXPMEMA_DMM = DMI_DMM_SUM / 14;
            }
            else {
                entities[i].DMI_EXPMEMA_TR = (entities[i].DMI_TR * 2 + 13 * entities[i - 1].DMI_EXPMEMA_TR) / 15;
                entities[i].DMI_EXPMEMA_DMP = (entities[i].DMI_DMP * 2 + 13 * entities[i - 1].DMI_EXPMEMA_DMP) / 15;
                entities[i].DMI_EXPMEMA_DMM = (entities[i].DMI_DMM * 2 + 13 * entities[i - 1].DMI_EXPMEMA_DMM) / 15;
            }
            if (entities[i].DMI_EXPMEMA_TR != 0) {
                entities[i].DMI_PDI = entities[i].DMI_EXPMEMA_DMP * 100 / entities[i].DMI_EXPMEMA_TR;
                entities[i].DMI_MDI = entities[i].DMI_EXPMEMA_DMM * 100 / entities[i].DMI_EXPMEMA_TR;
                if (entities[i].DMI_PDI + entities[i].DMI_MDI != 0) {
                    entities[i].DMI_MPDI = Math.abs(entities[i].DMI_MDI - entities[i].DMI_PDI) / (entities[i].DMI_MDI + entities[i].DMI_PDI) * 100;
                }
            }
        }
        if (i >= 18) {
            if (i == 18) {
                DMI_ADX_SUM = 0;
                for (var j = 0; j < 6; j++) {
                    DMI_ADX_SUM += entities[i - j].DMI_MPDI;
                }
                entities[i].DMI_ADX = DMI_ADX_SUM / 6;
            }
            else {
                entities[i].DMI_ADX = (entities[i].DMI_MPDI * 2 + 5 * entities[i - 1].DMI_ADX) / 7;
            }
        }
        if (i >= 23) {
            if (i == 23) {
                DMI_ADXR_SUM = 0;
                for (var j = 0; j < 6; j++) {
                    DMI_ADXR_SUM += entities[i - j].DMI_ADX;
                }
                entities[i].DMI_ADXR = DMI_ADXR_SUM / 6;
            }
            else {
                entities[i].DMI_ADXR = (entities[i].DMI_ADX * 2 + 5 * entities[i - 1].DMI_ADXR) / 7;
            }
        }

        LLV = entities[i].low;
        HHV = entities[i].high;
        for (var j = 0; j < 9 && j < i + 1; j++) {
            if (HHV < entities[i - j].high) {
                HHV = entities[i - j].high;
            }
            if (LLV > entities[i - j].low) {
                LLV = entities[i - j].low;
            }
        }
        if (HHV != LLV) {
            entities[i].KDJ_RSV = (entities[i].close - LLV) / (HHV - LLV) * 100;
        }
        else{
            entities[i].KDJ_RSV = 50
        }
        if (i == 0) {
            entities[i].KDJ_K = entities[i].KDJ_RSV;
            entities[i].KDJ_D = entities[i].KDJ_RSV;
            entities[i].KDJ_J = entities[i].KDJ_RSV;
        }
        else {
            entities[i].KDJ_K = (entities[i].KDJ_RSV / 3) + ((entities[i - 1].KDJ_K * 2) / 3);
            entities[i].KDJ_D = (entities[i].KDJ_K / 3) + ((entities[i - 1].KDJ_D * 2) / 3);
            entities[i].KDJ_J = (entities[i].KDJ_K * 3) - (entities[i].KDJ_D * 2);
        }

        if (i == 0) {
            entities[i].MACD_AX = entities[i].close;
            entities[i].MACD_BX = entities[i].close;
            entities[i].MACD_DIF = 0;
            entities[i].MACD_DEA = 0;
        }
        else {
            entities[i].MACD_AX = (2 * entities[i].close + 11 * entities[i - 1].MACD_AX) / 13;
            entities[i].MACD_BX = (2 * entities[i].close + 25 * entities[i - 1].MACD_BX) / 27;
            entities[i].MACD_DIF = entities[i].MACD_AX - entities[i].MACD_BX;
            entities[i].MACD_DEA = (2 * entities[i].MACD_DIF + 8 * entities[i - 1].MACD_DEA) / 10;
        }
        
        // old OBV
        // if (i > 0) {
        //     // console.info(entities[i])
        //     var preOBV = entities[i - 1].OBV
        //     if(preOBV == undefined) preOBV = 0
        //     // console.info(preOBV)
            
        //     if (entities[i].close > entities[i - 1].close) {
        //         entities[i].OBV = preOBV + entities[i].volume;
        //     }
        //     else if (entities[i].close < entities[i - 1].close) {
        //         entities[i].OBV = preOBV - entities[i].volume;
        //     }
        //     else {
        //         entities[i].OBV = preOBV;
        //     }
        //     if (i >= 29) {
        //         OBV_SUM = 0;
        //         for (var j = 0; j < 30; j++) {
        //             OBV_SUM += entities[i - j].OBV;
        //         }
        //         entities[i].OBV_MA = OBV_SUM / 30;
        //     }
        // }

        if (i >= 0) {
            // console.info(entities[i])
            let preOBV = i == 0 ? 0 : entities[i - 1].OBV
            if(preOBV == undefined) preOBV = 0
            // console.info(preOBV)

            if(i == 0){
                entities[i].OBV = preOBV - entities[i].volume;
            }
            else{
                if (entities[i].close > entities[i].pre_close) {
                    entities[i].OBV = preOBV + entities[i].volume;
                }
                else if (entities[i].close < entities[i].pre_close) {
                    entities[i].OBV = preOBV - entities[i].volume;
                }
                else {
                    entities[i].OBV = preOBV;
                }                
            }
            

            if (i >= 29) {
                OBV_SUM = 0;
                for (var j = 0; j < 30; j++) {
                    OBV_SUM += entities[i - j].OBV;
                }
                entities[i].OBV_MA = OBV_SUM / 30;
            }
        }
        
        // old ROC
        // ROC_N = Math.min(11, i);
        // if (entities[i - ROC_N].close != 0) {
        //     entities[i].ROC = 100 * (entities[i].close / entities[i - ROC_N].close - 1);
        // }
        // if (i >= 5) {
        //     sum = 0;
        //     for (var j = 0; j < 6; j++) {
        //         sum += entities[i - j].ROC;
        //     }
        //     entities[i].ROC_MA = sum / 6;
        // }

        ROC_N = Math.min(11, i);
        if( i > 11){
            entities[i].ROC = 100 * (entities[i].close / entities[i - 12].close - 1);
        }
        // if (entities[i - ROC_N].close != 0) {
            
        // }
        if (i >= 5) {
            sum = 0;
            for (var j = 0; j < 6; j++) {
                sum += entities[i - j].ROC;
            }
            entities[i].ROC_MA = sum / 6;
        }

        
        // RSI老的
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

        //RSI new
        // if (i > 0) {
        //     RSI_UP = Math.max(entities[i].zde, 0);
        //     RSI_DN = Math.abs(entities[i].zde);
        //     if (i == 1) {
        //         entities[i].RSI_UP_A = RSI_UP;
        //         entities[i].RSI_DN_A = RSI_DN;
        //         entities[i].RSI_UP_B = RSI_UP;
        //         entities[i].RSI_DN_B = RSI_DN;
        //         entities[i].RSI_UP_C = RSI_UP;
        //         entities[i].RSI_DN_C = RSI_DN;
        //     }
        //     else {
        //         entities[i].RSI_UP_A = RSI_UP / 6 + entities[i - 1].RSI_UP_A * (6 - 1) / 6;
        //         entities[i].RSI_DN_A = RSI_DN / 6 + entities[i - 1].RSI_DN_A * (6 - 1) / 6;
        //         entities[i].RSI_UP_B = RSI_UP / 12 + entities[i - 1].RSI_UP_B * (12 - 1) / 12;
        //         entities[i].RSI_DN_B = RSI_DN / 12 + entities[i - 1].RSI_DN_B * (12 - 1) / 12;
        //         entities[i].RSI_UP_C = RSI_UP / 24 + entities[i - 1].RSI_UP_C * (24 - 1) / 24;
        //         entities[i].RSI_DN_C = RSI_DN / 24 + entities[i - 1].RSI_DN_C * (24 - 1) / 24;
        //     }
            
        // }  

        // if (i > 0) {
        //     RSI_UP = Math.max(entities[i].zde, 0);
        //     RSI_DN = Math.abs(entities[i].zde);
        //     if (i == 1) {
        //         entities[i].RSI_UP_A = 0;
        //         entities[i].RSI_DN_A = RSI_DN;
        //         entities[i].RSI_UP_B = 0;
        //         entities[i].RSI_DN_B = RSI_DN;
        //         entities[i].RSI_UP_C = 0;
        //         entities[i].RSI_DN_C = RSI_DN;
        //     }
        //     else {
        //         entities[i].RSI_UP_A = RSI_UP / 6 + entities[i - 1].RSI_UP_A * (6 - 1) / 6;
        //         entities[i].RSI_DN_A = RSI_DN / 6 + entities[i - 1].RSI_DN_A * (6 - 1) / 6;
        //         entities[i].RSI_UP_B = RSI_UP / 12 + entities[i - 1].RSI_UP_B * (12 - 1) / 12;
        //         entities[i].RSI_DN_B = RSI_DN / 12 + entities[i - 1].RSI_DN_B * (12 - 1) / 12;
        //         entities[i].RSI_UP_C = RSI_UP / 24 + entities[i - 1].RSI_UP_C * (24 - 1) / 24;
        //         entities[i].RSI_DN_C = RSI_DN / 24 + entities[i - 1].RSI_DN_C * (24 - 1) / 24;
        //     }
            
        // }  

        // console.info(111)
        
        // if (i > 0) {
        //     RSI_UP = Math.max(entities[i].zde, 0);
        //     RSI_DN = Math.abs(entities[i].zde);
        //     if (i == 1) {
        //         entities[i].RSI_UP_A = RSI_UP;
        //         entities[i].RSI_DN_A = RSI_DN;
        //         // entities[i].RSI_UP_B = RSI_UP;
        //         // entities[i].RSI_DN_B = RSI_DN;
        //         // entities[i].RSI_UP_C = RSI_UP;
        //         // entities[i].RSI_DN_C = RSI_DN;
        //     }
        //     // else if(i > 5)
        //     else if(i < 6){
        //         entities[i].RSI_UP_A = RSI_UP + entities[i - 1].RSI_UP_A;
        //         entities[i].RSI_DN_A = RSI_DN + entities[i - 1].RSI_DN_A;                
        //     }
        //     // else if( i == 5){
        //     //     entities[i].RSI_UP_A = RSI_UP;
        //     //     entities[i].RSI_DN_A = RSI_DN;                    
        //     // }
        //     else {
        //         entities[i].RSI_UP_A = RSI_UP + entities[i - 1].RSI_UP_A * (6 - 1) / 6;
        //         entities[i].RSI_DN_A = RSI_DN + entities[i - 1].RSI_DN_A * (6 - 1) / 6;
        //         // entities[i].RSI_UP_B = RSI_UP + entities[i - 1].RSI_UP_B * (12 - 1) / 12;
        //         // entities[i].RSI_DN_B = RSI_DN + entities[i - 1].RSI_DN_B * (12 - 1) / 12;
        //         // entities[i].RSI_UP_C = RSI_UP + entities[i - 1].RSI_UP_C * (24 - 1) / 24;
        //         // entities[i].RSI_DN_C = RSI_DN + entities[i - 1].RSI_DN_C * (24 - 1) / 24;
        //     }
        // }               

        if (i == 3) {
            if (SAR_FIRSTDAY) {
                if (SAR_BULL) {
                    SAR_high = entities[i].high;
                    for (var j = 0; j < 4; j++) {
                        if (SAR_high < entities[i - j].high) {
                            SAR_high = entities[i - j].high;
                        }
                    }
                    SAR_low = entities[i].low;
                    for (var j = 0; j < 4; j++) {
                        if (SAR_low > entities[i - j].low) {
                            SAR_low = entities[i - j].low;
                        }
                    }
                    entities[i].SAR = SAR_low;
                    entities[i].SAR_RED = true;
                    SAR_AF = 0.02;
                }
                else {
                    SAR_high = entities[i].high;
                    for (var j = 0; j < 4; j++) {
                        if (SAR_high < entities[i - j].high) {
                            SAR_high = entities[i - j].high;
                        }
                    }
                    SAR_low = entities[i].low;
                    for (var j = 0; j < 4; j++) {
                        if (SAR_low > entities[i - j].low) {
                            SAR_low = entities[i - j].low;
                        }
                    }
                    entities[i].SAR = SAR_high;
                    entities[i].SAR_RED = false;
                    SAR_AF = 0.02;
                }
                SAR_FIRSTDAY = false;
            }
        }
        else if (i > 3) {
            sar(i, entities);
        }

        TH = TL = TQ = 0;
        for (var j = 0; j < 26 && j < i + 1; j++) {
            if (i >= j + 1) {
                if (entities[i - j].close > entities[i - j - 1].close) {
                    TH += entities[i - j].volume;
                }
                else if (entities[i - j].close < entities[i - j - 1].close) {
                    TL += entities[i - j].volume;
                }
                else {
                    TQ += entities[i - j].volume;
                }
            }
            else {
                TH += entities[i - j].volume / 3;
                TL += entities[i - j].volume / 3;
                TQ += entities[i - j].volume / 3;
            }
        }
        if (TL * 2 + TQ != 0) {
            entities[i].VR = 100 * (TH * 2 + TQ) / (TL * 2 + TQ);
        }
        if (i >= 5) {
            VR_SUM = 0;
            for (var j = 0; j < 6; j++) {
                VR_SUM += entities[i - j].VR;
            }
            entities[i].VR_MA = VR_SUM / 6;
        }

        LLV = entities[i].low;
        HHV = entities[i].high;
        for (var j = 0; j < 10 && j < i + 1; j++) {
            if (HHV < entities[i - j].high) {
                HHV = entities[i - j].high;
            }
            if (LLV > entities[i - j].low) {
                LLV = entities[i - j].low;
            }
        }
        if (HHV != LLV) {
            entities[i].WR_A = 100 * (HHV - entities[i].close) / (HHV - LLV);
        }
        LLV = entities[i].low;
        HHV = entities[i].high;
        for (var j = 0; j < 6 && j < i + 1; j++) {
            if (HHV < entities[i - j].high) {
                HHV = entities[i - j].high;
            }
            if (LLV > entities[i - j].low) {
                LLV = entities[i - j].low;
            }
        }
        if (HHV != LLV) {
            entities[i].WR_B = 100 * (HHV - entities[i].close) / (HHV - LLV);
        }

        if (i >= 23) {
            entities[i].BBI = (entities[i].Average3 + entities[i].Average6 + entities[i].Average12 + entities[i].Average24) / 4;
        }

    }
    return entities;
}
function sar(i, entities) {

    if (SAR_FIRSTDAY) {
        if (SAR_BULL) {
            SAR_HIGH = entities[i].high;
            for (var j = 0; j < 2; j++) {
                if (SAR_HIGH < entities[i - j].high) {
                    SAR_HIGH = entities[i - j].high;
                }
            }
            SAR_LOW = entities[i].low;
            for (var j = 0; j < 2; j++) {
                if (SAR_LOW > entities[i - j].low) {
                    SAR_LOW = entities[i - j].low;
                }
            }
            entities[i].SAR = SAR_LOW;
            entities[i].SAR_RED = true;
            SAR_AF = 0.02;
        }
        else {
            SAR_HIGH = entities[i].high;
            for (var j = 0; j < 2; j++) {
                if (SAR_HIGH < entities[i - j].high) {
                    SAR_HIGH = entities[i - j].high;
                }
            }
            SAR_LOW = entities[i].low;
            for (var j = 0; j < 2; j++) {
                if (SAR_LOW > entities[i - j].low) {
                    SAR_LOW = entities[i - j].low;
                }
            }
            entities[i].SAR = SAR_HIGH;
            entities[i].SAR_RED = false;
            SAR_AF = 0.02;
        }
        SAR_FIRSTDAY = false;
    }
    else {
        if (SAR_BULL) {
            entities[i].SAR = entities[i - 1].SAR + SAR_AF * (SAR_HIGH - entities[i - 1].SAR);
            entities[i].SAR_RED = true;
            if (entities[i].high > SAR_HIGH) {
                SAR_HIGH = entities[i].high;
                SAR_AF = Math.min(SAR_AF + 0.02, 0.2);
            }
            if (entities[i].SAR > entities[i].close) {
                SAR_BULL = false;
                SAR_FIRSTDAY = true;
                sar(i, entities);
            }
        }
        else {
            entities[i].SAR = entities[i - 1].SAR + SAR_AF * (SAR_LOW - entities[i - 1].SAR);
            entities[i].SAR_RED = false;
            if (entities[i].low < SAR_LOW) {
                SAR_LOW = entities[i].low;
                SAR_AF = Math.min(SAR_AF + 0.02, 0.2);
            }
            if (entities[i].SAR < entities[i].close) {
                SAR_BULL = true;
                SAR_FIRSTDAY = true;
                sar(i, entities);
            }
        }
    }
}
function GetEntity() {

    const CurveEntityCus = {
        /// <summary>
        /// 返回/设置5日均价
        /// </summary>
        Average5: 0.00,
        /// <summary>
        /// 返回/设置10日均价
        /// </summary>
        Average10: 0.00,
        /// <summary>
        /// 返回/设置20日均价
        /// </summary>
        Average20: 0.00,
        /// <summary>
        /// 返回/设置30日均价
        /// </summary>
        Average30: 0.00,
        /// <summary>
        /// 返回/设置3日均价
        /// </summary>
        Average3: 0.00,
        /// <summary>
        /// 返回/设置6日均价
        /// </summary>
        Average6: 0.00,
        /// <summary>
        /// 返回/设置12日均价
        /// </summary>
        Average12: 0.00,
        /// <summary>
        /// 返回/设置24日均价
        /// </summary>
        Average24: 0.00,
        /// <summary>
        /// 返回/设置50日均价
        /// </summary>
        Average50: 0.00,

        Average60: 0.00,

        /// <summary>
        /// 返回/设置ASI技术指标
        /// </summary>
        ASI: 0.00,
        /// <summary>
        /// 返回/设置BIAS_A技术指标
        /// </summary>
        BIAS_A: 0.00,

        /// <summary>
        /// 返回/设置BIAS_B技术指标
        /// </summary>
        BIAS_B: 0.00,
        /// <summary>
        /// 返回/设置BIAS_C技术指标
        /// </summary>
        BIAS_C: 0.00,
        /// <summary>
        /// 返回/设置BOLL技术指标
        /// </summary>
        BOLL: 0.00,
        /// <summary>
        /// 返回/设置BOLL_UPPER技术指标
        /// </summary>
        BOLL_UPPER: 0.00,
        /// <summary>
        /// 返回/设置BOLL_LOWER技术指标
        /// </summary>
        BOLL_LOWER: 0.00,
        /// <summary>
        /// 返回/设置CCI_TYP技术指标
        /// </summary>
        CCI_TYP: 0.00,

        /// <summary>
        /// 返回/设置CCI技术指标
        /// </summary>
        CCI: 0.00,
        /// <summary>
        /// 返回/设置CR_MID技术指标
        /// </summary>
        CR_MID: 0.00,
        /// <summary>
        /// 返回/设置CR_AX技术指标
        /// </summary>
        CR_AX: 0.00,

        /// <summary>
        /// 返回/设置CR_BX技术指标
        /// </summary>
        CR_BX: 0.00,
        /// <summary>
        /// 返回/设置CR技术指标
        /// </summary>
        CR: 0.00,
        /// <summary>
        /// 返回/设置CR_A技术指标
        /// </summary>
        CR_A: 0.00,
        /// <summary>
        /// 返回/设置CR_B技术指标
        /// </summary>
        CR_B: 0.00,
        /// <summary>
        /// 返回/设置CR_C技术指标
        /// </summary>
        CR_C: 0.00,
        /// <summary>
        /// 返回/设置DMI_TR技术指标
        /// </summary>
        DMI_TR: 0.00,
        /// <summary>
        /// 返回/设置DMI_DMP技术指标
        /// </summary>
        DMI_DMP: 0.00,
        /// <summary>
        /// 返回/设置DMI_DMM技术指标
        /// </summary>
        DMI_DMM: 0.00,
        /// <summary>
        /// 返回/设置DMI_EXPMEMA_TR技术指标
        /// </summary>
        DMI_EXPMEMA_TR: 0.00,

        /// <summary>
        /// 返回/设置DMI_EXPMEMA_DMP技术指标
        /// </summary>
        DMI_EXPMEMA_DMP: 0.00,
        /// <summary>
        /// 返回/设置DMI_EXPMEMA_DMM技术指标
        /// </summary>
        DMI_EXPMEMA_DMM: 0.00,
        /// <summary>
        /// 返回/设置DMI_PDI技术指标
        /// </summary>
        DMI_PDI: 0.00,
        /// <summary>
        /// 返回/设置DMI_MDI技术指标
        /// </summary>
        DMI_MDI: 0.00,
        /// <summary>
        /// 返回/设置DMI_MPDI技术指标
        /// </summary>
        DMI_MPDI: 0.00,
        /// <summary>
        /// 返回/设置DMI_ADX技术指标
        /// </summary>
        DMI_ADX: 0.00,

        /// <summary>
        /// 返回/设置DMI_ADXR技术指标
        /// </summary>
        DMI_ADXR: 0.00,
        /// <summary>
        /// 返回/设置KDJ_RSV技术指标
        /// </summary>
        KDJ_RSV: 0.00,
        /// <summary>
        /// 返回/设置KDJ_K技术指标
        /// </summary>
        KDJ_K: 0.00,

        /// <summary>
        /// 返回/设置KDJ_D技术指标
        /// </summary>
        KDJ_D: 0.00,
        /// <summary>
        /// 返回/设置KDJ_J技术指标
        /// </summary>
        KDJ_J: 0.00,
        /// <summary>
        /// 返回/设置MACD_AX技术指标
        /// </summary>
        MACD_AX: 0.00,

        /// <summary>
        /// 返回/设置MACD_BX技术指标
        /// </summary>
        MACD_BX: 0.00,
        /// <summary>
        /// 返回/设置MACD_DIF技术指标
        /// </summary>
        MACD_DIF: 0.00,

        /// <summary>
        /// 返回/设置MACD_DEA技术指标
        /// </summary>
        MACD_DEA: 0.00,

        /// <summary>
        /// 返回MACD技术指标
        /// </summary>
        MACD: 0.00,
        /// <summary>
        /// 返回/设置OBV技术指标
        /// </summary>
        OBV: 0.00,
        /// <summary>
        /// 返回/设置OBV_MA技术指标
        /// </summary>
        OBV_MA: 0.00,
        /// <summary>
        /// 返回/设置ROC技术指标
        /// </summary>
        ROC: 0.00,
        /// <summary>
        /// 返回/设置ROC_MA技术指标
        /// </summary>
        ROC_MA: 0.00,

        /// <summary>
        /// 返回/设置RSI_UP_A技术指标
        /// </summary>
        RSI_UP_A: 0.00,
        /// <summary>
        /// 返回/设置RSI_DN_A技术指标
        /// </summary>
        RSI_DN_A: 0.00,
        /// <summary>
        /// 返回/设置RSI_UP_B技术指标
        /// </summary>
        RSI_UP_B: 0.00,

        /// <summary>
        /// 返回/设置RSI_DN_B技术指标
        /// </summary>
        RSI_DN_B: 0.00,
        /// <summary>
        /// 返回/设置RSI_UP_C技术指标
        /// </summary>
        RSI_UP_C: 0.00,
        /// <summary>
        /// 返回/设置RSI_DN_C技术指标
        /// </summary>
        RSI_DN_C: 0.00,
        /// <summary>
        /// 返回RSI_A技术指标
        /// </summary>
        RSI_A: 0.00,
        /// <summary>
        /// 返回RSI_B技术指标
        /// </summary>
        RSI_B: 0.00,
        /// <summary>
        /// 返回RSI_C技术指标
        /// </summary>
        RSI_C: 0.00,
        /// <summary>
        /// 返回/设置SAR技术指标
        /// </summary>
        SAR: 0.00,
        /// <summary>
        /// 返回/设置SAR_RED技术指标
        /// </summary>
        SAR_RED: 0.00,
        /// <summary>
        /// 返回/设置VR技术指标
        /// </summary>
        VR: 0.00,
        /// <summary>
        /// 返回/设置VR技术指标
        /// </summary>
        VR_MA: 0.00,
        /// <summary>
        /// 返回/设置WR_A技术指标
        /// </summary>
        WR_A: 0.00,
        /// <summary>
        /// 返回/设置WR_B技术指标
        /// </summary>
        WR_B: 0.00,
        /// <summary>
        /// 返回/设置BBI技术指标
        /// </summary>
        BBI: 0.00,
        /// <summary>
        /// 零值
        /// </summary>
        Zero: 0,
        volume5: 0.00,
        volume10: 0.00,
        time: 0.00,
        open: 0.00,
        close: 0.00,
        high: 0.00,
        low: 0.00,
        volume: 0.00
    }

    return CurveEntityCus;
}



const arr = [
    "2025-01-27 09:45,40.600,42.100,42.150,40.600,7071000,294813595.000,3.82",
    "2025-01-27 10:00,42.050,41.700,42.100,41.500,1838000,76763520.000,1.43",
    "2025-01-27 10:15,41.650,41.550,41.700,41.400,1657100,68919025.000,0.72",
    "2025-01-27 10:30,41.500,41.350,41.600,41.200,1641900,67892440.000,0.96",
    "2025-01-27 10:45,41.350,41.350,41.400,41.200,940100,38829135.000,0.48",
    "2025-01-27 11:00,41.350,41.350,41.350,41.150,947600,39116840.000,0.48",
    "2025-01-27 11:15,41.350,41.700,41.700,41.300,1570300,65062180.000,0.97",
    "2025-01-27 11:30,41.700,41.600,41.750,41.350,1202800,49960685.000,0.96",
    "2025-01-27 11:45,41.650,41.650,41.650,41.500,779300,32412940.000,0.36",
    "2025-01-27 12:00,41.650,41.550,41.700,41.400,1020700,42404595.000,0.72",
    "2025-01-27 13:15,41.500,41.800,42.000,41.500,2771000,115817490.000,1.20",
    "2025-01-27 13:30,41.800,41.800,41.850,41.650,820300,34255485.000,0.48",
    "2025-01-27 13:45,41.750,41.950,41.950,41.700,1808900,75532555.000,0.60",
    "2025-01-27 14:00,41.900,42.250,42.250,41.850,2174800,91353950.000,0.95",
    "2025-01-27 14:15,42.250,42.550,42.700,42.200,5378900,228665960.000,1.18",
    "2025-01-27 14:30,42.500,42.800,42.850,42.450,3181800,135641250.000,0.94",
    "2025-01-27 14:45,42.750,42.650,42.850,42.550,3128100,133629350.000,0.70",
    "2025-01-27 15:00,42.650,42.550,42.650,42.400,2216500,94175865.000,0.59",
    "2025-01-27 15:15,42.550,42.350,42.550,42.250,2141600,90840075.000,0.71",
    "2025-01-27 15:30,42.300,42.150,42.400,42.100,2749700,116199965.000,0.71",
    "2025-01-27 15:45,42.100,42.100,42.150,42.000,2576500,108388680.000,0.36",
    "2025-01-27 16:00,42.100,42.100,42.100,41.950,5727400,240871595.000,0.36",
    "2025-01-28 09:45,42.450,41.850,42.800,41.650,2232900,94148720.000,2.73",
    "2025-01-28 10:00,41.750,41.950,42.200,41.600,990000,41516990.000,1.43",
    "2025-01-28 10:15,41.900,42.100,42.150,41.700,666600,27966230.000,1.07",
    "2025-01-28 10:30,42.100,41.750,42.150,41.750,776400,32558755.000,0.95",
    "2025-01-28 10:45,41.800,42.250,42.250,41.750,1275500,53589220.000,1.20",
    "2025-01-28 11:00,42.250,42.250,42.500,42.200,590000,24971595.000,0.71",
    "2025-01-28 11:15,42.200,42.100,42.300,42.000,441300,18600430.000,0.71",
    "2025-01-28 11:30,42.100,42.150,42.250,42.050,390300,16456370.000,0.48",
    "2025-01-28 11:45,42.150,42.000,42.200,42.000,588100,24773420.000,0.47",
    "2025-01-28 12:00,42.100,42.100,42.300,42.000,2660300,112092070.000,0.71",
    "2025-02-03 09:45,41.500,39.800,41.500,39.700,7393700,298491710.000,4.28",
    "2025-02-03 10:00,39.800,39.850,40.100,39.500,3958300,157752915.000,1.51",
    "2025-02-03 10:15,39.900,39.900,39.900,39.350,2197900,87114950.000,1.38",
    "2025-02-03 10:30,39.900,40.000,40.000,39.800,253600,10124885.000,0.50"
    ]


    console.log(GetConvert('RSI',arr))