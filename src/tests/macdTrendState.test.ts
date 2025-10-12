/**
 * MACD趋势状态测试
 * 测试6种状态的识别准确性
 */

import dayjs from 'dayjs';
import { detectMACDFirstGoldenCross, MACDTrendState } from '../pages/utils/macdProcessor';

// 测试用例接口
interface TestCase {
  name: string;
  description: string;
  macdData: Array<[string, number | string, number | string, number | string]>;
  expectedState: MACDTrendState;
  currentIndex: number;
}

// 辅助函数：生成MACD数据
function generateMACDData(diffValues: number[], deaValues: number[]): Array<[string, number | string, number | string, number | string]> {
  const baseTime = dayjs('2024-01-01 09:30:00');
  return diffValues.map((diff, index) => [
    baseTime.add(index, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    diff,
    deaValues[index],
    (diff - deaValues[index]) * 2 // MACD柱
  ]);
}

// 测试用例集合
const testCases: TestCase[] = [
  // 测试1：弱势状态（DEA下穿零轴后，到低位金叉之前）
  {
    name: '弱势状态',
    description: 'DEA下穿零轴后，DIFF和DEA都在零轴下方，且DIFF < DEA（死叉状态）',
    macdData: generateMACDData(
      [0.5, 0.3, 0.1, -0.1, -0.3, -0.5, -0.7, -0.9, -1.0, -1.1],  // DIFF：从正到负，下穿零轴
      [0.8, 0.6, 0.4, 0.2, 0.0, -0.2, -0.4, -0.6, -0.7, -0.8]    // DEA：下穿零轴，且在DIFF之上
    ),
    expectedState: MACDTrendState.WEAK,
    currentIndex: 9
  },

  // 测试2：中偏强状态（低位金叉后，DIF第一次上穿零轴之前）
  {
    name: '中偏强状态',
    description: '低位金叉后，DIFF和DEA都在零轴下方，但DIFF >= DEA（金叉状态）',
    macdData: generateMACDData(
      [-1.0, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1],  // DIFF：逐渐上升但仍在零轴下方
      [-0.8, -0.7, -0.6, -0.55, -0.52, -0.51, -0.50, -0.48, -0.45, -0.40] // DEA：上升较慢，在DIFF之下
    ),
    expectedState: MACDTrendState.MEDIUM_STRONG,
    currentIndex: 9
  },

  // 测试3：极强状态（DIF上穿零轴后，到DEA上穿零轴之前）
  {
    name: '极强状态',
    description: 'DIF已上穿零轴，DEA仍在零轴下方',
    macdData: generateMACDData(
      [-0.5, -0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.4],   // DIFF：上穿零轴
      [-0.6, -0.55, -0.5, -0.45, -0.4, -0.3, -0.2, -0.15, -0.1, -0.05] // DEA：仍在零轴下方
    ),
    expectedState: MACDTrendState.EXTREMELY_STRONG,
    currentIndex: 9
  },

  // 测试4：强势状态（DEA上穿零轴后，到高位死叉之前）
  {
    name: '强势状态',
    description: 'DEA已上穿零轴，DIFF和DEA都在零轴上方，且DIFF >= DEA（金叉状态）',
    macdData: generateMACDData(
      [-0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],      // DIFF：在零轴上方
      [-0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.35, 0.4]   // DEA：上穿零轴，在DIFF之下
    ),
    expectedState: MACDTrendState.STRONG,
    currentIndex: 9
  },

  // 测试5：中性偏弱状态（高位死叉后，到DIF下穿零轴之前）
  {
    name: '中性偏弱状态',
    description: '高位死叉后，DIFF和DEA都在零轴上方，但DIFF < DEA（死叉状态）',
    macdData: generateMACDData(
      [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1],      // DIFF：下降但仍在零轴上方
      [0.6, 0.65, 0.68, 0.69, 0.68, 0.65, 0.6, 0.5, 0.4, 0.3]   // DEA：在DIFF之上（死叉）
    ),
    expectedState: MACDTrendState.MEDIUM_WEAK,
    currentIndex: 9
  },

  // 测试6：极弱状态（DIF下穿零轴后，到DEA下穿零轴之前）
  {
    name: '极弱状态',
    description: 'DIF已下穿零轴，DEA仍在零轴上方',
    macdData: generateMACDData(
      [0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3, -0.4, -0.5],   // DIFF：下穿零轴
      [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05]   // DEA：仍在零轴上方
    ),
    expectedState: MACDTrendState.EXTREMELY_WEAK,
    currentIndex: 9
  },

  // 测试7：完整循环 - 从弱到强再到弱
  {
    name: '完整循环测试',
    description: '测试完整的状态转换序列',
    macdData: generateMACDData(
      // 弱 → 中偏强 → 极强 → 强 → 中性偏弱 → 极弱 → 弱
      [-1.0, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 
       0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
       1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
       0.0, -0.1, -0.2, -0.3, -0.4, -0.5],
      [-0.8, -0.75, -0.7, -0.65, -0.6, -0.58, -0.56, -0.54, -0.5, -0.45,
       -0.4, -0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5,
       0.6, 0.65, 0.68, 0.7, 0.68, 0.65, 0.6, 0.5, 0.4, 0.3,
       0.2, 0.1, 0.0, -0.1, -0.2, -0.3]
    ),
    expectedState: MACDTrendState.WEAK,
    currentIndex: 35
  },

  // 测试8：低位金叉瞬间（刚刚形成低位金叉）
  {
    name: '低位金叉形成瞬间',
    description: 'DIFF刚刚上穿DEA，两者都在零轴下方',
    macdData: generateMACDData(
      [-0.8, -0.7, -0.6, -0.55, -0.5, -0.48, -0.46],  // DIFF上升
      [-0.6, -0.58, -0.56, -0.54, -0.52, -0.50, -0.49] // DEA：DIFF刚上穿
    ),
    expectedState: MACDTrendState.MEDIUM_STRONG,
    currentIndex: 6
  },

  // 测试9：DIF刚上穿零轴瞬间
  {
    name: 'DIF上穿零轴瞬间',
    description: 'DIF刚刚上穿零轴，DEA仍在零轴下方',
    macdData: generateMACDData(
      [-0.3, -0.2, -0.1, 0.0, 0.05, 0.1],    // DIFF刚上穿零轴
      [-0.4, -0.35, -0.3, -0.25, -0.2, -0.15] // DEA仍在下方
    ),
    expectedState: MACDTrendState.EXTREMELY_STRONG,
    currentIndex: 5
  },

  // 测试10：DEA刚上穿零轴瞬间
  {
    name: 'DEA上穿零轴瞬间',
    description: 'DEA刚刚上穿零轴，进入强势状态',
    macdData: generateMACDData(
      [0.1, 0.15, 0.2, 0.25, 0.3, 0.35],     // DIFF在零轴上方
      [-0.1, -0.05, 0.0, 0.05, 0.1, 0.15]   // DEA刚上穿零轴
    ),
    expectedState: MACDTrendState.STRONG,
    currentIndex: 5
  },

  // 测试11：边界情况 - DIFF在零轴上方，DEA在零轴下方
  {
    name: '边界情况：零轴附近',
    description: 'DIFF在零轴上方，DEA仍在零轴下方（极强状态）',
    macdData: generateMACDData(
      [-0.01, 0.0, 0.01, 0.02],    // DIFF上穿零轴
      [-0.03, -0.02, -0.01, -0.005] // DEA仍为负值
    ),
    expectedState: MACDTrendState.EXTREMELY_STRONG,
    currentIndex: 3
  },

  // 测试12：高位死叉形成瞬间
  {
    name: '高位死叉形成瞬间',
    description: 'DIFF刚刚下穿DEA，两者都在零轴上方',
    macdData: generateMACDData(
      [0.8, 0.75, 0.7, 0.65, 0.6, 0.55],     // DIFF下降
      [0.6, 0.62, 0.64, 0.65, 0.64, 0.62]    // DEA：DIFF刚下穿
    ),
    expectedState: MACDTrendState.MEDIUM_WEAK,
    currentIndex: 5
  },

  // 测试13：DIF刚下穿零轴瞬间
  {
    name: 'DIF下穿零轴瞬间',
    description: 'DIF刚刚下穿零轴，DEA仍在零轴上方',
    macdData: generateMACDData(
      [0.3, 0.2, 0.1, 0.0, -0.05, -0.1],     // DIFF刚下穿零轴
      [0.4, 0.35, 0.3, 0.25, 0.2, 0.15]      // DEA仍在上方
    ),
    expectedState: MACDTrendState.EXTREMELY_WEAK,
    currentIndex: 5
  },

  // 测试14：DEA刚下穿零轴瞬间
  {
    name: 'DEA下穿零轴瞬间',
    description: 'DEA刚刚下穿零轴，进入弱势状态',
    macdData: generateMACDData(
      [-0.3, -0.35, -0.4, -0.45, -0.5, -0.55], // DIFF在零轴下方
      [0.1, 0.05, 0.0, -0.05, -0.1, -0.15]     // DEA刚下穿零轴
    ),
    expectedState: MACDTrendState.WEAK,
    currentIndex: 5
  },

  // 测试15：回溯周期不足导致的误判（真实案例）
  {
    name: '回溯周期不足的弱势状态',
    description: '阿里巴巴真实案例：DIF=-1, DEA=-0.64，虽然历史上可能有强势事件，但当前明显是弱势',
    macdData: generateMACDData(
      // 模拟从强势到弱势的完整转换
      [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 
       0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6, -0.7, -0.8, -1.0],  // DIF：从正到负
      [0.6, 0.65, 0.68, 0.7, 0.68, 0.65, 0.6, 0.5, 0.4, 0.3,
       0.2, 0.1, 0.0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.58, -0.64]   // DEA：跟随下降
    ),
    expectedState: MACDTrendState.WEAK,
    currentIndex: 19
  },

  // 测试16：回溯周期内的状态验证
  {
    name: '历史强势但当前已转弱',
    description: '回溯15期内有DEA上穿零轴，但当前已完全转弱，应判断为弱势',
    macdData: generateMACDData(
      // 最近15期内有强势，但当前已转弱
      [0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3, -0.4,
       -0.5, -0.6, -0.7, -0.8, -0.9, -1.0],
      [0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.0, -0.05, -0.1, -0.15,
       -0.2, -0.25, -0.3, -0.4, -0.5, -0.65]
    ),
    expectedState: MACDTrendState.WEAK,
    currentIndex: 15
  }
];

// 运行测试
function runTests() {
  console.log('========================================');
  console.log('MACD趋势状态测试开始');
  console.log('========================================\n');

  let passedTests = 0;
  let failedTests = 0;

  testCases.forEach((testCase, index) => {
    const { name, description, macdData, expectedState, currentIndex } = testCase;
    
    console.log(`\n测试 ${index + 1}: ${name}`);
    console.log(`描述: ${description}`);
    console.log(`数据点数: ${macdData.length}, 当前索引: ${currentIndex}`);
    
    const currentData = macdData[currentIndex];
    console.log(`当前时间: ${currentData[0]}`);
    console.log(`当前DIFF: ${currentData[1]}, 当前DEA: ${currentData[2]}`);
    
    // 调用检测函数
    const result = detectMACDFirstGoldenCross({
      itemTime: dayjs(currentData[0] as string),
      stockName: `测试股票${index + 1}`,
      macdData: macdData
    });

    console.log(`预期状态: ${expectedState}`);
    console.log(`实际状态: ${result.trendState}`);
    console.log(`状态表情: ${result.trendStateEmoji}`);
    console.log(`金叉状态: ${result.macdGoldenCross ? '是' : '否'}`);
    
    if (result.trendState === expectedState) {
      console.log('✅ 测试通过');
      passedTests++;
    } else {
      console.log('❌ 测试失败');
      failedTests++;
      
      // 输出更多调试信息
      console.log('\n详细数据分析:');
      for (let i = Math.max(0, currentIndex - 5); i <= currentIndex; i++) {
        const item = macdData[i];
        const diff = Number(item[1]);
        const dea = Number(item[2]);
        const crossInfo = diff >= dea ? '金叉' : '死叉';
        const posInfo = `DIFF${diff >= 0 ? '+' : '-'} DEA${dea >= 0 ? '+' : '-'}`;
        console.log(`  ${i === currentIndex ? '→' : ' '} ${item[0]}: DIFF=${diff.toFixed(2)}, DEA=${dea.toFixed(2)} [${crossInfo}, ${posInfo}]`);
      }
    }
    
    console.log('----------------------------------------');
  });

  console.log('\n========================================');
  console.log('测试结果汇总');
  console.log('========================================');
  console.log(`总测试数: ${testCases.length}`);
  console.log(`通过: ${passedTests} ✅`);
  console.log(`失败: ${failedTests} ❌`);
  console.log(`成功率: ${((passedTests / testCases.length) * 100).toFixed(2)}%`);
  console.log('========================================\n');

  return { passedTests, failedTests, total: testCases.length };
}

// 导出测试函数
export { runTests, testCases };

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runTests();
}

