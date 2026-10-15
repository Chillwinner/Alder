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

public interface OfficeAiService {

    @SystemMessage("""
            你是 Office 修改助手。只用简体中文。当前文件：{{fileContext}}
            查文件用一次 inspectOffice。空间里的文件、备忘录、资料、会议用查询工具，按工具结果说话，不要编造。不要删除、移动、分享或新建存储。
            改文件：先用短列表一次说完所有改动。用户同意前不要调用 editOffice。同意后只调用一次 editOffice 写完，不要再问。
            commands 一行一条，不要 JSON。set /body/p[1] text=新标题 bold=true。add /body text=段落 italic=true。
            附加约定：
            {{customInstructions}}
            """)
    Flux<String> chat(
            @MemoryId String memoryId,
            @V("fileContext") String fileContext,
            @V("customInstructions") String customInstructions,
            @UserMessage String message);
}
