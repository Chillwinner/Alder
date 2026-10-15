/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serial;
import java.io.Serializable;
import java.util.List;

/**
 * 创建角色命令
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Data
public class CreateRoleCmd implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 工作空间ID
     */
    @NotBlank(message = "工作空间ID不能为空")
    private String workspaceId;

    /**
     * 角色编码
     */
    @NotBlank(message = "角色编码不能为空")
    private String roleCode;

    /**
     * 角色名称
     */
    @NotBlank(message = "角色名称不能为空")
    private String roleName;

    /**
     * 角色描述
     */
    private String description;

    /**
     * 角色类型：0 系统预设，1 自定义；为空则按自定义处理
     */
    private Integer roleType;

    /**
     * 权限码，创建时一并写入
     */
    private List<String> permissions;
}
