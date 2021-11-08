/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主文件，入口文件
 * @Date: 2021-11-03 10:51:45 +0800
 * @LastEditTime: 2021-11-08 16:37:13 +0800
 * @FilePath: /websocket-node/src/index.ts
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



///全局异常
// 捕获普通异常
process.on('uncaughtException', function (err) {
    logger.error('uncaughtException Caught exception', err);
});

// 捕获async异常
process.on('unhandledRejection', (reason, p) => {
    logger.error('Caught Unhandled Rejection at ' + reason, p);
});

const app = new Koa();
const server = http.createServer(app.callback())
app.use(KoaStatic(path.join(__dirname, "../static")))
// 与 Koa 共用一个 HTTPService 对象，方便以后需要 HTTP 接口扩展
server.listen(+(process.env.NODE_PORT || 8080), function () {
    Application.start({ server }).on("load", function (app: Application) {
        app.complete()
    })
})
