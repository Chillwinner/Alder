/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.mapper;

import com.xddcodec.fs.workspaceboard.domain.WorkspaceVoteParticipantRow;
import com.xddcodec.fs.workspaceboard.domain.WorkspaceVoteRow;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface WorkspaceVoteMapper {

    int insertVote(WorkspaceVoteRow vote);

    int insertParticipants(@Param("voteId") String voteId, @Param("userIds") List<String> userIds);

    List<WorkspaceVoteRow> selectByWorkspace(@Param("workspaceId") String workspaceId,
                                             @Param("userId") String userId);

    List<WorkspaceVoteParticipantRow> selectParticipants(@Param("voteIds") List<String> voteIds);

    List<WorkspaceVoteRow> selectPending(@Param("userId") String userId);

    List<WorkspaceVoteRow> selectCreated(@Param("userId") String userId);

    WorkspaceVoteRow selectById(@Param("id") String id);

    WorkspaceVoteParticipantRow selectParticipant(@Param("voteId") String voteId,
                                                  @Param("userId") String userId);

    int castChoice(@Param("voteId") String voteId,
                   @Param("userId") String userId,
                   @Param("choice") String choice);
}
