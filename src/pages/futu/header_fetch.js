const type = {
    2: '日',
    3: '周',
    4: '月',
    11: '季',
    5: '年',
    //6 7 失败
}


/* 
  1. 修改type
  2. 修改_ 时间戳
  3. 修改请求头 quote_token  


  TOOD：请求分时线， 可自行处理5、15分钟分时线
  https://www.futunn.com/quote-api/quote-v2/get-quote-minute?stockId=69660076576418&marketType=4&type=1&marketCode=31&instrumentType=3&subInstrumentType=3002&_=1749363938780


  抓包过程：
  抓取app_hashxxx.js,找到quote-token源码; 使用whistle 代理修改源码，可以得到quote_token
   u.Z.interceptors.request.use((function(e) {
                document && (e.headers["futu-x-csrf-token"] = (0,
                i.WJ)("csrfToken"));
                var t = function(e) {
                    e.length <= 0 && (e = "quote");
                    var t = d()(e, "quote_web");
                    return s()(t.toString().slice(0, 10)).toString().slice(0, 10)
                }(JSON.stringify(e.data) || (0,
                i._M)(e.params) || "{}");
                return e.headers["quote-token"] = t,
                e
            }
*/

// 构造请求参数（与浏览器一致）
const params = new URLSearchParams({"stockId":"82639465969979","marketType":"2","type":"2","marketCode":"12","instrumentType":"3","subInstrumentType":"3002","_":"1749361280596"});

// const params = new URLSearchParams({
//   stockId: '82639465969979',
//   marketType: '2',
//   type: '1', // 若需15分钟线，改为对应的type值（如15）
//   marketCode: '12',
//   instrumentType: '3',
//   subInstrumentType: '3002',
//   _: 1749350962492 //Date.now() // 动态生成时间戳（与浏览器一致）
// });
const quoteToken = '30f2676579'

// 构造请求头（需包含所有浏览器发送的字段）
const headers = new Headers({
//   'authority': 'www.futunn.com',
  'method': 'GET',
//   'path': `/quote-api/quote-v2/get-kline?${params}`,
//   'scheme': 'https',
  'accept': 'application/json, text/plain, */*',
  'accept-encoding': 'gzip, deflate, br, zstd',
  'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8,es;q=0.7,ar;q=0.6',
  'cache-control': 'no-cache',
  'cookie': 'csrfToken=TRsApBujOa7ZD70O7cppI1zR; locale=zh-cn; locale.sig=ObiqV0BmZw7fEycdGJRoK-Q0Yeuop294gBeiHL1LqgQ; cipher_device_id=1749285145821143; device_id=1749285145821143; Hm_lvt_f3ecfeb354419b501942b6f9caf8d0db=1749044380,1749285146; HMACCOUNT=ED9FEDB1351799C4; futu-csrf=W5OD5PP2oCnJbDm9rRPGrjezPgc=; _gid=GA1.2.1625938493.1749285147; _ga_25WYRC4KDG=GS2.1.s1749294322$o2$g0$t1749294337$j45$l0$h0; Hm_lpvt_f3ecfeb354419b501942b6f9caf8d0db=1749295234; _gat_UA-71722593-3=1; _ga=GA1.1.792543118.1749285147; _ga_XECT8CPR37=GS2.1.s1749294322$o2$g1$t1749295235$j60$l0$h0; _ga_370Q8HQYD7=GS2.2.s1749294324$o2$g1$t1749295235$j60$l0$h0; _ga_EJJJZFNPTW=GS2.1.s1749294323$o2$g1$t1749295235$j60$l0$h0; ftreport-jssdk%40session={%22distinctId%22:%22ftv16wScUGFvhQ+J7+mpTN2oN5WHbhTplo+rBzP+mH1aG5W5vyR1xOONgSbv1b6WtWGf%22%2C%22firstId%22:%22ftv1iyS3E3VMM+8rLKzjshyBvjOGoYYMdkRc/GJ4BAZP8DGR+sVl1pAtlVqra01qHAR9%22%2C%22latestReferrer%22:%22https://www.futunn.com/%22}', // 替换为完整Cookie
  'futu-x-csrf-token': 'TRsApBujOa7ZD70O7cppI1zR', // 新增字段（浏览器请求中存在）
  'pragma': 'no-cache',
  'priority': 'u=1, i',
  'quote-token': quoteToken, // 新增字段（浏览器请求中存在）
  'referer': 'https://www.futunn.com/stock/KNW-US?chain_id=_JZb7-E8Xbh33r.1k48841&global_content=%7B%22promote_id%22%3A13766,%22sub_promote_id%22%3A2,%22f%22%3A%22nn%2Fquote%22%7D', // 替换为实际Referer
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
});

// 发送fetch请求
fetch(`https://www.futunn.com/quote-api/quote-v2/get-kline?${params}`, {
  method: 'GET',
  headers: headers,
  mode: 'cors', // 跨域模式（与浏览器一致）
  credentials: 'include', // 包含Cookie（若需要）
})
.then(response => {
  if (!response.ok) {
    throw new Error(`请求失败：状态码 ${response.status}`);
  }
  return response.json(); // 解析JSON响应
})
.then(data => {
  console.log('请求成功:', data); // 正常响应数据
})
.catch(error => {
  console.error('请求报错:', error); // 处理错误
});