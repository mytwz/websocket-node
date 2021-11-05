import Application, { Session } from "../../application";
import MsgAsync from "../../services/msgasync";
import { getLogger } from "../../utils";

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 16:21:16 +0800
 * @LastEditTime: 2021-11-05 14:41:05 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\handlers\abc\abcHandler.ts
 */
const logger = getLogger(__filename)

export default class User {
    
    private msgAsync: MsgAsync = <any>null;

    constructor(private app: Application) {
        
    }

    private loadAfter(){
        
        this.msgAsync = this.app.get("msgasync");
    }

    public async test(message: any, session: Session){
        let total = await this.msgAsync.getClientTotal();
        logger.info("客户端总数：", total, ", 收到消息: ", message)
        this.msgAsync.sendBroadcast("test", message);
    }
}
