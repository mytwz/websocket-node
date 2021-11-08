###
 # @Author: Summer
 # @LastEditors: Summer
 # @Description: 
 # @Date: 2021-11-03 10:54:12 +0800
 # @LastEditTime: 2021-11-08 15:47:20 +0800
 # @FilePath: /websocket-node/start.sh
### 
#!/bin/bash -xeu
declare -A map=(
    ["dev"]="开发"
    ["prod"]="客户"
    ["test"]="测试"
    ["pre"]="灰度测试"
)
Run(){
    echo "开始准备启动应用程序......."
    # echo "正在关闭已有的进程!...." 
    # pm2 delete IM && sleep 1
    # echo "正在检查程序依赖!...." 
    # npm i
    echo "正在生成 PM2 启动配置!...." 
    echo "
/**
 * Application configuration section
 * http://pm2.keymetrics.io/docs/usage/application-declaration/
 * 多个服务，依次放到apps对应的数组里
 */
module.exports = {
    apps:[{
        name: 'IM',
        max_memory_restart: '1806M', // 1.5G
        script: './dist/index.js',
        instances: -1,
        exec_mode: 'cluster',
        ssh_options: '',
        env: {
            NODE_ENV: '$1',
            NODE_PORT: $2
        }
    }]
}
    " > ./ecosystem.config.js
    echo "开始启动${map[$1]}环境应用"
    pm2 startOrReload ecosystem.config.js --update-env
    echo "启动完毕！。。。"
}

case $1 in 
    "dev"|"test"|"pre"|"prod") Run $1 $2;;
    *) echo "没有指定环境[dev|test|pre|prod]" ;;
esac

