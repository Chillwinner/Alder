/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.system.mapper;

import com.xddcodec.fs.system.domain.UserCalendarEvent;
import org.apache.ibatis.annotations.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface UserCalendarEventMapper {

    int insert(UserCalendarEvent row);

    int updateOwn(UserCalendarEvent row);

    int deleteOwn(@Param("id") String id, @Param("userId") String userId);

    UserCalendarEvent selectOwn(@Param("id") String id, @Param("userId") String userId);

    List<UserCalendarEvent> selectOverlapping(
            @Param("userId") String userId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);
}
