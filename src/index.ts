/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序主文件，入口文件
 * @Date: 2021-11-03 10:51:45 +0800
 * @LastEditTime: 2021-11-24 15:21:37 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\index.ts
 */
import Application from "./application"
import { getLogger } from "./utils";

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

Application.start(+(process.env.NODE_PORT = process.env.NODE_PORT || "8080"));
