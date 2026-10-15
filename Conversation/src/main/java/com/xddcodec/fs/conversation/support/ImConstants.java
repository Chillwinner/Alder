/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

package com.xddcodec.fs.conversation.support;

public final class ImConstants {

    public static final String CHANNEL = "fs:conversation:events";

    public static final String CONV_SINGLE = "single";
    public static final String CONV_GROUP = "group";

    public static final String FRIEND_PENDING = "pending";
    public static final String FRIEND_ACCEPTED = "accepted";
    public static final String FRIEND_REJECTED = "rejected";
    public static final String FRIEND_BLOCKED = "blocked";

    public static final String ROLE_OWNER = "owner";
    public static final String ROLE_ADMIN = "admin";
    public static final String ROLE_MEMBER = "member";

    public static final String MSG_TEXT = "TEXT";
    public static final String MSG_IMAGE = "IMAGE";
    public static final String MSG_FILE = "FILE";
    public static final String MSG_ENCRYPTED_TEXT = "ENCRYPTED_TEXT";

    public static final String INBOX_ENCRYPTED_PREVIEW = "[加密消息]";

    public static final String PUSH_MESSAGE = "MESSAGE";
    public static final String PUSH_UNREAD = "UNREAD";
    public static final String PUSH_READ = "READ";
    public static final String PUSH_RECALL = "RECALL";
    public static final String PUSH_FRIEND_REQUEST = "FRIEND_REQUEST";
    public static final String PUSH_WORKSPACE_INVITATION = "WORKSPACE_INVITATION";
    public static final String PUSH_FILE_COLLECTION_SUBMISSION = "FILE_COLLECTION_SUBMISSION";
    public static final String PUSH_FILE_COLLECTION_ASSIGNED = "FILE_COLLECTION_ASSIGNED";

    public static final int RECALL_LIMIT_SECONDS = 120;
    public static final String RECALL_INBOX_PREVIEW = "[撤回一条消息]";

    private ImConstants() {
    }

    public static String userPrincipal(String userId) {
        return "user-" + userId;
    }

    public static String canonicalPair(String userId, String friendId) {
        return userId.compareTo(friendId) <= 0
                ? userId + ":" + friendId
                : friendId + ":" + userId;
    }
}
