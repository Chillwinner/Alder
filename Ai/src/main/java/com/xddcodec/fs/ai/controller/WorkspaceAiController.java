/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.controller;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Result.Result;
import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.ai.domain.dto.AiChatCmd;
import com.xddcodec.fs.ai.domain.dto.IndexWorkspaceRagCmd;
import com.xddcodec.fs.ai.domain.dto.UpdateWorkspaceAiSettingsCmd;
import com.xddcodec.fs.ai.domain.vo.AiMessageVO;
import com.xddcodec.fs.ai.domain.vo.AiThreadVO;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiRagFileVO;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiReminderInboxVO;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiSettingsVO;
import com.xddcodec.fs.ai.service.AiThreadCatalog;
import com.xddcodec.fs.ai.service.WorkspaceAiAgentFactory;
import com.xddcodec.fs.ai.service.WorkspaceAiReminderService;
import com.xddcodec.fs.ai.service.WorkspaceAiSettingsService;
import com.xddcodec.fs.ai.service.WorkspaceRagService;
import com.xddcodec.fs.ai.store.RedisChatMemoryStore;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.apache.commons.lang3.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/ai")
@Tag(name = "工作空间助手")
public class WorkspaceAiController {

    private final AiThreadCatalog catalog;
    private final WorkspaceAiSettingsService settingsService;
    private final WorkspaceAiAgentFactory agentFactory;
    private final RedisChatMemoryStore memoryStore;
    private final WorkspaceAiReminderService reminderService;
    private final WorkspaceRagService ragService;

    @GetMapping("/settings")
    @Operation(summary = "当前空间助手配置")
    public Result<WorkspaceAiSettingsVO> settings() {
        return Result.ok(settingsService.getCurrent(StpUtil.hasPermission("member:manage")));
    }

    @PutMapping("/settings")
    @SaCheckPermission("member:manage")
    @Operation(summary = "保存当前空间助手配置")
    public Result<WorkspaceAiSettingsVO> saveSettings(@RequestBody UpdateWorkspaceAiSettingsCmd cmd) {
        return Result.ok(settingsService.save(cmd, true));
    }

    @GetMapping("/rag/staging")
    @Operation(summary = "rag 暂存目录中的文件（含子目录）")
    public Result<List<WorkspaceAiRagFileVO>> ragStaging() {
        return Result.ok(ragService.listStaging());
    }

    @PostMapping(value = "/rag/staging/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @SaCheckPermission("member:manage")
    @Operation(summary = "上传文件到 rag 暂存目录，不入库")
    public Result<List<WorkspaceAiRagFileVO>> ragUpload(@RequestParam("file") MultipartFile file) {
        return Result.ok(ragService.uploadStaging(file));
    }

    @GetMapping("/rag/docs")
    @Operation(summary = "已入库知识清单")
    public Result<List<WorkspaceAiRagFileVO>> ragDocs() {
        return Result.ok(ragService.listIndexed());
    }

    @PostMapping("/rag/index")
    @SaCheckPermission("member:manage")
    @Operation(summary = "把暂存文件写入向量库")
    public Result<List<WorkspaceAiRagFileVO>> ragIndex(@RequestBody IndexWorkspaceRagCmd cmd) {
        return Result.ok(ragService.index(cmd == null ? List.of() : cmd.getFileIds()));
    }

    @PostMapping("/rag/docs/{fileId}/reindex")
    @SaCheckPermission("member:manage")
    @Operation(summary = "按同一 fileId 重新入库")
    public Result<List<WorkspaceAiRagFileVO>> ragReindex(@PathVariable String fileId) {
        return Result.ok(ragService.reindex(fileId));
    }

    @DeleteMapping("/rag/docs/{fileId}")
    @SaCheckPermission("member:manage")
    @Operation(summary = "从知识库去掉该文件（不影响网盘）")
    public Result<Void> ragRemove(@PathVariable String fileId) {
        ragService.remove(fileId);
        return Result.ok();
    }

    @GetMapping("/rag/search")
    @Operation(summary = "检索已入库切片（与助手 tool 同一套 store）")
    public Result<String> ragSearch(
            @RequestParam String q,
            @RequestParam(required = false) Integer topK) {
        return Result.ok(ragService.search(q, topK));
    }

    @GetMapping("/reminders/inbox")
    @Operation(summary = "当前用户未消失的提醒通知")
    public Result<List<WorkspaceAiReminderInboxVO>> reminderInbox() {
        return Result.ok(reminderService.listInbox());
    }

    @PostMapping("/reminders/inbox/{inboxId}/dismiss")
    @Operation(summary = "从通知栏去掉一条提醒")
    public Result<Void> dismissReminder(@PathVariable String inboxId) {
        reminderService.dismissInbox(inboxId);
        return Result.ok();
    }

    @GetMapping("/threads")
    @Operation(summary = "当前用户在本空间的对话列表")
    public Result<List<AiThreadVO>> threads() {
        return Result.ok(catalog.list(WorkspaceContext.getWorkspaceId(), UserContext.getUserId()));
    }

    @PostMapping("/threads")
    @Operation(summary = "新建对话")
    public Result<AiThreadVO> create() {
        return Result.ok(catalog.create(WorkspaceContext.getWorkspaceId(), UserContext.getUserId()));
    }

    @DeleteMapping("/threads/{threadId}")
    @Operation(summary = "删除对话")
    public Result<Void> delete(@PathVariable String threadId) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        memoryStore.deleteMessages(catalog.memoryId(workspaceId, userId, threadId));
        catalog.delete(workspaceId, userId, threadId);
        return Result.ok();
    }

