import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, BarChart3, RefreshCw, Briefcase, GraduationCap, MessageSquare, FileSearch } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative min-h-[calc(100dvh-3.5rem)] flex flex-col items-center justify-center text-center px-4 overflow-hidden">
        <div className="hero-glow" />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
            <span className="gradient-text">你的 AI 面试教练</span>
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            模拟大厂真实面试流程 · 反转视角角色扮演 · 智能复盘深度分析 · 职业规划学习路径
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/interview/new">
              <Button size="lg" className="gap-2 px-8 py-6 text-base rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-105">
                <Mic className="h-5 w-5" />
                开始面试
              </Button>
            </Link>
            <Link href="/resume">
              <Button size="lg" variant="outline" className="gap-2 px-6 py-6 text-base rounded-xl glass hover:scale-105 transition-all">
                <FileSearch className="h-5 w-5" />
                简历诊断
              </Button>
            </Link>
            <Link href="/career">
              <Button size="lg" variant="outline" className="gap-2 px-6 py-6 text-base rounded-xl glass hover:scale-105 transition-all">
                <Briefcase className="h-5 w-5" />
                求职规划
              </Button>
            </Link>
            <Link href="/student">
              <Button size="lg" variant="outline" className="gap-2 px-6 py-6 text-base rounded-xl glass hover:scale-105 transition-all">
                <GraduationCap className="h-5 w-5" />
                大学生学习路径规划
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">为什么选择 职镜 OPC</h2>
            <p className="text-muted-foreground">全流程 AI 驱动的面试训练与职业规划平台</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">大厂面试流程</CardTitle>
                <CardDescription>
                  模拟字节/阿里/腾讯真实面试流程，一面算法、二面项目、三面HR，支持压力面模式
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <RefreshCw className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">反转视角</CardTitle>
                <CardDescription>
                  切换角色做面试官，面试 AI 候选人。通过换位思考理解面试官的评判标准
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">复盘报告</CardTitle>
                <CardDescription>
                  面试后自动生成多维度评分报告，逐题分析优缺点，给出改进计划和示范回答
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <FileSearch className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">简历修改清单</CardTitle>
                <CardDescription>
                  上传 PDF/DOCX 简历，逐条给出「原句 → 问题 → 为什么 → 改后原句」，可直接复制替换
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Briefcase className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-lg">求职路径</CardTitle>
                <CardDescription>
                  上传简历，AI 分析技能差距，推荐目标岗位，生成个性化求职路线图
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">大学生学习路径</CardTitle>
                <CardDescription>
                  针对计算机专业大学生，AI 生成 4 阶段学习路线图，推荐课程、书籍与实践项目
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="group glass border-0 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardTitle className="text-lg">AI 职业顾问</CardTitle>
                <CardDescription>
                  实时对话 AI 职业规划师，解答职业困惑，分析行业趋势，获取个性化建议
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
