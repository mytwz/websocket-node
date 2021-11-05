###
 # @Author: Summer
 # @LastEditors: Summer
 # @Description: 
 # @Date: 2021-11-03 10:54:12 +0800
 # @LastEditTime: 2021-11-05 16:04:07 +0800
 # @FilePath: \pj-node-imserver-ballroom\start.sh
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
    killall -9 node && sleep 1
    echo "正在检查程序依赖!...." 
    npm i
    echo "开始启动${map[$1]}环境应用"
    nohup tsc && node ./dist/index.js $1 $2 $3 &
    echo "启动完毕！。。。"
}

case $1 in 
    "dev"|"test"|"pre"|"prod") Run $1 $2 $3 ;;
    *) echo "没有指定环境[dev|test|pre|prod]" ;;
esac

