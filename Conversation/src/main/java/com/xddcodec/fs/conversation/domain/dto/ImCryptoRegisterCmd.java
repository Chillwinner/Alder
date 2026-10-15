/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.domain.dto;

import lombok.Data;

@Data
public class ImCryptoRegisterCmd {
    private String publicKeySpki;
    private String keyProof;
}
