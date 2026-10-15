/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain;

import com.xddcodec.fs.Framework.orm.entity.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 工作空间邀请表
 *
 * @Author: xddcode
 * @Date: 2026/3/30 10:11
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class SysWorkspaceInvitation extends BaseEntity {

    /**
     * 自增id
     */
    private String id;

    /**
     * 工作空间ID
     */
    private String workspaceId;

    /**
     * 邀请邮箱
     */
    private String email;

    /**
     * 角色ID
     */
    private Long roleId;

    /**
     * 邀请人ID
     */
    private String invitedBy;

    /**
     * 邀请令牌
     */
    private String token;

    /**
     * 邀请状态: 0-待接受 1-已接受 2-已过期 3-已取消
     */
    private Integer status;

    /**
     * 邀请过期时间
     */
    private LocalDateTime expiresAt;

    /**
     * 接受时间
     */
    private LocalDateTime acceptedAt;

    // ========== 关联查询字段（非数据库字段） ==========

    /**
     * 工作空间名称（关联查询）
     */
    private String workspaceName;

    /**
     * 角色名称（关联查询）
     */
    private String roleName;

    /**
     * 角色编码（关联查询）
     */
    private String roleCode;

    /**
     * 邀请人名称（关联查询）
     */
    private String inviterName;
}
