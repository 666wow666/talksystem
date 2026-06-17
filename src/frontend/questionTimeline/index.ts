/**
 * 推荐问题时间轴管理 - 模块导出
 *
 * 使用示例：
 *
 * Vanilla 项目：
 * ```js
 * import { createQuestionStore, getQuestionStore } from './index';
 *
 * // 方式1：创建独立实例
 * const store = createQuestionStore();
 * store.getState().receiveQuestion({ id: 'q1', content: '问题内容', createTime: Date.now() });
 *
 * // 方式2：使用单例
 * const singleStore = getQuestionStore();
 * ```
 *
 * React + Zustand 项目：
 * ```tsx
 * import { useQuestionStore, useCurrentQuestion, useCanGoNext, useCanGoPrev } from './index';
 *
 * function QuestionPanel() {
 *   const currentQuestion = useCurrentQuestion();
 *   const canGoNext = useCanGoNext();
 *   const canGoPrev = useCanGoPrev();
 *   const { showNextQuestion, showPrevQuestion, receiveQuestion } = useQuestionStore();
 *
 *   return (
 *     <div>
 *       <div>当前问题: {currentQuestion?.content}</div>
 *       <button disabled={!canGoNext} onClick={showNextQuestion}>下一题</button>
 *       <button disabled={!canGoPrev} onClick={showPrevQuestion}>上一题</button>
 *     </div>
 *   );
 * }
 * ```
 */

// 类型定义
export {
    type RecommendQuestion,
    type RecommendQuestionMessage,
    type QuestionStore,
    type QuestionActions,
    type QuestionStoreType,
    LATEST_QUESTIONS_MAX_SIZE,
    createEmptyQuestionStore,
} from './types';

// Zustand Store（React 项目使用）
export {
    useQuestionStore,
    useCurrentQuestion,
    useHistoryQuestions,
    useLatestQuestions,
    useCanGoNext,
    useCanGoPrev,
} from './questionStore';

// Vanilla Store（非 React 项目使用）
export { createQuestionStore, getQuestionStore } from './questionStoreVanilla';

// WebSocket 管理器
export {
    type QuestionWebSocketOptions,
    type QuestionWebSocket,
    createQuestionWebSocket,
} from './questionWebSocket';

// React Hook for WebSocket
export {
    type UseQuestionWebSocketOptions,
    type UseQuestionWebSocketReturn,
    useQuestionWebSocket,
} from './questionWebSocketHook';
