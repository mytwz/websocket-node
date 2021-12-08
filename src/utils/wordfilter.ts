/*
 * @Author: Summer
 * @LastEditors: Summer
 * @Description: 违禁词过滤器 DFA算法
 * @Date: 2021-11-08 17:28:06 +0800
 * @LastEditTime: 2021-12-06 18:26:38 +0800
 * @FilePath: \pj-node-imserver-ballroom\src\utils\wordfilter.ts
 */

//敏感词树结构
class WordNode {
    /**是否敏感词尾*/
    public isEnd: boolean = false;
    public parentNode: WordNode = <any>null;
    public children: { [name: string]: WordNode } = {};
    public value: string = "";

    public getChild(name: string): WordNode {
        return this.children[name];
    }

    public addChild(char: string): WordNode {
        let node = new WordNode();
        node.value = char;
        node.parentNode = this;
        this.children[char] = node;
        return node;
    }
}

/**
 * 违禁词过滤器 DFA算法
 */
export default class BannedWordFilter {
    /**敏感词索引树结构 */
    private treeRoot: WordNode = new WordNode();

    constructor(words: string[]) {
        this.addWords(words);
    }

    /**
     * 搜索是否符合的关键字
     * @param {String} word 字符串
     */
    private findContainWord(word: string = "", strict: boolean = false) {
        let words: number[] = [];
        let charCount = word.length;
        let node = this.treeRoot;
        // 确保敏感词索引树有内容
        if (charCount > 0 && this.treeRoot) {
            let vwords: number[] = []; // 找到的每个单词
            let alone: number[] = []; // 找到开头没有结尾的单词
            let char: string = ""; // 每一个需要匹配的字符
            let chars: string[] = word.split(""); // 过滤字符串数组
            let chilhNode = null; // 找到的节点

            if (strict) do {
                vwords = [];
                node = this.treeRoot;
                for (let i = 0; i < charCount; i++) {
                    if (words.concat(alone).includes(i)) continue; // 排除已经找到了的和只有一部分构不成整个屏蔽词的
                    char = chars[i];
                    chilhNode = node.getChild(char);
                    if (chilhNode) {
                        node = chilhNode;
                        vwords.push(i);
                        if (chilhNode.isEnd) {
                            words = words.concat(vwords);
                            node = this.treeRoot;
                        }
                    }
                }
                if (!node.isEnd) {
                    alone = alone.concat(vwords);
                }
            } while (vwords.length !== 0);

            else for (let i = 0; i < charCount; i++) {
                char = chars[i];
                chilhNode = node.getChild(char);
                if (!chilhNode) {
                    //重新开始下个敏感词检测
                    node = this.treeRoot;
                    vwords = [];
                }
                chilhNode = node.getChild(char);
                if (chilhNode) {
                    node = chilhNode;
                    vwords.push(i);
                    if (chilhNode.isEnd) {
                        words = words.concat(vwords);
                        vwords = [];
                    }
                }
            }
        }
        return words;
    }

    /**
     * 在查找树中添加新的关键字
     * @param {Array} dirtyWordArray 
     */
    public addWords(dirtyWordArray: string[] = []) {
        if (!Array.isArray(dirtyWordArray)) return;
        for (let i = 0, leng = dirtyWordArray.length; i < leng; i++) {
            let word = dirtyWordArray[i];
            let charCount = word.length;
            if (charCount > 0) {
                let node = this.treeRoot;
                for (let j = 0; j < charCount; j++) {
                    let char = word.slice(j, j + 1);
                    let tempNode = node.getChild(char);
                    if (tempNode) {
                        node = tempNode;
                    } else {
                        // 树根
                        node = node.addChild(char)
                    }
                }
                // 词尾标识
                node.isEnd = true;
            }
        }
    }
    /**
     * 检测一个词并返回是否带敏感词和替换敏感词之后的结果
     * @param {String} word 检测的词
     * @param {String} repChar 代替敏感字的字符
     * @param {String} strict 强力去除
     */
    public filterWord(word: string = "", repChar: string = "*", strict: boolean = false) {
        let wordArr = word.split("");
        let words = this.findContainWord(word, strict);
        for (let i of words) wordArr.splice(i, 1, repChar)

        return wordArr.join("");
    }
}
