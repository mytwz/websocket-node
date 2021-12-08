
/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 事件订阅
 * @Date: 2021-11-08 16:45:08 +0800
 * @LastEditTime: 2021-12-08 09:02:00 +0800
 * @FilePath: /websocket-node/src/services/redissubscribe.ts
 */
import Application from "../application";
import { getLogger, id64, MD5 } from "../utils";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { EventEmitter } from 'events';
import RedisDBC from "../dbc/redis";
import { ChatMsgItem, ChatMsgItemType, HALL_ROOMID, MsgAsync, UserInfo, USER_ONLINE } from "../dbc";
import { ONE_MONTH, ONE_SECOND } from "../dbc/constants";
import _ from "lodash";

const logger = getLogger(__filename);
const donations_effects_conf = { 100000: false, 50000: false, 10000: false }
const donations_effects_nums = Object.keys(donations_effects_conf).sort((a, b) => +b - +a).map(e => +e)

export default class RedisSubscribe extends EventEmitter {

    private readonly __name__: string = "redissubscribe"
    /**Redis 服务对象 */
    private client: Redis = <any>null;
    private redis: RedisDBC = <any>null;
    private msgasync: MsgAsync = <any>null;;

    private async loadBefore() {
        try {
            let config: RedisOptions = this.app.get("config.redis")
            this.client = new ioredis(config);
            if (config.password) await this.client.auth(config.password).then(_ => logger.info("Redis 验证密码成功"))
        } catch (error) {
            logger.error("连接 Redis 失败", error)
            throw error;
        }
    }

    private loadAfter() {
        this.msgasync = this.app.get("msgasync");
        try {
            logger.info("subscribe", this.eventNames())
            this.redis = this.app.get("redis");
            this.client.subscribe(<string[]>this.eventNames())
            this.client.on("message", async (event, message) => {
                if (this.listenerCount(event) && await this.redis.lock(MD5(event + message))) {
                    logger.info("onmessage", event, "-", message);
                    try {
                        this.emit(event, message);
                    } catch (error) {
                        logger.error("事件处理异常 -", event, message, error)
                    }
                }
            })
        } catch (error) {
            logger.error("订阅 Redis 事件失败", error)
            throw error;
        }
    }

    constructor(private app: Application) {
        super();

    }
}
