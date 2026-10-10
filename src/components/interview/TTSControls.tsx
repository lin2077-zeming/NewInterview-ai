"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, ChevronDown, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTTS } from "@/hooks/useTTS";

type TTSControlsVariant = "desktop" | "mobile";

interface TTSControlsProps {
  variant?: TTSControlsVariant;
}

export function TTSControls({ variant = "desktop" }: TTSControlsProps) {
  const {
    enabled,
    voiceURI,
    isSpeaking,
    voices,
    supported,
    toggleEnabled,
    setVoiceURI,
    preview,
  } = useTTS();
  const [showVoices, setShowVoices] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showVoices) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowVoices(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showVoices]);

  const isMobile = variant === "mobile";

  const currentVoiceLabel = (() => {
    if (!supported) return "不支持";
    if (voiceURI) {
      const v = voices.find((x) => x.voiceURI === voiceURI);
      if (v) return v.name.replace(/.*Microsoft\s*/i, "").replace(/\s*\(.*\)/, "").split(" ")[0];
    }
    return "默认";
  })();

  const handlePreview = (text: string, vURI?: string) => {
    preview(text, vURI);
  };

  return (
    <div
      className="relative flex items-center gap-1"
      data-testid={`tts-controls-${variant}`}
      ref={dropdownRef}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleEnabled}
        disabled={!supported}
        data-testid="tts-toggle"
        className={cn(
          "gap-1.5 touch-manipulation",
          isMobile ? "h-8 px-2 text-xs" : "h-7 px-2 text-xs",
          enabled && "text-primary",
          enabled && isSpeaking && "text-primary speaking-pulse"
        )}
        title={!supported ? "当前浏览器不支持朗读" : enabled ? "关闭 AI 朗读" : "开启 AI 朗读"}
        type="button"
      >
        {enabled ? (
          <Volume2 className={cn("h-3.5 w-3.5", isMobile && "h-3 w-3")} />
        ) : (
          <VolumeX className={cn("h-3.5 w-3.5", isMobile && "h-3 w-3")} />
        )}
        {!isMobile && (
          <span className="max-w-[3rem] truncate">
            {!supported ? "不支持" : enabled ? (isSpeaking ? "朗读中" : "开启") : "关闭"}
          </span>
        )}
      </Button>

      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowVoices((v) => !v)}
          disabled={!supported}
          data-testid="tts-voice-select"
          className={cn(
            "gap-1 bg-background touch-manipulation",
            isMobile ? "h-8 px-2 text-xs" : "h-7 px-2 text-xs"
          )}
          title="选择声音"
          type="button"
        >
          <span className="max-w-[5rem] truncate">{currentVoiceLabel}</span>
          <ChevronDown className={cn("h-3 w-3", isMobile && "h-2.5 w-2.5")} />
        </Button>

        {showVoices && (
          <>
            <div
              className="fixed inset-0 z-[199] bg-transparent"
              onClick={() => setShowVoices(false)}
            />
            <div
              className={cn(
                "rounded-xl border bg-popover p-2 text-popover-foreground shadow-2xl",
                isMobile
                  ? "fixed left-1/2 top-1/2 z-[200] max-h-[70vh] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2"
                  : "absolute right-0 top-full z-[200] mt-1 min-w-[14rem] max-h-[60vh] overflow-hidden"
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 mb-2 text-[11px]">
                <span className="font-medium text-muted-foreground">选择声音</span>
                <button
                  onClick={() => setShowVoices(false)}
                  className="rounded p-0.5 hover:bg-muted"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div
                className={cn(
                  "overflow-y-auto",
                  isMobile ? "max-h-[50vh] p-1" : "max-h-[50vh]"
                )}
              >
                {voices.length === 0 && (
                  <div className="px-2 py-2 text-xs text-muted-foreground">
                    当前浏览器暂未返回可选声音，将使用系统默认声音。
                  </div>
                )}
                <div
                  className={cn(
                    "flex w-full items-center gap-1 rounded-md hover:bg-accent",
                    !voiceURI && "bg-accent/60"
                  )}
                >
                  <button
                    onClick={() => {
                      setVoiceURI(null);
                      setShowVoices(false);
                    }}
                    className="flex flex-1 items-center gap-2 px-2 py-1.5 text-xs"
                    type="button"
                  >
                    <span className={cn("flex-1 text-left", !voiceURI && "font-medium")}>
                      默认
                    </span>
                  </button>
                  <button
                    onClick={() => handlePreview("这是一段试听语音。")}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    title="试听"
                    data-testid="tts-preview-default"
                    type="button"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                </div>
                {voices.map((v) => (
                  <div
                    key={v.voiceURI}
                    className={cn(
                      "flex w-full items-center gap-1 rounded-md hover:bg-accent",
                      voiceURI === v.voiceURI && "bg-accent/60"
                    )}
                  >
                    <button
                      onClick={() => {
                        setVoiceURI(v.voiceURI);
                        setShowVoices(false);
                      }}
                      className="flex flex-1 items-center gap-2 px-2 py-1.5 text-xs"
                      type="button"
                    >
                      <span
                        className={cn(
                          "flex-1 truncate text-left",
                          voiceURI === v.voiceURI && "font-medium"
                        )}
                      >
                        {v.name}
                      </span>
                    </button>
                    <button
                      onClick={() => handlePreview("这是一段试听语音。", v.voiceURI)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                      title="试听"
                      data-testid="tts-preview-voice"
                      type="button"
                    >
                      <Play className="h-3 w-3 shrink-0" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface MessageSpeakButtonProps {
  isCurrentlySpeaking: boolean;
  onClick: () => void;
}

export function MessageSpeakButton({
  isCurrentlySpeaking,
  onClick,
}: MessageSpeakButtonProps) {
  return (
    <button
      onClick={onClick}
      data-testid="message-speak-button"
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation",
        isCurrentlySpeaking && "text-primary speaking-pulse"
      )}
      title={isCurrentlySpeaking ? "停止朗读" : "朗读此消息"}
      type="button"
    >
      <Volume2 className="h-3 w-3" />
    </button>
  );
}
