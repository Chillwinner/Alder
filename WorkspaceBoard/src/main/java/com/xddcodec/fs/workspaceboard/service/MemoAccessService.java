/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceMemoMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MemoAccessService {

    private final WorkspaceMemoMapper memoMapper;
    private final SysWorkspaceMemberService memberService;

    public WorkspaceMemo requireMemo(String memoId) {
        return requireLoaded(memoMapper.selectById(memoId));
    }

    /** 不读 body_md。大段内嵌图在库里，打开编辑器时不能把整列拉过隧道。 */
    public WorkspaceMemo requireMemoMeta(String memoId) {
        return requireLoaded(memoMapper.selectMetaById(memoId));
    }

    private WorkspaceMemo requireLoaded(WorkspaceMemo memo) {
        if (memo == null) {
            throw new BusinessException("board.memo.not.found");
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        if (workspaceId != null && !workspaceId.equals(memo.getWorkspaceId())) {
            throw new BusinessException("board.memo.not.found");
        }
        if (isPrivate(memo)) {
            String userId = UserContext.getUserId();
            if (userId == null || !userId.equals(memo.getCreatedBy())) {
                throw new BusinessException("board.memo.not.found");
            }
        }
        return memo;
    }

    public WorkspaceMemo requireMemoForCollab(String memoId, String userId) {
        WorkspaceMemo memo = requireMemo(memoId);
        if (isPrivate(memo)) {
            throw new BusinessException("board.memo.private.no.sync");
        }
        assertMember(userId, memo.getWorkspaceId());
        return memo;
    }

    public static boolean isPrivate(WorkspaceMemo memo) {
        return memo != null && "private".equalsIgnoreCase(memo.getVisibility());
    }

    public void assertMember(String userId, String workspaceId) {
        if (memberService.findByWorkspaceAndUser(workspaceId, userId) == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_MEMBER);
        }
    }
}
