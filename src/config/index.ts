/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-04 15:29:52 +0800
 * @LastEditTime: 2021-11-04 15:44:52 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\config\index.ts
 */

import _ from "lodash"
import dev from "./dev"
import test from "./test"
import pre from "./pre"
import prod from "./prod"
import local from "./local"

export default _.merge(local, ({ dev, prod, test, pre } as any)[""+process.env.NODE_ENV] || {});