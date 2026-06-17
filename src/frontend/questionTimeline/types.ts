/**
 * 推荐问题时间轴管理 - TypeScript 类型定义
 */

/**
 * 推荐问题数据结构
 */
export interface RecommendQuestion {
    /** 唯一标识符 */
    id: string;
    /** 问题内容 */
    content: string;
    /** 创建时间戳（毫秒） */
    createTime: number;
}

/**
 * WebSocket 推送消息结构
 */
export interface RecommendQuestionMessage {
    type: 'recommend_question';
    data: RecommendQuestion;
}

/**
 * 问题状态存储
 */
export interface QuestionStore {
    /** 历史问题列表（已浏览过的问题） */
    historyQuestions: RecommendQuestion[];
    /** 当前显示的问题 */
    currentQuestion: RecommendQuestion | null;
    /** 最新问题池（最多5条，FIFO） */
    latestQuestions: RecommendQuestion[];
}

/**
 * QuestionStore 操作方法
 */
export interface QuestionActions {
    /**
     * 接收AI推送的新问题
     * 仅加入 latestQuestions，不修改 currentQuestion
     * @param question 新问题
     */
    receiveQuestion: (question: RecommendQuestion) => void;

    /**
     * 查看下一题
     * 从 latestQuestions 取出最早的问题作为 currentQuestion
     * 旧 currentQuestion 移入 historyQuestions
     * @returns 是否成功切换
     */
    showNextQuestion: () => boolean;

    /**
     * 查看上一题
     * 从 historyQuestions 取出最后的问题作为 currentQuestion
     * 旧 currentQuestion 移入 latestQuestions
     * @returns 是否成功切换
     */
    showPrevQuestion: () => boolean;

    /**
     * 重置状态
     */
    reset: () => void;

    /**
     * 初始化当前问题（首次设置）
     * @param question 初始问题
     */
    initCurrentQuestion: (question: RecommendQuestion) => void;
}

/**
 * 完整的 Question Store 类型
 */
export type QuestionStoreType = QuestionStore & QuestionActions;

/**
 * 最新问题池最大容量
 */
export const LATEST_QUESTIONS_MAX_SIZE = 5;

/**
 * 创建默认的空状态
 */
export function createEmptyQuestionStore(): QuestionStore {
    return {
        historyQuestions: [],
        currentQuestion: null,
        latestQuestions: [],
    };
}
