"use client";

import { useState, useCallback, useRef } from "react";
import type { LearningResources } from "@//types/student";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  BookOpen,
  FileText,
  Video,
  Wrench,
  Loader2,
  GraduationCap,
  ExternalLink,
} from "lucide-react";

/** 从 URL 中提取工具名称，如 https://leetcode.cn → LeetCode */
function extractNameFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const domain = hostname.split(".")[0];
    // capitalize first letter of each word part
    return domain
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  } catch {
    return "";
  }
}

interface LearningResourcesProps {
  career: string;
  skills: string;
  resources: LearningResources | null;
  onResourcesLoaded: (resources: LearningResources) => void;
  isLoading: boolean;
  onSetLoading: (loading: boolean) => void;
}

function parseJSON(text: string): LearningResources | null {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return parsed.resources as LearningResources;
  } catch {
    return null;
  }
}

const difficultyColor: Record<string, string> = {
  入门: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  进阶: "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  高级: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300",
};

export function LearningResourcesView({
  career,
  skills,
  resources,
  onResourcesLoaded,
  isLoading,
  onSetLoading,
}: LearningResourcesProps) {
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const generateResources = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    onSetLoading(true);
    setRawText("");
    setError(null);

    try {
      const response = await fetch("/api/career/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ career, skills }),
      });

      if (!response.ok) throw new Error("请求失败");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data) as { content?: string; error?: string };
              if (parsed.error) {
                setError(parsed.error);
                continue;
              }
              if (parsed.content) {
                fullText += parsed.content;
                setRawText(fullText);
              }
            } catch {
              // skip
            }
          }
        }
      }

      const result = parseJSON(fullText);
      if (result) {
        onResourcesLoaded(result);
      } else {
        setError("AI 返回的数据格式异常，请重试");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成学习资源失败");
    } finally {
      fetchingRef.current = false;
      onSetLoading(false);
    }
  }, [career, skills, onResourcesLoaded, onSetLoading]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
              AI 正在整理学习资源...
            </CardTitle>
            <CardDescription>
              为「{career}」方向精选书籍、文章、视频和工具
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rawText ? (
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-sm text-slate-600 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                {rawText}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                <Spinner className="w-5 h-5" />
                <span>正在搜索优质学习资源...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!resources) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <Card>
          <CardHeader>
            <CardTitle>获取「{career}」学习资源</CardTitle>
            <CardDescription>
              AI 将为你精选书籍、文章、视频和开发工具
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}
            <Button
              onClick={generateResources}
              size="lg"
              className="bg-amber-600 hover:bg-amber-700 text-white px-8 gap-2"
            >
              <GraduationCap className="w-4 h-4" />
              获取学习资源
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          学习资源推荐
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          为「{career}」方向精心推荐的学习材料
        </p>
      </div>

      <Tabs defaultValue="books" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="books" className="gap-1.5">
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">书籍</span>
          </TabsTrigger>
          <TabsTrigger value="articles" className="gap-1.5">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">文章</span>
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5">
            <Video className="w-4 h-4" />
            <span className="hidden sm:inline">视频</span>
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">工具</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="books" className="mt-4 space-y-3">
          {resources.books.map((book, i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                      {book.title}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {book.author}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                      {book.description}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1.5">
                    <Badge
                      className={
                        difficultyColor[book.difficulty] || "bg-slate-100"
                      }
                    >
                      {book.difficulty}
                    </Badge>
                    <Badge variant="outline">{book.category}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="articles" className="mt-4 space-y-3">
          {resources.articles.map((article, i) => {
            const articleUrl = `https://www.bing.com/search?q=${encodeURIComponent(article.source + ' ' + article.title)}`;
            return (
              <Card key={i} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 truncate">
                          {article.title}
                        </h3>
                        <a
                          href={articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>搜索</span>
                        </a>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        来源：{article.source}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                        {article.description}
                      </p>
                    </div>
                    <Badge
                      className={
                        difficultyColor[article.difficulty] || "bg-slate-100"
                      }
                    >
                      {article.difficulty}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="videos" className="mt-4 space-y-3">
          {resources.videos.map((video, i) => {
            const videoUrl = `https://search.bilibili.com/all?keyword=${encodeURIComponent(video.title)}`;
            return (
              <Card key={i} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 truncate">
                          {video.title}
                        </h3>
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>B站搜索</span>
                        </a>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        平台：B站
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                        {video.description}
                      </p>
                    </div>
                    <Badge
                      className={
                        difficultyColor[video.difficulty] || "bg-slate-100"
                      }
                    >
                      {video.difficulty}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="tools" className="mt-4 space-y-3">
          {resources.tools.map((tool, i) => {
            const toolUrl =
              tool.url || `https://www.google.com/search?q=${encodeURIComponent(tool.name + ' 官网')}`;
            return (
              <Card key={i} className="group hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                          {tool.name || extractNameFromUrl(tool.url) || "工具"}
                        </h3>
                        <a
                          href={toolUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>官网</span>
                        </a>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                        {tool.description}
                      </p>
                    </div>
                    <Badge variant="outline">{tool.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={generateResources}
          disabled={isLoading}
        >
          重新获取资源
        </Button>
      </div>
    </div>
  );
}
