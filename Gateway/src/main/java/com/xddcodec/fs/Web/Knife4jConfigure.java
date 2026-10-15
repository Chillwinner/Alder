/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Web;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.ExternalDocumentation;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Knife4jConfigure {

    @Bean
    public OpenAPI springShopOpenAPI() {
        final String loginToken = "BearerAuth";
        return new OpenAPI()
                .info(new Info().title("Alder API")
                        .description("Alder 接口文档。本产品基于 Apache-2.0 授权的 Free-FS 衍生，归属见发行包 NOTICE。")
                        .version("v2.3.1")
                        .license(new License().name("Apache 2.0").url("https://www.apache.org/licenses/LICENSE-2.0")))
                .externalDocs(new ExternalDocumentation()
                        .description("Apache License 2.0")
                        .url("https://www.apache.org/licenses/LICENSE-2.0"))
                .components(new Components()
                        .addSecuritySchemes(loginToken,
                                new SecurityScheme()
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("Bearer")
                                        .bearerFormat("JWT")
                                        .in(SecurityScheme.In.HEADER)
                                        .name(loginToken)))
                .addSecurityItem(new SecurityRequirement().addList(loginToken));
    }
}