    @GetMapping("/threads/{threadId}/messages")
    @Operation(summary = "最近最多 20 条")
    public Result<List<AiMessageVO>> messages(@PathVariable String threadId) {
        String memoryId = catalog.memoryId(
                WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), threadId);
        List<AiMessageVO> out = new ArrayList<>();
        for (ChatMessage message : memoryStore.getMessages(memoryId)) {
            AiMessageVO vo = new AiMessageVO();
            if (message instanceof UserMessage user) {
                vo.setRole("user");
                vo.setText(user.singleText());
            } else if (message instanceof AiMessage ai) {
                vo.setRole("assistant");
                vo.setText(ai.text());
            } else {
                continue;
            }
            out.add(vo);
        }
        return Result.ok(out);
    }

    @PutMapping("/threads/{threadId}/messages")
    @Operation(summary = "用给定前缀覆盖记忆（编辑重发）")
    public Result<Void> replaceMessages(@PathVariable String threadId, @RequestBody List<AiMessageVO> messages) {
        memoryStore.updateMessages(memoryId(threadId), toChatMessages(messages));
        return Result.ok();
    }

    @PostMapping("/threads/{threadId}/drop-last-turn")
    @Operation(summary = "丢掉最后一轮用户问题及未完成回复")
    public Result<Void> dropLastTurn(@PathVariable String threadId) {
        memoryStore.dropLastUserTurn(memoryId(threadId));
        return Result.ok();
    }

    @PostMapping(value = "/threads/{threadId}/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "发送并流式回复")
    public SseEmitter chat(@PathVariable String threadId, @RequestBody AiChatCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String text = cmd == null || cmd.getMessage() == null ? "" : cmd.getMessage().trim();
        catalog.touch(workspaceId, userId, threadId, text);
        String memoryId = catalog.memoryId(workspaceId, userId, threadId);
        String context = "workspaceId=" + workspaceId;
        WorkspaceAiSettingsService.ResolvedAiEndpoint endpoint = settingsService.resolveForChat();
        String instructions = StringUtils.isBlank(endpoint.customPrompt()) ? "无" : endpoint.customPrompt();
        SseEmitter emitter = new SseEmitter(120_000L);
        Flux<String> flux = agentFactory.agent(endpoint).chat(memoryId, context, instructions, text);
        Disposable sub = flux.subscribe(
                token -> {
                    try {
                        emitter.send(SseEmitter.event().data(token));
                    } catch (Exception ignored) {
                        emitter.complete();
                    }
                },
                error -> {
                    try {
                        emitter.send(SseEmitter.event().name("error").data(error.getMessage()));
                    } catch (Exception ignored) {
                        // already closed
                    }
                    emitter.complete();
                },
                emitter::complete
        );
        emitter.onCompletion(sub::dispose);
        emitter.onTimeout(() -> {
            sub.dispose();
            emitter.complete();
        });
        emitter.onError((error) -> sub.dispose());
        return emitter;
    }

    private String memoryId(String threadId) {
        return catalog.memoryId(WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), threadId);
    }

    private static List<ChatMessage> toChatMessages(List<AiMessageVO> messages) {
        List<ChatMessage> out = new ArrayList<>();
        if (messages == null) {
            return out;
        }
        for (AiMessageVO item : messages) {
            if (item == null || StringUtils.isBlank(item.getRole())) {
                continue;
            }
            String text = item.getText() == null ? "" : item.getText();
            if ("user".equalsIgnoreCase(item.getRole())) {
                out.add(UserMessage.from(text));
            } else if ("assistant".equalsIgnoreCase(item.getRole())) {
                out.add(AiMessage.from(text));
            }
        }
        return out;
    }
}
