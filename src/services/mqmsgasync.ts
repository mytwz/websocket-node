/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 多进程消息同步
 * @Date: 2021-11-03 18:03:20 +0800
 * @LastEditTime: 2021-12-01 16:52:07 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\services\mqmsgasync.ts
 */

import Application from "../application";
import { getLogger, id64 } from "../utils";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { connect, Channel, ConsumeMessage } from "amqplib";
import os from "os";
import { AsyncType, BroadcastType, MsgAsync } from "../dbc";

const msgpack = require("notepack.io");
const logger = getLogger(__filename);
ioredis.prototype.keys = async function (pattern: string) {
    let cursor = 0;
    let list: string[] = [];
    do {
        let res = await this.scan(cursor, "match", pattern, "count", 2000);
        cursor = +res[0];
        list = list.concat(res[1]);
    } while (cursor != 0);

    return list;
}

export default class MQMsgAsync implements MsgAsync {
    /**组件ID： 可以在启动完毕后 app.get("msgasync") 获取到 */
    // __name__: string = "msgasync";
    /**消息通道名称 */
    private readonly channel: string;
    /**同步超时时间 */
    private readonly requestsTimeout: number;
    /**请求地址 */
    private readonly group: string;
    /**对象ID */
    private readonly id: string;
    /**请求回调 */
    private requests: Map<number, Function> = new Map();
    /**Redis 服务对象 */
    private redis: Redis = <any>null;
    /**MQ 服务通道对象 */
    private amqplibPub: Channel = <any>null;
    /**是否可以发送消息了 */
    private ispublish: boolean = false;
    /**自增序号 */
    private index: number = 0;
    /**请求ID */
    private get requestid(): number { return this.index++ > Number.MAX_VALUE - 100 ? this.index = 1 : this.index; }
    /**消息缓存 */
    private msgbuffers: Buffer[] = [];
    private survival_time: any;

    constructor(private app: Application) {
        this.requestsTimeout = this.app.get("config.mqmsgasync.requestsTimeout") || 5000;
        this.group = `udpmsgasync:${this.app.get("config.mqmsgasync.group")}`
        this.id = `${this.group}:${os.hostname()}:${id64()}`;
        this.channel = `${this.group}-${this.app.get("config.mqmsgasync.channel")}`;
    }
    /**系统启动前完成 MQ 连接 */
    private async loadBefore() {
        if (!this.app.has("config.mqmsgasync")) throw new Error("没有找到 mqmsgasync 配置")
        if (!this.app.has("config.mqmsgasync.redis")) throw new Error("没有找到 mqmsgasync.redis 配置")
        if (!this.app.has("config.mqmsgasync.amqplib")) throw new Error("没有找到 mqmsgasync.amqplib 配置")
        if (!this.app.has("config.mqmsgasync.channel")) throw new Error("没有找到 mqmsgasync.channel 配置")
        try {
            let config: RedisOptions = this.app.get("config.mqmsgasync.redis")
            this.redis = new ioredis(config);
            if (config.password) await this.redis.auth(config.password).then(_ => logger.info("Redis 验证密码成功"))
        } catch (error) {
            logger.error("连接 redis 失败", error)
            throw error;
        }

        await this.initMQ()
    }

    private async initMQ(){
        try {
            let url: string = this.app.get("config.msgasync.amqplib");
            let mqconnect = await connect(url);
            mqconnect.on("error", error => {
                logger.error("mqconnect", "异常", error);
            })
            mqconnect.on("close", error => {
                logger.error("mqconnect", "重连", error);
                clearTimeout(this.survival_time);
                this.ispublish = false;
                this.initMQ();
            })
            let mqsub = await mqconnect.createChannel();
            await mqsub.assertExchange(this.channel, "fanout", { durable: false });

            let qok = await mqsub.assertQueue("", { exclusive: false, autoDelete: true, durable: false });
            await mqsub.bindQueue(qok.queue, this.channel, "");
            await mqsub.consume(qok.queue, this.onmessage.bind(this), { noAck: true })

            this.amqplibPub = await mqconnect.createChannel();
            await this.amqplibPub.assertExchange(this.channel, "fanout", { durable: false });
            logger.info("建立 AMQPLIB 消息通道完成", qok.queue)
            // 开始存活
            this.survivalHeartbeat();
            this.ispublish = true;
        } catch (error) {
            logger.error("消息同步服务启动失败", error)
            throw error;
        }
    }

    /**定时报活 */
    private survivalHeartbeat() {
        this.redis.set(this.id, 1, "ex", 2);
        this.survival_time = setTimeout(this.survivalHeartbeat.bind(this), 1000);
    }
    
    /**获取所有存活主机的数量 */
    private async allSurvivalCount(): Promise<number> {
        let keys = await this.redis.keys(`msgasync-host*`);
        return keys.length;
    }
    /**同步消息 */
    private asyncMsg(){
        if(this.msgbuffers.length){
            let msg = null;
            while (msg = this.msgbuffers.pop()) {
                this.amqplibPub.publish(this.channel, "", msg);
            }
        }
    }

    /**
     * 发送同步消息
     * @param type 
     * @param data 
     */
    private publish<T>(id:string, type: AsyncType, requestid:number, data: any = ""): Promise<Array<T>> {
        return new Promise(async (resolve, reject) => {
            if (this.ispublish) {
                try {
                    if(type != AsyncType.response) {
                        let results:T[] = []
                        let servercount = await this.allSurvivalCount();
                        let requestoutid = setTimeout(_ => {
                            this.requests.delete(requestid)
                            reject(`Waiting for MQ to return type [${type}] message [${JSON.stringify(data)}] timed out`)
                        }, this.requestsTimeout);
                        this.requests.set(requestid, (result: T) => {
                            if(--servercount > 0){
                                results = results.concat(result)
                            }
                            else {
                                this.requests.delete(requestid)
                                clearTimeout(requestoutid)
                                resolve(results.concat(result))
                            }
                        })
                    }
                    else resolve(<any>null);
                    this.ispublish = false;
                    this.msgbuffers.push(msgpack.encode([type, id, requestid, data]))
                    this.asyncMsg();
                    this.ispublish = true;
                } catch (error) {
                    logger.error("消息同步失败", error);
                }
            }
            else reject(`发送失败: [ispublish=${this.ispublish}]`)
        })
    }

