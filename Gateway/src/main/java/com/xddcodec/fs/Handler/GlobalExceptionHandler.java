/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Handler;

import com.xddcodec.fs.Exception.ErrorMessages;

import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.exception.NotPermissionException;
import cn.dev33.satoken.exception.NotRoleException;
import com.xddcodec.fs.Result.Result;
import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.StorageConfigException;
import com.xddcodec.fs.Exception.StorageOperationException;
import com.xddcodec.fs.common.utils.ErrorMessageUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.yaml.snakeyaml.constructor.DuplicateKeyException;

/**
 * 全局异常处理。msg 原样回给前端，由前端本地翻译。
 *
 * @Author: xddcode
 * @Date: 2023/6/29 17:27
 */
@Slf4j
@RestControllerAdvice
@ResponseBody
public class GlobalExceptionHandler {

    /**
     * 权限码异常
     */
    @ExceptionHandler(NotPermissionException.class)
    public Result<?> handleNotPermissionException(NotPermissionException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("请求地址'{}',权限码校验失败'{}'", requestURI, e.getMessage());
        return Result.error(ErrorMessages.AUTH_FORBIDDEN);
    }

    /**
     * 角色权限异常
     */
    @ExceptionHandler(NotRoleException.class)
    public Result<?> handleNotRoleException(NotRoleException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("请求地址'{}',角色权限校验失败'{}'", requestURI, e.getMessage());
        return Result.error(ErrorMessages.AUTH_FORBIDDEN);
    }

    /**
     * 认证失败
     */
    @ExceptionHandler(NotLoginException.class)
    public Result<?> handlerNotLoginException(NotLoginException nle) {
        ErrorMessages errorCode = switch (nle.getType()) {
            case NotLoginException.NOT_TOKEN -> ErrorMessages.AUTH_NOT_TOKEN;
            case NotLoginException.INVALID_TOKEN -> ErrorMessages.AUTH_INVALID_TOKEN;
            case NotLoginException.TOKEN_TIMEOUT -> ErrorMessages.AUTH_EXPIRED_TOKEN;
            case NotLoginException.BE_REPLACED -> ErrorMessages.AUTH_REPLACED_TOKEN;
            case NotLoginException.KICK_OUT -> ErrorMessages.AUTH_KICK_OUT_TOKEN;
            case NotLoginException.NO_PREFIX -> ErrorMessages.AUTH_NO_PREFIX_TOKEN;
            default -> ErrorMessages.AUTH_UNAUTHORIZED;
        };
        log.error("Token exception [{}]: {}", errorCode.getCode(), nle.getMessage(), nle);
        return Result.error(errorCode);
    }

    /**
     * 主键或UNIQUE索引，数据重复异常
     */
    @ExceptionHandler(DuplicateKeyException.class)
    public Result<Void> handleDuplicateKeyException(DuplicateKeyException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        log.error("请求地址'{}',数据库中已存在记录'{}'", requestURI, e.getMessage());
        return Result.error(ErrorMessages.DB_DUPLICATE_KEY);
    }

    /**
     * IllegalArgumentException 异常处理返回json
     */
    @ExceptionHandler({IllegalArgumentException.class})
    public Result<?> badRequestException(IllegalArgumentException e) {
        return defHandler(HttpStatus.BAD_REQUEST.value(), e.getMessage(), e);
    }

    /**
     * BusinessException 业务异常处理，保留业务层给出的状态码。
     */
    @ExceptionHandler(BusinessException.class)
    public Result<?> handleBusinessException(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }

