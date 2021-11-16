import Application from "../application";

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 事件订阅
 * @Date: 2021-11-08 16:45:08 +0800
 * @LastEditTime: 2021-11-08 17:13:13 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\services\redissubscribe.ts
 */
import { getLogger, id24, MD5 } from "../utils";
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { EventEmitter } from 'events';
import RedisDBC from "../dbc/redis";

const logger = getLogger(__filename);
export default class RedisSubscribe extends EventEmitter {

    __name__: string = "redissubscribe"
    /**Redis 服务对象 */
    private redis: Redis = <any>null;
    private redisLock: RedisDBC = <any>null;

    private loadBefore(){
        try {
            let config: RedisOptions = this.app.get("config.redis")
            this.redis = new ioredis(config);
            if (config.password) this.redis.auth(config.password).then(_ => logger.info("Redis 验证密码成功"))
        } catch (error) {
            logger.error("连接 Redis 失败", error)
            throw error;
        }
    }
    
    private loadAfter(){
        try {
            this.redisLock = this.app.get("redis");
            this.redis.subscribe(<string[]>this.eventNames())
            this.redis.on("message", async (event, message) => {
                if (this.listenerCount(event) && await this.redisLock.lock(MD5(event+message))) {
                    this.emit(event, message);
                }
            })
        } catch (error) {
            logger.error("订阅 Redis 事件失败", error)
            throw error;
        }
    }
    
    constructor(private app: Application){
        super();
        this.on("test", this.test.bind(this));
        
    }

    private test(message:string){
        
    }
}
