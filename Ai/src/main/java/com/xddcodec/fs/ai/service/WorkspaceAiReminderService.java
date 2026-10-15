/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.ai.domain.WorkspaceAiReminder;
import com.xddcodec.fs.ai.domain.WorkspaceAiReminderInbox;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiReminderInboxVO;
import com.xddcodec.fs.ai.domain.vo.WorkspaceAiReminderVO;
import com.xddcodec.fs.ai.mapper.WorkspaceAiReminderMapper;
import com.xddcodec.fs.push.RealtimeUserPushPublisher;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class WorkspaceAiReminderService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final WorkspaceAiReminderMapper mapper;
    private final RealtimeUserPushPublisher realtimeUserPushPublisher;

    public List<WorkspaceAiReminderVO> listMine() {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        return mapper.selectByUserInWorkspace(workspaceId, userId).stream().map(this::toVo).toList();
    }

    public List<WorkspaceAiReminderInboxVO> listInbox() {
        String userId = UserContext.getUserId();
        if (StringUtils.isBlank(userId)) {
            return List.of();
        }
        return mapper.selectOpenInbox(userId).stream().map(this::toInboxVo).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public WorkspaceAiReminderVO create(
            String message,
            String kindRaw,
            String hourRaw,
            String minuteRaw,
            String onceDateRaw,
            String weekdaysRaw,
            String biweekParityRaw,
            String anchorMondayRaw) {
        String workspaceId = WorkspaceContext.getWorkspaceId();
        String userId = UserContext.getUserId();
        String text = StringUtils.trimToEmpty(message);
        if (text.isEmpty() || text.length() > 2000) {
            throw new BusinessException("提醒内容不能为空");
        }
        String kind = normalizeKind(kindRaw);
        int hour = parseInt(hourRaw, 9);
        int minute = parseInt(minuteRaw, 0);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            throw new BusinessException("时间必须是北京时间的小时 0-23、分钟 0-59");
        }
        WorkspaceAiReminder row = new WorkspaceAiReminder();
        row.setId(IdUtil.fastSimpleUUID());
        row.setWorkspaceId(workspaceId);
        row.setUserId(userId);
        row.setMessage(text);
        row.setKind(kind);
        row.setHour(hour);
        row.setMinute(minute);
        row.setEnabled(true);
        if ("ONCE".equals(kind)) {
            LocalDate date = parseDate(onceDateRaw);
            if (date == null) {
                throw new BusinessException("单次提醒需要 onceDate，格式 YYYY-MM-DD（北京时间）");
            }
            row.setOnceDate(date);
        } else {
            if (WorkspaceAiReminderSchedule.parseWeekdays(weekdaysRaw).isEmpty()) {
                throw new BusinessException("每周/大小周提醒需要 weekdays，周一=1 … 周日=7，例如 1,3,5");
            }
            row.setWeekdays(String.join(",", WorkspaceAiReminderSchedule.parseWeekdays(weekdaysRaw)
                    .stream().map(String::valueOf).toList()));
        }
        if ("BIWEEK".equals(kind)) {
            String parity = StringUtils.trimToEmpty(biweekParityRaw).toUpperCase(Locale.ROOT);
            if (!"BIG".equals(parity) && !"SMALL".equals(parity)) {
                throw new BusinessException("大小周请指定 biweekParity=BIG 或 SMALL");
            }
            row.setBiweekParity(parity);
            LocalDate anchor = parseDate(anchorMondayRaw);
            if (anchor == null) {
                anchor = LocalDate.now(WorkspaceAiReminderSchedule.BEIJING)
                        .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            } else {
                anchor = anchor.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            }
            row.setAnchorMonday(anchor);
        }
        OffsetDateTime next = WorkspaceAiReminderSchedule.firstFire(row);
        if (next == null) {
            throw new BusinessException("算出的下一次提醒已过期，请换一个未来的北京时间");
        }
        row.setNextFireAt(next);
        mapper.insert(row);
        return toVo(row);
    }

    @Transactional(rollbackFor = Exception.class)
    public void cancel(String reminderId) {
        if (StringUtils.isBlank(reminderId)) {
            throw new BusinessException("缺少提醒 id");
        }
        int n = mapper.disable(reminderId, UserContext.getUserId());
        if (n == 0) {
            throw new BusinessException("提醒不存在或无权取消");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void dismissInbox(String inboxId) {
        if (StringUtils.isBlank(inboxId)) {
            throw new BusinessException("缺少通知 id");
        }
        mapper.dismissInbox(inboxId, UserContext.getUserId());
    }

    public void fireDue() {
        OffsetDateTime now = OffsetDateTime.now(WorkspaceAiReminderSchedule.BEIJING);
        List<WorkspaceAiReminder> due = mapper.selectDue(now);
        for (WorkspaceAiReminder row : due) {
            OffsetDateTime next = WorkspaceAiReminderSchedule.nextAfterFire(row, now);
            boolean keep = next != null && !"ONCE".equalsIgnoreCase(row.getKind());
            int claimed = mapper.claimFire(row.getId(), now, next, keep);
            if (claimed == 0) {
                continue;
            }
            WorkspaceAiReminderInbox inbox = new WorkspaceAiReminderInbox();
            inbox.setId(IdUtil.fastSimpleUUID());
            inbox.setReminderId(row.getId());
            inbox.setWorkspaceId(row.getWorkspaceId());
            inbox.setUserId(row.getUserId());
            inbox.setMessage(row.getMessage());
            inbox.setFiredAt(now);
            mapper.insertInbox(inbox);
            realtimeUserPushPublisher.publish(
                    row.getUserId(),
                    RealtimeUserPushPublisher.TYPE_WORKSPACE_AI_REMINDER,
                    Map.of("workspaceId", row.getWorkspaceId(), "inboxId", inbox.getId()));
        }
    }

    private WorkspaceAiReminderVO toVo(WorkspaceAiReminder row) {
        WorkspaceAiReminderVO vo = new WorkspaceAiReminderVO();
        vo.setId(row.getId());
        vo.setMessage(row.getMessage());
        vo.setKind(row.getKind());
        vo.setEnabled(Boolean.TRUE.equals(row.getEnabled()));
        vo.setNextFireAt(row.getNextFireAt() == null ? null : ISO.format(row.getNextFireAt()));
        vo.setWeekdays(row.getWeekdays());
        vo.setBiweekParity(row.getBiweekParity());
        vo.setOnceDate(row.getOnceDate() == null ? null : row.getOnceDate().toString());
        vo.setHour(row.getHour());
        vo.setMinute(row.getMinute());
        return vo;
    }

    private WorkspaceAiReminderInboxVO toInboxVo(WorkspaceAiReminderInbox row) {
        WorkspaceAiReminderInboxVO vo = new WorkspaceAiReminderInboxVO();
        vo.setId(row.getId());
        vo.setReminderId(row.getReminderId());
        vo.setWorkspaceId(row.getWorkspaceId());
        vo.setWorkspaceName(row.getWorkspaceName());
        vo.setMessage(row.getMessage());
        vo.setFiredAt(row.getFiredAt() == null ? null : ISO.format(row.getFiredAt()));
        return vo;
    }

    private static String normalizeKind(String raw) {
        String kind = StringUtils.trimToEmpty(raw).toUpperCase(Locale.ROOT);
        if (kind.isEmpty() || "ONCE".equals(kind) || "DATE".equals(kind) || "ABSOLUTE".equals(kind)) {
            return "ONCE";
        }
        if ("WEEKLY".equals(kind) || "WEEK".equals(kind)) {
            return "WEEKLY";
        }
        if ("BIWEEK".equals(kind) || "ALTWEEK".equals(kind) || "大小周".equals(raw.trim())) {
            return "BIWEEK";
        }
        throw new BusinessException("kind 只能是 ONCE、WEEKLY 或 BIWEEK（大小周）");
    }

    private static int parseInt(String raw, int fallback) {
        if (StringUtils.isBlank(raw)) {
            return fallback;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static LocalDate parseDate(String raw) {
        if (StringUtils.isBlank(raw)) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (Exception e) {
            return null;
        }
    }
}