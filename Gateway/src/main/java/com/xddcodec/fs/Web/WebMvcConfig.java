/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Web;

import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.stp.StpUtil;
import com.xddcodec.fs.framework.security.properties.SecurityProperties;
import com.xddcodec.fs.Interceptor.StoragePlatformInterceptor;
import com.xddcodec.fs.Interceptor.UserContextInterceptor;
import com.xddcodec.fs.Interceptor.WorkspaceInterceptor;
import com.xddcodec.fs.storage.plugin.local.LocalStorageOperationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.filter.CorsFilter;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Autowired
    private SecurityProperties securityProperties;

    @Autowired
    private StoragePlatformInterceptor storagePlatformInterceptor;

    @Autowired
    private WorkspaceInterceptor workspaceInterceptor;

    @Autowired
    private UserContextInterceptor userContextInterceptor;

    @Autowired
    private LocalStorageOperationService storageProperties;

    @Value("${fs.cors.allowed-origins:http://localhost,http://127.0.0.1,http://localhost:5180,http://127.0.0.1:5180}")
    private java.util.List<String> allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("*")
                .allowedHeaders("*")
                .exposedHeaders("Tus-Resumable", "Upload-Offset", "Upload-Length", "Location")
                .allowCredentials(true);
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> siteCorsFilter(SiteCorsConfigurationSource source) {
        FilterRegistrationBean<CorsFilter> bean = new FilterRegistrationBean<>(new CorsFilter(source));
        bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return bean;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String baseUrl = storageProperties.getBaseUrl();
        String prefix = baseUrl.substring(baseUrl.lastIndexOf("/") + 1);
        registry.addResourceHandler("/" + prefix + "/**")
                .addResourceLocations("file:" + storageProperties.getBasePath() + "/");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(workspaceInterceptor)
                .addPathPatterns("/apis/**")
                .excludePathPatterns(securityProperties.getExcludes())
                .order(1);

        SaInterceptor saInterceptor = new SaInterceptor(handle -> StpUtil.checkLogin());
        registry.addInterceptor(new HandlerInterceptor() {
                    @Override
                    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                                             Object handler) throws Exception {
                        // SseEmitter 异步二次分发时 Sa-Token 上下文已清理
                        if (request.getDispatcherType() == DispatcherType.ASYNC) {
                            return true;
                        }
                        return saInterceptor.preHandle(request, response, handler);
                    }
                })
                .addPathPatterns(securityProperties.getPathPattern())
                .excludePathPatterns(securityProperties.getExcludes())
                .order(2);

        registry.addInterceptor(userContextInterceptor)
                .addPathPatterns("/apis/**")
                .order(3);

        registry.addInterceptor(storagePlatformInterceptor)
                .addPathPatterns(securityProperties.getPathPattern())
                .excludePathPatterns(securityProperties.getExcludes())
                .order(4);
    }
}
