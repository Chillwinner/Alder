/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.vo;

import lombok.Data;

@Data
public class WorkspaceVoteParticipantVO {
    private String userId;
    private String username;
    private String nickname;
    private String avatar;
    private String choice;
}
