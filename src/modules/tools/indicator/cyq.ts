// @ts-nocheck

import Decimal  from 'decimal.js';

/**
 * 筹码分布算法
 * @param {Array.<Array.<string>>} kdata K图数据 [time,open,close,high,low,volume,amount,amplitude,turnoverRate]
 * @param {number} [accuracyFactor=500] 精度因子
 * @param {number} [range] 计算范围
 */
export function CYQCalculator(kdata, accuracyFactor, range) {
    /**
     * K图数据[time,open,close,high,low,volume,amount,amplitude,turnoverRate]
     */
    this.klinedata = kdata;
    /**
     * 精度因子(纵轴刻度数)
     */
    this.fator = accuracyFactor || 150;
    /**
     * 计算K线条数
     */
    this.range = range;
}

/**
 * 计算分布及相关指标
 * @param {number} index 当前选中的K线的索引
 * @return {{x: Array.<number>, y: Array.<number>}}
 */
CYQCalculator.prototype.calc = function (index) {
    let maxprice = 0;
    let minprice = 0;
    const factor = this.fator;
    const start = this.range ? Math.max(0, index - this.range + 1) : 0;
    /**
     * K图数据[time,open,close,high,low,volume,amount,amplitude,turnoverRate]
     */
    const kdata = this.klinedata.slice(start, Math.max(1, index + 1));
    if (kdata.length === 0) throw 'invaild index';
    for (var i = 0; i < kdata.length; i++) {
        const elements = kdata[i];
        maxprice = !maxprice ? elements.high : Math.max(maxprice, elements.high);
        minprice = !minprice ? elements.low : Math.min(minprice, elements.low);
    }

    // // 精度不小于0.01 产品逻辑
    // const accuracy = Math.max(0.01, (maxprice - minprice) / (factor - 1));
    // console.log('accuracy123',accuracy)

    // 设置全局精度
    Decimal.config({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

    // 使用Decimal.js进行高精度计算
    const maxpriceDec = new Decimal(maxprice);
    const minpriceDec = new Decimal(minprice);
    const factorDec = new Decimal(factor);

    // 计算精度值，确保不小于0.01
    const rawAccuracy = maxpriceDec.sub(minpriceDec).div(factorDec.sub(1));
    const minAccuracy = new Decimal(0.01);
    const accuracyDec = rawAccuracy.lt(minAccuracy) ? minAccuracy : rawAccuracy;

    // 转换回普通数字进行显示，但保持高精度
    const accuracy = accuracyDec.toFixed(8); // 保留8位小数

    /** 
     * 值域
     * @type {Array.<number>} 
     */
    const yrange = [];
    for (var i = 0; i < factor; i++) {
        // yrange.push((minprice + accuracy * i).toFixed(2) / 1);
        // yrange.push((minprice + accuracy * i) / 1);
        // 使用BigInt进行计算，然后转换回普通数字
        // const value = minpriceBig + accuracyBig * BigInt(i);

        // 使用Decimal.js进行计算，然后转换回普通数字
        const value = minpriceDec.add(accuracyDec.mul(i));
        yrange.push(value.toNumber());
        // yrange.push(Number(value) / Number(PRECISION_FACTOR));
    }
    /**
     * 横轴数据
     */
    const xdata = createNumberArray(factor);

    for (var i = 0; i < kdata.length; i++) {
        const eles = kdata[i];
        const open = eles.open,
            close = eles.close,
            high = eles.high,
            low = eles.low,
            avg = (open + close + high + low) / 4,
            turnoverRate = Math.min(1, eles.hsl / 100 || 0);
        const H = Math.floor((high - minprice) / accuracy),
            L = Math.ceil((low - minprice) / accuracy),
            // G点坐标, 一字板时, X为进度因子
            GPoint = [high == low ? factor - 1 : 2 / (high - low), Math.floor((avg - minprice) / accuracy)];
        // 衰减
        for (let n = 0; n < xdata.length; n++) {
            xdata[n] *= (1 - turnoverRate);
        }
        if (high == low) {
            // 一字板时，画矩形面积是三角形的2倍
            xdata[GPoint[1]] += GPoint[0] * turnoverRate / 2;
        } else {
            for (let j = L; j <= H; j++) {
                const curprice = minprice + accuracy * j;
                if (curprice <= avg) {
                    // 上半三角叠加分布分布
                    if (Math.abs(avg - low) < 1e-8) {
                        xdata[j] += GPoint[0] * turnoverRate;
                    } else {
                        xdata[j] += (curprice - low) / (avg - low) * GPoint[0] * turnoverRate;
                    }
                } else {
                    // 下半三角叠加分布分布
                    if (Math.abs(high - avg) < 1e-8) {
                        xdata[j] += GPoint[0] * turnoverRate;
                    } else {
                        xdata[j] += (high - curprice) / (high - avg) * GPoint[0] * turnoverRate;
                    }
                }
            }
        }
    }


    const currentprice = this.klinedata[index].close;
    let totalChips = 0;
    for (var i = 0; i < factor; i++) {
        const x = xdata[i].toPrecision(12) / 1;
        //if (x < 0) xdata[i] = 0;
        totalChips += x;
    }
    const result = new CYQData();
    result.x = xdata;
    result.y = yrange;
    result.benefitPart = result.getBenefitPart(currentprice);
    result.avgCost = getCostByChip(totalChips * 0.5).toFixed(2);
    result.percentChips = {
        '90': result.computePercentChips(0.9),
        '70': result.computePercentChips(0.7)
    };
    return result;

    /**
     * 获取指定筹码处的成本
     * @param {number} chip 堆叠筹码
     */
    function getCostByChip(chip) {
        let result = 0,
            sum = 0;
        for (let i = 0; i < factor; i++) {
            const x = xdata[i].toPrecision(12) / 1;
            if (sum + x > chip) {
                result = minprice + i * accuracy;
                break;
            }
            sum += x;
        }
        return result;
    }

    /**
     * 筹码分布数据
     */
    function CYQData() {
        /**
         * 筹码堆叠
         * @type {Array.<number>} 
         */
        this.x = arguments[0];
        /**
         * 价格分布
         * @type {Array.<number>} 
         */
        this.y = arguments[1];
        /**
         * 获利比例
         * @type {number} 
         */
        this.benefitPart = arguments[2];
        /**
         * 平均成本
         * @type {number} 
         */
        this.avgCost = arguments[3];
        /**
         * 百分比筹码
         * @type {{Object.<string, {{priceRange: number[], concentration: number}}>}}
         */
        this.percentChips = arguments[4];
        /**
         * 计算指定百分比的筹码
         * @param {number} percent 百分比大于0，小于1
         */
        /**
         * 计算指定百分比的筹码分布
         * @param {number} percent 百分比(0-1之间)
         * @returns {{priceRange: number[], concentration: number}} 价格范围和集中度
         */
    
        // this.computePercentChips = function (percent) {
        //     if (percent > 1 || percent < 0) throw 'argument "percent" out of range';
        //     const ps = [(1 - percent) / 2, (1 + percent) / 2];
        //     const pr = [getCostByChip(totalChips * ps[0]), getCostByChip(totalChips * ps[1])];
        //     return {
        //         priceRange: [pr[0].toFixed(2), pr[1].toFixed(2)],
        //         concentration: pr[0] + pr[1] === 0 ? 0 : (pr[1] - pr[0]) / (pr[0] + pr[1])
        //     };
        // };

        this.computePercentChips = function(percent) {
    if (percent > 1 || percent < 0) throw 'argument "percent" out of range';
    
    // 将输入转换为Decimal类型
    const percentDec = new Decimal(percent);
    const totalChipsDec = new Decimal(totalChips);
    
    // 计算百分比边界 (高精度计算)
    const ps = [
        new Decimal(1).sub(percentDec).div(2),
        new Decimal(1).add(percentDec).div(2)
    ];
    
    // 计算筹码位置
    const chipPositions = [
        totalChipsDec.mul(ps[0]).toNumber(),
        totalChipsDec.mul(ps[1]).toNumber()
    ];
    
    // 获取对应价格点
    const pr = [
        getCostByChip(chipPositions[0]),
        getCostByChip(chipPositions[1])
    ];
    
    // 使用Decimal进行高精度价格计算
    const pr0Dec = new Decimal(pr[0]);
    const pr1Dec = new Decimal(pr[1]);
    const sumDec = pr0Dec.add(pr1Dec);
    
    // 计算集中度 (避免除以零错误)
    let concentration = 0;
    if (!sumDec.isZero()) {
        const diffDec = pr1Dec.sub(pr0Dec);
        concentration = diffDec.div(sumDec).toNumber();
    }
    
    return {
        priceRange: [
            pr[0].toFixed(3), // 保持两位小数显示
            pr[1].toFixed(3)
        ],
        concentration: concentration
    };
}; 
        /**
         * 获取指定价格的获利比例
         * @param {number} price 价格
         */
        this.getBenefitPart = function (price) {
            let below = 0;
            for (let i = 0; i < factor; i++) {
                const x = xdata[i].toPrecision(12) / 1;
                if (price >= minprice + i * accuracy) {
                    below += x;
                }
            }
            return totalChips == 0 ? 0 : below / totalChips;
        };
    }
}

/**
 * 构造数字型数组
 * @param {number} count 数组数量
 */
function createNumberArray(count) {
    const array = [];
    for (let i = 0; i < count; i++) {
        array.push(0);
    }
    return array;
}