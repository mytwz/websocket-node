/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 工具类
 * @Date: 2021-11-03 12:24:35 +0800
 * @LastEditTime: 2021-11-26 12:01:17 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\utils\index.ts
 */
import _ from "lodash"
import path from "path";
import glob from "glob"
import { FilescanItem } from "../dbc";
import os from "os";
import request from "request";
import crypto from "crypto"
const Snowflake = require("@axihe/snowflake");
const idWorker = new Snowflake(randomInt(0,31), randomInt(0,31));
const logger = getLogger("utils")

export function randomInt(min:number=1, max:number=10): number {
    return Math.floor(Math.random() * (max - min)) + min;
}
/**
 * 获取一个 24 位的ID 
 * - 进程ID + 时间戳后 6 位 + 6 位序列号 + 随机数后 6 位
 * - 经测试 100W 次运行中，没有发现重复ID
 */
export function id64(): string {
    return String(idWorker.nextId())
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

export interface Logger {
    info(message:string, ...args:any[]): void;
    error(message:string, ...args:any[]): void;
    [key: string]: any;
}

declare global {
    interface Console {
        [key: string]: any;
    }

    interface Date {
        format(fmt: string): string;
    }
}

Date.prototype.format = function(fmt:string){
    let format = <{[key:string]: string}>{
        y: String(this.getFullYear()),
        M: String(this.getMonth() + 1).padStart(2, "0"),
        d: String(this.getDate()).padStart(2, "0"),
        H: String(this.getHours()).padStart(2, "0"),
        m: String(this.getMinutes()).padStart(2, "0"),
        s: String(this.getSeconds()).padStart(2, "0"),
        S: String(this.getMilliseconds()).padStart(3, "0"),
    }
    return fmt.replace(/[yMdHmsS]/g, function(key:string){
        return format[key] || key;
    });
}


/**
 * 获取 log4j 日志对象
 * @param filename 需要打印日志的文件名
 * @returns 
 */
export function getLogger(filename: string): Logger {
    return ["info", "error"].reduce((logger, key) => {
        logger[key] = function(message:string, ...args:any[]){
            const method = console[key]
            if(method instanceof Function) {
                method.apply(console, [`[${os.hostname()}][${process.pid}][${new Date().format("y/M/d-H:m:s:S")}] [${key}] ${path.basename(filename, ".js")} -`].concat([message,...args].map(msg => {
                    if(msg instanceof Error) {
                        return `${msg.message} ${msg.stack}`
                    }
                    else if(typeof(msg) == "object") {
                        return JSON.stringify(msg);
                    }
                    return msg;
                }).join(" ")))
            }
        }
        return logger;
    }, <Logger>{})
}

export function MD5(str:string){
    return crypto.createHash("md5").update(str).digest('hex')
}



/**
 * 发送 HTTP POST
 * @param {*} url 
 * @param {*} data 
 * @param {*} headers 
 */
 export function HTTPPost<T>(url: string, data = {}, headers = {}):Promise<T> {
    return new Promise((resolve, reject) => {
        request.post(url += (url.includes("?") ? "&t=" : "?t=") + Date.now(), {
            headers: Object.assign({
                'Content-Type': 'application/x-www-form-urlencoded'
            }, headers),
            json: true,
            form: data
        }, (error, response, body) => {
            logger.info("HTTPPost-response", { url, data, body, error })
            if (error) {
                return reject(error);
            }
            resolve(body)
        });
    })
}

/**
 * 发送 HTTP GET
 * @param {*} url 
 * @param {*} data 
 * @param {*} headers 
 */
export function HTTPGet<T>(url: string, data = {}, headers = {}):Promise<T> {
    return new Promise((resolve, reject) => {
        request.get(url += (url.includes("?") ? "&t=" : "?t=") + Date.now(), {
            qs: data,
            json: true,
            headers: Object.assign({}, headers),
        }, (error, response, body) => {
            logger.info("HTTPGet-response", { url, data, body, error })
            if (error) {
                return reject(error);
            }
            resolve(body)
        });
    })
}

export function AESCBCEncrypt(str: string, key:string, iv:string): string {
    const cipher  = crypto.createCipheriv("aes-128-cbc", key, iv);
    return cipher.update(str, 'utf8', 'base64') + cipher.final('base64')
}

export function AESCBCDecrypt(str: string, key:string, iv:string): string {
    const cipher  = crypto.createDecipheriv("aes-128-cbc", key, iv);
    return cipher.update(str, 'base64', 'utf8') + cipher.final()
}

/**延时函数 */
export function sleep(ms: number){ return new Promise(r => setTimeout(r, ms)) };