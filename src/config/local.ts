/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:35:06 +0800
 * @LastEditTime: 2021-12-08 09:00:54 +0800
 * @FilePath: /websocket-node/src/config/local.ts
 */

export default {
    NAME:"本地",
    redis: {
        host: "127.0.0.1",
        port: '6379',
        cache_size:20000, // LFU 缓存大小
    },
    mqmsgasync: {
        redis: {
            host: "127.0.0.1",
            port: '6379',
        },
        amqplib: "amqp://user:asd@1123",
        channel: "ballroom-channel",
        group:"asdad"
    },
    httpmsgasync: {
        md5key:"ahsjsgcbahncgdbs", 
        group:"asdad"
    },
    udpmsgasync: {
        md5key:"ahsjsgcbahncgdbs", 
        restarts_count: 10,
        restarts_timer: 1000 * 10,
        requests_timeout: 15000, 
        group:"asdad"
    },
    mysql: {
        host: '11231',
        username: '1231',
        password: '123',
        port: '3306',
        dialect: 'mysql',
        prefix: 'cmf_',
        database: '12313',
        timezone: '+08:00',
    },
    chat:{
        history_limit: 30
    },
    remote:{
    },
    statistics_whitelist:[]
}