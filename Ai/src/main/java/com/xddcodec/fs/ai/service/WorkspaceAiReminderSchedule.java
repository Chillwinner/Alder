/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.service;

import com.xddcodec.fs.ai.domain.WorkspaceAiReminder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

final class WorkspaceAiReminderSchedule {

    static final ZoneId BEIJING = ZoneId.of("Asia/Shanghai");

    private WorkspaceAiReminderSchedule() {
    }

    static OffsetDateTime firstFire(WorkspaceAiReminder row) {
        return nextOnOrAfter(row, OffsetDateTime.now(BEIJING));
    }

    static OffsetDateTime nextAfterFire(WorkspaceAiReminder row, OffsetDateTime firedAt) {
        if ("ONCE".equalsIgnoreCase(row.getKind())) {
            return null;
        }
        return nextOnOrAfter(row, firedAt.plusMinutes(1));
    }

    static OffsetDateTime nextOnOrAfter(WorkspaceAiReminder row, OffsetDateTime from) {
        OffsetDateTime cursor = from.atZoneSameInstant(BEIJING).toOffsetDateTime();
        String kind = row.getKind() == null ? "" : row.getKind().trim().toUpperCase(Locale.ROOT);
        int hour = clamp(row.getHour(), 0, 23);
        int minute = clamp(row.getMinute(), 0, 59);
        if ("ONCE".equals(kind)) {
            if (row.getOnceDate() == null) {
                return null;
            }
            OffsetDateTime at = row.getOnceDate().atTime(LocalTime.of(hour, minute)).atZone(BEIJING).toOffsetDateTime();
            return at.isBefore(cursor) ? null : at;
        }
        Set<Integer> days = parseWeekdays(row.getWeekdays());
        if (days.isEmpty()) {
            return null;
        }
        LocalDate start = cursor.toLocalDate();
        for (int i = 0; i < 420; i++) {
            LocalDate date = start.plusDays(i);
            if (!days.contains(date.getDayOfWeek().getValue())) {
                continue;
            }
            if ("BIWEEK".equals(kind) && !matchesBiweek(date, row)) {
                continue;
            }
            OffsetDateTime candidate = date.atTime(LocalTime.of(hour, minute)).atZone(BEIJING).toOffsetDateTime();
            if (!candidate.isBefore(cursor)) {
                return candidate;
            }
        }
        return null;
    }

    static Set<Integer> parseWeekdays(String raw) {
        Set<Integer> out = new LinkedHashSet<>();
        if (raw == null || raw.isBlank()) {
            return out;
        }
        for (String part : raw.split("[,，\\s]+")) {
            try {
                int day = Integer.parseInt(part.trim());
                if (day >= 1 && day <= 7) {
                    out.add(day);
                }
            } catch (NumberFormatException ignored) {
                // skip
            }
        }
        return out;
    }

    static boolean matchesBiweek(LocalDate date, WorkspaceAiReminder row) {
        LocalDate anchor = row.getAnchorMonday();
        if (anchor == null) {
            return false;
        }
        LocalDate monday = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        long weeks = ChronoUnit.WEEKS.between(anchor, monday);
        boolean weekIsBig = weeks % 2 == 0;
        String parity = row.getBiweekParity() == null ? "BIG" : row.getBiweekParity().trim().toUpperCase(Locale.ROOT);
        return "SMALL".equals(parity) != weekIsBig;
    }

    static List<Integer> weekdayList(String raw) {
        return new ArrayList<>(parseWeekdays(raw));
    }

    private static int clamp(Integer value, int min, int max) {
        if (value == null) {
            return min;
        }
        return Math.max(min, Math.min(max, value));
    }
}