/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.controller;

import cn.dev33.satoken.annotation.SaCheckPermission;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.ai.domain.dto.AiChatCmd;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.ai.domain.vo.AiMessageVO;
import com.xddcodec.fs.ai.domain.vo.AiThreadVO;
import com.xddcodec.fs.ai.domain.vo.OfficeLockVO;
import com.xddcodec.fs.ai.office.FileWriteLockService;
import com.xddcodec.fs.ai.office.OfficeCliRunner;
import com.xddcodec.fs.ai.office.OfficeEditScope;
import com.xddcodec.fs.ai.office.OfficeFileEditService;
import com.xddcodec.fs.ai.service.AiThreadCatalog;
import com.xddcodec.fs.ai.service.WorkspaceAiAgentFactory;
import com.xddcodec.fs.ai.service.WorkspaceAiSettingsService;
import com.xddcodec.fs.ai.store.RedisChatMemoryStore;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposable;
import reactor.core.publisher.Flux;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/apis/ai/office")
@Tag(name = "Office AI 修改")
public class OfficeAiController {

    private final FileWriteLockService writeLockService;
    private final OfficeFileEditService officeFileEditService;
    private final OfficeCliRunner officeCliRunner;
    private final AiThreadCatalog catalog;
    private final WorkspaceAiSettingsService settingsService;
    private final WorkspaceAiAgentFactory agentFactory;
    private final RedisChatMemoryStore memoryStore;

    @GetMapping("/{fileId}/lock")
    @SaCheckPermission("file:write")
    @Operation(summary = "写锁与版本")
    public Result<OfficeLockVO> lockStatus(@PathVariable String fileId) {
        return Result.ok(toVo(fileId, writeLockService.peek(fileId), null));
    }

    @PostMapping("/{fileId}/lock")
    @SaCheckPermission("file:write")
    @Operation(summary = "占用写锁")
    public Result<OfficeLockVO> acquire(@PathVariable String fileId) {
        officeFileEditService.requireOfficeFile(fileId);
        FileWriteLockService.Hold hold = writeLockService.acquire(fileId, UserContext.getUserId());
        return Result.ok(toVo(fileId, hold, hold.sessionId()));
    }

