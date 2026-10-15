/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 用户注册cmd
 *
 * @Author: xddcode
 * @Date: 2024/10/16 16:02
 */
@Data
public class UserRegisterCmd {

    @NotBlank(message = "username不能为空")
    private String username;

    @NotBlank(message = "password不能为空")
    private String password;

    @NotBlank(message = "confirmPassword不能为空")
    private String confirmPassword;

    @NotBlank(message = "email不能为空")
    private String email;

    @NotBlank(message = "nickname不能为空")
    private String nickname;

    private String avatar;

    /**
     * 邀请令牌（可选）
     */
    private String inviteToken;
}
