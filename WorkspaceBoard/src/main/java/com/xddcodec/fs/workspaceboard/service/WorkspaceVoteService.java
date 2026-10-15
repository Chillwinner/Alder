/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceVoteParticipantRow;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceVoteRow;
import com.xddcodec.fs.workspaceboard.domain.dto.CastWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceVoteParticipantVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceVoteVO;
import com.xddcodec.fs.push.RealtimeUserPushPublisher;
import com.xddcodec.fs.workspaceboard.mapper.WorkspaceVoteMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WorkspaceVoteService {

    private static final String AGREE = "AGREE";
    private static final String DISAGREE = "DISAGREE";

    private final WorkspaceVoteMapper voteMapper;
    private final SysWorkspaceMemberMapper memberMapper;
    private final RealtimeUserPushPublisher realtimeUserPushPublisher;

    public List<WorkspaceVoteVO> listCurrentWorkspace() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        String workspaceId = WorkspaceContext.getWorkspaceId();
        return toViews(voteMapper.selectCreated(userId), true).stream()
                .filter(item -> workspaceId != null && workspaceId.equals(item.getWorkspaceId()))
                .toList();
    }

    public List<WorkspaceVoteVO> listPendingForCurrentUser() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        List<WorkspaceVoteVO> hosted = toViews(voteMapper.selectCreated(userId), true);
        Set<String> hostedIds = hosted.stream().map(WorkspaceVoteVO::getId).collect(Collectors.toSet());
        List<WorkspaceVoteVO> ballots = toViews(voteMapper.selectPending(userId), false).stream()
                .filter(item -> !hostedIds.contains(item.getId()))
                .toList();
        List<WorkspaceVoteVO> merged = new ArrayList<>(hosted.size() + ballots.size());
        merged.addAll(hosted);
        merged.addAll(ballots);
        return merged;
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkspaceVoteVO create(CreateWorkspaceVoteCmd cmd) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String title = StringUtils.trimToEmpty(cmd == null ? null : cmd.getTitle());
        if (title.isEmpty() || title.length() > 200) {
            throw new BusinessException("vote.title.invalid");
        }
        List<String> participantIds = normalizeParticipants(cmd == null ? null : cmd.getParticipantUserIds());
        if (participantIds.isEmpty()) {
            throw new BusinessException("vote.participants.required");
        }
        Set<String> members = memberMapper.selectMembers(workspaceId, null).stream()
                .map(WorkspaceMemberVO::getUserId)
                .filter(StringUtils::isNotBlank)
                .collect(Collectors.toSet());
        if (!participantIds.stream().allMatch(members::contains)) {
            throw new BusinessException("vote.participant.invalid");
        }
        WorkspaceVoteRow vote = new WorkspaceVoteRow();
        vote.setId(IdUtil.fastSimpleUUID());
        vote.setWorkspaceId(workspaceId);
        vote.setTitle(title);
        vote.setCreatedBy(userId);
        voteMapper.insertVote(vote);
        voteMapper.insertParticipants(vote.getId(), participantIds);
        for (String participantId : participantIds) {
            realtimeUserPushPublisher.publish(
                    participantId,
                    RealtimeUserPushPublisher.TYPE_WORKSPACE_VOTE
            );
        }
        return listCurrentWorkspace().stream()
                .filter(item -> vote.getId().equals(item.getId()))
                .findFirst()
                .orElseGet(() -> {
                    WorkspaceVoteVO created = new WorkspaceVoteVO();
                    created.setId(vote.getId());
                    created.setTitle(title);
                    created.setWorkspaceId(workspaceId);
                    return created;
                });
    }

    @Transactional(rollbackFor = Exception.class)
    public void cast(String voteId, CastWorkspaceVoteCmd cmd) {
        String userId = UserContext.getUserId();
        String choice = StringUtils.trimToEmpty(cmd == null ? null : cmd.getChoice()).toUpperCase();
        if (!AGREE.equals(choice) && !DISAGREE.equals(choice)) {
            throw new BusinessException("vote.choice.invalid");
        }
        WorkspaceVoteRow vote = voteMapper.selectById(voteId);
        if (vote == null) {
            throw new BusinessException("vote.not.found");
        }
        SysWorkspaceMember membership = memberMapper.findByWorkspaceAndUser(vote.getWorkspaceId(), userId);
        if (membership == null) {
            throw new BusinessException("vote.not.participant");
        }
        WorkspaceVoteParticipantRow participant = voteMapper.selectParticipant(voteId, userId);
        if (participant == null) {
            throw new BusinessException("vote.not.participant");
        }
        if (StringUtils.isNotBlank(participant.getChoice())) {
            throw new BusinessException("vote.already.cast");
        }
        if (voteMapper.castChoice(voteId, userId, choice) != 1) {
            throw new BusinessException("vote.already.cast");
        }
        if (StringUtils.isNotBlank(vote.getCreatedBy()) && !vote.getCreatedBy().equals(userId)) {
            realtimeUserPushPublisher.publish(
                    vote.getCreatedBy(),
                    RealtimeUserPushPublisher.TYPE_WORKSPACE_VOTE
            );
        }
    }

    private List<String> normalizeParticipants(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        Set<String> ids = new LinkedHashSet<>();
        for (String id : raw) {
            String trimmed = StringUtils.trimToNull(id);
            if (trimmed != null) {
                ids.add(trimmed);
            }
        }
        return new ArrayList<>(ids);
    }

    private List<WorkspaceVoteVO> toViews(List<WorkspaceVoteRow> rows, boolean withParticipants) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }
        String userId = UserContext.getUserId();
        Map<String, List<WorkspaceVoteParticipantRow>> byVote = Map.of();
        if (withParticipants) {
            List<String> ids = rows.stream().map(WorkspaceVoteRow::getId).toList();
            byVote = voteMapper.selectParticipants(ids).stream()
                    .collect(Collectors.groupingBy(WorkspaceVoteParticipantRow::getVoteId));
        }
        List<WorkspaceVoteVO> views = new ArrayList<>();
        for (WorkspaceVoteRow row : rows) {
            WorkspaceVoteVO vo = new WorkspaceVoteVO();
            vo.setId(row.getId());
            vo.setWorkspaceId(row.getWorkspaceId());
            vo.setWorkspaceName(row.getWorkspaceName());
            vo.setWorkspaceSlug(row.getWorkspaceSlug());
            vo.setTitle(row.getTitle());
            vo.setCreatedBy(row.getCreatedBy());
            vo.setCreatorName(row.getCreatorName());
            vo.setCreatedAt(row.getCreatedAt());
            boolean host = userId != null && userId.equals(row.getCreatedBy());
            vo.setHost(host && withParticipants);
            if (withParticipants) {
                vo.setAgreeCount(row.getAgreeCount() == null ? 0 : row.getAgreeCount());
                vo.setDisagreeCount(row.getDisagreeCount() == null ? 0 : row.getDisagreeCount());
                vo.setPendingCount(row.getPendingCount() == null ? 0 : row.getPendingCount());
            }
            vo.setMyChoice(row.getMyChoice());
            boolean participant = !withParticipants || StringUtils.isNotBlank(row.getMyChoice());
            List<WorkspaceVoteParticipantVO> people = new ArrayList<>();
            for (WorkspaceVoteParticipantRow person : byVote.getOrDefault(row.getId(), List.of())) {
                WorkspaceVoteParticipantVO item = new WorkspaceVoteParticipantVO();
                item.setUserId(person.getUserId());
                item.setUsername(person.getUsername());
                item.setNickname(person.getNickname());
                item.setAvatar(person.getAvatar());
                item.setChoice(person.getChoice());
                people.add(item);
                if (userId != null && userId.equals(person.getUserId())) {
                    participant = true;
                    vo.setMyChoice(person.getChoice());
                }
            }
            vo.setParticipant(participant);
            vo.setParticipants(people);
            views.add(vo);
        }
        return views;
    }
}
