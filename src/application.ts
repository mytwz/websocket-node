/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-12 16:52:47 +0800
 * @LastEditTime: 2021-11-16 10:53:59 +0800
 * @FilePath: /websocket-node/src/application.ts
 */

import http = require('http');
import { IncomingMessage } from "http";
import { EventEmitter } from 'events';
import { id24, JSFilescan, getLogger, Logger, MD5 } from "./utils";
import { Component, ErrorCode, MessageData } from "./dbc";
import requestIp, { Request } from "request-ip"
import _ from "lodash";
import path from "path";
import config from "./config";
import * as engine from "engine.io";
import * as parser from "socket.io-parser";

const logger = getLogger(__filename)

/**
 * 消息处理器
 */
 const MessageHandler = new class MessageHandler {
    private logger: Logger = getLogger("messagehandler");
    /**所有的消息处理器都会自动注入到这里 */
    private readonly handlers: { [name: string]: Component } = {};
    /**这个列表主要是方便在启动后统一进行启动后函数回调 */
    private readonly objectList: Component[] = [];
    /**启动文件扫描自动加载消息处理器对象 */
    public async load(app: Application) {
        for (let { key, ObjClass } of await JSFilescan(path.join(__dirname, "./handlers"))) {
            // 名称结尾为 Handler 的 JS 文件都视为消息处理器组件
            if (key.endsWith("Handler")) {
                let obj = new ObjClass(app);
                if (typeof obj.loadBefore == "function") await obj.loadBefore();
                if (obj.__name__) app.set(obj.__name__, obj);
                this.objectList.push(this.handlers[key] = obj);
                this.logger.info("load", key)
            }
        }
    }
    /**程序启动后调用 */
    public async loadAfter() {
        for (let obj of this.objectList) if (typeof (obj.loadAfter) == "function") await obj.loadAfter.call(obj);
    }
    /**
     * 根据消息路径自动匹配到处理器的指定方法并执行
     * @param object 前端传过来的消息对象
     * @param object.path 处理器路径：路劲层次使用 . 隔开并且最后一位单次视为最终做出响应的方法。如：abc.abc.aa.Handler.test, 其中 abc.abc.aa.Handler 是处理器对象地址，test 是处理器中最终处理消息的指定方法
     * @param object.data 携带数据
     * @param session 客户端连接对象
     */
    public handle(path:string, data:any, session: Session) {
        let index = path.lastIndexOf(".");
        let name = index > -1 ? path.substr(0, index) : "defaultHandler";
        let key = path.substr(index + 1);
        this.logger.info("handle", { index, name, key })
        if(this.handlers[name] && typeof this.handlers[name][key] == "function"){
            let handle: Function = this.handlers[name][key];
            handle.call(this.handlers[name], data, session);
        }
    }
}

/**
 * 其他组件扫描
 */
const ComponentScan = new class ComponentScan {
    private logger: Logger = getLogger("componentscan");
    private readonly components: { [name: string]: Component } = {};

    /**
     * 指定扫描 services 和 dbc 目录
     * 用户注册程序逻辑服务和数据源
     * @param app 
     */
    public async load(app: Application) {
        for (let { key, ObjClass } of await Promise.all([
            JSFilescan(path.join(__dirname, "./services")),
            JSFilescan(path.join(__dirname, "./dbc"))
        ]).then(list => list.reduce((fs, f) => fs.concat(f), []))) {
            let obj = new ObjClass(app)
            if (obj.__name__) {
                if (typeof obj.loadBefore == "function") await obj.loadBefore();
                app.set(obj.__name__, this.components[obj.__name__] = obj);
                this.logger.info("load", key)
            }
        }
    }

    public async loadAfter() {
        for (let obj of Object.values(this.components)) if (typeof (obj.loadAfter) == "function") await obj.loadAfter.call(obj);
    }
}


export class Session extends EventEmitter {
    private logger: Logger = getLogger("session");
    /**连接ID */
    public id: string = "";
    /**全局可配置对象 */
    private config: any = {};

