/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.tool;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.ai.office.OfficeEditScope;
import com.xddcodec.fs.ai.office.OfficeFileEditService;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class OfficeAiTools {

    private final OfficeFileEditService officeFileEditService;

    @Tool("查看当前这份 Office。同一条消息只调用一次。verb 用 view，args 用 text 或 outline。")
    public String inspectOffice(
            @P("officecli 动词") String verb,
            @P("文件名之后的参数，可空") String args,
            @ToolMemoryId String memoryId) {
        return run(memoryId, false, verb, args);
    }

    @Tool("用户已同意全部改动后，一次写完。commands 多行纯文本，一行一条，不要 JSON。set /body/p[1] text=新标题 bold=true。add /body text=段落 italic=true。")
    public String editOffice(
            @P("多行修改命令，一行一条") String commands,
            @ToolMemoryId String memoryId) {
        if (!bindMemory(memoryId)) {
            return "失败: 无法确定当前工作空间。";
        }
        try {
            String fileId = OfficeEditScope.fileId(memoryId);
            String sessionId = OfficeEditScope.sessionId(memoryId);
            String userId = UserContext.getUserId();
            if (StringUtils.isAnyBlank(fileId, sessionId, userId)) {
                return "失败: 不在 AI 修改会话里。";
            }
            String json = batchJson(commands);
            String result = officeFileEditService.editTokens(
                    fileId, userId, sessionId, "batch", List.of("--commands", json));
            OfficeEditScope.noteTool(memoryId, result);
            return result;
        } catch (BusinessException e) {
            return "业务错误: " + e.getMessage();
        } catch (Exception e) {
            return "失败: " + e.getMessage();
        } finally {
            WorkspaceContext.clear();
            UserContext.clear();
        }
    }

    private String run(String memoryId, boolean write, String verb, String args) {
        if (!bindMemory(memoryId)) {
            return "失败: 无法确定当前工作空间。";
        }
        try {
            String fileId = OfficeEditScope.fileId(memoryId);
            String sessionId = OfficeEditScope.sessionId(memoryId);
            String userId = UserContext.getUserId();
            if (StringUtils.isAnyBlank(fileId, sessionId, userId)) {
                return "失败: 不在 AI 修改会话里。";
            }
            String result;
            if (write) {
                result = "请改用一次 editOffice，把全部修改按行写在 commands 里。";
            } else if (!OfficeEditScope.allowInspect(memoryId)) {
                result = "本轮已经查看过。禁止再次调用 inspectOffice。请根据上一次工具结果直接用中文回答。";
            } else {
                result = officeFileEditService.inspect(fileId, userId, sessionId, verb, args);
            }
            OfficeEditScope.noteTool(memoryId, result);
            return result;
        } catch (BusinessException e) {
            return "业务错误: " + e.getMessage();
        } catch (Exception e) {
            return "失败: " + e.getMessage();
        } finally {
            WorkspaceContext.clear();
            UserContext.clear();
        }
    }

    private static boolean bindMemory(String memoryId) {
        if (StringUtils.isBlank(memoryId)) {
            return false;
        }
        int first = memoryId.indexOf(':');
        int second = memoryId.indexOf(':', first + 1);
        if (first <= 0 || second <= first) {
            return false;
        }
        WorkspaceContext.setWorkspaceId(memoryId.substring(0, first));
        UserContext.setUserId(memoryId.substring(first + 1, second));
        return true;
    }

    private static final Set<String> PROP_KEYS = Set.of("text", "bold", "italic");

    /** 一行一条：set /body/p[1] text=标题 bold=true */
    static String batchJson(String commands) {
        if (StringUtils.isBlank(commands)) {
            throw new BusinessException("没有可执行的修改");
        }
        String[] lines = commands.trim().split("\\r?\\n|；|;");
        StringBuilder json = new StringBuilder("[");
        int count = 0;
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (count > 0) {
                json.append(',');
            }
            json.append(lineJson(line));
            count++;
        }
        if (count == 0) {
            throw new BusinessException("没有可执行的修改");
        }
        json.append(']');
        return json.toString();
    }

    private static String lineJson(String line) {
        String[] parts = line.split("\\s+");
        if (parts.length < 2) {
            throw new BusinessException("修改行不完整: " + line);
        }
        String command = parts[0].toLowerCase(java.util.Locale.ROOT);
        if (!command.equals("set") && !command.equals("add")) {
            throw new BusinessException("只支持 set 和 add: " + line);
        }
        Map<String, String> props = new LinkedHashMap<>();
        for (int i = 2; i < parts.length; i++) {
            int eq = parts[i].indexOf('=');
            if (eq <= 0) {
                throw new BusinessException("属性需要 key=value: " + parts[i]);
            }
            String key = parts[i].substring(0, eq);
            if (!PROP_KEYS.contains(key)) {
                throw new BusinessException("不支持的属性: " + key);
            }
            StringBuilder value = new StringBuilder(parts[i].substring(eq + 1));
            while (i + 1 < parts.length && parts[i + 1].indexOf('=') < 0) {
                value.append(' ').append(parts[++i]);
            }
            props.put(key, value.toString());
        }
        if (!props.containsKey("text")) {
            throw new BusinessException("缺少 text: " + line);
        }
        StringBuilder item = new StringBuilder();
        item.append("{\"command\":\"").append(command).append("\",");
        if ("set".equals(command)) {
            item.append("\"path\":").append(jsonString(parts[1]));
        } else {
            item.append("\"parent\":").append(jsonString(parts[1])).append(",\"type\":\"paragraph\"");
        }
        item.append(",\"props\":{");
        int n = 0;
        for (Map.Entry<String, String> entry : props.entrySet()) {
            if (n++ > 0) {
                item.append(',');
            }
            item.append(jsonString(entry.getKey())).append(':').append(jsonString(entry.getValue()));
        }
        item.append("}}");
        return item.toString();
    }

    private static String jsonString(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (c == '\\' || c == '"') {
                sb.append('\\').append(c);
            } else if (c == '\n') {
                sb.append("\\n");
            } else {
                sb.append(c);
            }
        }
        sb.append('"');
        return sb.toString();
    }
}
