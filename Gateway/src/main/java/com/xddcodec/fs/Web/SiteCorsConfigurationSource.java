package com.xddcodec.fs.Web;

import com.xddcodec.fs.site.SiteSettingsRuntime;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SiteCorsConfigurationSource implements CorsConfigurationSource {

    private final SiteSettingsRuntime siteSettingsRuntime;

    @Value("${fs.cors.allowed-origins:http://localhost,http://127.0.0.1,http://localhost:5180,http://127.0.0.1:5180}")
    private String defaultOrigins;

    @Override
    public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
        CorsConfiguration c = new CorsConfiguration();
        List<String> origins = siteSettingsRuntime.corsOrigins(defaultOrigins);
        c.setAllowedOrigins(origins);
        c.addAllowedMethod("*");
        c.addAllowedHeader("*");
        c.addExposedHeader("Tus-Resumable");
        c.addExposedHeader("Upload-Offset");
        c.addExposedHeader("Upload-Length");
        c.addExposedHeader("Location");
        c.setAllowCredentials(true);
        return c;
    }
}