    private encoder: parser.Encoder = new parser.Encoder();
    private decoder: parser.Decoder = new parser.Decoder();
    
    constructor(public app: Application, private socket: engine.Socket){
        super();
        this.id = socket.id;
        this.decoder.on("decoded", this.onmessage.bind(this))
        socket.send("0")
        socket.on("message", this.decoder.add.bind(this.decoder))
        socket.on("packet", packet => this.logger.info("packet", packet))
        socket.on("error", this.onerror.bind(this))
        socket.on("close", this.onclose.bind(this))
    }
    private onmessage(packet: parser.Packet) {
        try {
            this.logger.info("onmessage", packet)
            if([ parser.PacketType.EVENT, parser.PacketType.BINARY_EVENT ].includes(packet.type)) {
                let [path, data] = packet.data;
                MessageHandler.handle(path, data, this);
            }
        } catch (error) {
            logger.error("解析客户端消息异常", packet.data, error);
        }
    }
    private onerror(error: Error) {
        this.logger.info(`client tcp error ${this.ip}: ${this.id}`, error.message, error.stack);
    }
    /**
     * 客户端断开了解
     * @param event 
     */
    private onclose(reason: string, description?: Error) {
        logger.info(`client tcp close ${this.ip}: ${this.id}`, reason, description?.message, description?.stack);
        this.emit("close", reason);
        this.removeAllListeners(); // 释放所有绑定在该对象上的事件
        this.socket.removeAllListeners(); // 释放所有绑定在 ws 连接上的事件
        this.app.clients.delete(this.id); // 释放连接对象
        this.config = null;
    }
    /**客户端 IP 地址 */
    public get ip(): string {
        return requestIp.getClientIp(<Request>this.socket.request) || "0.0.0.0";
    }
    /**
     * 设置服务变量
     * @param name 
     * @param value 
     */
     public set(name: string, value: any) {
        _.set(this.config, name, value);
    }
    /**
     * 获取服务变量
     * @param name 
     * @returns 
     */
    public get<T>(name: string, def:T = <any>null): T {
        return _.get(this.config, name) || def;
    }
    /**
     * 检查是否存在某个服务变量
     * @param name 
     * @returns 
     */
    public has(name: string): boolean {
        return _.has(this.config, name);
    }

    /**
     * 加入房间，同一个用户可以拥有多个连接
     * @param userid 用户ID
     * @param room 房间号
     */
     public joinRoom(userid: string, room: string) {
        this.app.joinRoom(userid, this.id, room);
    }
    /**
     * 用户离开某个房间
     * @param userid 
     * @param room 
     */
    public leaveRoom(userid: string, room: string) {
        this.app.leaveRoom(userid, this.id, room);
    }
    public sendBinary(event:string, data: string | Buffer){
        if(this.socket.readyState == "open") {
            this.socket.send(`51-["${event}",{"_placeholder":true,"num":0}]`, { compress:true })
            this.socket.send(Buffer.from(data), { compress:true })
        }
    }

    public send(event:string, data: string | Buffer){
        if(this.socket.readyState == "open") {
            if(Buffer.isBuffer(data)){
                this.sendBinary(event, data);
            }
            else for(let packet of this.encoder.encode({ type: parser.PacketType.EVENT, nsp:"/", data:[event, data] })){
                this.socket.send(packet, { compress:true })
            }
        }
    }
}

class Server extends engine.Server {
    constructor(opts?: engine.ServerOptions){
        super(opts);
    }

    generateId(req: http.IncomingMessage): string {
        return MD5(`${req.headers["user-agent"]}${req.headers["sec-websocket-key"]}${id24()}`)
    }
}

export default class Application extends EventEmitter {

