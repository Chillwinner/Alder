/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.service;

import cn.hutool.core.util.IdUtil;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.System.domain.SysRole;
import com.xddcodec.fs.System.domain.SysUser;
import com.xddcodec.fs.System.domain.SysWorkspaceMember;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.progress.domain.ProgressSubmission;
import com.xddcodec.fs.progress.domain.ProgressTask;
import com.xddcodec.fs.file.service.WorkspaceFileshareService;
import com.xddcodec.fs.progress.domain.dto.CreateProgressTaskCmd;
import com.xddcodec.fs.progress.domain.dto.ReviewProgressCmd;
import com.xddcodec.fs.progress.domain.dto.UpdateProgressStatusCmd;
import com.xddcodec.fs.progress.domain.dto.UpdateProgressTaskCmd;
import com.xddcodec.fs.system.mapper.SysWorkspaceMapper;
import com.xddcodec.fs.System.domain.SysWorkspace;
import com.xddcodec.fs.progress.domain.ProgressDayHit;
import com.xddcodec.fs.progress.domain.vo.ProgressAssigneeVO;
import com.xddcodec.fs.progress.domain.vo.ProgressMonthVO;
import com.xddcodec.fs.progress.domain.vo.ProgressTaskVO;
import com.xddcodec.fs.progress.mapper.ProgressSubmissionMapper;
import com.xddcodec.fs.progress.mapper.ProgressTaskMapper;
import com.xddcodec.fs.progress.support.ProgressConstants;
import com.xddcodec.fs.system.constant.WorkspaceRoleConstants;
import com.xddcodec.fs.system.mapper.SysRoleMapper;
import com.xddcodec.fs.system.mapper.SysWorkspaceMemberMapper;
import com.xddcodec.fs.system.service.SysUserService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ProgressService {

    private final ProgressTaskMapper taskMapper;
    private final ProgressSubmissionMapper submissionMapper;
    private final SysWorkspaceMemberMapper memberMapper;
    private final SysRoleMapper roleMapper;
    private final SysUserService userService;
    private final FileInfoService fileInfoService;
    private final WorkspaceFileshareService fileshareService;
    private final SysWorkspaceMapper workspaceMapper;

    public List<ProgressTaskVO> list(String scope, String kind, String status, String keyword, String date) {
        String workspaceId = workspaceId();
        assertMember();
        String mine = "mine".equalsIgnoreCase(scope) ? UserContext.getUserId() : null;
        LocalDate onDate = parseDate(date);
        boolean includeOpen = onDate != null && onDate.equals(LocalDate.now());
        List<ProgressTask> rows = taskMapper.list(
                workspaceId, mine, blankToNull(kind), blankToNull(status), blankToNull(keyword), onDate, includeOpen);
        Set<String> todayDaily = new HashSet<>(taskMapper.listTodayDailyTaskIds(workspaceId, LocalDate.now()));
        boolean admin = isAdmin();
        String userId = UserContext.getUserId();
        List<ProgressTaskVO> out = new ArrayList<>();
        for (ProgressTask row : rows) {
            out.add(toVo(row, todayDaily.contains(row.getId()), admin, userId));
        }
        fillWeek(out);
        return out;
    }

    public ProgressMonthVO month(Integer year, Integer month) {
        assertMember();
        YearMonth ym = year != null && month != null ? YearMonth.of(year, month) : YearMonth.now();
        LocalDate from = ym.atDay(1);
        LocalDate to = ym.atEndOfMonth();
        ProgressMonthVO vo = new ProgressMonthVO();
        vo.setYear(ym.getYear());
        vo.setMonth(ym.getMonthValue());
        Map<String, ProgressAssigneeVO> people = new HashMap<>();
        Map<String, ProgressMonthVO.Cell> cells = new HashMap<>();
        for (ProgressDayHit hit : submissionMapper.listHits(workspaceId(), from, to)) {
            if (hit.getUserId() == null || hit.getDay() == null) {
                continue;
            }
            people.computeIfAbsent(hit.getUserId(), this::person);
            String key = hit.getUserId() + "#" + hit.getDay().getDayOfMonth();
            ProgressMonthVO.Cell cell = cells.computeIfAbsent(key, ignored -> {
                ProgressMonthVO.Cell next = new ProgressMonthVO.Cell();
                next.setUserId(hit.getUserId());
                next.setDay(hit.getDay().getDayOfMonth());
                return next;
            });
            cell.setCount(cell.getCount() + 1);
            if (!cell.getTitles().contains(hit.getTitle())) {
                cell.getTitles().add(hit.getTitle());
            }
            if (ProgressConstants.REVIEW_PENDING.equals(hit.getReviewStatus())) {
                cell.setPending(true);
            } else {
                cell.setApproved(true);
            }
        }
        vo.setPeople(new ArrayList<>(people.values()));
        vo.setCells(new ArrayList<>(cells.values()));
        return vo;
    }

    public ProgressTaskVO get(String id) {
        assertMember();
        ProgressTask row = requireTask(id);
        Set<String> todayDaily = new HashSet<>(taskMapper.listTodayDailyTaskIds(row.getWorkspaceId(), LocalDate.now()));
        ProgressTaskVO vo = toVo(row, todayDaily.contains(row.getId()), isAdmin(), UserContext.getUserId());
        fillWeek(List.of(vo));
        return vo;
    }

    @Transactional(rollbackFor = Exception.class)
    public ProgressTaskVO create(CreateProgressTaskCmd cmd) {
        assertCanWrite();
        if (cmd == null || StringUtils.isBlank(cmd.getTitle())) {
            throw new BusinessException(ErrorMessages.PROGRESS_TITLE_REQUIRED);
        }
        String kind = StringUtils.defaultIfBlank(cmd.getKind(), ProgressConstants.KIND_NORMAL).trim().toUpperCase(Locale.ROOT);
        if (!ProgressConstants.KIND_DAILY.equals(kind) && !ProgressConstants.KIND_NORMAL.equals(kind)) {
            throw new BusinessException(ErrorMessages.PROGRESS_KIND_INVALID);
        }
        List<String> assignees = resolveAssignees(cmd.getAssigneeIds());
        ProgressTask row = new ProgressTask();
        row.setId(IdUtil.fastSimpleUUID());
        row.setWorkspaceId(workspaceId());
        row.setTitle(cmd.getTitle().trim());
        row.setDescription(StringUtils.trimToNull(cmd.getDescription()));
        row.setKind(kind);
        row.setStatus(ProgressConstants.STATUS_TODO);
        row.setProgress(0);
        if (ProgressConstants.KIND_NORMAL.equals(kind)) {
            row.setDueAt(parseDueAt(cmd.getDueAt()));
        }
        row.setNote(null);
        row.setCreatedBy(UserContext.getUserId());
        taskMapper.insert(row);
        for (String userId : assignees) {
            taskMapper.insertAssignee(row.getId(), userId);
        }
        return get(row.getId());
    }

    @Transactional(rollbackFor = Exception.class)
    public ProgressTaskVO updateStatus(String id, UpdateProgressStatusCmd cmd) {
        ProgressTask row = requireTask(id);
        assertAssigneeOrAdmin(row);
        String status = cmd == null ? "" : StringUtils.defaultString(cmd.getStatus()).trim().toUpperCase(Locale.ROOT);
        if (!Set.of(
                ProgressConstants.STATUS_TODO,
                ProgressConstants.STATUS_IN_PROGRESS,
                ProgressConstants.STATUS_BLOCKED
        ).contains(status)) {
            throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
        }
        if (ProgressConstants.STATUS_REVIEW.equals(row.getStatus()) || ProgressConstants.STATUS_DONE.equals(row.getStatus())) {
            throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
        }
        row.setStatus(status);
        taskMapper.updateTask(row);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProgressTaskVO update(String id, UpdateProgressTaskCmd cmd) {
        ProgressTask row = requireTask(id);
        assertCanEdit(row);
        applyUpdate(row, cmd);
        taskMapper.updateTask(row);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(String id) {
        ProgressTask row = requireTask(id);
        if (!isAdmin() && !UserContext.getUserId().equals(row.getCreatedBy())) {
            throw new BusinessException(ErrorMessages.PROGRESS_FORBIDDEN);
        }
        taskMapper.deleteSubmissionFiles(id);
        taskMapper.deleteSubmissions(id);
        taskMapper.deleteAssignees(id);
        taskMapper.deleteById(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProgressTaskVO submit(
            String id,
            Integer progress,
            String note,
            String description,
            String dueAt,
            String status,
            boolean forReview,
            MultipartFile[] files) {
        ProgressTask row = requireTask(id);
        assertAssignee(row);
        if (ProgressConstants.STATUS_DONE.equals(row.getStatus()) || ProgressConstants.STATUS_REVIEW.equals(row.getStatus())) {
            throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
        }
        if (StringUtils.isNotBlank(description)) {
            row.setDescription(description.trim());
        }
        if (StringUtils.isNotBlank(dueAt) && ProgressConstants.KIND_NORMAL.equals(row.getKind())) {
            row.setDueAt(parseDueAt(dueAt));
        }
        if (StringUtils.isNotBlank(status)
                && Set.of(
                ProgressConstants.STATUS_TODO,
                ProgressConstants.STATUS_IN_PROGRESS,
                ProgressConstants.STATUS_BLOCKED
        ).contains(status.trim().toUpperCase(Locale.ROOT))) {
            row.setStatus(status.trim().toUpperCase(Locale.ROOT));
        }
        if (StringUtils.isNotBlank(note)) {
            row.setNote(note.trim());
        }
        int fileCount = countFiles(files);
        if (forReview && fileCount == 0) {
            throw new BusinessException(ErrorMessages.PROGRESS_IMAGES_REQUIRED);
        }
        if (fileCount > 3) {
            throw new BusinessException(ErrorMessages.PROGRESS_IMAGES_LIMIT);
        }
        if (fileCount > 0) {
            ProgressSubmission sub = new ProgressSubmission();
            sub.setId(IdUtil.fastSimpleUUID());
            sub.setTaskId(row.getId());
            sub.setUserId(UserContext.getUserId());
            sub.setProgressBefore(row.getProgress() == null ? 0 : row.getProgress());
            sub.setNote(StringUtils.trimToNull(note));
            if (ProgressConstants.KIND_DAILY.equals(row.getKind())) {
                LocalDate today = LocalDate.now();
                if (submissionMapper.selectDaily(row.getId(), today) != null) {
                    throw new BusinessException(ErrorMessages.PROGRESS_DAILY_ALREADY);
                }
                sub.setDay(today);
                sub.setProgressAfter(100);
                sub.setReviewStatus(ProgressConstants.REVIEW_NONE);
                row.setStatus(ProgressConstants.STATUS_IN_PROGRESS);
            } else {
                int next = progress == null ? (row.getProgress() == null ? 0 : row.getProgress()) : progress;
                if (next < 0 || next > 100) {
                    throw new BusinessException(ErrorMessages.PROGRESS_PROGRESS_INVALID);
                }
                sub.setProgressAfter(next);
                row.setProgress(next);
                if (forReview || next >= 100) {
                    row.setStatus(ProgressConstants.STATUS_REVIEW);
                    sub.setReviewStatus(ProgressConstants.REVIEW_PENDING);
                } else {
                    row.setStatus(ProgressConstants.STATUS_IN_PROGRESS);
                    sub.setReviewStatus(ProgressConstants.REVIEW_NONE);
                }
            }
            submissionMapper.insert(sub);
            saveImages(sub.getId(), files);
        } else if (ProgressConstants.KIND_NORMAL.equals(row.getKind()) && progress != null) {
            if (progress < 0 || progress > 100) {
                throw new BusinessException(ErrorMessages.PROGRESS_PROGRESS_INVALID);
            }
            row.setProgress(progress);
            if (forReview || progress >= 100) {
                throw new BusinessException(ErrorMessages.PROGRESS_IMAGES_REQUIRED);
            }
        }
        taskMapper.updateTask(row);
        return get(id);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProgressTaskVO review(String id, ReviewProgressCmd cmd) {
        if (!isAdmin()) {
            throw new BusinessException(ErrorMessages.PROGRESS_FORBIDDEN);
        }
        ProgressTask row = requireTask(id);
        if (!ProgressConstants.STATUS_REVIEW.equals(row.getStatus())) {
            throw new BusinessException(ErrorMessages.PROGRESS_NOT_REVIEW);
        }
        String action = cmd == null ? "" : StringUtils.defaultString(cmd.getAction()).trim().toLowerCase(Locale.ROOT);
        ProgressSubmission pending = submissionMapper.selectLatestPending(row.getId());
        if (pending == null) {
            throw new BusinessException(ErrorMessages.PROGRESS_NOT_REVIEW);
        }
        if ("approve".equals(action)) {
            row.setProgress(100);
            row.setStatus(ProgressConstants.STATUS_DONE);
            submissionMapper.updateReview(pending.getId(), ProgressConstants.REVIEW_APPROVED);
        } else if ("reject".equals(action)) {
            row.setProgress(pending.getProgressBefore() == null ? 0 : pending.getProgressBefore());
            row.setStatus(row.getProgress() > 0
                    ? ProgressConstants.STATUS_IN_PROGRESS
                    : ProgressConstants.STATUS_TODO);
            submissionMapper.updateReview(pending.getId(), ProgressConstants.REVIEW_REJECTED);
        } else {
            throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
        }
        taskMapper.updateTask(row);
        return get(id);
    }

    private void applyUpdate(ProgressTask row, UpdateProgressTaskCmd cmd) {
        if (cmd == null) {
            return;
        }
        if (StringUtils.isNotBlank(cmd.getTitle())) {
            row.setTitle(cmd.getTitle().trim());
        }
        if (cmd.getDescription() != null) {
            row.setDescription(StringUtils.trimToNull(cmd.getDescription()));
        }
        if (StringUtils.isNotBlank(cmd.getKind())) {
            String kind = cmd.getKind().trim().toUpperCase(Locale.ROOT);
            if (!ProgressConstants.KIND_DAILY.equals(kind) && !ProgressConstants.KIND_NORMAL.equals(kind)) {
                throw new BusinessException(ErrorMessages.PROGRESS_KIND_INVALID);
            }
            row.setKind(kind);
        }
        if (StringUtils.isNotBlank(cmd.getStatus())) {
            String status = cmd.getStatus().trim().toUpperCase(Locale.ROOT);
            if (!Set.of(
                    ProgressConstants.STATUS_TODO,
                    ProgressConstants.STATUS_IN_PROGRESS,
                    ProgressConstants.STATUS_BLOCKED
            ).contains(status)) {
                throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
            }
            if (ProgressConstants.STATUS_REVIEW.equals(row.getStatus())
                    || ProgressConstants.STATUS_DONE.equals(row.getStatus())) {
                throw new BusinessException(ErrorMessages.PROGRESS_STATUS_INVALID);
            }
            row.setStatus(status);
        }
        if (cmd.getProgress() != null) {
            if (cmd.getProgress() < 0 || cmd.getProgress() > 100) {
                throw new BusinessException(ErrorMessages.PROGRESS_PROGRESS_INVALID);
            }
            row.setProgress(cmd.getProgress());
        }
        if (cmd.getDueAt() != null) {
            row.setDueAt(parseDueAt(cmd.getDueAt()));
        }
        if (cmd.getNote() != null) {
            row.setNote(StringUtils.trimToNull(cmd.getNote()));
        }
    }

    private void saveImages(String submissionId, MultipartFile[] files) {
        String ownerId = UserContext.getUserId();
        SysWorkspace workspace = workspaceMapper.selectById(workspaceId());
        if (workspace != null && StringUtils.isNotBlank(workspace.getOwnerId())) {
            ownerId = workspace.getOwnerId();
        }
        String folderId = fileshareService.ensureScaleFolder(workspaceId(), ownerId);
        int saved = 0;
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String name = StringUtils.defaultIfBlank(file.getOriginalFilename(), "image.jpg");
            try {
                FileInfo info = fileInfoService.importStream(
                        file.getInputStream(),
                        name,
                        StringUtils.defaultIfBlank(file.getContentType(), "image/jpeg"),
                        file.getSize(),
                        folderId);
                if (info != null) {
                    submissionMapper.insertFile(submissionId, info.getId());
                    saved++;
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException(ErrorMessages.PROGRESS_IMAGES_REQUIRED);
            }
        }
        if (saved == 0) {
            throw new BusinessException(ErrorMessages.PROGRESS_IMAGES_REQUIRED);
        }
    }

    private static int countFiles(MultipartFile[] files) {
        if (files == null) {
            return 0;
        }
        int count = 0;
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                count++;
            }
        }
        return count;
    }

    private List<String> resolveAssignees(List<String> raw) {
        String me = UserContext.getUserId();
        List<String> ids = new ArrayList<>();
        if (raw != null) {
            for (String id : raw) {
                if (StringUtils.isNotBlank(id)) {
                    ids.add(id.trim());
                }
            }
        }
        if (ids.isEmpty()) {
            ids = List.of(me);
        }
        if (!isAdmin() && (ids.size() != 1 || !me.equals(ids.getFirst()))) {
            throw new BusinessException(ErrorMessages.PROGRESS_FORBIDDEN);
        }
        for (String id : ids) {
            SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId(), id);
            if (member == null) {
                throw new BusinessException(ErrorMessages.WORKSPACE_NOT_MEMBER);
            }
        }
        return ids;
    }

    private ProgressTaskVO toVo(ProgressTask row, boolean todayDone, boolean admin, String userId) {
        ProgressTaskVO vo = new ProgressTaskVO();
        vo.setId(row.getId());
        vo.setWorkspaceId(row.getWorkspaceId());
        vo.setTitle(row.getTitle());
        vo.setDescription(row.getDescription());
        vo.setKind(row.getKind());
        vo.setStatus(row.getStatus());
        vo.setProgress(row.getProgress());
        vo.setDueAt(row.getDueAt());
        vo.setNote(row.getNote());
        vo.setCreatedBy(row.getCreatedBy());
        SysUser creator = userService.getById(row.getCreatedBy());
        vo.setCreatedByName(creator == null
                ? row.getCreatedBy()
                : StringUtils.defaultIfBlank(creator.getNickname(), creator.getUsername()));
        vo.setCreatedAt(row.getCreatedAt());
        vo.setUpdatedAt(row.getUpdatedAt());
        List<ProgressAssigneeVO> assignees = new ArrayList<>();
        boolean assignee = false;
        for (String id : taskMapper.listAssigneeIds(row.getId())) {
            if (id.equals(userId)) {
                assignee = true;
            }
            ProgressAssigneeVO item = new ProgressAssigneeVO();
            item.setUserId(id);
            SysUser user = userService.getById(id);
            item.setName(user == null ? id : StringUtils.defaultIfBlank(user.getNickname(), user.getUsername()));
            assignees.add(item);
        }
        vo.setAssignees(assignees);
        vo.setTodayDone(todayDone);
        boolean open = !ProgressConstants.STATUS_DONE.equals(row.getStatus())
                && !ProgressConstants.STATUS_REVIEW.equals(row.getStatus());
        vo.setCanSubmit(assignee && open && !(ProgressConstants.KIND_DAILY.equals(row.getKind()) && todayDone));
        vo.setCanReview(admin && ProgressConstants.STATUS_REVIEW.equals(row.getStatus()));
        vo.setCanEdit(open && (assignee || admin));
        vo.setCanDelete(admin || userId.equals(row.getCreatedBy()));
        return vo;
    }

    private void assertCanEdit(ProgressTask row) {
        if (isAdmin()) {
            return;
        }
        assertAssignee(row);
    }

    private ProgressTask requireTask(String id) {
        ProgressTask row = taskMapper.selectById(id);
        if (row == null || !workspaceId().equals(row.getWorkspaceId())) {
            throw new BusinessException(ErrorMessages.PROGRESS_NOT_FOUND);
        }
        return row;
    }

    private void assertAssignee(ProgressTask row) {
        if (!taskMapper.listAssigneeIds(row.getId()).contains(UserContext.getUserId())) {
            throw new BusinessException(ErrorMessages.PROGRESS_NOT_ASSIGNEE);
        }
    }

    private void assertAssigneeOrAdmin(ProgressTask row) {
        if (isAdmin()) {
            return;
        }
        assertAssignee(row);
    }

    private void assertCanWrite() {
        SysRole role = currentRole();
        if (role != null && WorkspaceRoleConstants.CODE_VIEWER.equalsIgnoreCase(role.getRoleCode())) {
            throw new BusinessException(ErrorMessages.PROGRESS_VIEWER);
        }
        assertMember();
    }

    private void assertMember() {
        if (memberMapper.findByWorkspaceAndUser(workspaceId(), UserContext.getUserId()) == null) {
            throw new BusinessException(ErrorMessages.WORKSPACE_NOT_MEMBER);
        }
    }

    private boolean isAdmin() {
        SysRole role = currentRole();
        return role != null && WorkspaceRoleConstants.CODE_ADMIN.equalsIgnoreCase(role.getRoleCode());
    }

    private SysRole currentRole() {
        SysWorkspaceMember member = memberMapper.findByWorkspaceAndUser(workspaceId(), UserContext.getUserId());
        if (member == null || member.getRoleId() == null) {
            return null;
        }
        return roleMapper.selectById(member.getRoleId());
    }

    private String workspaceId() {
        String id = WorkspaceContext.getWorkspaceId();
        if (StringUtils.isBlank(id)) {
            throw new BusinessException(ErrorMessages.WORKSPACE_ID_REQUIRED);
        }
        return id;
    }

    private ProgressAssigneeVO person(String userId) {
        ProgressAssigneeVO item = new ProgressAssigneeVO();
        item.setUserId(userId);
        SysUser user = userService.getById(userId);
        item.setName(user == null ? userId : StringUtils.defaultIfBlank(user.getNickname(), user.getUsername()));
        return item;
    }

    private void fillWeek(List<ProgressTaskVO> tasks) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(6);
        Map<String, Set<LocalDate>> days = new HashMap<>();
        for (ProgressDayHit hit : submissionMapper.listHits(workspaceId(), from, today)) {
            if (hit.getTaskId() == null || hit.getDay() == null) {
                continue;
            }
            days.computeIfAbsent(hit.getTaskId(), ignored -> new HashSet<>()).add(hit.getDay());
        }
        for (ProgressTaskVO vo : tasks) {
            if (!ProgressConstants.KIND_DAILY.equals(vo.getKind())) {
                continue;
            }
            List<Boolean> week = new ArrayList<>();
            Set<LocalDate> done = days.getOrDefault(vo.getId(), Set.of());
            for (int i = 6; i >= 0; i--) {
                week.add(done.contains(today.minusDays(i)));
            }
            vo.setWeek(week);
        }
    }

    private static LocalDateTime parseDueAt(String raw) {
        if (StringUtils.isBlank(raw)) {
            return null;
        }
        String value = raw.trim();
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ignored) {
        }
        try {
            return java.time.OffsetDateTime.parse(value).toLocalDateTime();
        } catch (Exception ignored) {
        }
        try {
            return java.time.Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }
        if (value.length() == 16) {
            try {
                return LocalDateTime.parse(value + ":00");
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    private static LocalDate parseDate(String value) {
        if (StringUtils.isBlank(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static String blankToNull(String value) {
        return StringUtils.isBlank(value) ? null : value.trim();
    }
}
