import Application, { Session } from "../application";

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 14:50:38 +0800
 * @LastEditTime: 2021-12-08 09:04:40 +0800
 * @FilePath: /websocket-node/src/dbc/index.ts
 */

export interface HandleData {
    requestid: string,
    [key: string]: any;
}

/**前后端交互使用的数据模型 */
export type MessageData = { path: string, data: any }
/**组件模型 */
export interface Component {
    new(app: Application): Component;
    __name__: string;
    loadAfter(): void ;
    loadBefore(): void ;
    [key: string]: any;
}
/**组件扫描模型 */
export interface FilescanItem {
    key:string, 
    ObjClass: new (...args: any) => Component
}

/**错误代码 */
export enum ErrorCode {
    "" = 0,
    "找不到 Token 对应的用户数据" = 400,
    "请先登录" = 401,
    "系统异常" = 500,
    "无法获取房间号" = 402,
    "没有权限" = 403,
    "请先加入房间" = 410
}

export enum ChatMsgItemType {
    /**聊天文本 */
    TEXT = 1,
    /**捐赠消息 */
    DONATIONS = 2,
}

/**为了 TS 代码注释提醒而做的类型扩展 */
declare module '../application' {

    export interface Session {
        /**绑定心跳事件 */
        on<T>(event: "heartbeat", listener: (this: T, message: string, session: Session) => void): T;
        /**绑定客户端断开事件 */
        on<T>(event: "close", listener: (this: T) => void): T;
        
        /**客户端关闭 */
        emit(event: "close", code:number, reason:string): boolean;
        /**触发心跳回调 */
        emit(event: "heartbeat"): boolean;

        /**发送房间历史 */
        send(path: "chatHistory", data: ChatMsgItem[]): void;
        /**发送连接成功消息 */
        send(path: "connection", data: "ok"): void;
    }

    export default interface Application {
        /**绑定消息历史保存事件 */
        on<T>(event: "chatmsg", listener: (this: T, sid:string, roomid:string, msg: ChatMsgItem) => void): T;
        /**绑定程序加载完成事件 */
        on<T>(event: "load", listener: (this: T, app: Application) => void): T;

        /**发送并保存聊天消息 */
        emit(event: "chatmsg", sid:string, roomid:string, msg: ChatMsgItem): boolean;
        /**程序加载完成 */
        emit(event: "load", app: Application): boolean;
    }
}


/**同步类型 */
export enum AsyncType {
    /**广播 */
    broadcast,
    /**获取所有的房间号 */
    roomall,
    /**获取某个客户端所加入的房间号 */
    roomsByuserid,
    /**统计所有客户端总数 */
    clientTotal,
    /**统计某房间下所有客户端总数 */
    clientTotalByroomid,
    /**统计某个用户的客户端总数 */
    clientTotalByuserid,
    /**统计某个用户在某个房间的客户端总数 */
    clientTotalByroomidAnduserid,
    //////////////////
    /**响应 */
    response
}
/**消息广播范围 */
export enum BroadcastType {
    all, room, user, socket
}

/**
 * 
 */
export interface MsgAsync {
    /**统计某个用户在某个房间的客户端总数 */
    getClientTotalByroomidAnduserid(roomid:string, uid: string): Promise<number>
    /**统计某个用户的客户端总数 */
    getClientTotalByuserid(uid: string): Promise<number>
    /**获取某个房间下所有的客户端总数 */
    getClientTotalByroomid(roomid:string): Promise<number>
    /**获取所有的客户端总数 */
    getClientTotal(): Promise<number>;
    /**获取所有的房间号 */
    getRoomall(): Promise<string[]>;
    /**获取某个用户所加入的所有房间号 */
    getRoomByuserid(userid:string): Promise<string[]>
    /**向分布式集群发送消息广播 */
    sendBroadcast(sid: string, path: string, data: any): void;
    /**向分布式集群发送房间消息广播 */
    sendRoom(sid: string, room: string, path: string, data: any): void;
    /**向分布式集群某个用户发送消息广播 */
    sendUser(sid: string, touserid: string, path: string, data: any): void;
    /**向分布式集群某个连接发送消息广播 */
    send(sid: string, path: string, data: any): void;
}

/**本地 IP 地址 */
export const INTERNAL_IP = (function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
})()