/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class WorkspaceVoteVO {
    private String id;
    private String workspaceId;
    private String workspaceName;
    private String workspaceSlug;
    private String title;
    private String createdBy;
    private String creatorName;
    private LocalDateTime createdAt;
    private int agreeCount;
    private int disagreeCount;
    private int pendingCount;
    private String myChoice;
    private boolean participant;
    /** 发起人在铃铛里看结果；其他人只有投票按钮。 */
    private boolean host;
    private List<WorkspaceVoteParticipantVO> participants;
}