    /**
     * StorageOperationException 存储异常处理
     *
     * @param e
     * @return
     */
    @ExceptionHandler(StorageOperationException.class)
    public Result<?> handleStorageOperationException(StorageOperationException e) {
        String message = ErrorMessageUtils.extractUserFriendlyMessage(e);
        log.error("存储操作异常: {}", e.getMessage(), e);
        return Result.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), message);
    }

    /**
     * StorageConfigException 存储配置异常处理
     * 返回状态码:500
     */
    @ExceptionHandler(StorageConfigException.class)
    public Result<?> handleStorageConfigException(StorageConfigException e) {
        String message = ErrorMessageUtils.extractUserFriendlyMessage(e);
        log.error("存储配置异常: {}", e.getMessage(), e);
        return Result.error(HttpStatus.INTERNAL_SERVER_ERROR.value(), message);
    }

    /**
     * HttpRequestMethodNotSupportedException 异常处理返回json
     */
    @ExceptionHandler({HttpRequestMethodNotSupportedException.class})
    public Result<?> handleHttpRequestMethodNotSupportedException(HttpRequestMethodNotSupportedException e) {
        return defHandler(ErrorMessages.REQUEST_METHOD_NOT_SUPPORTED.getCode(), ErrorMessages.REQUEST_METHOD_NOT_SUPPORTED.getKey(), e);
    }

    /**
     * 文件上传相关异常（包括大小超限）
     */
    @ExceptionHandler({
            MaxUploadSizeExceededException.class,
            org.springframework.web.multipart.MultipartException.class
    })
    public Result<?> handleFileUploadException(Exception e) {
        log.error("文件上传异常: {}", e.getClass().getName(), e);
        return Result.error(ErrorMessages.FILE_UPLOAD_FAILED);
    }

    /**
     * Bean 校验异常 Validate
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<?> handleMethodArgumentNotValidException(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getAllErrors().get(0).getDefaultMessage();
        log.error(message, e);
        return Result.error(HttpStatus.BAD_REQUEST.value(), message);
    }

    /**
     * 方法参数校验异常 Validate
     */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<?> handleValidationException(ConstraintViolationException e) {
        String message = e.getConstraintViolations().iterator().next().getMessage();
        log.error(message, e);
        return Result.error(HttpStatus.BAD_REQUEST.value(), message);
    }

    /**
     * 方法参数校验异常 Validate
     */
    @ExceptionHandler(BindException.class)
    public Result<?> handleBindException(BindException e) {
        String message = e.getBindingResult().getAllErrors().iterator().next().getDefaultMessage();
        log.error(message, e);
        return Result.error(HttpStatus.BAD_REQUEST.value(), message);
    }

    /**
     * 处理静态资源未找到异常
     * 通常是浏览器请求 sw.js、manifest.json 等前端资源
     * 这些请求来自浏览器缓存的 Service Worker 注册，可以安全忽略
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public Result<?> handleNoResourceFoundException(NoResourceFoundException e, HttpServletRequest request) {
        String requestURI = request.getRequestURI();
        if ("/".equals(requestURI)) {
            return Result.error(ErrorMessages.REQUEST_ROOT_PATH_MESSAGE);
        }

        if (requestURI.matches(".*(sw\\.js|manifest\\.json|robots\\.txt|favicon\\.ico)$")) {
            log.debug("忽略前端资源请求: {}", requestURI);
            return null;
        }
        log.warn("请求地址'{}',静态资源未找到", requestURI);
        return Result.error(ErrorMessages.REQUEST_RESOURCE_NOT_FOUND);
    }

    /**
     * 处理客户端断开连接异常
     * 这种异常通常发生在用户刷新页面、快速切换文件、网络中断等场景
     * 不需要记录为错误日志
     */
    @ExceptionHandler({
            org.springframework.web.context.request.async.AsyncRequestNotUsableException.class,
            java.io.IOException.class
    })
    public Result<?> handleClientAbortException(Exception e) {
        if (isClientAbortException(e)) {
            log.debug("客户端断开连接: {}", e.getMessage());
            return null;
        }
        return defHandler(ErrorMessages.SYSTEM_ERROR.getCode(), ErrorMessages.SYSTEM_ERROR.getKey(), e);
    }

    /**
     * 处理所有不可知的异常
     */
    @ExceptionHandler(Exception.class)
    public Result<?> handleException(Exception e) {
        return defHandler(ErrorMessages.SYSTEM_ERROR.getCode(), ErrorMessages.SYSTEM_ERROR.getKey(), e);
    }

    private Result<?> defHandler(int code, String msg, Exception e) {
        log.error(e.getMessage(), e);
        return Result.error(code, msg);
    }

    /**
     * 判断是否为客户端断开连接异常
     */
    private boolean isClientAbortException(Throwable e) {
        if (e == null) {
            return false;
        }

        String className = e.getClass().getName();
        String message = e.getMessage();

        if (className.contains("ClientAbortException")
                || className.contains("AsyncRequestNotUsableException")
                || className.contains("EOFException")
                || className.contains("SocketException")) {
            return true;
        }

        if (message != null) {
            String lowerMessage = message.toLowerCase();
            if (lowerMessage.contains("broken pipe")
                    || lowerMessage.contains("connection reset")
                    || lowerMessage.contains("connection abort")
                    || lowerMessage.contains("stream closed")
                    || lowerMessage.contains("client abort")
                    || lowerMessage.contains("outputstream failed")) {
                return true;
            }
        }

        return isClientAbortException(e.getCause());
    }
}
