/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.progress.domain.vo;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ProgressMonthVO {
    private int year;
    private int month;
    private List<ProgressAssigneeVO> people = new ArrayList<>();
    private List<Cell> cells = new ArrayList<>();

    @Data
    public static class Cell {
        private String userId;
        private int day;
        private int count;
        private boolean approved;
        private boolean pending;
        private List<String> titles = new ArrayList<>();
    }
}
