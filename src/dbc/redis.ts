/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: Redis 服务对象
 * @Date: 2021-11-04 14:31:46 +0800
 * @LastEditTime: 2021-11-05 17:12:05 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\dbc\redis.ts
 */
import { Redis, RedisOptions } from "ioredis"
import ioredis from "ioredis"
import { getLogger } from "../utils";
import Application from "../application";
import { DEFAULT_PAGE_NO, DEFAULT_PAGE_SIZE } from "./constants";
const logger = getLogger(__filename);
/**替换 redis keys 命令实现，避免某些 Redis 服务器没有 keys 命令 */
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

export default class RedisDBC {
    __name__: string = "redis";
    private client: Redis = <any>null;
    constructor(private app: Application) {
        try {
            let config: RedisOptions = this.app.get("config.redis")
            if (!config) throw new Error("没有找到 Redis 配置")
            this.client = new ioredis(config);
            if (config.password) this.client.auth(config.password).then(_ => logger.info("Redis 验证密码成功"))
            logger.info("Redis 连接成功");
        } catch (error) {
            logger.error("Redis 服务启动失败", error)
            throw error;
        }
    }

    /**获取管道 */
    public get pipeline() { return this.client.pipeline() }

    public async delKey(key: string) {
        await this.client.del(key)
    }

    public async delHashValue(key: string, name: string) {
        await this.client.hdel(String(key), String(name));
    }

    /**
     * 获取原生值
     * @param {*} key 
     */
    public async getValue(key: string) {
        return await this.client.get(String(key));
    }
    /**
     * 保存原生值
     * @param {*} key 
     * @param {*} value 
     */
    public async setValue(key: string, value: string) {
        await this.client.set(String(key), value)
    }

    public async setHashValue(key: string, name: string, value: string) {
        await this.client.hset(String(key), String(name), value);
    }

    public async getHashValue(key: string, name: string) {
        return await this.client.hget(String(key), String(name));
    }

    public async getHashKeyAll(key: string) {
        return await this.client.hkeys(String(key));
    }

    public async getHashValAll(key: string) {
        return await this.client.hvals(String(key));
    }

    public async getHashAll(key: string) {
        return await this.client.hgetall(String(key));
    }

    public async getHashLen(key: string) {
        return await this.client.hlen(String(key));
    }

    /**
     * 查询原生对象
     * @param {*} key 
     */
    public async getObject<T>(key: string): Promise<T> {
        const result = await this.getValue(key);
        return result ? JSON.parse(result) : null;
    }

    /**
     * 保存原生对象
     * @param {*} key 
     * @param {*} value 
     */
    public async setObject<T>(key: string, value: T): Promise<T> {
        await this.setValue(key, JSON.stringify(value))
        return value;
    }

    /**
     * 获取原生列表
     * @param  {...any} args redis.lrange 原生方法参数 
     */
    public async getObjectList<T>(key: string, start: number, stop: number): Promise<Array<T>> {
        const results = await this.client.lrange(key, start, stop);
        return results ? [...results.map(item => JSON.parse(item))] : [];
    }

    /**
     * 根据 Index 获取元素
     * @param {*} key 
     * @param {*} index 
     */
    public async getObjectListItem<T>(key: string, index: number): Promise<T> {
        const result = await this.client.lindex(key, index);
        return JSON.parse(result || "{}")
    }

    /**
     * 根据 Index 设置元素
     * @param {*} key 
     * @param {*} index 
     * @param {*} value 
     */
    public async setObjectListItem<T>(key: string, index: number, value: T): Promise<"OK"> {
        return await this.client.lset(key, index, JSON.stringify(value || {}));
    }

    /**
     * 移除列表中指定位置的值
     * @param {*} key 
     * @param {*} index 
     */
    public async removeObjectListItem(key: string, index: number): Promise<void> {
        if (await this.client.lindex(key, index)) {
            await this.setObjectListItem(key, index, {});
            await this.client.lrem(key, 0, "{}");
        }
    }

    /**
     * 保存列表记录
     * @param {*} key 
     * @param {*} data 消息内容
     * @param {*} history_limit 保存的条目数
     */
    public async saveObjectListItem<T>(key: string, data: T, history_limit = -1): Promise<void> {
        await this.client.lpush(key, JSON.stringify(data))
        const totalEntries = await this.client.llen(key);
        if (history_limit != -1 && totalEntries > history_limit) {
            const pipe = this.client.pipeline();
            for (let i = 0; i < totalEntries - history_limit; i++) pipe.rpop(key)
            await pipe.exec();
        }
    }

    /**
     * 从后面弹出一个元素
     * @param {*} key 
     */
    public async getObjectListItemPop<T>(key: string): Promise<T> {
        let result = await this.client.rpop(key);
        return JSON.parse(result || "{}")
    }

    /**
     * 从前面弹出一个元素
     * @param {*} key 
     */
    public async getObjectListItemShift<T>(key: string): Promise<T> {
        let result = await this.client.lpop(key);
        return JSON.parse(result || "{}")
    }

    /**
     * 获取列表长度
     * @param {*} key 
     */
    public async getObjectListLength(key: string): Promise<number> {
        return await this.client.llen(key);
    }

    /**
     * 获取列表记录
     * @param {*} key 
     * @param {*} pageNo 页码
     * @param {*} pageSize 每页条目数 -1 代表查询全部
     */
    public async findObjectList<T>(key: string, pageNo: number = DEFAULT_PAGE_NO, pageSize: number = DEFAULT_PAGE_SIZE) {
        const totalEntries = await this.client.llen(key) || 0;
        const totalPageSize = pageSize > 0 ? Math.ceil(totalEntries / pageSize) : 1;
        const startNo = pageSize !== -1 ? (pageNo - 1) * pageSize : 0;
        const endNo = totalPageSize > pageNo ? startNo + pageSize : -1;
        const results = await this.getObjectList<T>(key, startNo, endNo) || [];
        return {
            /**当前页码 */
            pageNo,
            /**当前每一页条目数 */
            pageSize,
            /**下一页页码 */
            nextPage: totalPageSize > pageNo ? pageNo + 1 : pageNo,
            /**总页数 */
            totalPageSize,
            /**总条目数 */
            totalEntries,
            /**查询结果 */
            results
        }
    }


    /**
     * 锁
     * @param {*} key 
     * @param {*} seconds 秒
     */
    public async lock(key: string, seconds: number = 1) {
        return await this.client.set(key, 1, "px", seconds * 1000, "nx")
    }

    /**
     * 发送订阅事件
     * @param {*} event 
     * @param {*} message 
     */
    public sendEventMessage(event: string, message: string) {
        this.client.publish(event, message, n => logger.info("sendEventMessage", "发送成功-" + n, { event, message }))
    }

}