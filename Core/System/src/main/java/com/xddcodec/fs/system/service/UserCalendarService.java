/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.system.domain.UserCalendarEvent;
import com.xddcodec.fs.system.domain.dto.SaveCalendarEventCmd;
import com.xddcodec.fs.system.domain.vo.UserCalendarEventVO;
import com.xddcodec.fs.system.mapper.UserCalendarEventMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserCalendarService {

    private final UserCalendarEventMapper mapper;

    public List<UserCalendarEventVO> list(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw new BusinessException("时间范围无效");
        }
        return mapper.selectOverlapping(requireUserId(), from, to).stream().map(this::toVo).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public UserCalendarEventVO create(SaveCalendarEventCmd cmd) {
        UserCalendarEvent row = new UserCalendarEvent();
        row.setId(IdUtil.fastSimpleUUID());
        row.setUserId(requireUserId());
        apply(row, cmd);
        mapper.insert(row);
        return toVo(row);
    }

    @Transactional(rollbackFor = Exception.class)
    public UserCalendarEventVO update(String id, SaveCalendarEventCmd cmd) {
        String userId = requireUserId();
        UserCalendarEvent existing = mapper.selectOwn(id, userId);
        if (existing == null) {
            throw new BusinessException("日程不存在");
        }
        apply(existing, cmd);
        if (mapper.updateOwn(existing) != 1) {
            throw new BusinessException("日程不存在");
        }
        return toVo(existing);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(String id) {
        if (mapper.deleteOwn(id, requireUserId()) != 1) {
            throw new BusinessException("日程不存在");
        }
    }

    private void apply(UserCalendarEvent row, SaveCalendarEventCmd cmd) {
        if (cmd == null) {
            throw new BusinessException("日程内容不能为空");
        }
        String title = StringUtils.trimToEmpty(cmd.getTitle());
        if (title.isEmpty() || title.length() > 200) {
            throw new BusinessException("标题不能为空");
        }
        OffsetDateTime startsAt = parseInstant(cmd.getStartsAt());
        OffsetDateTime endsAt = parseInstant(cmd.getEndsAt());
        if (startsAt == null || endsAt == null || !endsAt.isAfter(startsAt)) {
            throw new BusinessException("结束时间必须晚于开始时间");
        }
        String note = StringUtils.trimToNull(cmd.getNote());
        if (note != null && note.length() > 2000) {
            throw new BusinessException("备注过长");
        }
        row.setTitle(title);
        row.setNote(note);
        row.setStartsAt(startsAt);
        row.setEndsAt(endsAt);
    }

    private UserCalendarEventVO toVo(UserCalendarEvent row) {
        UserCalendarEventVO vo = new UserCalendarEventVO();
        vo.setId(row.getId());
        vo.setTitle(row.getTitle());
        vo.setNote(row.getNote());
        vo.setStartsAt(row.getStartsAt() == null ? null : row.getStartsAt().toInstant().toString());
        vo.setEndsAt(row.getEndsAt() == null ? null : row.getEndsAt().toInstant().toString());
        return vo;
    }

    private static OffsetDateTime parseInstant(String raw) {
        if (StringUtils.isBlank(raw)) {
            return null;
        }
        try {
            return OffsetDateTime.parse(raw.trim());
        } catch (Exception ignored) {
            try {
                return java.time.Instant.parse(raw.trim()).atOffset(ZoneOffset.UTC);
            } catch (Exception e) {
                return null;
            }
        }
    }

    private static String requireUserId() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            throw new BusinessException("未登录");
        }
        return userId;
    }
}
