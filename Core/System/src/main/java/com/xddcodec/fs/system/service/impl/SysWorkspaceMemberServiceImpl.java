/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service.impl;

import com.xddcodec.fs.Exception.ErrorMessages;

import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.PageHelper.Pages;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.System.domain.dto.CreateWorkspaceMemberCmd;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.system.service.SysUserService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 工作空间成员服务实现
 *
 * @Author: xddcode
 * @Date: 2026/3/31
 */
@Service
@RequiredArgsConstructor
public class SysWorkspaceMemberServiceImpl implements SysWorkspaceMemberService {

    private final SysWorkspaceMemberMapper memberMapper;
    private final SysWorkspaceMapper workspaceMapper;
    private final SysUserService userService;

    @Override
    public PageResult<WorkspaceMemberVO> getMembers(String workspaceId, int pageNumber, int pageSize) {
        return getMembers(workspaceId, pageNumber, pageSize, null);
    }

    @Override
    public PageResult<WorkspaceMemberVO> getMembers(String workspaceId, int pageNumber, int pageSize, String keyword) {
        Pages.start(pageNumber, pageSize);
        List<WorkspaceMemberVO> records = memberMapper.selectMembers(workspaceId, keyword);
        records.forEach(WorkspaceMemberVO::setIsOwner);
        return Pages.of(records);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateMemberUserStatus(String workspaceId, String userId, Integer status, String currentUserId) {
        if (userId.equals(currentUserId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_MODIFY_SELF);
        }
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace != null && workspace.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_MODIFY_OWNER);
        }
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            throw new BusinessException(ErrorMessages.MEMBER_NOT_EXIST);
        }
        SysUser user = userService.getById(userId);
        if (user == null) {
            throw new BusinessException(ErrorMessages.USER_NOT_EXIST);
        }
        user.setStatus(status);
        userService.updateById(user);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateMemberRole(String workspaceId, String userId, Long roleId, String currentUserId) {
        // 不能修改自己的角色
        if (userId.equals(currentUserId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_MODIFY_SELF);
        }
        //不能修改所有者角色
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace != null && workspace.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_MODIFY_OWNER);
        }

        // 查询成员
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            throw new BusinessException(ErrorMessages.MEMBER_NOT_EXIST);
        }

        // 更新角色
        member.setRoleId(roleId);
        memberMapper.updateById(member);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void removeMember(String workspaceId, String userId, String currentUserId) {
        // 查询工作空间
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_EXIST);
        }

        // 不能移除所有者
        if (workspace.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_REMOVE_OWNER);
        }

        // 不能移除自己
        if (userId.equals(currentUserId)) {
            throw new BusinessException(ErrorMessages.MEMBER_CANNOT_REMOVE_SELF);
        }

        // 查询成员
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId, userId);
        if (member == null) {
            throw new BusinessException(ErrorMessages.MEMBER_NOT_EXIST);
        }

        // 删除成员
        memberMapper.deleteById(member.getId());

        // 更新成员数量
        workspace.setMemberCount(workspace.getMemberCount() - 1);
        workspaceMapper.updateById(workspace);
    }

    @Override
    public SysWorkspaceMember createMember(CreateWorkspaceMemberCmd cmd) {
        SysWorkspaceMember member = new SysWorkspaceMember();
        member.setWorkspaceId(cmd.getWorkspaceId());
        member.setUserId(cmd.getUserId());
        member.setRoleId(cmd.getRoleId());
        member.setJoinedAt(LocalDateTime.now());
        member.setUpdatedAt(LocalDateTime.now());
        memberMapper.insert(member);
        return member;
    }

    @Override
    public SysWorkspaceMember findByWorkspaceAndUser(String workspaceId, String userId) {
        return memberMapper.findByWorkspaceAndUser(workspaceId, userId);
    }

    @Override
    public long countByWorkspaceAndRoleId(String workspaceId, Long roleId) {
        return memberMapper.countByWorkspaceAndRoleId(workspaceId, roleId);
    }

    @Override
    public void removeByWorkspaceId(String workspaceId) {
        memberMapper.deleteByWorkspaceId(workspaceId);
    }
}
