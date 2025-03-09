import  nodemailer from 'nodemailer';
import { ERSISuggestion } from './config';
// 创建一个 SMTP 传输对象
export const QQMail = nodemailer.createTransport({
    service: 'QQ', // 使用的邮件服务，这里以 QQ 邮箱为例
    auth: {
        user: '1175166300@qq.com', // 发件人邮箱地址
        pass: 'jxidhvesevtciege' // 发件人邮箱的 SMTP 授权码
    }
});
// echo '[2025-01-27 13:30] RSI: 22.114 ➜ 建议买入"\,\n"[2025-01-27 14:45] RSI: 23.205 ➜ 建议买入"\,"[2025-01-27 15:00] RSI: 20.604 ➜ 建议买入"' | msmtp -a default 1175166300@qq.com

export const createEmailItem = (item: any, kltDesc: string | undefined, stockLink: string, stockName: string, suggestion: ERSISuggestion, backtestingStr: string = '',currentPriceChange = '', latestTradeDirection = true) => {
    const stockColor = [ERSISuggestion.BUY, ERSISuggestion.MUST_BUY].includes(suggestion) ? 'green' : 'red'
    const buyColor = [ERSISuggestion.MUST_BUY, ERSISuggestion.MUST_SELL].includes(suggestion) ? 'red' : 'orange'
    return `<tr><td>${item[0]}</td><td>${kltDesc}</td><td><a href="${stockLink}" style="color: ${stockColor};">${stockName}</a></td><td>${item[1]} [${currentPriceChange}]</td><td style="color: ${buyColor};">${suggestion} ${backtestingStr} ${latestTradeDirection ? "⬆️" : "⬇️"}</td></tr>`;
};