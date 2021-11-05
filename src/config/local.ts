/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:35:06 +0800
 * @LastEditTime: 2021-11-05 17:29:23 +0800
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
    log4j:{
        appenders: {
            console: {
                type: "console",
                layout: {
                    type: "pattern",
                    pattern: `%[[%h][%z][%d{yyyy/MM/dd-hh:mm:ss:SSS}] [%p] %c -%] %m`
                }
            },
            "pinus-rpc": {
                type: "file",
                filename: "${opts:base}/logs/pinus-rpc-${opts:serverId}.log",
                maxLogSize: 1048576,
                layout: {
                    type: "basic"
                },
                backups: 5
            }
        },
    
        categories: {
            default: {
                appenders: ["console"],
                level: "debug"
            },
        },
        // pm2: true,
        // instance_var: "INSTANCE_ID",
        replaceConsole: true,
        lineDebug: false,
        errorStack: true
    }
}