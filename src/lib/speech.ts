/**
 * Web Speech API 封装
 * 浏览器原生语音识别和语音合成，零依赖
 */

export const SENTENCE_BOUNDARY = /[。！？!?]|[.](?=\s|$)/;

export function normalizeSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " 代码片段。")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[>#*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSpeechText(text: string, maxLength = 180): string[] {
  const normalized = normalizeSpeechText(text);
  if (!normalized) return [];

  const sentences =
    normalized.match(/[^。！？!?.]+[。！？!?.]?/g)?.map((item) => item.trim()) ??
    [normalized];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!sentence) continue;

    if (sentence.length > maxLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < sentence.length; i += maxLength) {
        chunks.push(sentence.slice(i, i + maxLength));
      }
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  /**
   * 开始语音识别，返回识别结果的 Promise
   * @param lang 语言代码 'zh-CN' | 'en-US'
   * @param onInterim 可选回调，实时返回中间识别结果
   */
  startRecognition(
    lang: "zh-CN" | "en-US" = "zh-CN",
    onInterim?: (text: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const SpeechRecognitionAPI =
        window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        reject(new Error("浏览器不支持语音识别"));
        return;
      }

      this.recognition = new SpeechRecognitionAPI();
      this.recognition.lang = lang;
      this.recognition.interimResults = !!onInterim;
      this.recognition.maxAlternatives = 1;
      this.recognition.continuous = false;

      let settled = false;
      let accumulatedFinal = "";

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";

          if (result.isFinal) {
            accumulatedFinal += transcript;
          } else {
            interim += transcript;
          }
        }

        if (onInterim && interim) {
          onInterim(interim);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (settled) return;
        settled = true;
        reject(new Error(`语音识别错误: ${event.error}`));
      };

      this.recognition.onend = () => {
        if (settled) return;
        settled = true;
        resolve(accumulatedFinal);
      };

      this.recognition.start();
    });
  }

  /**
   * 停止语音识别
   */
  stopRecognition(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  /**
   * 文字转语音
   * @param text 要朗读的文字
   * @param lang 语言代码
   */
  speak(text: string, lang: "zh-CN" | "en-US" = "zh-CN"): void {
    // 取消当前正在播放的语音
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // 尝试选择中文语音
    const voices = this.synth.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith("zh") || v.lang.startsWith("en")
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    this.synth.speak(utterance);
  }

  /**
   * 检查浏览器是否支持语音识别
   */
  static isRecognitionSupported(): boolean {
    return !!(
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }
}

// 浏览器 Speech API 类型扩展
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}
