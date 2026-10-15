package com.xddcodec.fs.meeting.wb.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomStatusResponse {
    private String status;
    private String createdAt;
    private String expiresAt;
}
