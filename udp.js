/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-22 09:24:31 +0800
 * @LastEditTime: 2021-12-01 18:24:39 +0800
 * @FilePath: /websocket-node/udp.js
 */
const dgram = require('dgram');
const server = dgram.createSocket("udp4");
/**
组播地址是实现UDP组播的关键，因此了解组播地址是重点。什么是组播地址？IANA将D类地址

(224.0.0.0-239.255.255.255)分配给IP组播，用来标识一个IP组播组，由IGMP(组管理协议)协议维护组成员关系，其中：
224.0.0.0～224.0.0.255为永久组地址，地址224.0.0.0保留不做分配，其它地址供路由协议使用；
224.0.1.0～224.0.1.255是公用组播地址，可以用于Internet；
224.0.2.0～238.255.255.255为用户可用的组播地址（临时组地址），全网范围内有效；
239.0.0.0～239.255.255.255为本地管理组播地址，仅在特定的本地范围内有效。 向组播地址发送数据报，只有该组成员才会接收此数据报。
 */
const multicastAddr = "224.0.3.114";
const port = +process.argv[2];
const id = port + "-" + Date.now();
server
.on("error", err => console.log("异常", err))
.on("close", _ => console.log("连接关闭"))
.on("connect", s => console.log("连接成功"))
.on("listening", _ => { 
    console.log("正在监听"); 
    server.setBroadcast(true);
    // 设置组播地址
    server.addMembership(multicastAddr); 
    server.setMulticastLoopback(false)
    // 设置数据包存活时间（跳跃点数量）
    server.setMulticastTTL(128); 
    // server.setTTL(128);

})
.on("message", (msg, info) => {
    if(info.address == "127.0.0.1") return;
    console.log("收到消息", info.address, info.port, "-", Buffer.from(msg).toString("utf8"))
    setTimeout( _ => {
        server.send(id + "-返回消息-" + Date.now(), info.port, info.address)
    }, 2000)
})
.bind({ exclusive: false, port});


console.log("启动参数", process.argv)