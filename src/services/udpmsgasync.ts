/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-12-01 16:16:03 +0800
 * @LastEditTime: 2021-12-02 12:14:20 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\services\udpmsgasync.ts
 */

import Application from "../application";
import { AsyncType, BroadcastType, INTERNAL_IP, MsgAsync } from "../dbc";
import dgram from "dgram";
import RedisDBC from "../dbc/redis";
import os from "os";
import { getLogger } from "../utils";
import { ONE_SECOND } from "../dbc/constants";

const msgpack = require("notepack.io");
const logger = getLogger(__filename);

type Address = dgram.BindOptions;


export default class HttpMsgAsync implements MsgAsync {
    
    private __name__: string = "msgasync"

    private server: dgram.Socket = <any>null;
    private readonly md5Key: string;
    /**请求地址 */
    private readonly address:Address;
    /**请求地址 */
    private readonly group: string;
    /**对象ID */
    private readonly id: string;
    /**Redis 服务对象 */
    private redis: RedisDBC = <any>null;
    private survival_time: any;
    /**自增序号 */
    private index: number = 0;
    /**请求ID */
    private get requestid(): number { return this.index++ > Number.MAX_VALUE - 100 ? this.index = 1 : this.index; }
    private restarts_count:number = 0
    private restarts_timer:number = 0
    /**请求回调 */
    private requests: Map<number, Function> = new Map();
    /**同步超时时间 */
    private readonly requestsTimeout: number;

    constructor(private app: Application) {
        const port = this.app.port - 1000;
        this.md5Key = this.app.get("config.udpmsgasync.md5key")
        this.group = `udpmsgasync:${this.app.get("config.udpmsgasync.group")}`
        this.address = { address: INTERNAL_IP, port: port , exclusive: false};
        this.id = `${this.group}:${os.hostname()}:${port}`;

        this.restarts_count = this.app.get("config.udpmsgasync.restarts_count")
        this.restarts_timer = this.app.get("config.udpmsgasync.restarts_timer")
        this.requestsTimeout = this.app.get("config.udpmsgasync.requests_timeout") || 15000;
    }

    private loadAfter(): void {
        this.redis = this.app.get("redis");
        this.survivalHeartbeat();
        logger.info("启动消息同步地址", this.address)
    }

    private async loadBefore() {
        if (!this.app.has("config.udpmsgasync.group")) throw new Error("没有找到 udpmsgasync.group 配置")
        this.init();
    }

    private init(){
        if(this.server){
            this.server.removeAllListeners();
            this.server = <any>null;
        }
        this.server = dgram.createSocket("udp4");
        this.server.on("close", () => {
            logger.error("UDP 消息服务关闭"); 
            if(--this.restarts_count > 0){
                setTimeout(this.init.bind(this), this.restarts_timer);
            }
        })
        this.server.on("error", (err: Error) => logger.error("UDP 消息服务发生异常", err))
        this.server.on("listening", () => { logger.info("UDP 消息服务正在监听"); this.restarts_count = this.app.get("config.udpmsgasync.restarts_count") })
        this.server.on("message", this.onmessage.bind(this))
        this.server.bind(this.address)
    }

    private async onmessage(msg: Buffer, rinfo: dgram.RemoteInfo){
        if (!msg) return ;
        try {
            const args = msgpack.decode(msg);
            const type: AsyncType = args.shift();
            const requestid: number = args.shift();

            switch (type) {
                case AsyncType.response: {
                    this.requests.get(requestid)?.call(this, args.shift());
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
                    this.sendUDP(AsyncType.response, requestid, "", rinfo);
                    break;
                }
                case AsyncType.roomall: {
                    this.sendUDP(AsyncType.response, requestid, [...this.app.rooms.keys()], rinfo);
                    break;
                }
                case AsyncType.clientTotal: {
                    this.sendUDP(AsyncType.response, requestid, this.app.clients.size, rinfo);
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
                    this.sendUDP(AsyncType.response, requestid, rooms, rinfo);
                    break;
                }
                case AsyncType.clientTotalByuserid: {
                    let userid: string = String(args.shift());
                    this.sendUDP(AsyncType.response, requestid, this.app.users.get(userid)?.size, rinfo);
                    break;
                }
                case AsyncType.clientTotalByroomidAnduserid: {
                    let { roomid, uid } = args.shift();
                    roomid = String(roomid), uid = String(uid);
                    let sids = this.app.users.get(uid) || new Set();
                    this.sendUDP(AsyncType.response, requestid, [...sids].filter(id => this.app.roomids.get(id)?.has(roomid)).length, rinfo);
                    break;
                }
                case AsyncType.clientTotalByroomid: {
                    let roomid = args.shift();
                    roomid = String(roomid);
                    this.sendUDP(AsyncType.response, requestid, this.app.rooms.get(roomid)?.size, rinfo);
                    break;
                }
                default:
                    break;
            }
        } catch (error) {
            logger.error("解析数据失败", error);
        }
    }

