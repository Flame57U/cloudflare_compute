# Vault 整理任务（每晚 23:00 由 hermes cron 触发）

你正在维护一个 Obsidian 仓库（OBSIDIAN_VAULT_PATH=/root/obsidian-vault）。这是用户的私人笔记，**整理动作必须保守、可逆、最小化**。

## 硬约束（违反就立刻停止）

1. **绝不**新建、删除、重命名、移动任何**一级目录**（vault 根下的第一层目录）。一级目录的名字和数量必须和昨天完全一致。
2. **绝不**新建笔记，**绝不**删除笔记，**绝不**移动笔记到别的目录。
3. **只**修改"明显错误"的内容：
   - 代码块语言标记缺失（` ``` ` 后面缺语言）—— 能从代码内容明确推断出来才补，否则跳过
   - 代码块没闭合（成对的 ` ``` `）
   - Markdown 语法明显坏掉（如 `[文字](` 后面没东西、表格列数不齐、heading 前缺空行导致没渲染）
   - 列表缩进混乱（mix 2/4 空格、tab/空格混用）导致 Obsidian 渲染异常
   - 多余的尾部空行（> 2 行连续空行压成 1 行）
   - YAML frontmatter 语法错（key 缺冒号、缩进错）
4. **不修改**：
   - 任何拼写、措辞、用词、句意 —— 笔记是用户的，他认可的就是对的
   - 任何技术结论 —— 哪怕你觉得"那个 docker 命令应该用 -v 不是 --volume"，也不要动
   - wikilink `[[...]]` 的目标 —— 哪怕看起来指向一个不存在的笔记
   - 缩进风格的一致性 —— 除非确实坏了渲染
5. 每天最多修改 **20 个文件**。如果发现的问题更多，**只挑最严重的 20 个**改，其余下次再说。
6. 单个文件的改动量 ≤ 30 行 diff。超过就跳过（说明那个文件需要人工处理）。

## 执行步骤

1. `cd /root/obsidian-vault`
2. 用 `git status` 确认 working tree 干净；如果不干净，**立即终止**并把状态写进输出（不要 commit 任何已有未提交的改动）。
3. 用 `git pull --ff-only` 拉一下远端。如果 fast-forward 失败，**立即终止**并报错。
4. 列出一级目录快照（`ls -1d */ 2>/dev/null`），保存到变量 BEFORE_DIRS。
5. 用 `search_files` 找候选问题文件（可以按以下模式扫描）：
   - ` ``` ` 出现次数为奇数的文件（代码块没闭合）
   - 包含 `[]()` 空链接的文件
   - 包含连续 3 行以上空行的文件
6. 对每个候选文件：
   - `read_file` 通读
   - 用 `patch` 做精确小改（不要全文重写）
   - 改完后立即 `git diff <file>` 验证只动了预期的行
7. 改完后，再次列一级目录快照 AFTER_DIRS。如果 BEFORE_DIRS != AFTER_DIRS，**立即 `git reset --hard HEAD` 并终止**。
8. `git add -u` 只加已跟踪文件的改动。**不要 `git add .`**（防止误加 .obsidian/workspace.json 等本地状态文件）。
9. 检查 `git diff --cached --stat`：
   - 如果改动文件数 > 20，**回滚并终止**
   - 如果有任何 .md 之外的文件被加入，**回滚并终止**
10. commit message 格式：
    ```
    chore(tidy): nightly markdown fixes YYYY-MM-DD

    - <文件1>: <一句话改了啥>
    - <文件2>: ...
    ```
11. `git push origin main`（或当前分支）。如果 push 失败（冲突/认证错），**不要重试**，直接把错误信息写进输出。
12. 最后输出本次的：改了几个文件、各文件改了什么、有没有跳过的疑似问题。

## 输出格式

```
== Vault Tidy Report YYYY-MM-DD ==
Modified: <N> files
Skipped (too risky): <M> files
Pushed: yes/no
Errors: <none|...>

Changes:
- path/to/file1.md: 闭合了 ```python 代码块
- path/to/file2.md: ...

Skipped:
- path/to/file3.md: 改动估计超过 30 行，留人工处理
```

记住：**保守 > 完整**。宁可漏改也不要乱改。今晚没改完的明晚再改。
