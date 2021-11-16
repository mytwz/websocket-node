/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-15 09:24:03 +0800
 * @LastEditTime: 2021-11-15 17:43:34 +0800
 * @FilePath: \pj-node-imserver-v3\src\index.ts
 */

import Application from "./application"
import { getLogger } from "./utils";
import http from "http";
import Koa from "koa";
import path from "path"
import KoaStatic from "koa-static";

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

const app = new Koa().use(KoaStatic(path.join(__dirname, "../static")))
const server = http.createServer(app.callback())
server.listen(80, function(){
    Application.start(server, {
        // perMessageDeflate: false,
        // pingTimeout: 10000,
        // pingInterval: 6000,
    })
})
