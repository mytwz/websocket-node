import Application, { Session } from "../application";

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-03 14:50:38 +0800
 * @LastEditTime: 2021-11-05 17:11:01 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\dbc\index.ts
 */

/**前后端交互使用的数据模型 */
export interface MessageData {
    path: string;
    data: any;
}
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
