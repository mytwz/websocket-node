import Application from "../application";

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 14:50:38 +0800
 * @LastEditTime: 2021-11-12 17:03:50 +0800
 * @FilePath: \pj-node-imserver-v3\src\dbc\index.ts
 */

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
    "找不到 Token 对应的用户数据" = 400,
    "请先登录" = 401,
    "系统异常" = 500
}