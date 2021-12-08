/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:29:52 +0800
 * @LastEditTime: 2021-11-18 10:06:52 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\config\index.ts
 */

import _ from "lodash"
import dev from "./dev"
import test from "./test"
import pre from "./pre"
import prod from "./prod"
import local from "./local"

const config = { dev, prod, test, pre }

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            NODE_ENV: keyof typeof config;
        }
    }
}

export default _.merge(local, config[process.env.NODE_ENV] || {});