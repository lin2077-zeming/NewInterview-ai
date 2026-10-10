"use client";

import { useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { useTTS } from "@/hooks/useTTS";

const INIT_TRIGGER = "__INTERVIEW_START__";

type ChatStatus = "submitted" | "streaming" | "ready" | "error" | string;

interface UseInterviewTTSOptions {
  messages: UIMessage[];
  status: ChatStatus;
  getMessageText: (message: UIMessage) => string;
}

function isAiMessage(message: UIMessage) {
  return message.role === "assistant";
}

function canSpeakNow(status: ChatStatus) {
  return status !== "submitted" && status !== "streaming";
}

export function useInterviewTTS({
  messages,
  status,
  getMessageText,
}: UseInterviewTTSOptions) {
  const tts = useTTS();
  const lastAutoSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!tts.enabled || !canSpeakNow(status)) return;

    const latestAiMessage = [...messages]
      .reverse()
      .find((message) => {
        if (!isAiMessage(message)) return false;
        const text = getMessageText(message).trim();
        return text.length > 0 && text !== INIT_TRIGGER;
      });

    if (!latestAiMessage) return;
    if (latestAiMessage.id === lastAutoSpokenIdRef.current) return;

    const text = getMessageText(latestAiMessage).trim();
    if (!text) return;

    lastAutoSpokenIdRef.current = latestAiMessage.id;
    tts.speak(text, { messageId: latestAiMessage.id });
  }, [getMessageText, messages, status, tts]);

  const speakMessage = useCallback(
    (message: UIMessage) => {
      const text = getMessageText(message).trim();
      if (!text || text === INIT_TRIGGER) return;

      if (tts.isSpeaking && tts.activeMessageId === message.id) {
        tts.stop();
        return;
      }

      tts.speak(text, { messageId: message.id });
    },
    [getMessageText, tts]
  );

  const isMessageSpeaking = useCallback(
    (messageId: string) =>
      tts.isSpeaking && tts.activeMessageId === messageId,
    [tts.activeMessageId, tts.isSpeaking]
  );

  const canShowSpeakButton = useCallback(
    (message: UIMessage, isLatestVisibleMessage: boolean) =>
      isAiMessage(message) &&
      (!isLatestVisibleMessage || canSpeakNow(status)) &&
      getMessageText(message).trim() !== INIT_TRIGGER &&
      getMessageText(message).trim().length > 0,
    [getMessageText, status]
  );

  return {
    activeMessageId: tts.activeMessageId,
    isSpeaking: tts.isSpeaking,
    speakMessage,
    isMessageSpeaking,
    canShowSpeakButton,
  };
}
