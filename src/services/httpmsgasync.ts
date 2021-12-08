/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 使用 HTTP 服进行消息同步
 * @Date: 2021-11-24 15:03:26 +0800
 * @LastEditTime: 2021-12-02 12:14:15 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\services\httpmsgasync.ts
 */

import Application from "../application";
import { MsgAsync, INTERNAL_IP, USER_ONLINE, UserInfo, HALL_ROOMID, AsyncType, BroadcastType } from "../dbc";
import KoaRouter from "koa-router"
import { Context } from "koa"
import os from "os";
import RedisDBC from "../dbc/redis";
import { id64, getLogger, MD5 } from "../utils";
import { ONE_SECOND } from "../dbc/constants";
import request from "request";

const logger = getLogger(__filename);


interface Message {
    type: AsyncType,
    data: any;
    timestamp?: number;
    sign?: string;
}

interface Res {
    code: number;
    reason: string,
    data?: any;
}

function POST<T>(url: string, data: any): Promise<T> {
    return new Promise((resolve, reject) => {
        request.post(url += (url.includes("?") ? "&t=" : "?t=") + Date.now(), {
            json: true,
            form: data
        }, (error, response, body) => {
            if (error) {
                return reject(error);
            }
            resolve(body)
        });
    })
}

function keySort(data: any): string {
    return Object.keys(data).sort().filter(k => data[k]).reduce((url, k) => url += "&" + data[k], "").substr(1)
}

function sign(data: any, key: string): Message {
    data.sign = MD5(keySort((data.timestamp = Date.now(), data)) + "&" + key)
    return data;
}

function verifySign(data: any, key: string): boolean {
    const sign = data.sign;
    delete data.sign;
    const vsign = MD5(keySort(data) + "&" + key)
    return vsign == sign;
}

export default class HttpMsgAsync extends KoaRouter implements MsgAsync {

    private __name__: string = "";//"msgasync"
    private readonly md5Key: string;
    /**请求地址 */
    private readonly address: string;
    /**请求地址 */
    private readonly group: string;
    /**对象ID */
    private readonly id: string;
    /**Redis 服务对象 */
    private redis: RedisDBC = <any>null;
    private survival_time: any;

    constructor(private app: Application) {
        super();
        this.md5Key = this.app.get("config.httpmsgasync.md5key")
        this.group = `httpmsgasync:${this.app.get("config.httpmsgasync.group")}`
        this.address = `http://${INTERNAL_IP}:${this.app.port}/${this.__name__}`
        this.id = `${this.group}:${os.hostname()}:${this.app.port}`;

        this.post(`/${this.__name__}`, this.onmessage.bind(this))
        this.app.use(this.routes()).use(this.allowedMethods());
    }

    private loadAfter(): void {
        this.redis = this.app.get("redis");
        this.survivalHeartbeat();
        logger.info("启动消息同步地址", this.address)
    }

    private async loadBefore() {
        if (!this.app.has("config.httpmsgasync.md5key")) throw new Error("没有找到 httpmsgasync.md5key 配置")
        if (!this.app.has("config.httpmsgasync.group")) throw new Error("没有找到 httpmsgasync.group 配置")
    }

    /**定时报活 */
    private survivalHeartbeat() {
        this.redis.setValue(this.id, this.address, ONE_SECOND * 2);
        this.survival_time = setTimeout(this.survivalHeartbeat.bind(this), 1000);
    }

    /**获取所有存活主机的请求地址 */
    private async allSurvivals(): Promise<string[]> {
        let keys = await this.redis.keys(`${this.group}*`);
        let origins: string[] = [];
        for (let key of keys || []) {
            let url = await this.redis.getValue(key);
            if (url) origins.push(url)
        }
        return origins;
    }

