/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 15:50:14 +0800
 * @LastEditTime: 2021-11-05 12:00:54 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\handlers\userHandler.ts
 */

import Application, { Session } from "../application";
import { getLogger } from "../utils";
const logger = getLogger(__filename)

export default class User {

    constructor(private app: Application) {
    }

    public test(message: any, session: Session){
        logger.info("收到消息: ", message)
        session.send("test", message);
    }
}
