import type { QuestionChain } from "@/types";

export const QUESTION_CHAIN_KEY = "zhijing-opc-question-chain";

export interface SavedQuestionChain {
  chain: QuestionChain;
  /** 公司 key，用于「去练习」链接 */
  companyKey?: string;
  updatedAt: string;
}

export function loadQuestionChain(): SavedQuestionChain | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(QUESTION_CHAIN_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SavedQuestionChain;
    if (!parsed?.chain?.dimensions) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveQuestionChain(input: {
  chain: QuestionChain;
  companyKey?: string;
}): SavedQuestionChain {
  const item: SavedQuestionChain = {
    chain: input.chain,
    companyKey: input.companyKey,
    updatedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(QUESTION_CHAIN_KEY, JSON.stringify(item));
  return item;
}

export function clearQuestionChain() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(QUESTION_CHAIN_KEY);
}
