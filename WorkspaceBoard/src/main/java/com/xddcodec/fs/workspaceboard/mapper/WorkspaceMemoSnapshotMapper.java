/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.workspaceboard.mapper;

import com.xddcodec.fs.workspaceboard.domain.WorkspaceMemoSnapshot;
import org.apache.ibatis.annotations.Param;

public interface WorkspaceMemoSnapshotMapper {

    int insert(WorkspaceMemoSnapshot snapshot);

    WorkspaceMemoSnapshot selectLatest(@Param("memoId") String memoId);

    WorkspaceMemoSnapshot selectLatestCommit(@Param("memoId") String memoId);

    java.util.List<WorkspaceMemoSnapshot> selectList(@Param("memoId") String memoId);

    WorkspaceMemoSnapshot selectById(@Param("id") Long id);
}
