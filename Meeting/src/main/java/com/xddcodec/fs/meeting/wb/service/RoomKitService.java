package com.xddcodec.fs.meeting.wb.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * 房间计时器 / 投票：写入 Redis kit hash，进房 INIT 带回，人走不保留到关房之后。
 */
@Slf4j
@Service
public class RoomKitService {

    private static final int MIN_TIMER_MS = 10_000;
    private static final int MAX_TIMER_MS = 3 * 60 * 60 * 1000;
    private static final int QUESTION_MAX = 80;
    private static final int OPTION_MAX = 24;
    private static final int OPTIONS_MIN = 2;
    private static final int OPTIONS_MAX = 6;
    private static final int VOTE_DURATION_MS = 5 * 60 * 1000;

    @Autowired
    private RoomService roomService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public JsonNode handle(String roomId, JsonNode node) {
        if (!roomService.isRoomActive(roomId) || node == null) {
            return null;
        }
        String type = node.path("type").asText("");
        try {
            return switch (type) {
                case "TIMER_START" -> startTimer(roomId, node.path("durationMs").asInt(0));
                case "TIMER_PAUSE" -> pauseTimer(roomId);
                case "TIMER_RESUME" -> resumeTimer(roomId);
                case "TIMER_RESET" -> resetTimer(roomId);
                case "VOTE_START" -> startVote(roomId, node.path("question").asText(""), node.path("options"));
                case "VOTE_CAST" -> castVote(roomId, node.path("from").asText(""), node.path("choice").asText(""));
                case "VOTE_CLOSE" -> closeVote(roomId);
                case "VOTE_CLEAR" -> clearVote(roomId);
                default -> null;
            };
        } catch (Exception e) {
            log.warn("kit 处理失败: roomId={}, type={}", roomId, type, e);
            return null;
        }
    }

    public ObjectNode snapshot(String roomId) {
        ObjectNode out = objectMapper.createObjectNode();
        String timer = roomService.getKit(roomId, "timer");
        String vote = roomService.getKit(roomId, "vote");
        if (timer != null) {
            try {
                out.set("timer", objectMapper.readTree(timer));
            } catch (Exception ignored) {
                /* skip */
            }
        }
        if (vote != null) {
            try {
                ObjectNode voteNode = (ObjectNode) objectMapper.readTree(vote);
                out.set("vote", expireVote(roomId, voteNode));
            } catch (Exception ignored) {
                /* skip */
            }
        }
        return out;
    }

    private JsonNode startTimer(String roomId, int durationMs) throws Exception {
        int dur = Math.min(MAX_TIMER_MS, Math.max(MIN_TIMER_MS, durationMs));
        ObjectNode timer = objectMapper.createObjectNode();
        timer.put("running", true);
        timer.put("durationMs", dur);
        timer.put("endsAt", System.currentTimeMillis() + dur);
        timer.putNull("pausedLeftMs");
        saveTimer(roomId, timer);
        return wrap("TIMER", timer);
    }

    private JsonNode pauseTimer(String roomId) throws Exception {
        ObjectNode timer = readTimer(roomId);
        if (timer == null || !timer.path("running").asBoolean(false)) {
            return wrap("TIMER", timer);
        }
        long left = Math.max(0, timer.path("endsAt").asLong(0) - System.currentTimeMillis());
        timer.put("running", false);
        timer.put("pausedLeftMs", left);
        timer.putNull("endsAt");
        saveTimer(roomId, timer);
        return wrap("TIMER", timer);
    }

    private JsonNode resumeTimer(String roomId) throws Exception {
        ObjectNode timer = readTimer(roomId);
        if (timer == null || timer.path("running").asBoolean(false)) {
            return wrap("TIMER", timer);
        }
        int left = timer.path("pausedLeftMs").asInt(timer.path("durationMs").asInt(0));
        if (left <= 0) {
            return resetTimer(roomId);
        }
        timer.put("running", true);
        timer.put("endsAt", System.currentTimeMillis() + left);
        timer.putNull("pausedLeftMs");
        saveTimer(roomId, timer);
        return wrap("TIMER", timer);
    }

    private JsonNode resetTimer(String roomId) {
        roomService.deleteKit(roomId, "timer");
        return wrap("TIMER", null);
    }

