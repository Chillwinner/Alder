/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.dto.*;
import com.xddcodec.fs.System.domain.vo.SysUserVO;
import org.springframework.web.multipart.MultipartFile;

import java.io.Serializable;

/**
 * 用户服务接口
 *
 * @Author: xddcode
 * @Date: 2024/6/7 11:08
 */
public interface SysUserService {

    SysUser getById(Serializable id);

    void updateById(SysUser user);

    /**
     * 根据用户名获取用户信息
     *
     * @param username
     * @return
     */
    SysUser getByUsername(String username);

    /**
     * 根据邮箱获取用户信息
     *
     * @param email
     * @return
     */
    SysUser getByMail(String email);

    /**
     * 获取用户信息
     *
     * @return
     */
    SysUserVO getDetail();

    /**
     * 注册用户
     *
     * @param cmd
     */
    void register(UserRegisterCmd cmd);

    /**
     * 编辑用户个人信息
     *
     * @param cmd
     * @return
     */
    void editUserInfo(UserEditInfoCmd cmd);

    /**
     * 修改邮箱-发送邮箱验证码
     *
     * @param mail
     */
    void sendUpdateMailCode(String mail);

    /**
     * 修改邮箱-验证邮箱验证码
     *
     * @param cmd
     */
    void updateMail(UserEditMailCmd cmd);

    /**
     * 上传头像
     *
     * @param file
     * @return
     */
    void uploadAvatar(MultipartFile file);

    /**
     * 修改密码
     *
     * @param cmd
     * @return
     */
    void updatePassword(PasswordEditCmd cmd);

    /**
     * 设置密码
     *
     * @param cmd
     * @return
     */
    void setPassword(PasswordAddCmd cmd);


    /**
     * 忘记密码-发送验证码
     *
     * @param email
     */
    void sendForgetPasswordCode(String email);

    /**
     * 忘记密码-修改密码
     *
     * @param cmd
     */
    void updateForgetPassword(PasswordForgetEditCmd cmd);
}
