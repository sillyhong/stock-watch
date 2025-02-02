/**
 * jsonp获取数据
 */

//@ts-nocheck

/**
 * Module dependencies
 */

// var debug = require('debug')('jsonp');

/**
 * Module exports.
 */



/**
 * Callback index.
 */

let count = 0;

/**
 * Noop function.
 */

function noop(){}

/**
 * JSONP handler
 *
 * Options:
 *  - param {String} qs parameter (`callback`)
 *  - prefix {String} qs parameter (`__jp`)
 *  - name {String} qs parameter (`prefix` + incr)
 *  - timeout {Number} how long after a timeout error is emitted (`60000`)
 *
 * @param {String} url
 * @param {Object|Function} optional options / callback
 * @param {Function} optional callback
 */

function jsonp(url:string, opts:any, fn:Function){
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }
  if (!opts) opts = {};

  const prefix = opts.prefix || '__jp';

  // use the callback name that was passed if one was provided.
  // otherwise generate a unique name by incrementing our counter.
  const id = opts.name || (prefix + (count++));

  const param = opts.param || 'callback';
  const timeout = null != opts.timeout ? opts.timeout : 60000;
  const enc = encodeURIComponent;
  const target = document.getElementsByTagName('script')[0] || document.head;
  let script;
  let timer;


  if (timeout) {
    timer = setTimeout(function(){
      cleanup();
      if (fn) fn(new Error('Timeout'));
    }, timeout);
  }

  function cleanup(){
    if (script.parentNode) script.parentNode.removeChild(script);
    window[id] = noop;
    if (timer) clearTimeout(timer);
  }

  function cancel(){
    if (window[id]) {
      cleanup();
    }
  }

  window[id] = function(data){
    // debug('jsonp got', data);
    cleanup();
    if (fn) fn(null, data);
  };

  // add qs component
  url += (~url.indexOf('?') ? '&' : '?') + param + '=' + enc(id);
  url = url.replace('?&', '?');

  // debug('jsonp req "%s"', url);

  // create script
  script = document.createElement('script');
  script.src = url;
  target.parentNode.insertBefore(script, target);

  return cancel;
}

export default async function (url: string, options: any) {
  return new Promise((resolve, reject)=>{
    jsonp(
      url,
      options,
      function(error:any, data:any){
        if(error){
          reject(error)
        }
        else{
          resolve(data)
        }
      }
    )
  })
};