/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 工具类
 * @Date: 2021-11-03 12:24:35 +0800
 * @LastEditTime: 2021-11-05 17:12:29 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\utils\index.ts
 */
import _ from "lodash"
import path from "path";
import glob from "glob"
import log4j, { Logger } from "log4js";
import { FilescanItem } from "../dbc";

let __index__ = 0
let id24_buffer = Buffer.alloc(16);
/**
 * 获取一个 24 位的ID 
 * - 进程ID + 时间戳后 6 位 + 6 位序列号 + 随机数后 6 位
 * - 经测试 100W 次运行中，没有发现重复ID
 */
export function id24(): string {
    let offset = 0;
    id24_buffer.writeUInt32BE(+process.pid, offset); offset += 4;
    id24_buffer.writeUInt32BE(+String(Date.now()).substr(-6), offset); offset += 4;
    id24_buffer.writeUInt32BE((++__index__ > 999999) ? (__index__ = 1) : __index__, offset); offset += 4;
    id24_buffer.writeUInt32BE(+String(Math.random()).substr(-6), offset); offset += 4;
    return id24_buffer.toString("base64");
}
/**
 * 文件扫描
 * @param dirname 某个文件夹地址
 * @returns 
 */
export function JSFilescan(dirname: string): Promise<Array<FilescanItem>> {
    return new Promise((resolve, reject) => {
        glob(dirname + '/**/*.js', (err, files) => {
            if (!err) {
                let list: Array<FilescanItem> = [];
                for (let file of files) {
                    let pathname = path.dirname(file).substr(file.indexOf(path.basename(dirname)) + path.basename(dirname).length + 1).replace("/", ".");
                    let name = path.basename(file, ".js");
                    let ObjClass = require(file).default;
                    if (ObjClass) {
                        let key = pathname ? `${pathname}.${name}` : name;
                        list.push({ key, ObjClass })
                    }
                }
                resolve(list);
            }
            else reject(err);
        });
    })
}
/**
 * 清除 Node 模块缓存，为以后设计热更新准备
 * @param path 文件路径
 * @returns 
 */
export function clearRequireCache(path: string) {
    const moduleObj = require.cache[path];
    if (!moduleObj) return;
    if (moduleObj.parent) {
        //    console.log('has parent ',moduleObj.parent);
        moduleObj.parent.children.splice(moduleObj.parent.children.indexOf(moduleObj), 1);
    }
    delete require.cache[path];
}
/**
 * 获取 log4j 日志对象
 * @param filename 需要打印日志的文件名
 * @returns 
 */
export function getLogger(filename: string): Logger {
    return log4j.getLogger(path.basename(filename, ".js"))
}