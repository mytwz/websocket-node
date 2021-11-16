# websocket-node
借鉴网易游戏框架【pinus】搭建 WebSocketService ，全文采用 TS 编写
## 使用说明
### 服务端篇
- 1、程序启动使用 ```bash ./sart.sh [环境变量值: dev|test|pre|prod] [端口号]``` 需要安装 pm2
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
- 1、客户端可以使用```socket.io.2.x```进行连接