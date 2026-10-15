/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemo;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemoSnapshot;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceMemoMapper;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceMemoSnapshotMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemoPersistenceService {

    private final MemoSyncRedisService syncRedis;
    private final WorkspaceMemoSnapshotMapper snapshotMapper;
    private final WorkspaceMemoMapper memoMapper;
    private final MemoBoardMetaPushService metaPushService;

    @Transactional(rollbackFor = Exception.class)
    public void flushMemo(String memoId) {
        if (!syncRedis.isDirty(memoId)) {
            return;
        }
        byte[] state = syncRedis.loadState(memoId);
        if (state == null || state.length == 0) {
            syncRedis.clearDirty(memoId);
            return;
        }
        String hash = sha256Hex(state);
        WorkspaceMemoSnapshot latest = snapshotMapper.selectLatest(memoId);
        if (latest != null && hash.equals(latest.getContentHash())) {
            syncRedis.clearDirty(memoId);
            return;
        }
        WorkspaceMemoSnapshot row = new WorkspaceMemoSnapshot();
        row.setMemoId(memoId);
        row.setYjsState(state);
        row.setContentHash(hash);
        snapshotMapper.insert(row);
        memoMapper.touchUpdatedAt(memoId);
        syncRedis.clearDirty(memoId);
        WorkspaceMemo memo = memoMapper.selectById(memoId);
        if (memo != null && memo.getDeletedAt() == null && !MemoAccessService.isPrivate(memo)) {
            metaPushService.publishAfterCommit(memo.getWorkspaceId(), "updated", memo);
        }
        log.debug("备忘录已备份 PG: memoId={}, bytes={}", memoId, state.length);
    }

    public void flushDirtyMemos(Set<String> memoIds) {
        for (String memoId : memoIds) {
            try {
                flushMemo(memoId);
            } catch (Exception e) {
                log.warn("备忘录备份失败: memoId={}", memoId, e);
            }
        }
    }

    public java.util.List<WorkspaceMemoSnapshot> listSnapshots(String memoId) {
        return snapshotMapper.selectList(memoId);
    }

    public WorkspaceMemoSnapshot restoreSnapshot(String memoId, Long snapshotId) {
        WorkspaceMemoSnapshot row = snapshotMapper.selectById(snapshotId);
        if (row == null || !memoId.equals(row.getMemoId()) || row.getYjsState() == null) {
            throw new com.xddcodec.fs.Exception.BusinessException("board.memo.snapshot.not.found");
        }
        if (!isMarkdownRevision(row.getYjsState())) {
            syncRedis.storeSnapshot(memoId, row.getYjsState());
        }
        return row;
    }

    public WorkspaceMemoSnapshot recordMarkdownRevision(String memoId, String markdown, String commitMessage) {
        if (memoId == null || markdown == null) {
            return null;
        }
        byte[] state = encodeMarkdownRevision(markdown);
        String hash = sha256Hex(state);
        WorkspaceMemoSnapshot latest = snapshotMapper.selectLatestCommit(memoId);
        if (latest != null && hash.equals(latest.getContentHash())) {
            return null;
        }
        WorkspaceMemoSnapshot row = new WorkspaceMemoSnapshot();
        row.setMemoId(memoId);
        row.setYjsState(state);
        row.setContentHash(hash);
        row.setCommitMessage(commitMessage);
        snapshotMapper.insert(row);
        return row;
    }

    public static boolean isMarkdownRevision(byte[] state) {
        if (state == null || state.length < MARKDOWN_PREFIX.length) {
            return false;
        }
        for (int i = 0; i < MARKDOWN_PREFIX.length; i++) {
            if (state[i] != MARKDOWN_PREFIX[i]) {
                return false;
            }
        }
        return true;
    }

    public static String decodeMarkdownRevision(byte[] state) {
        return new String(state, MARKDOWN_PREFIX.length, state.length - MARKDOWN_PREFIX.length, StandardCharsets.UTF_8);
    }

    private static byte[] encodeMarkdownRevision(String markdown) {
        byte[] body = markdown.getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[MARKDOWN_PREFIX.length + body.length];
        System.arraycopy(MARKDOWN_PREFIX, 0, out, 0, MARKDOWN_PREFIX.length);
        System.arraycopy(body, 0, out, MARKDOWN_PREFIX.length, body.length);
        return out;
    }

    public byte[] loadInitialState(String memoId) {
        byte[] hot = syncRedis.loadState(memoId);
        if (hot != null && hot.length > 0) {
            return hot;
        }
        WorkspaceMemoSnapshot latest = snapshotMapper.selectLatest(memoId);
        return latest == null ? null : latest.getYjsState();
    }

    private static final byte[] MARKDOWN_PREFIX = "ALDERMD\n".getBytes(StandardCharsets.UTF_8);

    private static String sha256Hex(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
