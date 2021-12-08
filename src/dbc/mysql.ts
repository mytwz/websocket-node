

/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 
 * @Date: 2021-11-08 17:38:49 +0800
 * @LastEditTime: 2021-12-08 09:06:19 +0800
 * @FilePath: /websocket-node/src/dbc/mysql.ts
 */
import Application from "../application";
import { getLogger } from "../utils";
import sequelize, { Sequelize, Model, ModelCtor, DataTypes, Options, Optional, ModelDefined } from "sequelize";
import BannedWordFilter from "../utils/wordfilter";

const logger = getLogger(__filename);

interface BanRoomKeywordAttributes {
    id: number,
    keyword: string,
    createtime: number,
    updatetime: number,
}

export class BanRoomKeyword extends Model<BanRoomKeywordAttributes> implements BanRoomKeywordAttributes {
    public id!: number
    public keyword!: string
    public createtime!: number
    public updatetime!: number

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

interface BanShieldKeywordAttributes {
    id: number,
    word: string,
    created_at: number,
    updated_at: number,
}

export class BanShieldKeyword extends Model<BanShieldKeywordAttributes> implements BanShieldKeywordAttributes {
    public id!: number
    public word!: string
    public created_at!: number
    public updated_at!: number

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

export default class MysqlDBC {

    __name__: string = "mysql"
    private sequelize: Sequelize = <any>null;

    constructor(private app: Application) {
    }

    private async loadAfter() {
    }

    private async loadBefore() {

        try {
            let config: Options = this.app.get("config.mysql")
            this.sequelize = new Sequelize({
                ...config,
                benchmark: true,
                logging: (sql, time) => logger.info(`SQL-执行时间 ${time}ms`, sql),
                define: {
                    timestamps: false
                },
                hooks: {
                    beforeDefine(columns, model) {
                        model.tableName = `${(<any>config).prefix}${model.modelName}`;
                    }
                },
            });

            await this.sequelize.authenticate()
            logger.info("authenticate", 'Mysql 连接成功')
        } catch (error) {
            logger.error("Mysql 连接失败", error)
            throw error;
        }

        try {
            await BanRoomKeyword.init({
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true
                },
                keyword: DataTypes.STRING,
                createtime: DataTypes.DATE,
                updatetime: DataTypes.DATE,
            }, { modelName: 'chatroom_ban_keywords', sequelize: this.sequelize })

            await BanShieldKeyword.init({
                id: {
                    type: DataTypes.INTEGER,
                    primaryKey: true
                },
                word: DataTypes.STRING,
                created_at: DataTypes.INTEGER,
                updated_at: DataTypes.INTEGER,
                }
            }, { modelName: 'shield_sensitive_words', sequelize: this.sequelize })

        } catch (error) {
            logger.error("初始化 Mysql 失败", error)
            throw error;
        }

        try {
            let words = await BanShieldKeyword.findAll({
                raw: true,
                attributes: ['word'],
            }).then(body => body.map(res => res.word))

            logger.info("获取系统屏蔽字列表", words);
            this.app.set("wordfilter.system", new BannedWordFilter(words))
        } catch (error) {
            logger.error("初始化系统屏蔽字对象失败", error)
            throw error;
        }
    }
}