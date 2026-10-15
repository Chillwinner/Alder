package com.xddcodec.fs.System.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ExportSiteSettingsCmd {

    @NotBlank
    @Size(min = 8, max = 128)
    private String password;

    private boolean includeJwt;
    private boolean includeOss = true;
}
