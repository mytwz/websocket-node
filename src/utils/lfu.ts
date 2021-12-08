/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 最不经常使用。数据被使用次数最少的，优先被淘汰。利用 Map 有序结构的特性
 * @Date: 2021-12-03 14:38:05 +0800
 * @LastEditTime: 2021-12-07 17:35:08 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\utils\lfu.ts
 */

import { ONE_DAY, ONE_YEAR } from "../dbc/constants";

interface Cache {
    value: any;
    time: number;
}

export default class LFU {
    
    private map: Map<string, Cache> = new Map();

    constructor(private limit: number = 10) {

    }

    /**
     * 加入缓存/更新缓存
     * @param key 
     * @param value 
     * @param expired 
     */
    public set<T>(key: string, value: T, expired:number = ONE_DAY): T {
        // 要将其放在最后，所以若存在key，先删除
        if (this.map.has(key)) this.map.delete(key);
        const cache = { value, time: Date.now() + (expired == -1 ? ONE_YEAR * 3 : expired) }
        // 设置key、value
        this.map.set(key, cache);
        if (this.map.size > this.limit) {
            // 若超出范围，将map中头部的删除
            // map.keys()返回一个迭代器
            // 迭代器调用next()方法，返回包含迭代器返回的下一个值，在value中
            this.map.delete(this.map.keys().next().value);
        }
        return value;
    }

    /**
     * 获取缓存
     * @param key 
     * @returns 
     */
    public get<T>(key: string): T {
        const cache = this.map.get(key);
        if (cache) {
            // get表示访问该值
            // 所以在访问的同时，要将其调整位置，放置在最后
            // 先删除，再添加
            this.map.delete(key);
            if(cache.time > Date.now()){
                this.map.set(key, cache);
                // 返回访问的值
                return cache.value;
            }
        }

        return <T><any>null;
    }

    public remove(key:string){
        if(this.map.has(key)) this.map.delete(key);
    }

    public has(key:string){
        const cache = this.map.get(key);
        if (cache) {
            return cache.time > Date.now();
        }
        return false;
    }
}