    private handler<T>(message: Message): T {
        switch (message.type) {
            case AsyncType.broadcast: {
                let { type, room, sid, userid, path, data } = <{ type: BroadcastType, room: string, sid: string, userid: string, path: string, data: any }>message.data;
                if (BroadcastType.all == type) {
                    this.app.sendBroadcast(path, data);
                }
                else if (BroadcastType.room == type) {
                    this.app.sendRoom(room, path, data);
                }
                else if (BroadcastType.user == type) {
                    this.app.sendUser(userid, path, data);
                }
                else if (BroadcastType.socket == type) {
                    this.app.send(sid, path, data);
                }
                break;
            }
            case AsyncType.roomall: {
                return <T><any>[...this.app.rooms.keys()];
            }
            case AsyncType.clientTotal: {
                return <T><any>this.app.clients.size;
            }
            case AsyncType.roomsByuserid: {
                let userid: string = String(message.data);
                let sessionids = this.app.users.get(userid) || [];
                let rooms: string[] = [];
                for (let id of sessionids) {
                    let roomlist = this.app.roomids.get(id) || [];
                    rooms = rooms.concat([...roomlist]);
                }
                return <T><any>rooms;
            }
            case AsyncType.clientTotalByuserid: {
                let userid: string = String(message.data);
                return <T><any>(this.app.users.get(userid)?.size);
            }
            case AsyncType.clientTotalByroomidAnduserid: {
                let { roomid, uid } = message.data;
                roomid = String(roomid), uid = String(uid);
                let sids = this.app.users.get(uid) || new Set();
                return <T><any>([...sids].filter(id => this.app.roomids.get(id)?.has(roomid)).length);
            }
            case AsyncType.clientTotalByroomid: {
                let roomid = message.data;
                roomid = String(roomid);
                return <T><any>(this.app.rooms.get(roomid)?.size);
            }

            default:
                break;
        }

        return <T><any>null
    }

    private async onmessage(ctx: Context): Promise<void> {
        const { data } = ctx.request.body;
        const res: Res = { code: 200, reason: "" }
        try {
            const message = JSON.parse(data);
            if (verifySign(message, this.md5Key)) {
                res.data = this.handler(message)
            }
            else {
                res.code = 400;
                res.reason = "无效消息"
            }
        } catch (error) {
            res.code = 400;
            res.reason = "无效消息"
            logger.error("onmessage", "无效消息", data, ctx.request.URL)
        }

        ctx.body = res
    }

    /**
     * 发送同步消息
     * @param type 
     * @param data 
     */
    private async publish<T>(type: AsyncType, data: any = ""): Promise<Array<T>> {
        const urls = await this.allSurvivals();
        let results: T[] = []
        for (let url of urls) {
            try {
                if (this.address == url) results.push(this.handler({ type, data }));
                else {
                    let res: Res = await POST(url, { data: JSON.stringify(sign({ type, data }, this.md5Key)) });
                    if (res.code == 200) {
                        results.push(res.data);
                    }
                }
            } catch (error) {
                logger.error("消息同步失败", error);
            }
        }

        return results;
    }

    /**统计某个用户在某个房间的客户端总数 */
    public async getClientTotalByroomidAnduserid(roomid: string, uid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByroomidAnduserid, { roomid, uid });
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**统计某个用户的客户端总数 */
    public async getClientTotalByuserid(uid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByuserid, uid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }

    /**获取某个房间下所有的客户端总数 */
    public async getClientTotalByroomid(roomid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByroomid, roomid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的客户端总数 */
    public async getClientTotal(): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotal);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的房间号 */
    public async getRoomall(): Promise<string[]> {
        let list: string[][] = await this.publish(AsyncType.roomall);
        return list.reduce((rs:string[], r:string[]) => rs.concat(r), []);
    }
    /**获取某个用户所加入的所有房间号 */
    public getRoomByuserid(userid: string): Promise<string[]> {
        return this.publish(AsyncType.roomsByuserid, userid);
    }
    /**向分布式集群发送消息广播 */
    public sendBroadcast(sid: string, path: string, data: any) {
        logger.info(`[${sid}][sendBroadcast] - all`, { path, data });
        this.publish(AsyncType.broadcast, { type: BroadcastType.all, path, data });
    }
    /**向分布式集群发送房间消息广播 */
    public sendRoom(sid: string, room: string, path: string, data: any) {
        logger.info(`[${sid}][sendRoom] - ${room}`, { path, data });
        this.publish(AsyncType.broadcast, { type: BroadcastType.room, room, path, data });
    }
    /**向分布式集群某个用户发送消息广播 */
    public sendUser(sid: string, touserid: string, path: string, data: any) {
        logger.info(`[${sid}][sendUser] - ${touserid}`, { path, data });
        this.publish(AsyncType.broadcast, { type: BroadcastType.user, userid: touserid, path, data });
    }
    /**向分布式集群某个连接发送消息广播 */
    public send(sid: string, path: string, data: any) {
        logger.info(`[${sid}][send] - socket`, { path, data });
        if (this.app.clients.has(sid)) {
            this.app.send(sid, path, data);
        }
        else this.publish(AsyncType.broadcast, { type: BroadcastType.socket, sid, path, data });
    }
}