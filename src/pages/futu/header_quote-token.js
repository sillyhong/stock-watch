// 假设 d() 是 MD5 加密，s() 是 SHA-1 加密
const crypto = require('crypto');

function d(data, salt) {
    return crypto.createHash('md5')
        .update(data + salt) // 拼接数据和盐值
        .digest('hex'); // 输出十六进制字符串
}

function s(data) {
    return crypto.createHash('sha1')
        .update(data)
        .digest('hex');
}

// 生成 quote-token 的函数
function generateQuoteToken(params) {
    // 处理参数为字符串（模拟 i._M 函数）
    const paramStr = new URLSearchParams(params).toString() || "{}";
    
    // 第一次加密：d(paramStr, "quote_web")
    const firstHash = d(paramStr, "quote_web");
    const firstHashSubstring = firstHash.slice(0, 10); // 取前10位
    
    // 第二次加密：s(firstHashSubstring)
    const secondHash = s(firstHashSubstring);
    const finalToken = secondHash.slice(0, 10); // 取前10位
    
    return finalToken;
}
/* 
 e123 {"stockId":"82639465969979","marketType":"2","marketCode":"12","lotSize":"1","spreadCode":"49","underlyingStockId":"0","instrumentType":"3","subInstrumentType":"3002","_":"1749342789694"}
 t123 ac4dbb1f5b
 e123 {"stockId":"82639465969979","_":"1749342789694"}
 t123 5702fa4857
 e123 {"stockId":"82639465969979","marketType":"2","marketCode":"12","lotSize":"1","spreadCode":"49","underlyingStockId":"0","instrumentType":"3","subInstrumentType":"3002","_":"1749342865349"}
 t123 2fbec7936c
 e123 {"stockId":"82639465969979","_":"1749342865349"}
 t123 ee6db28ad8
*/
const params = {"stockId":"82639465969979","marketType":"2","marketCode":"12","lotSize":"1","spreadCode":"49","underlyingStockId":"0","instrumentType":"3","subInstrumentType":"3002","_":"1749342865349"}

const result = generateQuoteToken(params)
console.log("🚀 ~ result:", result)
