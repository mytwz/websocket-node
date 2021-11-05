/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主文件，入口文件
 * @Date: 2021-11-03 10:51:45 +0800
 * @LastEditTime: 2021-11-05 16:46:38 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\index.ts
 */
import Application from "./application"
import config from "./config"
import { getLogger } from "./utils";
import log4j from "log4js";
import path from "path"
import http from "http";
import Koa from "koa";
import KoaStatic from "koa-static";
import cluster from "cluster";
import os from "os";
log4j.configure(config.log4j)
const logger = getLogger(__filename);

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: string;
            NODE_PORT: number;
        }
    }
}
// 从命令行参数获取到环境变量和端口号
process.env.NODE_ENV = process.argv[2];
process.env.NODE_PORT = +process.argv[3];

///全局异常
// 捕获普通异常
process.on('uncaughtException', function (err) {
    logger.error('uncaughtException Caught exception', err);
});

// 捕获async异常
process.on('unhandledRejection', (reason, p) => {
    logger.error('Caught Unhandled Rejection at ' + reason, p);
});

function load(isCluster: boolean = false) {
    if(isCluster && cluster.isMaster) for (let i = 0, l = os.cpus().length; i < l; i++) cluster.fork();
    else {
        const app = new Koa();
        const server = http.createServer(app.callback())
        app.use(KoaStatic(path.join(__dirname, "../static")))
        // 与 Koa 共用一个 HTTPService 对象，方便以后需要 HTTP 接口扩展
        server.listen(+(process.env.NODE_PORT || 8080), function () {
            Application.start({ server }).on("load", function (app: Application) {
                app.complete()
            })
        })
    }
}

// 从命令行参数中获取是否需要以集群的方式启动
load(!!process.argv[4]);

logger.info("启动参数", process.argv)
