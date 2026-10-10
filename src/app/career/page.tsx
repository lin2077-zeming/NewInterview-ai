import { CareerPlanner } from "@/components/career/CareerPlanner";

export default function CareerPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">职业规划</h1>
      <p className="text-muted-foreground mb-8">
        上传简历并选择目标岗位，系统将分析你的技能差距，为你生成个性化学习路径。
      </p>

      <CareerPlanner />
    </div>
  );
}
