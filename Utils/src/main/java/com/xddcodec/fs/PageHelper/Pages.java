/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.PageHelper;

import com.github.pagehelper.PageHelper;
import com.github.pagehelper.PageInfo;
import com.xddcodec.fs.Framework.common.domain.PageQuery;
import com.xddcodec.fs.Framework.common.domain.PageResult;

import java.util.List;
import java.util.function.Supplier;

/**
 * PageHelper 分页封装
 */
public final class Pages {

    private Pages() {
    }

    public static void start(PageQuery query) {
        int page = query.getPage() == null ? 1 : query.getPage();
        int pageSize = query.getPageSize() == null ? 20 : query.getPageSize();
        start(page, pageSize);
    }

    public static void start(Integer page, Integer pageSize) {
        PageHelper.startPage(page == null ? 1 : page, pageSize == null ? 20 : pageSize);
    }

    public static <T> PageResult<T> of(List<T> records) {
        PageInfo<T> info = new PageInfo<>(records);
        return PageResult.success(info.getList(), info.getTotal());
    }

    public static <T> PageResult<T> query(PageQuery query, Supplier<List<T>> supplier) {
        start(query);
        return of(supplier.get());
    }
}
