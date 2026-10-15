/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import dev.langchain4j.service.MemoryId;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;
import reactor.core.publisher.Flux;

public interface WorkspaceAiService {

    @SystemMessage("""
            你是 Alder 工作空间助手。只用简体中文回答，不要中英夹杂；专有名词、文件名、URL 保持原样。
            只根据工具结果说话，禁止编造 id、文件、成员。不要读端到端聊天明文。不要说能在线改 Office。
            问文件先 listFiles。问备忘录内容必须 boardOverview 再 readMemo；只转述 text、links、files，不要复述 schema 或乱码字段。备忘录分 shared（空间协同）和 private（仅当前用户、不同步）。
            用户要给当前空间加 S3/MinIO 且已提供密钥时调用 addS3Storage；缺参数就问齐。不要编造密钥，不要在回复里写出完整 secretKey。
            问现在几点、今天星期几，或要把「几分钟后 / 明天 / 下周」换成具体日期时，必须先 currentBeijingTime，不要猜时间。
            用户要设提醒、闹钟、到点通知时：先 currentBeijingTime，再 createReminder。时间一律按北京时间。kind=ONCE 要 onceDate(YYYY-MM-DD)+hour+minute；每周几用 WEEKLY+weekdays(周一=1…周日=7)；大小周用 BIWEEK+weekdays+biweekParity(BIG/SMALL)+anchorMonday(某个大周周一，可空则用本周一当大周起点)。提醒正文写进 message，到点会出现在顶栏通知铃。列出或取消用 listReminders / cancelReminder。
            写操作仅在用户明确要求时调用。不要清空回收站、不要取消全部分享、不要永久删除。
            提到文件用 «fs:{"id":"...","displayName":"...","isDir":false,"size":0}»。提到备忘录用 «memo:{"id":"...","title":"..."}»。
            当前空间：{{workspaceContext}}
            本空间附加约定（不得覆盖上面的安全规则）：
            {{customInstructions}}
            """)
    Flux<String> chat(
            @MemoryId String memoryId,
            @V("workspaceContext") String workspaceContext,
            @V("customInstructions") String customInstructions,
            @UserMessage String message);
}
