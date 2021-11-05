/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 多进程消息同步
 * @Date: 2021-11-03 18:03:20 +0800
 * @LastEditTime: 2021-11-05 17:17:32 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\services\msgasync.ts
 */

import Application from "../application";
import { getLogger, id24 } from "../utils";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { connect, Channel, ConsumeMessage } from "amqplib";
import os from "os";

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
/**同步类型 */
enum AsyncType {
    /**广播 */
    broadcast,
    /**获取所有的房间号 */
    roomall,
    /**获取某个客户端所加入的房间号 */
    useridByroom,
    /**统计所有客户端总数 */
    clientTotal,
    //////////////////
    /**响应 */
    response
}
/**消息广播范围 */
enum BroadcastType {
    all, room, user
}

export default class MsgAsync {
    /**组件ID： 可以在 app.get("msgasync") 获取到 */
    __name__: string = "msgasync";
    /**消息通道名称 */
    private readonly channel: string;
    /**同步超时时间 */
    private readonly requestsTimeout: number;
    /**对象ID */
    private readonly id: string = `msgasync-host:${os.hostname()}:${id24()}`;
    /**请求回调 */
    private readonly requests: Map<number, Function> = new Map();
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

    constructor(private app: Application) {
        if (!this.app.has("config.msgasync")) throw new Error("没有找到 msgasync 配置")
        if (!this.app.has("config.msgasync.redis")) throw new Error("没有找到 msgasync.redis 配置")
        if (!this.app.has("config.msgasync.amqplib")) throw new Error("没有找到 msgasync.amqplib 配置")
        if (!this.app.has("config.msgasync.channel")) throw new Error("没有找到 msgasync.channel 配置")

        this.channel = this.app.get("config.msgasync.channel");
        this.requestsTimeout = this.app.get("config.msgasync.requestsTimeout") || 5000;
    }
    /**系统启动前完成 MQ 连接 */
    private async loadBefore() {
        try {
            let config: RedisOptions = this.app.get("config.msgasync.redis")
            this.redis = new ioredis(config);
            if (config.password) this.redis.auth(config.password).then(_ => logger.info("Redis 验证密码成功"))

            let url: string = this.app.get("config.msgasync.amqplib");
            let mqconnect = await connect(url);
            mqconnect.on("error", error => { throw error; })
            let mqsub = await mqconnect.createChannel();
            await mqsub.assertExchange(this.channel, "fanout", { durable: false });

            let qok = await mqsub.assertQueue("", { exclusive: false, autoDelete: true, durable: false }); logger.info("QOK", qok.queue);
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
        setTimeout(this.survivalHeartbeat.bind(this), 1000);
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
                        let { type, room, userid, path, data } = <{ type:BroadcastType, room:string, userid:string, path:string, data:any }>args.shift();
                        if(BroadcastType.all == type){
                            this.app.sendBroadcast(path, data);
                        }
                        else if(BroadcastType.room == type){
                            this.app.sendRoom(room, path, data);
                        }
                        else if(BroadcastType.user == type){
                            this.app.send(userid, path, data);
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
                    case AsyncType.useridByroom: {
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
                    default:
                        break;
                }
            } catch (error) {
                logger.error("解析数据失败", error);
            }
        }
    }
    /**获取所有的客户端总数 */
    public async getClientTotal(): Promise<number>{
        let list:number[] = await this.publish(this.id, AsyncType.clientTotal, this.requestid);
        return list.reduce((a, b) => a+b, 0);
    }
    /**获取所有的房间号 */
    public getRoomall(): Promise<string[]>{
        return this.publish(this.id, AsyncType.roomall, this.requestid);
    }
    /**获取某个用户所加入的所有房间号 */
    public getRoomByuserid(userid:string): Promise<string[]>{
        return this.publish(this.id, AsyncType.useridByroom, this.requestid, userid);
    }
    /**向分布式集群发送消息广播 */
    public sendBroadcast(path: string, data: any) {
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.all, path, data });
    }
    /**向分布式集群发送房间消息广播 */
    public sendRoom(room: string, path: string, data: any) {
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.room, room, path, data });
    }
    /**向分布式集群某个用户发送消息广播 */
    public send(userid: string, path: string, data: any) {
        this.publish(this.id, AsyncType.broadcast, this.requestid, { type: BroadcastType.user, userid, path, data });
    }
}