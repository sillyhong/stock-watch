git pull
pm2 restart stock-watch-dev 
 curl http://localhost:3008/api/15-rsi-watch/hk
 curl http://localhost:3008/api/5-rsi-watch/hk
 curl http://localhost:3008/api/day-rsi-watch/hk
 curl http://localhost:3008/api/backtrend/15-rsi/hk
 curl http://localhost:3008/api/15-rsi-watch/a
 curl http://localhost:3008/api/5-rsi-watch/a
 curl http://localhost:3008/api/day-rsi-watch/a
 curl http://localhost:3008/api/backtrend/15-rsi/a
 curl http://localhost:3008/api/15-rsi-watch/us
#  curl http://localhost:3008/api/5-rsi-watch/us
 curl http://localhost:3008/api/day-rsi-watch/us
 curl http://localhost:3008/api/day-rsi-watch/us
 curl http://localhost:3008/api/backtrend/15-rsi/us