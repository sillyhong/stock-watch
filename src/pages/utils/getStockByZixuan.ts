function extractSecurityCodes(arr) {
    return arr.filter(item => item.security.startsWith('0$') || item.security.startsWith('1$'))
              .map(item => {
                  const parts = item.security.split('$');
                  if(parts?.length) return `${parts[0]}.${parts[1]}`;
              }).filter(item => !!item);
}

var arr = [{
    "security": "0$301517$24581808415882",
    "star": false,
    "updatetime": 20241015091910,
    "price": "52.54"
}, {
    "security": "0$002085$33534345375962",
    "star": false,
    "updatetime": 20240821084326,
    "price": "11.66"
}, {
    "security": "0$301568$13799180745338",
    "star": false,
    "updatetime": 20240322065436,
    "price": "43.1"
}, {
    "security": "0$300469$33592299619222",
    "star": false,
    "updatetime": 20240319085006,
    "price": "14.92"
}, {
    "security": "1$601127$49251240792453",
    "star": false,
    "updatetime": 20240104092547,
    "price": "72.88"
}, {
    "security": "1$603099$31088026151579",
    "star": false,
    "updatetime": 20240226092426,
    "price": "24.89"
}, {
    "security": "0$002995$33476191627226",
    "star": false,
    "updatetime": 20231106094851,
    "price": "23.23"
}, {
    "security": "106$SE$25283408680001",
    "star": false,
    "updatetime": 20220316222447,
    "price": "109.21"
}, {
    "security": "202$US36966$12108670243786",
    "star": false,
    "updatetime": 20240415225649,
    "price": "419.39"
}]

const result = extractSecurityCodes(arr);
console.log(JSON.stringify(result, undefined, 2));