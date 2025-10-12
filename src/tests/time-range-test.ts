import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// 启用 dayjs 时区插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 检查当前时间是否在允许的执行时间段内
function isInAllowedTimeRange(testTime?: string): boolean {
  const now = testTime ? dayjs(testTime).tz('Asia/Shanghai') : dayjs().tz('Asia/Shanghai');
  const hour = now.hour();
  const minute = now.minute();
  const currentMinutes = hour * 60 + minute;
  
  // 9:25-10:00 (565-600分钟)
  const morningStart = 9 * 60 + 25; // 565
  const morningEnd = 10 * 60; // 600
  
  // 14:30-15:00 (870-900分钟)
  const afternoonStart = 14 * 60 + 30; // 870
  const afternoonEnd = 15 * 60; // 900
  
  return (currentMinutes >= morningStart && currentMinutes <= morningEnd) ||
         (currentMinutes >= afternoonStart && currentMinutes <= afternoonEnd);
}

// 测试用例
const testCases = [
  // 应该执行的时间
  { time: '2024-01-08 09:25:00', expected: true, description: '上午开始时间 9:25' },
  { time: '2024-01-08 09:30:00', expected: true, description: '上午时间段内 9:30' },
  { time: '2024-01-08 09:45:00', expected: true, description: '上午时间段内 9:45' },
  { time: '2024-01-08 10:00:00', expected: true, description: '上午结束时间 10:00' },
  { time: '2024-01-08 14:30:00', expected: true, description: '下午开始时间 14:30' },
  { time: '2024-01-08 14:45:00', expected: true, description: '下午时间段内 14:45' },
  { time: '2024-01-08 15:00:00', expected: true, description: '下午结束时间 15:00' },
  
  // 不应该执行的时间
  { time: '2024-01-08 09:00:00', expected: false, description: '9:00 太早' },
  { time: '2024-01-08 09:24:00', expected: false, description: '9:24 还未到开始时间' },
  { time: '2024-01-08 10:01:00', expected: false, description: '10:01 已过上午时段' },
  { time: '2024-01-08 10:30:00', expected: false, description: '10:30 不在时间段内' },
  { time: '2024-01-08 12:00:00', expected: false, description: '12:00 午休时间' },
  { time: '2024-01-08 14:00:00', expected: false, description: '14:00 还未到下午时段' },
  { time: '2024-01-08 14:29:00', expected: false, description: '14:29 还未到开始时间' },
  { time: '2024-01-08 15:01:00', expected: false, description: '15:01 已过下午时段' },
  { time: '2024-01-08 16:00:00', expected: false, description: '16:00 收市后' },
];

console.log('========== 时间范围测试 ==========\n');
console.log('允许执行的时间段:');
console.log('  上午: 9:25 - 10:00');
console.log('  下午: 14:30 - 15:00');
console.log('\n测试结果:\n');

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
  const result = isInAllowedTimeRange(testCase.time);
  const passed = result === testCase.expected;
  const status = passed ? '✅ PASS' : '❌ FAIL';
  
  if (passed) {
    passCount++;
  } else {
    failCount++;
  }
  
  console.log(`${index + 1}. ${status} - ${testCase.description}`);
  console.log(`   时间: ${testCase.time}`);
  console.log(`   预期: ${testCase.expected ? '执行' : '跳过'}, 实际: ${result ? '执行' : '跳过'}`);
  console.log('');
});

console.log('========== 测试总结 ==========');
console.log(`总测试数: ${testCases.length}`);
console.log(`通过: ${passCount} ✅`);
console.log(`失败: ${failCount} ❌`);
console.log(`通过率: ${((passCount / testCases.length) * 100).toFixed(2)}%`);

if (failCount === 0) {
  console.log('\n🎉 所有测试通过！时间判断逻辑正确。');
} else {
  console.log('\n⚠️  有测试失败，请检查时间判断逻辑。');
  process.exit(1);
}