    private async sendUDP(type:AsyncType, requestid:number, data: any, addr: Address){
        this.server.send(msgpack.encode([type, requestid, data]), addr.port, addr.address);
    }

    private async sendUDPBroadcast(type:AsyncType, requestid:number, data: any){
        const addrs = await this.allSurvivals();
        for(let addr of addrs){
            try {
                this.sendUDP(type, requestid, data, addr);
            } catch (error) {
                logger.error("sendUDPBroadcast", { type, data, addr }, error)
            }
        }
    }

    private publish<T>(type: AsyncType, requestid:number, data: any = ""): Promise<Array<T>> {
        return new Promise(async (resolve, reject) => {
            try {
                if(type != AsyncType.response) {
                    let results:T[] = []
                    let servercount = await this.allSurvivalCount();
                    let requestoutid = setTimeout(_ => { this.requests.delete(requestid); resolve(results) }, this.requestsTimeout);
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
                
                this.sendUDPBroadcast(type, requestid, data)
            } catch (error) {
                logger.error("消息同步失败", error);
            }
        })
    }

    /**定时报活 */
    private survivalHeartbeat() {
        this.redis.setObject(this.id, this.address, ONE_SECOND * 2);
        this.survival_time = setTimeout(this.survivalHeartbeat.bind(this), 1000);
    }

    /**获取所有存活主机的数量 */
    private async allSurvivalCount(): Promise<number> {
        let keys = await this.redis.keys(`${this.group}*`);
        return keys.length;
    }

    /**获取所有存活主机的请求地址 */
    private async allSurvivals(): Promise<Address[]> {
        let keys = await this.redis.keys(`${this.group}*`);
        let origins: Address[] = [];
        for (let key of keys || []) {
            let addr = await this.redis.getObject<Address>(key);
            if (addr) origins.push(addr)
        }
        return origins;
    }

    /**统计某个用户在某个房间的客户端总数 */
    public async getClientTotalByroomidAnduserid(roomid: string, uid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByroomidAnduserid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**统计某个用户的客户端总数 */
    public async getClientTotalByuserid(uid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByuserid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }

    /**获取某个房间下所有的客户端总数 */
    public async getClientTotalByroomid(roomid: string): Promise<number> {
        let list: number[] = await this.publish(AsyncType.clientTotalByroomid, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的客户端总数 */
    public async getClientTotal(): Promise<number> {
        let list:number[] = await this.publish(AsyncType.clientTotal, this.requestid);
        return list.filter(e => e).reduce((a, b) => a + b, 0);
    }
    /**获取所有的房间号 */
    public async getRoomall(): Promise<string[]>{
        let list: string[][] = await this.publish(AsyncType.roomall, this.requestid);
        return list.reduce((rs:string[], r:string[]) => rs.concat(r), []);
    }
    /**获取某个用户所加入的所有房间号 */
    public getRoomByuserid(userid:string): Promise<string[]>{
        return this.publish(AsyncType.roomsByuserid, this.requestid, userid);
    }
    /**向分布式集群发送消息广播 */
    public sendBroadcast(sid: string, path: string, data: any) {
        logger.info(`[${sid}][sendBroadcast] - all`, {path, data});
        this.publish(AsyncType.broadcast, this.requestid, { type: BroadcastType.all, path, data });
    }
    /**向分布式集群发送房间消息广播 */
    public sendRoom(sid: string, room: string, path: string, data: any) {
        logger.info(`[${sid}][sendRoom] - ${room}`, {path, data});
        this.publish(AsyncType.broadcast, this.requestid, { type: BroadcastType.room, room, path, data });
    }
    /**向分布式集群某个用户发送消息广播 */
    public sendUser(sid: string, touserid: string, path: string, data: any) {
        logger.info(`[${sid}][sendUser] - ${touserid}`, { path, data });
        this.publish(AsyncType.broadcast, this.requestid, { type: BroadcastType.user, userid: touserid, path, data });
    }
    /**向分布式集群某个连接发送消息广播 */
    public send(sid: string, path: string, data: any) {
        logger.info(`[${sid}][send] - socket`, { path, data });
        if (this.app.clients.has(sid)) {
            this.app.send(sid, path, data);
        }
        else this.publish(AsyncType.broadcast, this.requestid, { type: BroadcastType.socket, sid, path, data });
    }

}