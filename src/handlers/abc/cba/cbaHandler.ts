/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 16:21:24 +0800
 * @LastEditTime: 2021-11-05 12:08:13 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\handlers\abc\cba\cbaHandler.ts
 */

import Application, { Session } from "../../../application";
import { getLogger } from "../../../utils";
const logger = getLogger(__filename)

export default class Abc  {

    constructor(private app: Application) {
    }

    public test(message: any, session: Session){
        logger.info("收到消息: ", message)
        this.app.sendBroadcast("test", message);
    }
}