/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.domain.vo;

import com.xddcodec.fs.File.domain.vo.FileVO;
import lombok.Data;

import java.util.List;

@Data
public class WorkspaceBoardOverviewVO {
    private String fileshareFolderId;
    private String memosFolderId;
    private List<FileVO> fileshareFiles;
    private List<WorkspaceMemoVO> memos;
}
