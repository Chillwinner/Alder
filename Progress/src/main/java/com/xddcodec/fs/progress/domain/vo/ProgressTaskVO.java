/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ProgressTaskVO {
    private String id;
    private String workspaceId;
    private String title;
    private String description;
    private String kind;
    private String status;
    private Integer progress;
    private LocalDateTime dueAt;
    private String note;
    private String createdBy;
    private String createdByName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<ProgressAssigneeVO> assignees;
    private boolean todayDone;
    private boolean canSubmit;
    private boolean canReview;
    private boolean canEdit;
    private boolean canDelete;
    /** 日常任务：近 7 天是否提交，从旧到新，最后一项是今天 */
    private List<Boolean> week;
}
