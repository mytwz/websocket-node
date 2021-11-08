# websocket-node
借鉴网易游戏框架【pinus】搭建 WebSocketService ，全文采用 TS 编写
## 使用说明
### 服务端篇
- 1、程序启动使用 ```bash ./sart.sh [环境变量值: dev|test|pre|prod] [端口号]```
- 2、模块说明：程序中所有的自动化组件都遵循此模型并且放置在 ```[handlers/dbc/services]``` 目录中方能自动注入到程序中
```ts
interface Component {
    new(app: Application): Component; // 构造函数在程序加载时会自动调用
    __name__: string; // 组件唯一ID： 可以在启动完毕后 app.get(name) 获取到
    loadAfter(): void ; // 启动后回调函数
    loadBefore(): void ; // 启动前回调函数
}
```
- 3、新增消息处理器
- - 1、在指定目录 ```handlers``` 中添加一个文件名为 Handler 后缀的文件，并返回一个遵循上述模块标准的 Class 
- - 2、在这个 Class 下的所有方法都会自动生成一个从 ```handlers``` 下开始到方法名的调用路径如：文件 ```handlers/user/loginHandler``` 下有个方法名为 ```login``` 则前端可以使用 ```user.loginHandler.login``` 调用到该方法
- 4、新增数据操作和服务组件则在```[dbc/services]``` 添加一个遵循上述模块标准的 Class 即可
- 5、配置在```src/config```文件中的数据可以从```app.get("path")```获取到值
- 6、完成上述操作即可使用该程序
  
### 客户端篇
- 1、客户端可以使用```Web```自带的```WebSocket```对象进行连接
- 2、收发消息统一使用
```js
//MessageType:0PING|1PONG|2DATA
Date.prototype.format = function (fmt) {
    let format = {
        y: String(this.getFullYear()),
        M: String(this.getMonth() + 1).padStart(2, "0"),
        d: String(this.getDate()).padStart(2, "0"),
        H: String(this.getHours()).padStart(2, "0"),
        m: String(this.getMinutes()).padStart(2, "0"),
        s: String(this.getSeconds()).padStart(2, "0"),
        S: String(this.getMilliseconds()).padStart(3, "0"),
    }
    return fmt.replace(/[yMdHmsS]/g, function (key) {
        return format[key] || key;
    });
}
var ws = new WebSocket("ws://127.0.0.1:8080");
ws.onopen = function () { console.log("连接成功"); ws.send("0"/*MessageType*/) }
ws.onclose = function (code, msg) { console.log("连接断开", code, msg) }
ws.onerror = function (error) { console.log("连接异常", error) }
ws.onmessage = function ({ data }) {
    let str = event.data;
    let cmd = +str.slice(0, 1); // 一个单位符号作为指令操作码，
    let msg = str.slice(1);
    switch (cmd) {
        case 1: {
            setTimeout(() => ws.send("0"), 1000)
            console.log("SystemTime", new Date(+msg).format("y/M/d-H:m:s:S"))
            break;
        }
        case 2: {
            let [ path, data ] = JSON.parse(msg)
            console.log(path, ":", data);
            break;
        }
        default: {

            break;
        }
    }
}
function send(path, data){
    this.ws.send("2" + JSON.stringify([path, data]))// 2["user.login",{"user":{ "token":"12347" }}]
}
```
- 3、完成上述操作即可对接到后端程序