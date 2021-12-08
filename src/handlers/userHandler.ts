/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 15:50:14 +0800
 * @LastEditTime: 2021-12-08 09:01:24 +0800
 * @FilePath: /websocket-node/src/handlers/userHandler.ts
 */

import Application, { Session } from "../application";
import { getLogger, randomInt } from "../utils";
import RedisDBC from "../dbc/redis";
import { ChatMsgItem, ChatMsgItemType, ErrorCode, HALL_ROOMID, HandleData, MsgAsync, UserInfo, USER_ONLINE } from "../dbc";
import BannedWordFilter from "../utils/wordfilter";
import { BanRoomKeyword } from "../dbc/mysql";
import { ONE_SECOND } from "../dbc/constants";
import _ from "lodash";
import RemoteAPi from "../services/remote";
import v8 from "v8"

const logger = getLogger(__filename)

export default class UserHandler {

    private msgasync: MsgAsync = <any>null;;
    private redis: RedisDBC = <any>null;
    private systemBannedWordFilter: BannedWordFilter = <any>null;
    private remote: RemoteAPi = <any>null;

    constructor(private app: Application) {
        app.on<this>("chatmsg", (sid: string, roomid: string, item: ChatMsgItem) => {
            if (HALL_ROOMID != roomid) {
                this.msgasync.sendRoom(sid, HALL_ROOMID, "chatmsg", item);
                this.redis.saveObjectListItem("chatHistory:" + HALL_ROOMID, item, this.app.get<number>("config.chat.history_limit"));
            }
            this.msgasync.sendRoom(sid, roomid, "chatmsg", item);
            this.redis.saveObjectListItem("chatHistory:" + roomid, item, this.app.get<number>("config.chat.history_limit"));
            // this.msgasync.sendBroadcast(sid, "chatmsg", item);
        })
    }

    private async loadAfter() {
        this.msgasync = this.app.get("msgasync");
        this.redis = this.app.get("redis");
        this.systemBannedWordFilter = this.app.get("wordfilter.system")
        this.remote = this.app.get("remoteapi")
    }
}

