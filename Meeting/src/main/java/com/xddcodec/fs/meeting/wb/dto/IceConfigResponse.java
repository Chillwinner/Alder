package com.xddcodec.fs.meeting.wb.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class IceConfigResponse {
    private List<IceServerDto> iceServers;
}