    private JsonNode startVote(String roomId, String question, JsonNode optionsNode) throws Exception {
        List<String> options = sanitizeOptions(optionsNode);
        if (options.size() < OPTIONS_MIN) {
            return null;
        }
        ObjectNode vote = objectMapper.createObjectNode();
        vote.put("open", true);
        vote.put("question", sanitizeQuestion(question));
        vote.put("endsAt", System.currentTimeMillis() + VOTE_DURATION_MS);
        var optionArr = vote.putArray("options");
        for (String option : options) optionArr.add(option);
        vote.putObject("ballots");
        saveVote(roomId, vote);
        return wrap("VOTE", vote);
    }

    private JsonNode castVote(String roomId, String from, String choice) throws Exception {
        ObjectNode vote = expireVote(roomId, readVote(roomId));
        if (vote == null || !vote.path("open").asBoolean(false)) {
            return wrap("VOTE", vote);
        }
        if (from == null || from.isBlank() || !voteOptions(vote).contains(choice)) {
            return wrap("VOTE", vote);
        }
        ObjectNode ballots = vote.has("ballots") && vote.get("ballots").isObject()
                ? (ObjectNode) vote.get("ballots")
                : vote.putObject("ballots");
        if (ballots.size() >= 16) {
            Iterator<String> it = ballots.fieldNames();
            if (it.hasNext() && !ballots.has(from)) {
                return wrap("VOTE", vote);
            }
        }
        ballots.put(from, choice);
        saveVote(roomId, vote);
        return wrap("VOTE", vote);
    }

    private JsonNode closeVote(String roomId) throws Exception {
        ObjectNode vote = expireVote(roomId, readVote(roomId));
        if (vote == null) {
            return wrap("VOTE", null);
        }
        vote.put("open", false);
        saveVote(roomId, vote);
        return wrap("VOTE", vote);
    }

    private JsonNode clearVote(String roomId) {
        roomService.deleteKit(roomId, "vote");
        ObjectNode empty = objectMapper.createObjectNode();
        empty.put("open", false);
        empty.put("question", "");
        empty.putArray("options");
        empty.putObject("ballots");
        return wrap("VOTE", empty);
    }

    private ObjectNode readTimer(String roomId) throws Exception {
        String raw = roomService.getKit(roomId, "timer");
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return (ObjectNode) objectMapper.readTree(raw);
    }

    private ObjectNode expireVote(String roomId, ObjectNode vote) throws Exception {
        if (vote == null || !vote.path("open").asBoolean(false)) {
            return vote;
        }
        long endsAt = vote.path("endsAt").asLong(0);
        if (endsAt > 0 && System.currentTimeMillis() >= endsAt) {
            vote.put("open", false);
            saveVote(roomId, vote);
        }
        return vote;
    }

    private ObjectNode readVote(String roomId) throws Exception {
        String raw = roomService.getKit(roomId, "vote");
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return (ObjectNode) objectMapper.readTree(raw);
    }

    private void saveTimer(String roomId, ObjectNode timer) throws Exception {
        roomService.setKit(roomId, "timer", objectMapper.writeValueAsString(timer));
    }

    private void saveVote(String roomId, ObjectNode vote) throws Exception {
        roomService.setKit(roomId, "vote", objectMapper.writeValueAsString(vote));
    }

    private ObjectNode wrap(String type, JsonNode data) {
        ObjectNode out = objectMapper.createObjectNode();
        out.put("type", type);
        if (data != null) {
            out.set("data", data);
        }
        return out;
    }

    private List<String> voteOptions(ObjectNode vote) {
        List<String> out = new ArrayList<>();
        JsonNode arr = vote.path("options");
        if (!arr.isArray()) {
            return out;
        }
        for (JsonNode item : arr) {
            String label = item.asText("").trim();
            if (!label.isEmpty()) out.add(label);
        }
        return out;
    }

    private List<String> sanitizeOptions(JsonNode optionsNode) {
        List<String> out = new ArrayList<>();
        if (optionsNode != null && optionsNode.isArray()) {
            for (JsonNode item : optionsNode) {
                String label = sanitizeOption(item.asText(""));
                if (label.isEmpty() || out.contains(label)) continue;
                out.add(label);
                if (out.size() >= OPTIONS_MAX) break;
            }
        }
        return out;
    }

    private String sanitizeOption(String option) {
        if (option == null) return "";
        String trimmed = option.trim();
        return trimmed.length() > OPTION_MAX ? trimmed.substring(0, OPTION_MAX) : trimmed;
    }

    private String sanitizeQuestion(String question) {
        if (question == null) {
            return "";
        }
        String trimmed = question.trim();
        return trimmed.length() > QUESTION_MAX ? trimmed.substring(0, QUESTION_MAX) : trimmed;
    }
}
