/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.xddcodec.fs.Context.UserContext;
import com.xddcodec.fs.Context.WorkspaceContext;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.File.domain.dto.CopyFileCmd;
import com.xddcodec.fs.File.domain.dto.CreateDirectoryCmd;
import com.xddcodec.fs.File.domain.dto.CreateFileCollectionCmd;
import com.xddcodec.fs.File.domain.dto.CreateShareCmd;
import com.xddcodec.fs.File.domain.dto.MoveFileCmd;
import com.xddcodec.fs.File.domain.dto.RenameFileCmd;
import com.xddcodec.fs.File.domain.qry.FileCollectionQry;
import com.xddcodec.fs.File.domain.qry.FileQry;
import com.xddcodec.fs.File.domain.qry.FileRecycleQry;
import com.xddcodec.fs.File.domain.qry.FileShareQry;
import com.xddcodec.fs.File.domain.qry.TransferFilesQry;
import com.xddcodec.fs.File.domain.vo.FileCollectionVO;
import com.xddcodec.fs.File.domain.vo.FileRecycleVO;
import com.xddcodec.fs.File.domain.vo.FileShareVO;
import com.xddcodec.fs.File.domain.vo.FileTransferTaskVO;
import com.xddcodec.fs.File.domain.vo.FileVO;
import com.xddcodec.fs.Framework.common.domain.PageResult;
import com.xddcodec.fs.System.domain.vo.WorkspaceMemberVO;
import com.xddcodec.fs.file.service.FileCollectionService;
import com.xddcodec.fs.file.service.FileInfoService;
import com.xddcodec.fs.file.service.FileRecycleService;
import com.xddcodec.fs.file.service.FileShareService;
import com.xddcodec.fs.file.service.FileTransferTaskService;
import com.xddcodec.fs.storage.StoragePlatforms;
import com.xddcodec.fs.storage.service.StorageSettingService;
import com.xddcodec.fs.Storage.domain.cmd.StorageSettingAddCmd;
import com.xddcodec.fs.Storage.domain.vo.StorageSettingUserVO;
import com.xddcodec.fs.file.service.StorageMountService;
import com.xddcodec.fs.meeting.domain.dto.CreateWorkspaceMeetingCmd;
import com.xddcodec.fs.meeting.domain.vo.WorkspaceMeetingVO;
import com.xddcodec.fs.meeting.service.WorkspaceMeetingService;
import com.xddcodec.fs.system.service.SysWorkspaceMemberService;
import com.xddcodec.fs.workspaceboard.domain.dto.CastWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.UpdateWorkspaceMemoCmd;
import com.xddcodec.fs.workspaceboard.domain.dto.CreateWorkspaceVoteCmd;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceBoardOverviewVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceMemoVO;
import com.xddcodec.fs.workspaceboard.domain.vo.WorkspaceVoteVO;
import com.xddcodec.fs.ai.service.WorkspaceAiReminderService;
import com.xddcodec.fs.ai.service.WorkspaceRagService;
import com.xddcodec.fs.workspaceboard.service.WorkspaceMemoService;
import com.xddcodec.fs.workspaceboard.service.WorkspaceVoteService;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolMemoryId;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class WorkspaceAiTools {

    private static final int TEXT_LIMIT = 48 * 1024;
    private static final Set<String> TEXT_SUFFIX = Set.of(
            "txt", "md", "csv", "json", "log", "xml", "yml", "yaml", "properties", "ini");

    private final FileInfoService fileInfoService;
    private final FileShareService fileShareService;
    private final FileCollectionService fileCollectionService;
    private final FileRecycleService fileRecycleService;
    private final FileTransferTaskService fileTransferTaskService;
    private final WorkspaceMemoService workspaceMemoService;
    private final WorkspaceVoteService workspaceVoteService;
    private final WorkspaceMeetingService workspaceMeetingService;
    private final SysWorkspaceMemberService workspaceMemberService;
    private final StorageSettingService storageSettingService;
    private final WorkspaceAiReminderService workspaceAiReminderService;
    private final WorkspaceRagService workspaceRagService;
    private final ObjectMapper objectMapper;

    @Tool("检索当前空间知识库。只搜设置里已入库的切片，与网盘目录是否还在无关。引用文件时用 «fs:文件id»。")
    public String searchWorkspaceKnowledge(
            @P("用户问题或关键词") String query,
            @P("返回条数，默认 8，最大 20") Integer topK,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> workspaceRagService.search(query, topK));
    }

    @Tool("列出当前空间已添加的对象存储（不返回密钥）。")
    public String listStorageSettings(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(summarizeStorages(storageSettingService.getStorageSettingsByUser())));
    }

    @Tool("为当前工作空间添加 S3 兼容存储。必须用户已给出 accessKey、secretKey、endpoint、bucket。添加后会启用该配置。不要编造密钥，回复里不要写出完整 secretKey。")
    public String addS3Storage(
            @P("Access Key") String accessKey,
            @P("Secret Key") String secretKey,
            @P("服务端点，如 https://s3.amazonaws.com 或 MinIO 地址") String endpoint,
            @P("存储桶名") String bucket,
            @P("区域，可空，默认 us-east-1") String region,
            @P("自定义域名，可空") String customDomain,
            @P("备注，可空") String remark,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            if (StringUtils.isAnyBlank(accessKey, secretKey, endpoint, bucket)) {
                return "缺少 accessKey、secretKey、endpoint 或 bucket，无法添加。";
            }
            Map<String, String> config = new LinkedHashMap<>();
            config.put("accessKey", accessKey.trim());
            config.put("secretKey", secretKey.trim());
            config.put("endpoint", endpoint.trim());
            config.put("bucket", bucket.trim());
            if (StringUtils.isNotBlank(region)) {
                config.put("region", region.trim());
            }
            if (StringUtils.isNotBlank(customDomain)) {
                config.put("customDomain", customDomain.trim());
            }
            StorageSettingAddCmd cmd = new StorageSettingAddCmd();
            cmd.setPlatformIdentifier(StoragePlatforms.S3);
            cmd.setConfigData(objectMapper.writeValueAsString(config));
            cmd.setRemark(blankToNull(remark));
            storageSettingService.addStorageSetting(cmd);
            StorageSettingUserVO created = findS3Setting(bucket.trim(), endpoint.trim());
            if (created != null) {
                storageSettingService.enableOrDisableStoragePlatform(created.getId(), 1);
                created = findS3Setting(bucket.trim(), endpoint.trim());
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("ok", true);
            out.put("setting", summarizeStorage(created));
            return json(out);
        });
    }

    @Tool("列出当前工作空间的目录。parentId 空时同时返回挂载根和「本地」里的文件。看本地请用 parentId=mnt:local。")
    public String listFiles(
            @P("父目录 id，根目录传空，本地目录用 mnt:local") String parentId,
            @P("文件名关键词，可空") String keyword,
            @P("类型 ALL/DOCUMENT/IMAGE/VIDEO/AUDIO/OTHER，可空") String fileType,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            if (StringUtils.isBlank(parentId)
                    && StringUtils.isBlank(keyword)
                    && (StringUtils.isBlank(fileType) || "ALL".equalsIgnoreCase(fileType))) {
                FileQry mounts = pageQry(new FileQry());
                FileQry local = pageQry(new FileQry());
                local.setParentId(StorageMountService.LOCAL);
                local.setPageSize(80);
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("workspaceId", WorkspaceContext.getWorkspaceId());
                out.put("mounts", summarizeFiles(pageRecords(fileInfoService.getList(mounts))));
                PageResult<FileVO> localPage = fileInfoService.getList(local);
                out.put("local", summarizeFiles(pageRecords(localPage)));
                if (localPage.getData() != null) {
                    out.put("localTotal", localPage.getData().getTotal());
                }
                return json(out);
            }
            FileQry qry = pageQry(new FileQry());
            qry.setParentId(blankToNull(parentId));
            qry.setKeyword(blankToNull(keyword));
            qry.setPageSize(80);
            if (StringUtils.isNotBlank(fileType) && !"ALL".equalsIgnoreCase(fileType)) {
                qry.setFileType(fileType.toUpperCase(Locale.ROOT));
            }
            return jsonFiles(fileInfoService.getList(qry));
        });
    }

    @Tool("搜索当前空间文件名。")
    public String searchFiles(@P("关键词") String keyword, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileQry qry = pageQry(new FileQry());
            qry.setKeyword(StringUtils.trimToEmpty(keyword));
            return jsonFiles(fileInfoService.getList(qry));
        });
    }

    @Tool("列出收藏文件。")
    public String listFavorites(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileQry qry = pageQry(new FileQry());
            qry.setIsFavorite(true);
            return jsonFiles(fileInfoService.getList(qry));
        });
    }

    @Tool("列出最近使用的文件。")
    public String listRecents(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileQry qry = pageQry(new FileQry());
            qry.setIsRecents(true);
            return jsonFiles(fileInfoService.getList(qry));
        });
    }

    @Tool("查看文件或文件夹详情。")
    public String getFileDetail(@P("文件 id") String fileId, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(fileInfoService.getFileDetails(fileId)));
    }

    @Tool("读取纯文本文件前若干字符。仅 txt/md/csv/json 等，不读 Office。")
    public String readTextFile(@P("文件 id") String fileId, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileInfo file = fileInfoService.getAuthorizedFile(fileId);
            if (Boolean.TRUE.equals(file.getIsDir())) {
                return "这是文件夹，不能当文本读。";
            }
            String suffix = StringUtils.defaultString(file.getSuffix()).toLowerCase(Locale.ROOT);
            if (!TEXT_SUFFIX.contains(suffix)) {
                return "后缀 ." + suffix + " 不是纯文本，不能读取正文。Office 也不能在线改。";
            }
            Long size = file.getSize();
            if (size != null && size > TEXT_LIMIT) {
                return "文件超过 " + TEXT_LIMIT + " 字节，只读小文本。";
            }
            try (InputStream in = fileInfoService.downloadFile(fileId)) {
                byte[] buf = in.readNBytes(TEXT_LIMIT + 1);
                if (buf.length > TEXT_LIMIT) {
                    return "内容超出上限。";
                }
                return new String(buf, StandardCharsets.UTF_8);
            }
        });
    }

    @Tool("在指定目录创建文件夹。")
    public String createFolder(
            @P("文件夹名称") String folderName,
            @P("父目录 id，根目录传空") String parentId,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateDirectoryCmd cmd = new CreateDirectoryCmd();
            cmd.setFolderName(folderName);
            cmd.setParentId(blankToNull(parentId));
            FileInfo created = fileInfoService.createDirectory(cmd);
            return json(Map.of("id", created.getId(), "displayName", created.getDisplayName()));
        });
    }

    @Tool("重命名文件或文件夹。用户必须已经明确说出新名字。")
    public String renameFile(
            @P("文件 id") String fileId,
            @P("新显示名") String displayName,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            RenameFileCmd cmd = new RenameFileCmd();
            cmd.setDisplayName(displayName);
            fileInfoService.renameFile(fileId, cmd);
            return "已重命名 " + fileId + " -> " + displayName;
        });
    }

    @Tool("把若干文件移动到目标目录。")
    public String moveFiles(
            @P("逗号分隔的文件 id") String fileIds,
            @P("目标目录 id，根目录传空") String dirId,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            MoveFileCmd cmd = new MoveFileCmd();
            cmd.setFileIds(splitIds(fileIds));
            cmd.setDirId(blankToNull(dirId));
            fileInfoService.moveFile(cmd);
            return "已移动 " + cmd.getFileIds();
        });
    }

    @Tool("复制若干文件到目标目录。")
    public String copyFiles(
            @P("逗号分隔的文件 id") String fileIds,
            @P("目标目录 id，根目录传空") String dirId,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CopyFileCmd cmd = new CopyFileCmd();
            cmd.setFileIds(splitIds(fileIds));
            cmd.setDirId(blankToNull(dirId));
            List<FileInfo> copied = fileInfoService.copyFiles(cmd);
            List<Map<String, String>> rows = new ArrayList<>();
            for (FileInfo info : copied) {
                rows.add(Map.of("id", info.getId(), "displayName", String.valueOf(info.getDisplayName())));
            }
            return json(rows);
        });
    }

    @Tool("把文件放入回收站。仅当用户明确要求删除时调用。")
    public String recycleFiles(@P("逗号分隔的文件 id") String fileIds, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            List<String> ids = splitIds(fileIds);
            fileInfoService.moveFilesToRecycleBin(ids);
            return "已移入回收站: " + ids;
        });
    }

    @Tool("查看回收站。")
    public String listRecycle(@P("关键词，可空") String keyword, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileRecycleQry qry = pageQry(new FileRecycleQry());
            qry.setKeyword(blankToNull(keyword));
            PageResult<FileRecycleVO> page = fileRecycleService.getRecyclePages(qry);
            return json(pageRecords(page));
        });
    }

    @Tool("列出我创建的外链分享。")
    public String listShares(@P("关键词，可空") String keyword, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileShareQry qry = pageQry(new FileShareQry());
            qry.setKeyword(blankToNull(keyword));
            PageResult<FileShareVO> page = fileShareService.getPages(qry);
            return json(pageRecords(page));
        });
    }

    @Tool("为文件创建分享链接。默认永久、可预览下载、无提取码。")
    public String createShare(
            @P("逗号分隔的文件 id") String fileIds,
            @P("分享名称，可空") String shareName,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateShareCmd cmd = new CreateShareCmd();
            cmd.setFileIds(splitIds(fileIds));
            cmd.setShareName(blankToNull(shareName));
            cmd.setExpireType(4);
            cmd.setScope("preview,download");
            cmd.setNeedShareCode(false);
            FileShareVO vo = fileShareService.createShare(cmd);
            return json(vo);
        });
    }

    @Tool("列出文件收集任务。")
    public String listCollections(@P("关键词，可空") String keyword, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            FileCollectionQry qry = pageQry(new FileCollectionQry());
            qry.setKeyword(blankToNull(keyword));
            PageResult<FileCollectionVO> page = fileCollectionService.getPages(qry);
            return json(pageRecords(page));
        });
    }

    @Tool("创建文件收集。expireType：1=7天 2=30天 3=自定义 4=永久。")
    public String createCollection(
            @P("收集名称") String collectionName,
            @P("收集到的目标文件夹 id") String targetFolderId,
            @P("说明，可空") String description,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateFileCollectionCmd cmd = new CreateFileCollectionCmd();
            cmd.setCollectionName(collectionName);
            cmd.setTargetFolderId(targetFolderId);
            cmd.setDescription(blankToNull(description));
            cmd.setExpireType(4);
            cmd.setNeedAccessCode(false);
            return json(fileCollectionService.createCollection(cmd));
        });
    }

    @Tool("查看当前用户传输任务。statusType：1上传 2下载 3已完成，可空表示全部。")
    public String listTransfers(@P("状态类型 1/2/3，可空") String statusType, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            TransferFilesQry qry = new TransferFilesQry();
            if (StringUtils.isNotBlank(statusType)) {
                qry.setStatusType(Integer.parseInt(statusType.trim()));
            }
            List<FileTransferTaskVO> list = fileTransferTaskService.getTransferFiles(qry);
            return json(list);
        });
    }

    @Tool("查看协作页：fileshare 文件和备忘录标题。要读某篇正文必须再调用 readMemo。")
    public String boardOverview(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            WorkspaceBoardOverviewVO vo = workspaceMemoService.overview();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("fileshareFolderId", vo.getFileshareFolderId());
            out.put("fileshareFiles", summarizeFiles(vo.getFileshareFiles()));
            List<Map<String, Object>> memos = new ArrayList<>();
            if (vo.getMemos() != null) {
                for (WorkspaceMemoVO memo : vo.getMemos()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("kind", "memo");
                    row.put("id", memo.getId());
                    row.put("title", memo.getTitle());
                    row.put("visibility", memo.getVisibility());
                    memos.add(row);
                }
            }
            out.put("memos", memos);
            return json(out);
        });
    }

    @Tool("读取一篇备忘录的标题和正文。问备忘录内容时必须调用，不要只看标题。")
    public String readMemo(@P("备忘录 id") String memoId, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            WorkspaceMemoVO meta = null;
            WorkspaceBoardOverviewVO overview = workspaceMemoService.overview();
            if (overview.getMemos() != null) {
                for (WorkspaceMemoVO item : overview.getMemos()) {
                    if (memoId.equals(item.getId())) {
                        meta = item;
                        break;
                    }
                }
            }
            var extracted = workspaceMemoService.readExtract(memoId);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("kind", "memo");
            out.put("id", memoId);
            out.put("title", meta == null ? "" : meta.getTitle());
            out.put("visibility", meta == null ? "" : meta.getVisibility());
            out.put("text", extracted.text);
            out.put("links", extracted.links);
            out.put("files", extracted.files);
            if (extracted.text.isBlank() && extracted.links.isEmpty() && extracted.files.isEmpty()) {
                out.put("note", "这篇备忘录没有抽出可读文字。");
            }
            return json(out);
        });
    }

    @Tool("修改备忘录标题。不能改协同正文，正文请用户在预览里编辑。")
    public String updateMemoTitle(
            @P("备忘录 id") String memoId,
            @P("新标题") String title,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            UpdateWorkspaceMemoCmd cmd = new UpdateWorkspaceMemoCmd();
            cmd.setTitle(title);
            return json(workspaceMemoService.update(memoId, cmd));
        });
    }

    @Tool("新建空白备忘录。visibility：private 仅创建者（默认），shared 空间成员都可见可改。正文由用户在协作页点完成后整篇提交。")
    public String createMemo(
            @P("标题") String title,
            @P("shared 或 private，可空") String visibility,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateWorkspaceMemoCmd cmd = new CreateWorkspaceMemoCmd();
            cmd.setTitle(title);
            cmd.setVisibility(visibility);
            WorkspaceMemoVO vo = workspaceMemoService.create(cmd);
            return json(vo);
        });
    }

    @Tool("列出当前空间投票。")
    public String listVotes(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(workspaceVoteService.listCurrentWorkspace()));
    }

    @Tool("发起投票。必须先 listMembers 拿到 userId，participantUserIds 不能为空。")
    public String createVote(
            @P("标题") String title,
            @P("参与人用户 id，逗号分隔") String participantUserIds,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateWorkspaceVoteCmd cmd = new CreateWorkspaceVoteCmd();
            cmd.setTitle(title);
            if (StringUtils.isNotBlank(participantUserIds)) {
                cmd.setParticipantUserIds(splitIds(participantUserIds));
            }
            WorkspaceVoteVO vo = workspaceVoteService.create(cmd);
            return json(vo);
        });
    }

    @Tool("投票。choice 只能是 AGREE 或 DISAGREE。")
    public String castVote(
            @P("投票 id") String voteId,
            @P("AGREE 或 DISAGREE") String choice,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CastWorkspaceVoteCmd cmd = new CastWorkspaceVoteCmd();
            cmd.setChoice(choice);
            workspaceVoteService.cast(voteId, cmd);
            return "已投票 " + voteId + " " + choice;
        });
    }

    @Tool("列出当前空间会议。")
    public String listMeetings(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(workspaceMeetingService.listCurrentWorkspace()));
    }

    @Tool("创建会议。startsAt 必须是 ISO-8601，例如 2026-09-28T16:00:00+08:00。")
    public String createMeeting(
            @P("标题") String title,
            @P("开始时间 ISO-8601") String startsAt,
            @P("参与人用户 id，逗号分隔，可空") String participantUserIds,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            CreateWorkspaceMeetingCmd cmd = new CreateWorkspaceMeetingCmd();
            cmd.setTitle(title);
            cmd.setStartsAt(startsAt);
            if (StringUtils.isNotBlank(participantUserIds)) {
                cmd.setParticipantUserIds(splitIds(participantUserIds));
            }
            WorkspaceMeetingVO vo = workspaceMeetingService.create(cmd);
            return json(vo);
        });
    }

    @Tool("返回此刻的北京时间（精确到秒），含公历日期、星期（周一=1 周日=7）、小时分钟。设提醒、换算「几分钟后/明天」之前必须先调。")
    public String currentBeijingTime(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            var now = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Shanghai"));
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("timezone", "Asia/Shanghai");
            out.put("iso", now.toOffsetDateTime().toString());
            out.put("date", now.toLocalDate().toString());
            out.put("time", now.toLocalTime().withNano(0).toString());
            out.put("hour", now.getHour());
            out.put("minute", now.getMinute());
            out.put("second", now.getSecond());
            out.put("weekday", now.getDayOfWeek().getValue());
            out.put("weekdayName", switch (now.getDayOfWeek().getValue()) {
                case 1 -> "星期一";
                case 2 -> "星期二";
                case 3 -> "星期三";
                case 4 -> "星期四";
                case 5 -> "星期五";
                case 6 -> "星期六";
                default -> "星期日";
            });
            return json(out);
        });
    }

    @Tool("为当前用户设置提醒。时间按北京时间。kind：ONCE 某日某点；WEEKLY 每周几；BIWEEK 大小周。weekdays 周一=1 周日=7。BIWEEK 的 biweekParity 为 BIG 或 SMALL，anchorMonday 为一个大周的周一（可空）。设之前先 currentBeijingTime。")
    public String createReminder(
            @P("到点后出现在通知铃里的正文") String message,
            @P("ONCE / WEEKLY / BIWEEK") String kind,
            @P("小时 0-23") String hour,
            @P("分钟 0-59") String minute,
            @P("ONCE 用，YYYY-MM-DD，北京日期") String onceDate,
            @P("WEEKLY/BIWEEK 用，如 1,3,5") String weekdays,
            @P("BIWEEK 用，BIG 或 SMALL") String biweekParity,
            @P("BIWEEK 用，某个大周周一 YYYY-MM-DD，可空") String anchorMonday,
            @ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(workspaceAiReminderService.create(
                message, kind, hour, minute, onceDate, weekdays, biweekParity, anchorMonday)));
    }

    @Tool("列出当前用户在本空间的提醒规则。")
    public String listReminders(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> json(workspaceAiReminderService.listMine()));
    }

    @Tool("取消一条提醒规则。仅当用户明确要求取消时调用。")
    public String cancelReminder(@P("提醒 id") String reminderId, @ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            workspaceAiReminderService.cancel(reminderId);
            return "已取消提醒 " + reminderId;
        });
    }

    @Tool("列出当前空间成员，创建投票/会议时用他们的 userId。")
    public String listMembers(@ToolMemoryId String memoryId) {
        return run(memoryId, () -> {
            var page = workspaceMemberService.getMembers(WorkspaceContext.getWorkspaceId(), 1, 100);
            List<WorkspaceMemberVO> records = pageRecords(page);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (WorkspaceMemberVO m : records) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("userId", m.getUserId());
                row.put("username", m.getUsername());
                row.put("nickname", m.getNickname());
                row.put("roleName", m.getRoleName());
                row.put("isOwner", m.getIsOwner());
                rows.add(row);
            }
            return json(rows);
        });
    }

    private StorageSettingUserVO findS3Setting(String bucket, String endpoint) {
        List<StorageSettingUserVO> list = storageSettingService.getStorageSettingsByUser();
        if (list == null) {
            return null;
        }
        for (StorageSettingUserVO item : list) {
            if (item.getStoragePlatform() == null
                    || !StoragePlatforms.S3.equals(item.getStoragePlatform().getIdentifier())) {
                continue;
            }
            Map<String, String> cfg = parseStorageConfig(item.getConfigData());
            if (bucket.equals(cfg.get("bucket")) && endpoint.equals(cfg.get("endpoint"))) {
                return item;
            }
        }
        return list.stream()
                .filter(item -> item.getStoragePlatform() != null
                        && StoragePlatforms.S3.equals(item.getStoragePlatform().getIdentifier()))
                .reduce((a, b) -> b)
                .orElse(null);
    }

    private List<Map<String, Object>> summarizeStorages(List<StorageSettingUserVO> list) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (list == null) {
            return rows;
        }
        for (StorageSettingUserVO item : list) {
            rows.add(summarizeStorage(item));
        }
        return rows;
    }

    private Map<String, Object> summarizeStorage(StorageSettingUserVO item) {
        Map<String, Object> row = new LinkedHashMap<>();
        if (item == null) {
            return row;
        }
        row.put("id", item.getId());
        row.put("platform", item.getStoragePlatform() == null ? "" : item.getStoragePlatform().getIdentifier());
        row.put("enabled", item.getEnabled());
        row.put("remark", item.getRemark());
        Map<String, String> cfg = parseStorageConfig(item.getConfigData());
        row.put("endpoint", cfg.get("endpoint"));
        row.put("bucket", cfg.get("bucket"));
        row.put("region", cfg.get("region"));
        row.put("accessKeyMasked", maskSecret(cfg.get("accessKey")));
        return row;
    }

    private Map<String, String> parseStorageConfig(String raw) {
        if (StringUtils.isBlank(raw)) {
            return Map.of();
        }
        try {
            Map<String, String> out = new LinkedHashMap<>();
            var node = objectMapper.readTree(raw);
            node.fields().forEachRemaining(entry -> {
                if (entry.getValue() != null && entry.getValue().isTextual()) {
                    out.put(entry.getKey(), entry.getValue().asText());
                }
            });
            return out;
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String maskSecret(String value) {
        if (StringUtils.isBlank(value)) {
            return "";
        }
        if (value.length() <= 4) {
            return "****";
        }
        return "****" + value.substring(value.length() - 4);
    }

    private static FileQry pageQry(FileQry qry) {
        qry.setPage(1);
        qry.setPageSize(30);
        return qry;
    }

    private static <T extends com.xddcodec.fs.Framework.common.domain.PageQuery> T pageQry(T qry) {
        qry.setPage(1);
        qry.setPageSize(30);
        return qry;
    }

    private String jsonFiles(PageResult<FileVO> page) {
        return json(summarizeFiles(pageRecords(page)));
    }

    private static List<Map<String, Object>> summarizeFiles(List<FileVO> files) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (files == null) {
            return rows;
        }
        for (FileVO file : files) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", file.getId());
            row.put("displayName", file.getDisplayName());
            row.put("isDir", file.getIsDir());
            row.put("size", file.getSize());
            row.put("suffix", file.getSuffix());
            row.put("parentId", file.getParentId());
            row.put("isFavorite", file.getIsFavorite());
            rows.add(row);
        }
        return rows;
    }

    private static <T> List<T> pageRecords(PageResult<T> page) {
        if (page == null || page.getData() == null || page.getData().getRecords() == null) {
            return List.of();
        }
        return page.getData().getRecords();
    }

    private static List<String> splitIds(String raw) {
        if (StringUtils.isBlank(raw)) {
            return List.of();
        }
        return Arrays.stream(raw.split("[,，\\s]+"))
                .map(String::trim)
                .filter(StringUtils::isNotBlank)
                .distinct()
                .toList();
    }

    private static String blankToNull(String value) {
        return StringUtils.isBlank(value) ? null : value.trim();
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private static String run(String memoryId, ToolCall call) {
        if (!bindMemory(memoryId)) {
            return "失败: 无法确定当前工作空间，请重试。";
        }
        try {
            return call.get();
        } catch (BusinessException e) {
            return "业务错误: " + e.getMessage();
        } catch (Exception e) {
            return "失败: " + e.getMessage();
        } finally {
            WorkspaceContext.clear();
            UserContext.clear();
        }
    }

    private static boolean bindMemory(String memoryId) {
        if (StringUtils.isBlank(memoryId)) {
            return false;
        }
        int first = memoryId.indexOf(':');
        int second = memoryId.indexOf(':', first + 1);
        if (first <= 0 || second <= first) {
            return false;
        }
        WorkspaceContext.setWorkspaceId(memoryId.substring(0, first));
        UserContext.setUserId(memoryId.substring(first + 1, second));
        return true;
    }

    @FunctionalInterface
    private interface ToolCall {
        String get() throws Exception;
    }
}
