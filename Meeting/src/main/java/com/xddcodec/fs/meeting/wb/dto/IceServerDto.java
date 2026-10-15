package com.xddcodec.fs.meeting.wb.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IceServerDto {
    private List<String> urls;
    private String username;
    private String credential;
}
