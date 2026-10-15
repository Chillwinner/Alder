/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.ai.office;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.File.domain.FileInfo;
import com.xddcodec.fs.file.service.FileInfoService;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class OfficeFileEditService {

    private static final Set<String> SUFFIX = Set.of("docx", "xlsx", "pptx");

    private final FileInfoService fileInfoService;
    private final OfficeCliRunner officeCliRunner;
    private final FileWriteLockService writeLockService;

    public FileInfo requireOfficeFile(String fileId) {
        FileInfo file = fileInfoService.getAuthorizedFile(fileId);
        if (Boolean.TRUE.equals(file.getIsDir())) {
            throw new BusinessException("不能修改文件夹");
        }
        String suffix = suffix(file);
        if (!SUFFIX.contains(suffix)) {
            throw new BusinessException("只支持 docx / xlsx / pptx");
        }
        return file;
    }

    public long revision(FileInfo file) {
        if (file.getUpdateTime() == null) {
            return file.getSize() == null ? 0L : file.getSize();
        }
        return file.getUpdateTime().atZone(ZoneId.of("Asia/Shanghai")).toInstant().toEpochMilli();
    }

    public String inspect(String fileId, String userId, String sessionId, String verb, String extra)
            throws Exception {
        writeLockService.requireMine(fileId, userId, sessionId);
        return withLocal(fileId, false, verb, extra);
    }

    public String edit(String fileId, String userId, String sessionId, String verb, String extra)
            throws Exception {
        writeLockService.requireMine(fileId, userId, sessionId);
        return withLocal(fileId, true, verb, extra);
    }

    public String editTokens(String fileId, String userId, String sessionId, String verb, java.util.List<String> tokens)
            throws Exception {
        writeLockService.requireMine(fileId, userId, sessionId);
        return withLocalTokens(fileId, verb, tokens);
    }

    private String withLocalTokens(String fileId, String verb, java.util.List<String> tokens) throws Exception {
        return withLocal(fileId, true, verb, null, tokens);
    }

    private String withLocal(String fileId, boolean write, String verb, String extra) throws Exception {
        return withLocal(fileId, write, verb, extra, null);
    }

    private String withLocal(String fileId, boolean write, String verb, String extra, java.util.List<String> tokens)
            throws Exception {
        FileInfo meta = requireOfficeFile(fileId);
        String suffix = suffix(meta);
        Path dir = Files.createTempDirectory("officecli-");
        Path file = dir.resolve("doc." + suffix);
        try {
            try (InputStream in = fileInfoService.downloadFile(fileId)) {
                Files.copy(in, file);
            }
            OfficeCliRunner.assertSafeWorkFile(dir, file);
            String out = tokens == null
                    ? officeCliRunner.exec(dir, file, verb, extra, write)
                    : officeCliRunner.execTokens(dir, file, verb, tokens, write);
            if (write) {
                fileInfoService.replaceFileContent(fileId, Files.readAllBytes(file));
            }
            return StringUtils.defaultIfBlank(out, write ? "已写回网盘" : "完成");
        } finally {
            try {
                Files.deleteIfExists(file);
                Files.deleteIfExists(dir);
            } catch (Exception ignored) {
                // temp cleanup
            }
        }
    }

    public static String suffix(FileInfo file) {
        return file.getSuffix() == null ? "" : file.getSuffix().trim().toLowerCase(Locale.ROOT);
    }
}
