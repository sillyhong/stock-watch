git pull
pm2 restart stock-watch-dev 
sleep 5
 curl http://localhost:3008/api/30-rsi-watch/hk
 curl http://localhost:3008/api/15-rsi-watch/hk
 curl http://localhost:3008/api/5-rsi-watch/hk
 curl http://localhost:3008/api/day-rsi-watch/hk
 curl http://localhost:3008/api/backtrend/15-rsi/hk
 curl http://localhost:3008/api/30-rsi-watch/a
 curl http://localhost:3008/api/15-rsi-watch/a
 curl http://localhost:3008/api/5-rsi-watch/a
 curl http://localhost:3008/api/day-rsi-watch/a
 curl http://localhost:3008/api/backtrend/30-rsi/a
 curl http://localhost:3008/api/backtrend/15-rsi/a
 curl http://localhost:3008/api/15-rsi-watch/us
#  curl http://localhost:3008/api/5-rsi-watch/us
 curl http://localhost:3008/api/day-rsi-watch/us
 curl http://localhost:3008/api/day-rsi-watch/us
 curl http://localhost:3008/api/backtrend/15-rsi/us
 #主张段
 curl http://localhost:3008/api/day-rise/a