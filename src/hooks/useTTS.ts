"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { splitSpeechText } from "@/lib/speech";

const STORAGE_KEY_VOICE = "zhijing-opc-tts-voice-uri";
const STORAGE_KEY_ENABLED = "zhijing-opc-tts-enabled";

type TTSState = {
  enabled: boolean;
  isSpeaking: boolean;
  voices: SpeechSynthesisVoice[];
  voiceURI: string | null;
  activeMessageId: string | null;
  supported: boolean;
};

type SpeechJob = {
  id: number;
  text: string;
  messageId: string | null;
  voiceURI?: string | null;
};

type SpeakOptions = {
  messageId?: string | null;
  voiceURI?: string | null;
};

type Listener = () => void;

function hasSpeechSynthesis() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return fallback;
  }
}

function readStoredVoice() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY_VOICE) || null;
  } catch {
    return null;
  }
}

/**
 * 语音排序：普通话（zh-CN）优先，其余中文（粤语 zh-HK、繁体 zh-TW）次之，非中文最后。
 *
 * 原先只判断"以 zh 开头"，Windows 的语音列表里粤语（zh-HK）排在前面时
 * 就会被当成默认语音——对目标用户（求职学生）来说朗读出来是粤语，不可接受。
 */
function voiceRank(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase().replace("_", "-");
  if (lang === "zh-cn" || lang.startsWith("zh-cn")) return 0; // 普通话
  if (lang.startsWith("zh")) return 1; // 其他中文（粤语/繁体等）
  return 2;
}

function sortVoices(voices: SpeechSynthesisVoice[]) {
  return [...voices].sort((a, b) => {
    const rankDiff = voiceRank(a) - voiceRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function createStore() {
  let state: TTSState = {
    enabled: readStoredBoolean(STORAGE_KEY_ENABLED, false),
    isSpeaking: false,
    voices: [],
    voiceURI: readStoredVoice(),
    activeMessageId: null,
    supported: typeof window === "undefined" ? true : hasSpeechSynthesis(),
  };

  let queue: SpeechJob[] = [];
  let currentJob: SpeechJob | null = null;
  let currentToken = 0;
  let nextJobId = 1;

  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function update(partial: Partial<TTSState>) {
    state = { ...state, ...partial };
    emit();
  }

  function selectVoice(voiceURI?: string | null) {
    if (!hasSpeechSynthesis()) return null;

    const voices =
      state.voices.length > 0
        ? state.voices
        : sortVoices(window.speechSynthesis.getVoices());
    const preferredURI = voiceURI ?? state.voiceURI;

    if (preferredURI) {
      const selected = voices.find((voice) => voice.voiceURI === preferredURI);
      if (selected) return selected;
    }

    // 默认语音：优先普通话（zh-CN），其次任意中文，最后才随便选一个
    return (
      voices.find((voice) => voiceRank(voice) === 0) ??
      voices.find((voice) => voiceRank(voice) === 1) ??
      voices[0] ??
      null
    );
  }

  function finishCurrent(token: number) {
    if (token !== currentToken) return;
    currentJob = null;

    if (queue.length === 0) {
      update({ isSpeaking: false, activeMessageId: null });
      return;
    }

    playNext();
  }

  function playNext() {
    if (!hasSpeechSynthesis()) {
      queue = [];
      currentJob = null;
      update({
        supported: false,
        isSpeaking: false,
        activeMessageId: null,
      });
      return;
    }

    if (currentJob || queue.length === 0) return;

    const job = queue.shift();
    if (!job) return;

    const text = job.text.trim();
    if (!text) {
      playNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = selectVoice(job.voiceURI);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "zh-CN";
    } else {
      utterance.lang = "zh-CN";
    }
    utterance.rate = 1;
    utterance.pitch = 1;

    currentJob = job;
    currentToken += 1;
    const token = currentToken;

    utterance.onstart = () => {
      if (token !== currentToken) return;
      update({
        isSpeaking: true,
        activeMessageId: job.messageId,
      });
    };
    utterance.onend = () => finishCurrent(token);
    utterance.onerror = () => finishCurrent(token);

    window.speechSynthesis.speak(utterance);

    // Some browsers do not fire onstart for very short utterances.
    update({
      supported: true,
      isSpeaking: true,
      activeMessageId: job.messageId,
    });
  }

  function stop() {
    queue = [];
    currentJob = null;
    currentToken += 1;
    if (hasSpeechSynthesis()) {
      window.speechSynthesis.cancel();
    }
    update({ isSpeaking: false, activeMessageId: null });
  }

  function enqueueChunks(text: string, options: SpeakOptions = {}) {
    const chunks = splitSpeechText(text);
    if (chunks.length === 0) return;

    queue.push(
      ...chunks.map((chunk) => ({
        id: nextJobId++,
        text: chunk,
        messageId: options.messageId ?? null,
        voiceURI: options.voiceURI,
      }))
    );
    playNext();
  }

  return {
    getState: () => state,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEnabled: (enabled: boolean) => {
      if (!enabled) stop();
      update({ enabled });
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      } catch {
        // localStorage may be blocked in private mode.
      }
    },
    toggleEnabled: () => {
      const enabled = !state.enabled;
      if (!enabled) stop();
      update({ enabled });
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
      } catch {
        // localStorage may be blocked in private mode.
      }
    },
    setVoices: (voices: SpeechSynthesisVoice[]) => {
      update({ voices: sortVoices(voices), supported: hasSpeechSynthesis() });
    },
    setVoiceURI: (uri: string | null) => {
      update({ voiceURI: uri });
      try {
        if (uri) {
          localStorage.setItem(STORAGE_KEY_VOICE, uri);
        } else {
          localStorage.removeItem(STORAGE_KEY_VOICE);
        }
      } catch {
        // localStorage may be blocked in private mode.
      }
    },
    speak: (text: string, options?: SpeakOptions) => {
      stop();
      enqueueChunks(text, options);
    },
    enqueue: enqueueChunks,
    stop,
    preview: (text: string, voiceURI?: string | null) => {
      stop();
      enqueueChunks(text, { voiceURI, messageId: null });
    },
  };
}

const store = createStore();

export function useTTS() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );

  useEffect(() => {
    if (!hasSpeechSynthesis()) {
      store.setVoices([]);
      return;
    }

    const synth = window.speechSynthesis;
    const updateVoices = () => {
      store.setVoices(synth.getVoices());
    };

    updateVoices();
    synth.addEventListener("voiceschanged", updateVoices);
    return () => synth.removeEventListener("voiceschanged", updateVoices);
  }, []);

  const speak = useCallback((text: string, options?: SpeakOptions) => {
    store.speak(text, options);
  }, []);

  const enqueue = useCallback((text: string, options?: SpeakOptions) => {
    store.enqueue(text, options);
  }, []);

  const stop = useCallback(() => {
    store.stop();
  }, []);

  const preview = useCallback((text: string, voiceURI?: string | null) => {
    store.preview(text, voiceURI);
  }, []);

  const toggleEnabled = useCallback(() => {
    store.toggleEnabled();
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    store.setEnabled(enabled);
  }, []);

  const setVoiceURI = useCallback((uri: string | null) => {
    store.setVoiceURI(uri);
  }, []);

  return {
    enabled: state.enabled,
    isSpeaking: state.isSpeaking,
    voices: state.voices,
    voiceURI: state.voiceURI,
    activeMessageId: state.activeMessageId,
    supported: state.supported,
    setEnabled,
    setVoiceURI,
    speak,
    enqueue,
    stop,
    preview,
    toggleEnabled,
  };
}
