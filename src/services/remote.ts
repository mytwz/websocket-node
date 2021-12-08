/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-23 18:20:55 +0800
 * @LastEditTime: 2021-12-08 09:04:01 +0800
 * @FilePath: /websocket-node/src/services/remote.ts
 */

import Application from "../application";
import { ONE_SECOND } from "../dbc/constants";
import RedisDBC from "../dbc/redis";
import { HTTPGet } from "../utils";

interface CheckUserStatus {
    data:{ code:string, info: string }
}

export default class RemoteAPi {

    private __name__:string = "remoteapi";
    private redis: RedisDBC = <any>null;

    constructor(private app: Application){}
    private async loadAfter() {
        this.redis = this.app.get("redis");
    }

}