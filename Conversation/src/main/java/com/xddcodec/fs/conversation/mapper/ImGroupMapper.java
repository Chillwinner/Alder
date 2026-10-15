/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.mapper;

import com.xddcodec.fs.conversation.domain.ImGroup;
import com.xddcodec.fs.conversation.domain.vo.ImGroupVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface ImGroupMapper {

    ImGroup selectById(@Param("id") String id);

    List<ImGroupVO> listByUserId(@Param("userId") String userId);

    int insert(ImGroup row);

    int dissolve(@Param("id") String id);

    int updateOwner(@Param("id") String id, @Param("ownerId") String ownerId);

    int updateProfile(
            @Param("id") String id,
            @Param("avatar") String avatar,
            @Param("notice") String notice);
}
