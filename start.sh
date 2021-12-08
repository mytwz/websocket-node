###
 # @Author: Summer
 # @LastEditors: Summer
 # @Description: 
 # @Date: 2021-11-03 10:54:12 +0800
 # @LastEditTime: 2021-12-08 08:57:00 +0800
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
    echo "正在关闭已有的进程!...." 
    pm2 delete ballroom && sleep 1
    echo "正在检查程序依赖!...." 
    npm i
    echo "正在生成 PM2 启动配置!...." 
    echo -n "
/**
* Application configuration section
* http://pm2.keymetrics.io/docs/usage/application-declaration/
* 多个服务，依次放到apps对应的数组里
*/
module.exports = {
    apps: [" > ./ecosystem.config.js
    portStr=$2
    ports=(${portStr//,/ })
    index=1
    for port in ${ports[@]}
    do
    if [ "$port" -gt 0 ] 2>/dev/null ;then 
    echo -n "{
        name: 'ballroom-$index',
        max_memory_restart: '1806M', // 1.5G
        script: './dist/index.js',
        args:'--max-stack-size=1000 --max_semi_space_size=128',
        instances: 1,
        exec_mode: 'cluster',
        ssh_options: '',
        env: {
            NODE_ENV: '$1',
            NODE_PORT: $port,
            // DEBUG:'*,-ioredis*'
        }
    }, " >> ./ecosystem.config.js
    index=$(($index+1))
    else 
        rm -f ./ecosystem.config.js
        echo -e "\033[31m端口号只能是数字-[$port]\033[0m"
        exit 1;
    fi 
    done
    echo "" >> ./ecosystem.config.js
    echo "]}" >> ./ecosystem.config.js
    echo "开始启动${map[$1]}环境应用"
    pm2 startOrReload ecosystem.config.js --update-env
    echo "启动完毕！。。。"
}

echo "命令格式: bash start.sh [环境] [端口号[,端口号...]]"

if [ ! $2 ]; then
    echo -e "\033[31m端口号不能不填\033[0m"; exit 1;
fi  

case $1 in 
    "dev"|"test"|"pre"|"prod") Run $1 $2;;
    *) echo -e "\033[31m没有指定环境[dev|test|pre|prod]\033[0m" ;;
esac





# perf record -e cycles:u -g --node --perf-basic-prof --interpreted-frames-native-stack --perf-basic-prof-only-functions app.js

# perf record -F99 -p 4518 -g --sleep 10

# export NODE_ENV=test&&export NODE_PORT=9090&& node --perf-basic-prof --interpreted-frames-native-stack --perf-basic-prof-only-functions ./dist/index.js

# export NODE_ENV=test&&export NODE_PORT=9090&& perf record -e cycles:u -g -- node --perf-basic-prof --interpreted-frames-native-stack --perf-basic-prof-only-functions ./dist/index.js


# export NODE_ENV=test&&export NODE_PORT=9090&& node --perf-basic-prof --interpreted-frames-native-stack --perf-basic-prof-only-functions $(which 0x) ./dist/index.js