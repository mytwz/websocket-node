/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:31:35 +0800
 * @LastEditTime: 2021-11-05 16:38:45 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\config\test.ts
 */
export default {
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