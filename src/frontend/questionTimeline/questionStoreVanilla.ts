/**
 * 推荐问题时间轴管理 - Vanilla Store 实现
 *
 * 不依赖 React/Zustand，适用于普通 JavaScript/TypeScript 项目
 *
 * 使用方式：
 * ```js
 * import { createQuestionStore } from './questionStoreVanilla';
 *
 * // 创建 Store 实例
 * const store = createQuestionStore();
 *
 * // 订阅状态变化
 * const unsubscribe = store.subscribe((state) => {
 *   console.log('状态变化:', state);
 * });
 *
 * // 接收新问题
 * store.getState().receiveQuestion({
 *   id: 'q1',
 *   content: '最近学习压力大吗？',
 *   createTime: Date.now()
 * });
 *
 * // 查看下一题
 * store.getState().showNextQuestion();
 *
 * // 查看上一题
 * store.getState().showPrevQuestion();
 *
 * // 取消订阅
 * unsubscribe();
 * ```
 */

import {
    RecommendQuestion,
    QuestionStoreType,
    LATEST_QUESTIONS_MAX_SIZE,
    createEmptyQuestionStore,
} from './types';

/**
 * 订阅者函数类型
 */
type Subscriber = (state: QuestionStoreType) => void;

/**
 * Vanilla Store 实现
 */
export function createQuestionStore() {
    // 内部状态
    let state: QuestionStoreType = createEmptyQuestionStore();

    // 订阅者列表
    const subscribers = new Set<Subscriber>();

    /**
     * 通知所有订阅者状态变化
     */
    function notifySubscribers() {
        subscribers.forEach((callback) => callback(state));
    }

    /**
     * 更新状态并通知订阅者
     */
    function setState(partial: Partial<QuestionStoreType>) {
        state = { ...state, ...partial };
        notifySubscribers();
    }

    // 创建 actions 对象
    const actions: Omit<QuestionStoreType, 'historyQuestions' | 'currentQuestion' | 'latestQuestions'> = {
        /**
         * 初始化当前问题（首次设置）
         */
        initCurrentQuestion: (question: RecommendQuestion) => {
            setState({
                currentQuestion: question,
                historyQuestions: [],
                latestQuestions: [],
            });
        },

        /**
         * 接收AI推送的新问题
         */
        receiveQuestion: (question: RecommendQuestion) => {
            // 使用展开操作符创建新数组
            let newLatest = [...state.latestQuestions, question];

            // FIFO：超过最大容量时移除最早的问题
            while (newLatest.length > LATEST_QUESTIONS_MAX_SIZE) {
                newLatest.shift();
            }

            setState({ latestQuestions: newLatest });
        },

        /**
         * 查看下一题
         */
        showNextQuestion: () => {
            if (state.latestQuestions.length === 0) {
                return false;
            }

            // 取出最新问题池最早的问题
            const nextQuestion = state.latestQuestions[0];
            const remainingLatest = state.latestQuestions.slice(1);

            // 当前问题加入历史
            const newHistory = state.currentQuestion
                ? [...state.historyQuestions, state.currentQuestion]
                : state.historyQuestions;

            setState({
                historyQuestions: newHistory,
                currentQuestion: nextQuestion,
                latestQuestions: remainingLatest,
            });

            return true;
        },

        /**
         * 查看上一题
         */
        showPrevQuestion: () => {
            if (state.historyQuestions.length === 0) {
                return false;
            }

            // 取出历史中最后的问题
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

            setState({
                historyQuestions: remainingHistory,
                currentQuestion: prevQuestion,
                latestQuestions: newLatest,
            });

            return true;
        },

        /**
         * 重置状态
         */
        reset: () => {
            setState(createEmptyQuestionStore());
        },
    };

    // 返回 Store 接口
    return {
        /**
         * 获取当前状态
         */
        getState: () => state,

        /**
         * 获取操作方法
         */
        ...actions,

        /**
         * 订阅状态变化
         * @param callback 回调函数
         * @returns 取消订阅函数
         */
        subscribe: (callback: Subscriber) => {
            subscribers.add(callback);
            // 返回取消订阅函数
            return () => {
                subscribers.delete(callback);
            };
        },

        /**
         * 获取最新问题数量
         */
        getLatestCount: () => state.latestQuestions.length,

        /**
         * 获取历史问题数量
         */
        getHistoryCount: () => state.historyQuestions.length,
    };
}

/**
 * 单例模式的 Store 实例
 */
let singletonStore: ReturnType<typeof createQuestionStore> | null = null;

export function getQuestionStore() {
    if (!singletonStore) {
        singletonStore = createQuestionStore();
    }
    return singletonStore;
}
