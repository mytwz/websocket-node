/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:35:06 +0800
 * @LastEditTime: 2021-11-08 15:49:23 +0800
 * @FilePath: /websocket-node/src/config/local.ts
 */

export default {
    redis:{
        host:"127.0.0.1",
        port: '6379',
    },
    msgasync:{
        redis:{
            host:"127.0.0.1",
            port: '6379',
        },
        amqplib:"amqp://user:123@101235",
        channel:"",
    },
}