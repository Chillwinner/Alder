/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.Mail;

import com.xddcodec.fs.site.SiteSettingsKeys;
import com.xddcodec.fs.site.SiteSettingsRuntime;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

@Slf4j
@Service
public class MailService {

    private static final String VERIFY_CODE_TEMPLATE = "email-verification-code.html";
    private static final String WORKSPACE_INVITE_TEMPLATE = "email-workspace-member-invite.html";

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;
    private final SiteSettingsRuntime siteSettingsRuntime;

    @Value("${spring.mail.enable:true}")
    private boolean enabled;

    @Value("${spring.mail.form}")
    private String from;

    public MailService(JavaMailSender mailSender, TemplateEngine templateEngine,
                       SiteSettingsRuntime siteSettingsRuntime) {
        this.mailSender = mailSender;
        this.templateEngine = templateEngine;
        this.siteSettingsRuntime = siteSettingsRuntime;
    }

    @Async
    public void sendVerifyCode(String recipient, String name, String code) {
        Context context = new Context();
        context.setVariable("name", name);
        context.setVariable("code", code);
        sendHtml(recipient, "验证码", VERIFY_CODE_TEMPLATE, context);
    }

    @Async
    public void sendWorkspaceInvite(String recipient, String inviterName, String workspaceName,
                                    String roleName, String inviteUrl) {
        Context context = new Context();
        context.setVariable("inviterName", inviterName);
        context.setVariable("workspaceName", workspaceName);
        context.setVariable("roleName", roleName);
        context.setVariable("inviteUrl", inviteUrl);
        sendHtml(recipient, "空间成员邀请通知", WORKSPACE_INVITE_TEMPLATE, context);
    }

    private void sendHtml(String recipient, String subject, String template, Context context) {
        boolean on = siteSettingsRuntime.getBoolean(SiteSettingsKeys.MAIL_ENABLE, enabled);
        if (!on) {
            log.info("邮件未开启，跳过发送: to={}, subject={}", recipient, subject);
            return;
        }
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true);
            helper.setFrom(siteSettingsRuntime.getOrDefault(SiteSettingsKeys.MAIL_FROM, from));
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(templateEngine.process(template, context), true);
            mailSender.send(message);
            log.info("邮件已发送: to={}, subject={}", recipient, subject);
        } catch (Exception e) {
            log.error("邮件发送失败: to={}, subject={}", recipient, subject, e);
        }
    }
}
