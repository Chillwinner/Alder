package com.xddcodec.fs.system.support;

import com.xddcodec.fs.Exception.BusinessException;
import com.xddcodec.fs.Exception.ErrorMessages;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

public final class SiteBoxCrypto {

    private static final int ITERATIONS = 210_000;
    private static final int KEY_BITS = 256;
    private static final int SALT_LEN = 16;
    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;

    private SiteBoxCrypto() {
    }

    public static String seal(String password, byte[] plaintext) {
        try {
            byte[] salt = random(SALT_LEN);
            byte[] iv = random(IV_LEN);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, derive(password, salt), new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plaintext);
            ByteBuffer buf = ByteBuffer.allocate(1 + SALT_LEN + IV_LEN + ct.length);
            buf.put((byte) 1);
            buf.put(salt);
            buf.put(iv);
            buf.put(ct);
            return Base64.getEncoder().encodeToString(buf.array());
        } catch (GeneralSecurityException e) {
            throw new BusinessException(ErrorMessages.SITE_BOX_FAILED);
        }
    }

    public static byte[] open(String password, String box) {
        try {
            byte[] raw = Base64.getDecoder().decode(box.trim());
            if (raw.length < 1 + SALT_LEN + IV_LEN + 16 || raw[0] != 1) {
                throw new BusinessException(ErrorMessages.SITE_BOX_INVALID);
            }
            ByteBuffer buf = ByteBuffer.wrap(raw);
            buf.get();
            byte[] salt = new byte[SALT_LEN];
            byte[] iv = new byte[IV_LEN];
            buf.get(salt);
            buf.get(iv);
            byte[] ct = new byte[buf.remaining()];
            buf.get(ct);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, derive(password, salt), new GCMParameterSpec(TAG_BITS, iv));
            return cipher.doFinal(ct);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorMessages.SITE_BOX_INVALID);
        }
    }

    private static SecretKeySpec derive(String password, byte[] salt) throws GeneralSecurityException {
        PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, ITERATIONS, KEY_BITS);
        byte[] key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        return new SecretKeySpec(key, "AES");
    }

    private static byte[] random(int n) {
        byte[] b = new byte[n];
        new SecureRandom().nextBytes(b);
        return b;
    }

    public static String utf8(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }

    public static byte[] utf8(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }
}
