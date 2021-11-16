/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:35:06 +0800
 * @LastEditTime: 2021-11-16 10:55:54 +0800
 * @FilePath: /websocket-node/src/config/local.ts
 */

export default {
    redis: {
        host: "127.0.0.1",
        port: '6379',
    },
    msgasync: {
        redis: {
            host: "127.0.0.1",
            port: '6379',
        },
        amqplib: "amqp://user:asdasd@127.0.0.1",
        channel: "message-channel",
    },
    mysql: {
        host: '127.0.0.1',
        username: 'asd',
        password: 'qweqe',
        port: '3306',
        dialect: 'mysql',
        prefix: 'cmf_',
        database: 'asd',
        timezone: '+08:00',
    },
    chat:{
        history_limit: 10
    }
}