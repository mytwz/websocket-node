/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 程序核心文件，用于 WebSocket 连接的维护和消息处理分发
 * @Date: 2021-11-03 12:12:11 +0800
 * @LastEditTime: 2021-11-05 17:03:12 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\application.ts
 */
import { IncomingMessage } from "http";
import { EventEmitter } from 'events';
import WebSocket, { Server, ServerOptions, MessageEvent, CloseEvent, ErrorEvent, Event } from "ws";
import { id24, JSFilescan, getLogger } from "./utils";
import { Component, MessageData } from "./dbc";
import requestIp, { Request } from "request-ip"
import _ from "lodash";
import path from "path";
import config from "./config";

const logger = getLogger(__filename)

/**
 * 消息处理器
 */
const MessageHandler = new class MessageHandler {
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
                logger.info("加载消息处理器", key)
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
    public handle({ path, data }: MessageData, session: Session) {
        let index = path.lastIndexOf(".");
        let name = index > -1 ? path.substr(0, index) : path;
        let key = path.substr(index + 1);
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
                logger.info("加载服务", key)
            }
        }
    }

    public async loadAfter() {
        for (let obj of Object.values(this.components)) if (typeof (obj.loadAfter) == "function") await obj.loadAfter.call(obj);
    }
}

/**
 * 客户端连接对象
 */
export class Session extends EventEmitter {
    /**连接ID */
    public readonly id: string = id24();
    constructor(public app: Application, private ws: WebSocket, private req: IncomingMessage) {
        super();
        this.ws.addEventListener("message", this.onmessage.bind(this));
        this.ws.addEventListener("error", this.onerror.bind(this));
        this.ws.addEventListener("close", this.onclose.bind(this));
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
    /**
     * 该连接直接向前端发送数据
     * @param path 
     * @param data 
     */
    public send(path: string, data: any) {
        if (this.ws.OPEN) {
            this.ws.send(JSON.stringify({ path, data }));
        }
    }
    /**客户端 IP 地址 */
    public get ip(): string {
        return requestIp.getClientIp(<Request>this.req) || "0.0.0.0";
    }

    private onmessage(event: MessageEvent) {
        try {
            let data: MessageData = JSON.parse(event.data.toString("utf-8"));
            MessageHandler.handle(data, this);
        } catch (error) {
            logger.error("解析客户端消息异常", event.data.toString(), error);
        }
    }
    private onerror(event: ErrorEvent) {
        logger.info(`client tcp error ${this.ip}: ${this.id}`);
    }
    /**
     * 客户端断开了解
     * @param event 
     */
    private onclose(event: CloseEvent) {
        logger.info(`client tcp close ${this.ip}: ${this.id}`, event.code, event.reason);
        this.emit("close", event.code, event.reason);
        this.removeAllListeners(); // 释放所有绑定在该对象上的事件
        this.ws.removeAllListeners(); // 释放所有绑定在 ws 连接上的事件
        this.app.clients.delete(this.id); // 释放连接对象
    }
}
/**
 * WebSocket 服务对象
 */
export default class Application extends EventEmitter {
    constructor(private opts: ServerOptions) {
        super();
        // 注册配置对象
        this.set("config", config);
        // 在加载完所有组件之后再启动程序
        Promise.all([ComponentScan.load(this), MessageHandler.load(this)]).then(_ => {
            logger.info("加载完成")
            this.server = new Server(Object.assign(this.opts, {
                clients: false,
                perMessageDeflate: true,
                verifyClient: this.verifyClient.bind(this) 
            }), this.complete.bind(this));
            this.server.on("connection", (socket: WebSocket, req: IncomingMessage) => {
                let client = new Session(this, socket, req);
                this.clients.set(client.id, client);
                logger.info(`client tcp open ${client.ip}: ${client.id}`);
            })
            this.emit("load", this);
        }).catch(err => {
            logger.error("启动失败", err)
            process.exit(0);
        })

        logger.info("加载配置文件", config)
    }

    private server: Server = <any>null;
    /**是否完全加载完毕 */
    public LOADCOMPLETE: boolean = false;
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
    /**所有准备工作完毕后调用该方法 */
    public async complete(){
        if(this.LOADCOMPLETE) return ;
        await ComponentScan.loadAfter();
        await MessageHandler.loadAfter();
        this.LOADCOMPLETE = true;
        logger.info("启动完成", process.env.NODE_PORT)
    }
    /**
     * 连接前校验
     * @param info 
     * @param callback 
     */
    private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }, callback: (res: boolean, code?: number, message?: string) => void): void {
        if (!this.LOADCOMPLETE) {
            callback(false, 400, "服务器还没准备好！")
        }
        else callback(true);
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
    public get<T>(name: string): T {
        return _.get(this.config, name);
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
    public static start(opts: ServerOptions): Application {
        return new Application(opts);
    }
}