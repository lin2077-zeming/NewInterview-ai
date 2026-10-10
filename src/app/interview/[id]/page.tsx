"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ChatPanel, MarkdownMessage, type ChatPanelHandle } from "@/components/interview/ChatPanel";
import { StageIndicator } from "@/components/interview/StageIndicator";
import { InterviewControls } from "@/components/interview/InterviewControls";
import { CodeEditor } from "@/components/interview/CodeEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { COMPANY_FLOWS } from "@/config/interview-stages";
import { loadInterviewContext } from "@/lib/interview-context";
import { AlertTriangle, Clock, Code2, ListChecks, Loader2, MessageSquare, Mic, MicOff, Send } from "lucide-react";
import type { CompanyFlow, InterviewConfig, InterviewMode } from "@/types";
import { TTSControls, MessageSpeakButton } from "@/components/interview/TTSControls";
import { useInterviewTTS } from "@/hooks/useInterviewTTS";

type MobilePanel = "chat" | "code" | "progress";
const INIT_TRIGGER = "__INTERVIEW_START__";

export default function InterviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const interviewId = params.id as string;
  const [interviewContext] = useState(() => loadInterviewContext(interviewId));

  const [mode, setMode] = useState<InterviewMode>(
    (searchParams.get("mode") as InterviewMode) || "normal"
  );
  const company = searchParams.get("company") || "bytedance";
  const role = searchParams.get("role") || "后端开发工程师";
  const [stressMode, setStressMode] = useState(
    searchParams.get("stress") === "true"
  );
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingExitHref, setPendingExitHref] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<"manual" | "timeout">("manual");
  const [activeMobilePanel, setActiveMobilePanel] = useState<MobilePanel>("chat");
  const chatPanelRef = useRef<ChatPanelHandle>(null);
  const allowExitRef = useRef(false);
  const exitWasBackRef = useRef(false);
  const exitGuardKeyRef = useRef<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const flow = COMPANY_FLOWS[company] ?? COMPANY_FLOWS.bytedance;
  const requestedStageIndex = Number(searchParams.get("stage") ?? 0);
  const currentStageIndex = Number.isFinite(requestedStageIndex)
    ? Math.min(Math.max(requestedStageIndex, 0), flow.stages.length - 1)
    : 0;
  const currentStage = flow.stages[currentStageIndex];
  const codeEditorVisible = currentStage?.id === "algorithm";
  const stageDurationSeconds = (currentStage?.duration ?? 45) * 60;

  const handleCodeSubmit = useCallback((code: string, language: string) => {
    chatPanelRef.current?.sendMessage(
      `我的代码（${language}）：\n\`\`\`${language}\n${code}\n\`\`\``
    );
    setActiveMobilePanel("chat");
  }, []);

  const handleEndInterview = useCallback(() => {
    setEndReason("manual");
    setShowEndDialog(true);
  }, []);

  const handleTimerExpire = useCallback(() => {
    setEndReason("timeout");
    setShowEndDialog(true);
  }, []);

  const cancelExit = useCallback(() => {
    setShowExitDialog(false);
    setPendingExitHref(null);
    if (exitWasBackRef.current) {
      window.history.pushState(
        { interviewExitGuard: exitGuardKeyRef.current },
        "",
        window.location.href
      );
    }
    exitWasBackRef.current = false;
  }, []);

  const confirmExit = useCallback(() => {
    allowExitRef.current = true;
    setShowExitDialog(false);

    if (pendingExitHref) {
      router.push(pendingExitHref);
      return;
    }

    const exitFromUrl = window.location.href;
    let attempts = 0;
    const maxAttempts = 6;

    window.history.back();

    const skipSamePageGuards = window.setInterval(() => {
      if (window.location.href !== exitFromUrl) {
        window.clearInterval(skipSamePageGuards);
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        window.clearInterval(skipSamePageGuards);
        router.push("/");
        return;
      }

      window.history.back();
    }, 120);
  }, [pendingExitHref, router]);

  const confirmEndInterview = useCallback(() => {
    allowExitRef.current = true;
    setShowEndDialog(false);
    const reviewParams = new URLSearchParams({
      mode,
      role,
      company,
      stage: String(currentStageIndex),
      stageId: flow.stages[currentStageIndex]?.id ?? "",
    });
    router.push(`/interview/review/${interviewId}?${reviewParams.toString()}`);
  }, [interviewId, mode, role, company, currentStageIndex, flow.stages, router]);

  const handleToggleMode = useCallback(() => {
    setMode((current) => (current === "normal" ? "reversed" : "normal"));
  }, []);

  const handleToggleStress = useCallback(() => {
    setStressMode((prev) => !prev);
  }, []);

  useEffect(() => {
    const guardKey = `interview-exit:${interviewId}:${window.location.pathname}${window.location.search}`;
    exitGuardKeyRef.current = guardKey;

    if (window.history.state?.interviewExitGuard !== guardKey) {
      window.history.replaceState(
        { ...(window.history.state ?? {}), interviewExitBase: guardKey },
        "",
        window.location.href
      );
      window.history.pushState(
        { interviewExitGuard: guardKey },
        "",
        window.location.href
      );
    }

    const handlePopState = () => {
      if (allowExitRef.current) return;
      exitWasBackRef.current = true;
      setPendingExitHref(null);
      setShowExitDialog(true);
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (allowExitRef.current) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      event.preventDefault();
      exitWasBackRef.current = false;
      setPendingExitHref(`${url.pathname}${url.search}${url.hash}`);
      setShowExitDialog(true);
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExitRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [interviewId]);

  const config: InterviewConfig & { currentStage: number } = useMemo(
    () => ({
      role,
      company,
      mode,
      stressMode,
      currentStage: currentStageIndex,
      stageIndex: currentStageIndex,
      candidateProfileSummary: interviewContext?.candidateProfileSummary,
      resumeSummary: interviewContext?.resumeSummary,
    }),
    [
      role,
      company,
      mode,
      stressMode,
      currentStageIndex,
      interviewContext?.candidateProfileSummary,
      interviewContext?.resumeSummary,
    ]
  );

  if (isDesktop === null) {
    return (
      <div className="flex h-[calc(100dvh-3.5rem)] items-center justify-center text-sm text-muted-foreground">
        正在准备面试工作台...
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <MobileInterviewWorkspace
        flow={flow}
        role={role}
        mode={mode}
        stressMode={stressMode}
        currentStageIndex={currentStageIndex}
        currentStageName={currentStage?.name ?? "当前模块"}
        codeEditorVisible={codeEditorVisible}
        activePanel={activeMobilePanel}
        onActivePanelChange={setActiveMobilePanel}
        interviewId={interviewId}
        config={config}
        chatPanelRef={chatPanelRef}
        durationSeconds={stageDurationSeconds}
        timerPaused={showEndDialog}
        onTimerExpire={handleTimerExpire}
        onToggleMode={handleToggleMode}
        onToggleStress={handleToggleStress}
        onEndInterview={handleEndInterview}
        showEndDialog={showEndDialog}
        setShowEndDialog={setShowEndDialog}
        showExitDialog={showExitDialog}
        setShowExitDialog={setShowExitDialog}
        endReason={endReason}
        confirmEndInterview={confirmEndInterview}
        cancelExit={cancelExit}
        confirmExit={confirmExit}
        allowExitRef={allowExitRef}
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <aside className="w-64 shrink-0 border-r p-4 overflow-y-auto">
        <StageIndicator flow={flow} currentStage={currentStageIndex} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-4 py-2 flex items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">
              {flow.name} · {role}
            </span>
            <Badge variant={stressMode ? "destructive" : "outline"} className="text-xs">
              {stressMode ? "压力面" : "普通模式"}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {mode === "reversed" ? "面试官视角" : "候选人视角"}
            </Badge>
            {interviewContext?.candidateProfileSummary ? (
              <Badge variant="outline" className="text-xs">
                已接入个人信息
              </Badge>
            ) : null}
            {interviewContext?.resumeSummary ? (
              <Badge variant="outline" className="text-xs">
                已接入简历
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <CountdownTimer
              durationSeconds={stageDurationSeconds}
              paused={showEndDialog}
              onExpire={handleTimerExpire}
            />
            <div className="text-sm text-muted-foreground">
              当前模块 · {currentStage?.name}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden" key={`${mode}-${stressMode}-${currentStageIndex}`}>
          <ChatPanel
            ref={chatPanelRef}
            interviewId={interviewId}
            config={config}
            mode={mode}
          />
        </div>

        <div className="border-t px-4 py-2 shrink-0">
          <InterviewControls
            mode={mode}
            stressMode={stressMode}
            onToggleMode={handleToggleMode}
            onToggleStress={handleToggleStress}
            onEndInterview={handleEndInterview}
          />
        </div>
      </div>

      {codeEditorVisible && (
        <aside className="w-96 shrink-0 border-l">
          <CodeEditor
            visible={true}
            onLanguageChange={() => {}}
            onSubmit={handleCodeSubmit}
          />
        </aside>
      )}

      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {endReason === "timeout" ? "本轮时间已到" : "确认结束面试？"}
            </DialogTitle>
            <DialogDescription>
              {endReason === "timeout"
                ? "当前模块倒计时已结束，可以进入复盘报告。"
                : "结束后将无法继续本次面试，系统会为你生成复盘报告。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndDialog(false)}>
              继续面试
            </Button>
            <Button onClick={confirmEndInterview}>
              结束并查看复盘
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitDialog} onOpenChange={(open) => {
        if (open) {
          setShowExitDialog(true);
          return;
        }

        if (allowExitRef.current) {
          setShowExitDialog(false);
          return;
        }

        cancelExit();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认离开当前面试？</DialogTitle>
            <DialogDescription>
              当前面试还在进行中，离开后本页对话可能无法继续。确认要退出吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelExit}>
              继续面试
            </Button>
            <Button variant="destructive" onClick={confirmExit}>
              确认离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MobileInterviewWorkspace({
  flow,
  role,
  mode,
  stressMode,
  currentStageIndex,
  currentStageName,
  codeEditorVisible,
  activePanel,
  onActivePanelChange,
  interviewId,
  config,
  chatPanelRef,
  durationSeconds,
  timerPaused,
  onTimerExpire,
  onToggleMode,
  onToggleStress,
  onEndInterview,
  showEndDialog,
  setShowEndDialog,
  showExitDialog,
  setShowExitDialog,
  endReason,
  confirmEndInterview,
  cancelExit,
  confirmExit,
  allowExitRef,
}: {
  flow: CompanyFlow;
  role: string;
  mode: InterviewMode;
  stressMode: boolean;
  currentStageIndex: number;
  currentStageName: string;
  codeEditorVisible: boolean;
  activePanel: MobilePanel;
  onActivePanelChange: (panel: MobilePanel) => void;
  interviewId: string;
  config: InterviewConfig & { currentStage: number };
  chatPanelRef: React.RefObject<ChatPanelHandle | null>;
  durationSeconds: number;
  timerPaused: boolean;
  onTimerExpire: () => void;
  onToggleMode: () => void;
  onToggleStress: () => void;
  onEndInterview: () => void;
  showEndDialog: boolean;
  setShowEndDialog: (open: boolean) => void;
  showExitDialog: boolean;
  setShowExitDialog: (open: boolean) => void;
  endReason: "manual" | "timeout";
  confirmEndInterview: () => void;
  cancelExit: () => void;
  confirmExit: () => void;
  allowExitRef: React.RefObject<boolean>;
}) {
  const visiblePanel =
    activePanel === "code" && !codeEditorVisible ? "chat" : activePanel;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full max-w-full touch-pan-y flex-col overflow-hidden bg-background">
      <div className="shrink-0 border-b px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {flow.name} · {role}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {currentStageName} · {mode === "reversed" ? "面试官视角" : "候选人视角"} · {stressMode ? "压力面" : "普通"}
            </p>
          </div>
          <CountdownTimer
            durationSeconds={durationSeconds}
            paused={timerPaused}
            onExpire={onTimerExpire}
          />
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1 border-b bg-muted/25 p-1.5">
        <MobileTab
          active={visiblePanel === "chat"}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          label="对话"
          onClick={() => onActivePanelChange("chat")}
        />
        <MobileTab
          active={visiblePanel === "code"}
          disabled={!codeEditorVisible}
          icon={<Code2 className="h-3.5 w-3.5" />}
          label="代码"
          onClick={() => onActivePanelChange("code")}
        />
        <MobileTab
          active={visiblePanel === "progress"}
          icon={<ListChecks className="h-3.5 w-3.5" />}
          label="进度"
          onClick={() => onActivePanelChange("progress")}
        />
        {visiblePanel === "chat" && (
          <div className="col-span-3 flex justify-end border-t pt-1">
            <TTSControls variant="mobile" />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className={mobilePanelClass(visiblePanel === "chat")}>
          <MobileChatPanel
            ref={chatPanelRef}
            interviewId={interviewId}
            config={config}
            mode={mode}
          />
        </div>
        {codeEditorVisible ? (
          <div className={mobilePanelClass(visiblePanel === "code")}>
            <MobileCodePanel
              onSubmit={(code, language) => {
                chatPanelRef.current?.sendMessage(
                  `我的代码（${language}）：\n\`\`\`${language}\n${code}\n\`\`\``
                );
                onActivePanelChange("chat");
              }}
            />
          </div>
        ) : null}
        <div className={mobilePanelClass(visiblePanel === "progress")}>
          <div className="h-full overflow-y-auto p-3">
            <MobileProgress flow={flow} currentStageIndex={currentStageIndex} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t bg-background p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2">
          <MobileActionButton onClick={onToggleMode}>
            {mode === "normal" ? "面试官" : "候选人"}
          </MobileActionButton>
          <MobileActionButton active={stressMode} onClick={onToggleStress}>
            压力面
          </MobileActionButton>
          <MobileActionButton danger onClick={onEndInterview}>
            结束
          </MobileActionButton>
        </div>
      </div>

      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {endReason === "timeout" ? "本轮时间已到" : "确认结束面试？"}
            </DialogTitle>
            <DialogDescription>
              {endReason === "timeout"
                ? "当前模块倒计时已结束，可以进入复盘报告。"
                : "结束后将无法继续本次面试，系统会为你生成复盘报告。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
              onClick={() => setShowEndDialog(false)}
            >
              继续面试
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
              onClick={confirmEndInterview}
            >
              结束并查看复盘
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitDialog} onOpenChange={(open) => {
        if (open) {
          setShowExitDialog(true);
          return;
        }

        if (allowExitRef.current) {
          setShowExitDialog(false);
          return;
        }

        cancelExit();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认离开当前面试？</DialogTitle>
            <DialogDescription>
              当前面试还在进行中，离开后本页对话可能无法继续。确认要退出吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium"
              onClick={cancelExit}
            >
              继续面试
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive/10 px-3 text-sm font-medium text-destructive"
              onClick={confirmExit}
            >
              确认离开
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mobilePanelClass(active: boolean) {
  return `h-full min-h-0 ${active ? "block" : "hidden"}`;
}

function MobileTab({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-9 select-none items-center justify-center gap-1.5 rounded-md text-xs font-medium touch-manipulation disabled:pointer-events-none disabled:opacity-40 ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

const MobileChatPanel = forwardRef<ChatPanelHandle, {
  interviewId: string;
  config: InterviewConfig & { currentStage?: number };
  mode: "normal" | "reversed";
}>(function MobileChatPanel({ interviewId, config, mode }, ref) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { interviewId, config, mode },
      }),
    [interviewId, config, mode]
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const autoTriggered = useRef(false);

  useImperativeHandle(ref, () => ({
    sendMessage: (text: string) => {
      sendMessage({ text });
    },
  }), [sendMessage]);

  useEffect(() => {
    if (
      mode === "normal" &&
      !autoTriggered.current &&
      status === "ready" &&
      messages.length === 0
    ) {
      autoTriggered.current = true;
      sendMessage({ text: INIT_TRIGGER });
    }
  }, [mode, status, messages.length, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceWarning, setVoiceWarning] = useState("");
  const speechRef = useRef<InstanceType<typeof import("@/lib/speech").SpeechService> | null>(null);
  const tts = useInterviewTTS({
    messages,
    status,
    getMessageText: getMobileMessageText,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const visibleMessages = messages.filter((msg) => getMobileMessageText(msg) !== INIT_TRIGGER);

  const submit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    sendMessage({ text });
    setInput("");
  };

  const handleVoiceToggle = async () => {
    if (listening) {
      speechRef.current?.stopRecognition();
      setListening(false);
      setInterimText("");
      return;
    }

    try {
      const { SpeechService } = await import("@/lib/speech");
      if (!SpeechService.isRecognitionSupported()) {
        setVoiceWarning("语音识别需要 HTTPS 环境，当前浏览器不支持");
        setTimeout(() => setVoiceWarning(""), 4000);
        return;
      }

      speechRef.current = new SpeechService();
      setListening(true);
      setVoiceWarning("");
      setInterimText("");

      const text = await speechRef.current.startRecognition(
        "zh-CN",
        (interim) => setInterimText(interim)
      );

      if (text) {
        sendMessage({ text });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "未知错误";
      let hint: string;
      if (msg.includes("no-speech")) {
        hint = "没听到声音，请靠近麦克风说话后重试";
      } else if (msg.includes("network") || msg.includes("网络")) {
        hint = "语音识别失败：网络问题，部署到服务器后可稳定使用";
      } else if (msg.includes("not-allowed") || msg.includes("aborted")) {
        hint = "麦克风权限被拒绝或语音识别被中断，请检查浏览器设置";
      } else if (msg.includes("浏览器不支持")) {
        hint = "当前浏览器不支持语音识别，请使用 Chrome 或 Edge";
      } else {
        hint = `语音识别失败：${msg}`;
      }
      setVoiceWarning(hint);
      setTimeout(() => setVoiceWarning(""), 6000);
    } finally {
      setListening(false);
      setInterimText("");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
        {error ? (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            AI 服务连接失败，请检查模型配置、网络或 API Key
          </div>
        ) : null}
        {visibleMessages.length === 0 && !error ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 面试官正在准备题目...
              </span>
            ) : mode === "normal" ? (
              "面试即将开始，AI 面试官会先向你提问..."
            ) : (
              "你是面试官，请开始向 AI 候选人提问..."
            )}
          </div>
        ) : null}
        {visibleMessages.map((msg, idx) => {
          const isInterviewerMsg =
            mode === "reversed" ? msg.role === "user" : msg.role === "assistant";
          const isLastMsg = idx === visibleMessages.length - 1;
          return (
            <MobileMessageBubble
              key={msg.id}
              role={msg.role}
              content={getMobileMessageText(msg)}
              mode={mode}
              showSpeakButton={tts.canShowSpeakButton(msg, isLastMsg)}
              isInterviewer={isInterviewerMsg}
              isSpeaking={tts.isMessageSpeaking(msg.id)}
              onSpeak={() => tts.speakMessage(msg)}
            />
          );
        })}
        {isLoading && visibleMessages.length > 0 ? (
          <div className="flex items-center gap-2 pl-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            AI 思考中...
          </div>
        ) : null}
        <div ref={messagesEndRef} />
      </div>
      <div className="border-t bg-background p-3">
        {listening && interimText && (
          <div className="px-1 py-1 text-center text-xs italic text-primary">
            正在识别：{interimText}
          </div>
        )}
        <form className="flex gap-2" onSubmit={submit}>
          <textarea
            id="mobile-chat-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              listening
                ? interimText || "正在聆听..."
                : mode === "normal" ? "输入你的回答..." : "向 AI 候选人提问..."
            }
            rows={1}
            disabled={isLoading}
            enterKeyHint="send"
            autoComplete="off"
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <button
            type="button"
            data-testid="voice-input-toggle"
            disabled={isLoading && !listening}
            onClick={handleVoiceToggle}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg border touch-manipulation disabled:pointer-events-none disabled:opacity-50 ${
              listening
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background touch-manipulation disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        {voiceWarning && (
          <div className="px-1 pt-1.5 text-center text-xs text-destructive">
            {voiceWarning}
          </div>
        )}
      </div>
    </div>
  );
});

function MobileMessageBubble({
  role,
  content,
  mode,
  showSpeakButton,
  isSpeaking,
  onSpeak,
  isInterviewer,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  mode: "normal" | "reversed";
  showSpeakButton?: boolean;
  isSpeaking?: boolean;
  onSpeak?: () => void;
  isInterviewer?: boolean;
}) {
  if (role === "system" || !content) return null;
  const computedIsInterviewer =
    isInterviewer ?? (mode === "reversed" ? role === "user" : role === "assistant");

  return (
    <div className={`flex flex-col ${computedIsInterviewer ? "items-start" : "items-end"}`}>
      <div
        className={`max-w-[92%] overflow-hidden break-words rounded-lg border p-3 text-sm leading-6 ${
          computedIsInterviewer ? "bg-muted/50" : "border-primary/20 bg-primary/5"
        }`}
      >
        <MarkdownMessage content={content} />
      </div>
      {showSpeakButton && (
        <div className="mt-1 flex items-center gap-1 px-1">
          <MessageSpeakButton
            isCurrentlySpeaking={!!isSpeaking}
            onClick={onSpeak ?? (() => {})}
          />
          <span className="text-[10px] text-muted-foreground">
            {isSpeaking ? "朗读中" : "朗读"}
          </span>
        </div>
      )}
    </div>
  );
}

function MobileCodePanel({
  onSubmit,
}: {
  onSubmit: (code: string, language: string) => void;
}) {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const languages = ["javascript", "typescript", "python", "java", "go", "cpp"];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-medium">代码输入</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
        >
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-background p-3 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        placeholder="在手机上可以输入代码、伪代码或核心思路..."
      />
      <div className="shrink-0 border-t p-3">
        <button
          type="button"
          disabled={!code.trim()}
          onClick={() => onSubmit(code, language)}
          className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground touch-manipulation disabled:pointer-events-none disabled:opacity-50"
        >
          提交代码
        </button>
      </div>
    </div>
  );
}

function MobileProgress({
  flow,
  currentStageIndex,
}: {
  flow: CompanyFlow;
  currentStageIndex: number;
}) {
  return (
    <div className="space-y-2">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
        {flow.name} 面试模块
      </h2>
      {flow.stages.map((stage, index) => {
        const selected = index === currentStageIndex;
        return (
          <div
            key={`${stage.id}-${index}`}
            className={`rounded-lg border p-3 ${
              selected ? "border-primary bg-primary/5" : "border-border bg-background"
            }`}
          >
            <p className="text-sm font-semibold">{stage.name}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {stage.focus} · {stage.duration} 分钟
            </p>
            {selected ? <p className="mt-1 text-xs font-medium text-primary">本次面试</p> : null}
          </div>
        );
      })}
    </div>
  );
}

function MobileActionButton({
  children,
  active,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 select-none rounded-lg text-xs font-medium touch-manipulation ${
        danger
          ? "bg-destructive/10 text-destructive"
          : active
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-background"
      }`}
    >
      {children}
    </button>
  );
}

function getMobileMessageText(message: UIMessage): string {
  const parts = message.parts as Array<{ type: string; text?: string; delta?: string }>;
  return parts
    .filter((part) => part.type === "text" || part.type === "text-delta")
    .map((part) => part.text ?? part.delta ?? "")
    .join("");
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const update = () => setMatches(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function CountdownTimer({
  durationSeconds,
  paused,
  onExpire,
}: {
  durationSeconds: number;
  paused: boolean;
  onExpire: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [notice, setNotice] = useState<string | null>(null);
  const remainingRef = useRef(durationSeconds);
  const expiredRef = useRef(false);
  const fiveMinuteNotifiedRef = useRef(false);
  const oneMinuteNotifiedRef = useRef(false);

  useEffect(() => {
    if (paused || expiredRef.current) return;

    const timer = window.setInterval(() => {
      remainingRef.current = Math.max(remainingRef.current - 1, 0);
      setTimeLeft(remainingRef.current);

      if (remainingRef.current <= 60 && !oneMinuteNotifiedRef.current) {
        oneMinuteNotifiedRef.current = true;
        setNotice("最后 1 分钟");
      } else if (
        remainingRef.current <= 300 &&
        !fiveMinuteNotifiedRef.current
      ) {
        fiveMinuteNotifiedRef.current = true;
        setNotice("剩余 5 分钟");
      }

      if (remainingRef.current === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [onExpire, paused]);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-sm font-semibold text-destructive shadow-sm">
        <Clock className="h-4 w-4" />
        <span className="tabular-nums">{formatTime(timeLeft)}</span>
      </div>
      {notice && (
        <div className="flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          {notice}
        </div>
      )}
    </div>
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function Badge({
  children,
  variant = "outline",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary";
  className?: string;
}) {
  const variants = {
    default: "bg-primary text-primary-foreground",
    destructive: "bg-destructive/10 text-destructive",
    outline: "border text-muted-foreground",
    secondary: "bg-secondary text-secondary-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className || ""}`}
    >
      {children}
    </span>
  );
}