    @PostMapping("/{fileId}/heartbeat")
    @SaCheckPermission("file:write")
    public Result<Void> heartbeat(@PathVariable String fileId, @RequestParam String sessionId) {
        writeLockService.heartbeat(fileId, UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @DeleteMapping("/{fileId}/lock")
    @SaCheckPermission("file:write")
    public Result<Void> release(@PathVariable String fileId, @RequestParam String sessionId) {
        writeLockService.release(fileId, UserContext.getUserId(), sessionId);
        return Result.ok();
    }

    @GetMapping("/{fileId}/threads")
    @SaCheckPermission("file:write")
    public Result<List<AiThreadVO>> threads(@PathVariable String fileId) {
        officeFileEditService.requireOfficeFile(fileId);
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String scope = officeScope(fileId);
        List<AiThreadVO> list = catalog.list(workspaceId, userId, scope);
        if (list.isEmpty()) {
            String legacyId = catalog.memoryId(workspaceId, userId, "office-" + fileId);
            List<ChatMessage> legacy = memoryStore.getMessages(legacyId);
            AiThreadVO created = catalog.create(workspaceId, userId, scope);
            if (!legacy.isEmpty()) {
                memoryStore.updateMessages(catalog.memoryId(workspaceId, userId, created.getId()), legacy);
                memoryStore.deleteMessages(legacyId);
            }
            list = List.of(created);
        }
        return Result.ok(list);
    }

    @PostMapping("/{fileId}/threads")
    @SaCheckPermission("file:write")
    public Result<AiThreadVO> createThread(@PathVariable String fileId) {
        officeFileEditService.requireOfficeFile(fileId);
        return Result.ok(catalog.create(
                WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), officeScope(fileId)));
    }

    @DeleteMapping("/{fileId}/threads/{threadId}")
    @SaCheckPermission("file:write")
    public Result<Void> deleteThread(@PathVariable String fileId, @PathVariable String threadId) {
        requireOfficeThread(fileId, threadId);
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        memoryStore.deleteMessages(catalog.memoryId(workspaceId, userId, threadId));
        catalog.delete(workspaceId, userId, threadId, officeScope(fileId));
        return Result.ok();
    }

    @GetMapping("/{fileId}/threads/{threadId}/messages")
    @SaCheckPermission("file:write")
    public Result<List<AiMessageVO>> messages(@PathVariable String fileId, @PathVariable String threadId) {
        requireOfficeThread(fileId, threadId);
        return Result.ok(toVos(memoryStore.getMessages(memoryId(threadId))));
    }

    @PutMapping("/{fileId}/threads/{threadId}/messages")
    @SaCheckPermission("file:write")
    public Result<Void> replaceMessages(
            @PathVariable String fileId,
            @PathVariable String threadId,
            @RequestBody List<AiMessageVO> messages) {
        requireOfficeThread(fileId, threadId);
        memoryStore.updateMessages(memoryId(threadId), toChatMessages(messages));
        return Result.ok();
    }

    @PostMapping("/{fileId}/threads/{threadId}/drop-last-turn")
    @SaCheckPermission("file:write")
    public Result<Void> dropLastTurn(@PathVariable String fileId, @PathVariable String threadId) {
        requireOfficeThread(fileId, threadId);
        memoryStore.dropLastUserTurn(memoryId(threadId));
        return Result.ok();
    }

    @PostMapping(value = "/{fileId}/threads/{threadId}/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @SaCheckPermission("file:write")
    @Operation(summary = "针对该文件某一对话的流式回复")
    public SseEmitter chat(
            @PathVariable String fileId,
            @PathVariable String threadId,
            @RequestParam String sessionId,
            @RequestBody AiChatCmd cmd) {
        requireOfficeThread(fileId, threadId);
        writeLockService.requireMine(fileId, UserContext.getUserId(), sessionId);
        FileInfo file = officeFileEditService.requireOfficeFile(fileId);
        String text = cmd == null || cmd.getMessage() == null ? "" : cmd.getMessage().trim();
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        catalog.touch(workspaceId, userId, threadId, text, officeScope(fileId));
        WorkspaceAiSettingsService.ResolvedAiEndpoint endpoint = settingsService.resolveForChat();
        String instructions = StringUtils.isBlank(endpoint.customPrompt()) ? "无" : endpoint.customPrompt();
        String context = file.getDisplayName() + " (" + file.getSuffix() + ") id=" + file.getId();
        String memoryId = memoryId(threadId);
        SseEmitter emitter = new SseEmitter(180_000L);
        OfficeEditScope.bind(memoryId, fileId, sessionId);
        Flux<String> flux = agentFactory.officeAgent(endpoint).chat(memoryId, context, instructions, text);
        PreambleGate gate = new PreambleGate();
        Disposable sub = flux.subscribe(
                token -> {
                    String visible = gate.accept(token);
                    if (visible == null || visible.isEmpty()) {
                        return;
                    }
                    try {
                        emitter.send(SseEmitter.event().data(visible));
                    } catch (Exception ignored) {
                        emitter.complete();
                    }
                },
                error -> {
                    try {
                        emitter.send(SseEmitter.event().name("error").data(error.getMessage()));
                    } catch (Exception ignored) {
                        // closed
                    }
                    emitter.complete();
                    OfficeEditScope.clear(memoryId);
                },
                () -> {
                    String fallback = gate.finish(OfficeEditScope.lastTool(memoryId));
                    if (fallback != null && !fallback.isEmpty()) {
                        try {
                            emitter.send(SseEmitter.event().data(fallback));
                        } catch (Exception ignored) {
                            // closed
                        }
                    }
                    OfficeEditScope.clear(memoryId);
                    emitter.complete();
                }
        );
        emitter.onCompletion(() -> {
            sub.dispose();
            OfficeEditScope.clear(memoryId);
        });
        emitter.onTimeout(() -> {
            sub.dispose();
            OfficeEditScope.clear(memoryId);
            emitter.complete();
        });
        emitter.onError((error) -> {
            sub.dispose();
            OfficeEditScope.clear(memoryId);
        });
        return emitter;
    }

    private OfficeLockVO toVo(String fileId, FileWriteLockService.Hold hold, String sessionId) {
        FileInfo file = officeFileEditService.requireOfficeFile(fileId);
        String me = UserContext.getUserId();
        OfficeLockVO vo = new OfficeLockVO();
        vo.setFileId(file.getId());
        vo.setDisplayName(file.getDisplayName());
        vo.setSuffix(file.getSuffix());
        vo.setRevision(officeFileEditService.revision(file));
        vo.setOfficeCliReady(officeCliRunner.available());
        vo.setThreadId("");
        if (hold != null) {
            vo.setHolderUserId(hold.userId());
            vo.setLockedByMe(me != null && me.equals(hold.userId()));
            vo.setSessionId(sessionId != null ? sessionId : hold.sessionId());
        }
        return vo;
    }

    /** 模型在调工具前会反复说 I'll inspect / 我先看，这些不发给界面。 */
    private static final class PreambleGate {
        private final StringBuilder held = new StringBuilder();
        private boolean open;

        String accept(String token) {
            if (token == null || token.isEmpty()) {
                return null;
            }
            if (open) {
                return token;
            }
            held.append(token);
            int cjk = indexOfCjk(held);
            if (cjk < 0) {
                return null;
            }
            open = true;
            return held.substring(cjk);
        }

        /** 模型只说了英文开场白时，把工具读到的正文发给界面。 */
        String finish(String toolText) {
            if (open) {
                return null;
            }
            int cjk = indexOfCjk(held);
            if (cjk >= 0) {
                open = true;
                return held.substring(cjk);
            }
            if (toolText == null || toolText.isBlank()) {
                open = true;
                return "没有读到文件内容，请再发一次。";
            }
            open = true;
            String body = toolText.length() > 3500 ? toolText.substring(0, 3500) : toolText;
            return body;
        }

        private static int indexOfCjk(CharSequence text) {
            for (int i = 0; i < text.length(); i++) {
                char c = text.charAt(i);
                if (c >= 0x4E00 && c <= 0x9FFF) {
                    return i;
                }
            }
            return -1;
        }
    }

    private void requireOfficeThread(String fileId, String threadId) {
        officeFileEditService.requireOfficeFile(fileId);
        boolean found = catalog.list(
                        WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), officeScope(fileId))
                .stream()
                .anyMatch(item -> item.getId().equals(threadId));
        if (!found) {
            throw new BusinessException("对话不存在");
        }
    }

    private String officeScope(String fileId) {
        return "office-" + fileId;
    }

    private String memoryId(String threadId) {
        return catalog.memoryId(WorkspaceContext.getWorkspaceId(), UserContext.getUserId(), threadId);
    }

    private static List<AiMessageVO> toVos(List<ChatMessage> messages) {
        List<AiMessageVO> out = new ArrayList<>();
        for (ChatMessage message : messages) {
            AiMessageVO vo = new AiMessageVO();
            if (message instanceof UserMessage user) {
                vo.setRole("user");
                vo.setText(user.singleText());
            } else if (message instanceof AiMessage ai) {
                if (ai.hasToolExecutionRequests() && StringUtils.isBlank(ai.text())) {
                    continue;
                }
                vo.setRole("assistant");
                vo.setText(ai.text() == null ? "" : ai.text());
            } else {
                continue;
            }
            out.add(vo);
        }
        return out;
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
