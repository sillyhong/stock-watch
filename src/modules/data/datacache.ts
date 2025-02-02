/**
 * 数据缓存
 */

const cacheobj:{
    [key:string]: any
  } = {}
  
  export const datacache = {
    /**
     * 设置缓存
     * @param key key
     * @param value value
     * @param cache_time 缓存时间，单位：秒，如果是0就不缓存
     * @returns 
     */
    set: function(key:string, value: any, cache_time = 0){
      if(cache_time <= 0) return false
  
      cacheobj[key] = value
  
      if(cache_time > 0){
        setTimeout(() => {
          try {
            delete cacheobj[key]
          } catch (error) {
            
          }
        }, cache_time * 1000)
      }
    },
    /**
     * 获取缓存，如果没有返回null
     * @param key 
     * @returns 
     */
    get: function(key: string){
      if(cacheobj[key] != undefined) return cacheobj[key]
      return null
    },
    /**
     * 删除缓存
     * @param key 
     */
    del: function(key: string){
      try {
        delete cacheobj[key]
      } catch (error) {
        
      }
    }
  }