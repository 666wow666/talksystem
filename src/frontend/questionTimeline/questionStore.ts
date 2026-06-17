/**
 * 推荐问题时间轴管理 - Zustand Store 实现
 *
 * 使用方式（React）：
 * ```tsx
 * import { useQuestionStore } from './questionStore';
 *
 * function MyComponent() {
 *   const { currentQuestion, showNextQuestion, showPrevQuestion } = useQuestionStore();
 *   // ...
 * }
 * ```
 *
 * 使用方式（Vanilla）：
 * ```js
 * import { createQuestionStore } from './questionStore';
 * const store = createQuestionStore();
 * store.getState().receiveQuestion({ id: 'q1', content: '...', createTime: Date.now() });
 * ```
 */

import { create } from 'zustand';
import {
    RecommendQuestion,
    QuestionStoreType,
    LATEST_QUESTIONS_MAX_SIZE,
} from './types';

/**
 * Zustand Store 实现
 */
export const useQuestionStore = create<QuestionStoreType>((set, get) => ({
    // ==================== 初始状态 ====================
    historyQuestions: [],
    currentQuestion: null,
    latestQuestions: [],

    // ==================== 操作方法 ====================

    /**
     * 初始化当前问题（首次设置）
     */
    initCurrentQuestion: (question: RecommendQuestion) => {
        set({
            currentQuestion: question,
            // 清空历史和缓冲池
            historyQuestions: [],
            latestQuestions: [],
        });
    },

    /**
     * 接收AI推送的新问题
     * 仅加入 latestQuestions，不修改 currentQuestion
     */
    receiveQuestion: (question: RecommendQuestion) => {
        set((state) => {
            // 使用展开操作符创建新数组
            const newLatest = [...state.latestQuestions, question];

            // FIFO：超过最大容量时移除最早的问题
            while (newLatest.length > LATEST_QUESTIONS_MAX_SIZE) {
                newLatest.shift();
            }

            return {
                latestQuestions: newLatest,
            };
        });
    },

    /**
     * 查看下一题
     * 从 latestQuestions 取出最早的问题作为 currentQuestion
     * 旧 currentQuestion 移入 historyQuestions
     */
    showNextQuestion: () => {
        const state = get();

        // 如果最新问题池为空，无法切换
        if (state.latestQuestions.length === 0) {
            return false;
        }

        set((state) => {
            // 取出最新问题池最早的问题（shift）
            const nextQuestion = state.latestQuestions[0];
            const remainingLatest = state.latestQuestions.slice(1);

            // 当前问题加入历史
            const newHistory = state.currentQuestion
                ? [...state.historyQuestions, state.currentQuestion]
                : state.historyQuestions;

            return {
                historyQuestions: newHistory,
                currentQuestion: nextQuestion,
                latestQuestions: remainingLatest,
            };
        });

        return true;
    },

    /**
     * 查看上一题
     * 从 historyQuestions 取出最后的问题作为 currentQuestion
     * 旧 currentQuestion 移入 latestQuestions
     */
    showPrevQuestion: () => {
        const state = get();

        // 如果历史为空，无法切换
        if (state.historyQuestions.length === 0) {
            return false;
        }

        set((state) => {
            // 取出历史中最后的问题（pop）
            const prevQuestion = state.historyQuestions[state.historyQuestions.length - 1];
            const remainingHistory = state.historyQuestions.slice(0, -1);

            // 当前问题放回 latestQuestions 头部
            let newLatest = state.currentQuestion
                ? [state.currentQuestion, ...state.latestQuestions]
                : state.latestQuestions;

            // 保持最大容量限制
            while (newLatest.length > LATEST_QUESTIONS_MAX_SIZE) {
                newLatest.pop();
            }

            return {
                historyQuestions: remainingHistory,
                currentQuestion: prevQuestion,
                latestQuestions: newLatest,
            };
        });

        return true;
    },

    /**
     * 重置状态
     */
    reset: () => {
        set({
            historyQuestions: [],
            currentQuestion: null,
            latestQuestions: [],
        });
    },
}));

/**
 * 选择器 Hooks
 */
export const useCurrentQuestion = () => useQuestionStore((state) => state.currentQuestion);
export const useHistoryQuestions = () => useQuestionStore((state) => state.historyQuestions);
export const useLatestQuestions = () => useQuestionStore((state) => state.latestQuestions);
export const useCanGoNext = () => useQuestionStore((state) => state.latestQuestions.length > 0);
export const useCanGoPrev = () => useQuestionStore((state) => state.historyQuestions.length > 0);