    private async onmessage(msg: ConsumeMessage | null): Promise<void> {
        if (msg && msg.content) {
            try {
                const args = msgpack.decode(msg.content);
                const type: AsyncType = args.shift();
                const id: string = args.shift();
                const requestid: number = args.shift();
                switch (type) {
                    case AsyncType.response: {
                        if (id == this.id) {
                            this.requests.get(requestid)?.call(this, args.shift());
                        }
                        break;
                    }
                    case AsyncType.broadcast: {
                        let { type, room, sid, userid, path, data } = <{ type:BroadcastType, room:string, sid: string, userid:string, path:string, data:any }>args.shift();
                        if(BroadcastType.all == type){
                            this.app.sendBroadcast(path, data);
                        }
                        else if(BroadcastType.room == type){
                            this.app.sendRoom(room, path, data);
                        }
                        else if (BroadcastType.user == type) {
                            this.app.sendUser(userid, path, data);
                        }
                        else if (BroadcastType.socket == type) {
                            this.app.send(sid, path, data);
                        }
                        this.publish(id, AsyncType.response, requestid);
                        break;
                    }
                    case AsyncType.roomall: {
                        this.publish(id, AsyncType.response, requestid, [...this.app.rooms.keys()]);
                        break;
                    }
                    case AsyncType.clientTotal: {
                        this.publish(id, AsyncType.response, requestid, this.app.clients.size);
                        break;
                    }
                    case AsyncType.roomsByuserid: {
                        let userid:string = args.shift()
                        let sessionids = this.app.users.get(userid) || [];
                        let rooms: string[] = [];
                        for(let id of sessionids) {
                            let roomlist = this.app.roomids.get(id) || [];
                            rooms = rooms.concat([...roomlist]);
                        }
                        this.publish(id, AsyncType.response, requestid, rooms);
                        break;
                    }
                    case AsyncType.clientTotalByuserid: {
                        let userid: string = String(args.shift());
                        this.publish(id, AsyncType.response, requestid, this.app.users.get(userid)?.size);
                        break;
                    }
                    case AsyncType.clientTotalByroomidAnduserid: {
                        let { roomid, uid } = args.shift();
                        roomid = String(roomid), uid = String(uid);
                        let sids = this.app.users.get(uid) || new Set();
                        this.publish(id, AsyncType.response, requestid, [...sids].filter(id => this.app.roomids.get(id)?.has(roomid)).length);
                        break;
                    }
                    case AsyncType.clientTotalByroomid: {
                        let roomid = args.shift();
                        roomid = String(roomid);
                        this.publish(id, AsyncType.response, requestid, this.app.rooms.get(roomid)?.size);
                        break;
                    }
                    default:
                        break;
                }
            } catch (error) {
                logger.error("解析数据失败", error);
            }
        }
    }
    
    /**统计某个用户在某个房间的客户端总数 */
    public async getClientTotalByroomidAnduserid(roomid: string, uid: string): Promise<number> {
        let list: number[] = await this.publish(this.id, AsyncType.clientTotalByroomidAnduserid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**统计某个用户的客户端总数 */
    public async getClientTotalByuserid(uid: string): Promise<number> {
        let list: number[] = await this.publish(this.id, AsyncType.clientTotalByuserid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }

    /**获取某个房间下所有的客户端总数 */
    public async getClientTotalByroomid(roomid: string): Promise<number> {
        let list: number[] = await this.publish(this.id, AsyncType.clientTotalByroomid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的客户端总数 */
    public async getClientTotal(): Promise<number> {
        let list:number[] = await this.publish(this.id, AsyncType.clientTotal, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的房间号 */
    public async getRoomall(): Promise<string[]>{
        let list: string[][] = await this.publish(this.id, AsyncType.roomall, this.requestid);
        return list.reduce((rs:string[], r:string[]) => rs.concat(r), []);
    }
    /**获取某个用户所加入的所有房间号 */
    public getRoomByuserid(userid:string): Promise<string[]>{
        return this.publish(this.id, AsyncType.roomsByuserid, this.requestid, userid);
    }
    /**向分布式集群发送消息广播 */
    public sendBroadcast(sid: string, path: string, data: any) {
        logger.info(`[${sid}][sendBroadcast] - all`, {path, data});
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.all, path, data });
    }
    /**向分布式集群发送房间消息广播 */
    public sendRoom(sid: string, room: string, path: string, data: any) {
        logger.info(`[${sid}][sendRoom] - ${room}`, {path, data});
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.room, room, path, data });
    }
    /**向分布式集群某个用户发送消息广播 */
    public sendUser(sid: string, touserid: string, path: string, data: any) {
        logger.info(`[${sid}][sendUser] - ${touserid}`, { path, data });
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.user, userid: touserid, path, data });
    }
    /**向分布式集群某个连接发送消息广播 */
    public send(sid: string, path: string, data: any) {
        logger.info(`[${sid}][send] - socket`, { path, data });
        if (this.app.clients.has(sid)) {
            this.app.send(sid, path, data);
        }
        else this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.socket, sid, path, data });
    }
}