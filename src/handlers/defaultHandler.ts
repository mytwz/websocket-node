/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-16 10:08:42 +0800
 * @LastEditTime: 2021-11-16 10:37:02 +0800
 * @FilePath: \pj-node-imserver-v3\src\handlers\defaultHandler.ts
 */

import Application, { Session } from "../application";
import { getLogger } from "../utils";
const logger = getLogger(__filename)

export default class DefaultHandler {
    
    constructor(private app: Application){}

    test(message: any, session: Session){
        logger.info("收到消息-test", message);
        session.send("test", message);
    }

    
}