    constructor(httpServer: http.Server, opts?: engine.ServerOptions) {
        super();
        // 注册配置对象
        this.set("config", config);
        Promise.all([ComponentScan.load(this), MessageHandler.load(this)]).then(async _ => {
            logger.info("加载完成")
            this.server = new Server({
                ...opts, 
                allowRequest: this.verifyClient.bind(this),
                perMessageDeflate:true,
                httpCompression:true
            });
            this.server.attach(httpServer, { path:"/socket.io/" })
            this.server.on("connection", (socket: engine.Socket) => {
                let client = new Session(this, socket);
                this.clients.set(client.id, client);
                logger.info(`client tcp open ${client.ip} ${client.id}`, socket.request.headers["user-agent"]);
            })
            
            await ComponentScan.loadAfter();
            await MessageHandler.loadAfter();
            logger.info("启动完成", process.env.NODE_PORT)
        }).catch(err => {
            logger.error("启动失败", err)
            process.exit(0);
        })

        logger.info("加载配置文件", config)
    }

    private verifyClient(req: http.IncomingMessage, callback: (err: string|null|undefined, success: boolean) => void){
        callback("OK", true);
    }
    private server: Server = <any>null
    /**全局可配置对象 */
    private readonly config: any = {};
    /** {id: Session} */
    public clients: Map<string, Session> = new Map();
    /** {room: [sessionid]}*/
    public rooms: Map<string, Set<string>> = new Map();
    /** {sessionid: [room]}*/
    public roomids: Map<string, Set<string>> = new Map();
    /** {user: [sessionid]}*/
    public users: Map<string, Set<string>> = new Map();
    /**
     * 设置服务变量
     * @param name 
     * @param value 
     */
     public set(name: string, value: any) {
        _.set(this.config, name, value);
    }
    /**
     * 获取服务变量
     * @param name 
     * @returns 
     */
    public get<T>(name: string, def:T = <any>null): T {
        return _.get(this.config, name) || def;
    }
    /**
     * 检查是否存在某个服务变量
     * @param name 
     * @returns 
     */
    public has(name: string): boolean {
        return _.has(this.config, name);
    }
    
    /**
     * 加入房间
     * @param userid 用户ID
     * @param id 连接ID
     * @param room 房间号
     */
     public joinRoom(userid: string, id: string, room: string) {
        if (!this.rooms.has(room)) this.rooms.set(room, new Set());
        this.rooms.get(room)?.add(id);

        if (!this.roomids.has(id)) this.rooms.set(id, new Set());
        this.roomids.get(id)?.add(room);

        if (!this.users.has(userid)) this.users.set(userid, new Set());
        this.users.get(userid)?.add(id);
    }

    public leaveRoom(userid: string, id: string, room: string) {
        if (this.rooms.has(room)) this.rooms.get(room)?.delete(id);
        if (this.roomids.has(id)) this.roomids.get(id)?.delete(room);

        if (this.rooms.get(room)?.size) this.rooms.delete(room);
        if (this.roomids.get(id)?.size) this.roomids.delete(id);

        if (this.users.has(userid)) this.users.get(userid)?.delete(id);
        if (this.users.get(userid)?.size == 0) this.users.delete(userid);
    }
    /**
     * 向该进程下的所有客户端连接发送消息
     * @param path 
     * @param data 
     */
    public sendBroadcast(path: string, data: any) {
        this.clients.forEach(session => session.send(path, data));
    }
    /**
     * 向该进程下某个房间的所有客户端连接发送消息
     * @param room 
     * @param path 
     * @param data 
     */
    public sendRoom(room: string, path: string, data: any) {
        if (this.rooms.has(room)) this.rooms.get(room)?.forEach(id => this.send(id, path, data));
    }
    /**
     * 向该进程下某个用户的所有客户端连接发送消息
     * @param userid 
     * @param path 
     * @param data 
     */
    public send(userid: string, path: string, data: any) {
        if (this.users.has(userid)) {
            this.users.get(userid)?.forEach(id => this.clients.get(id)?.send(path, data));
        }
    }
    /**
     * 启动程序
     * @param opts 
     * @returns 
     */
    public static start(httpServer: http.Server, opts?: engine.ServerOptions): Application {
        return new Application(httpServer, opts);
    }
}