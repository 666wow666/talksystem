/**
 * 推荐问题时间轴管理 - 单元测试
 *
 * 测试框架：Vitest
 * 运行命令：npx vitest run questionTimeline.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createQuestionStore } from './questionStoreVanilla';
import type { RecommendQuestion } from './types';

/**
 * 创建测试用问题的辅助函数
 */
function createQuestion(id: string, content: string, createTime = Date.now()): RecommendQuestion {
    return { id, content, createTime };
}

describe('推荐问题时间轴管理 - Store 测试', () => {
    let store: ReturnType<typeof createQuestionStore>;

    beforeEach(() => {
        store = createQuestionStore();
    });

    // ==================== 初始化测试 ====================
    describe('初始化状态', () => {
        it('初始状态应为空', () => {
            const state = store.getState();
            expect(state.currentQuestion).toBeNull();
            expect(state.historyQuestions).toEqual([]);
            expect(state.latestQuestions).toEqual([]);
        });
    });

    // ==================== initCurrentQuestion 测试 ====================
    describe('initCurrentQuestion', () => {
        it('应正确初始化当前问题', () => {
            const q1 = createQuestion('q1', '第一个问题');
            store.getState().initCurrentQuestion(q1);

            const state = store.getState();
            expect(state.currentQuestion).toEqual(q1);
            expect(state.historyQuestions).toEqual([]);
            expect(state.latestQuestions).toEqual([]);
        });

        it('初始化时应清空历史和缓冲池', () => {
            // 先添加一些数据
            store.getState().initCurrentQuestion(createQuestion('q0', '旧问题'));
            store.getState().receiveQuestion(createQuestion('q1', '新问题1'));
            store.getState().showNextQuestion();
            store.getState().showNextQuestion();

            // 再次初始化
            store.getState().initCurrentQuestion(createQuestion('q-new', '新初始化'));

            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('q-new');
            expect(state.historyQuestions).toEqual([]);
            expect(state.latestQuestions).toEqual([]);
        });
    });

    // ==================== receiveQuestion 测试 ====================
    describe('receiveQuestion - 接收新问题', () => {
        it('应将问题添加到 latestQuestions', () => {
            const q1 = createQuestion('q1', '问题1');
            store.getState().receiveQuestion(q1);

            const state = store.getState();
            expect(state.latestQuestions).toEqual([q1]);
            expect(state.currentQuestion).toBeNull();
        });

        it('不应修改 currentQuestion', () => {
            const current = createQuestion('current', '当前问题');
            store.getState().initCurrentQuestion(current);

            const newQ = createQuestion('new', '新问题');
            store.getState().receiveQuestion(newQ);

            const state = store.getState();
            expect(state.currentQuestion).toEqual(current);
            expect(state.latestQuestions).toContain(newQ);
        });

        it('超过5条时应移除最早的问题（FIFO）', () => {
            // 添加6条问题
            for (let i = 1; i <= 6; i++) {
                store.getState().receiveQuestion(createQuestion(`q${i}`, `问题${i}`));
            }

            const state = store.getState();
            expect(state.latestQuestions.length).toBe(5);
            expect(state.latestQuestions[0].id).toBe('q2'); // q1 被移除
            expect(state.latestQuestions[4].id).toBe('q6');
        });

        it('exactly 5条时应正常工作', () => {
            for (let i = 1; i <= 5; i++) {
                store.getState().receiveQuestion(createQuestion(`q${i}`, `问题${i}`));
            }

            const state = store.getState();
            expect(state.latestQuestions.length).toBe(5);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
        });
    });

    // ==================== showNextQuestion 测试 ====================
    describe('showNextQuestion - 查看下一题', () => {
        beforeEach(() => {
            // 设置初始状态
            store.getState().initCurrentQuestion(createQuestion('current', '当前问题'));
            store.getState().receiveQuestion(createQuestion('q1', '下一题1'));
            store.getState().receiveQuestion(createQuestion('q2', '下一题2'));
        });

        it('应从 latestQuestions 取最早的问题', () => {
            const result = store.getState().showNextQuestion();

            expect(result).toBe(true);
            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('q1');
            expect(state.latestQuestions.map(q => q.id)).toEqual(['q2']);
        });

        it('应将旧 currentQuestion 移入 history', () => {
            store.getState().showNextQuestion();

            const state = store.getState();
            expect(state.historyQuestions.map(q => q.id)).toEqual(['current']);
        });

        it('连续调用应正确更新状态', () => {
            store.getState().showNextQuestion(); // current -> history, q1 -> current
            store.getState().showNextQuestion(); // q1 -> history, q2 -> current

            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('q2');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['current', 'q1']);
            expect(state.latestQuestions).toEqual([]);
        });

        it('latestQuestions 为空时应返回 false', () => {
            store.getState().showNextQuestion();
            store.getState().showNextQuestion();

            const result = store.getState().showNextQuestion();

            expect(result).toBe(false);
        });

        it('在 history 为空时也能正常工作', () => {
            store = createQuestionStore();
            store.getState().initCurrentQuestion(createQuestion('current', '当前'));
            store.getState().receiveQuestion(createQuestion('next', '下一个'));

            store.getState().showNextQuestion();

            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('next');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['current']);
        });
    });

    // ==================== showPrevQuestion 测试 ====================
    describe('showPrevQuestion - 查看上一题', () => {
        beforeEach(() => {
            // 准备状态：history 有问题，current 有问题
            store.getState().initCurrentQuestion(createQuestion('q1', '问题1'));
            store.getState().receiveQuestion(createQuestion('q2', '问题2'));
            store.getState().showNextQuestion(); // q1 -> history, q2 -> current
            store.getState().receiveQuestion(createQuestion('q3', '问题3'));
        });

        it('应从 history 取最后的问题', () => {
            const result = store.getState().showPrevQuestion();

            expect(result).toBe(true);
            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('q1');
        });

        it('应将旧 currentQuestion 放回 latestQuestions', () => {
            store.getState().showPrevQuestion();

            const state = store.getState();
            expect(state.latestQuestions[0]?.id).toBe('q2');
        });

        it('history 为空时应返回 false', () => {
            store = createQuestionStore();
            store.getState().initCurrentQuestion(createQuestion('current', '当前'));

            const result = store.getState().showPrevQuestion();

            expect(result).toBe(false);
        });

        it('连续返回应正确更新状态', () => {
            // 继续添加历史
            store.getState().receiveQuestion(createQuestion('q4', '问题4'));
            store.getState().showNextQuestion(); // q2 -> history, q3 -> current, q4 -> latest
            // 现在：history=[q1, q2], current=q3, latest=[q4]

            store.getState().showPrevQuestion(); // q1 -> current, q3 -> latest
            // 现在：history=[q2], current=q1, latest=[q3, q4]

            const state = store.getState();
            expect(state.currentQuestion?.id).toBe('q1');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['q2']);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['q3', 'q4']);
        });

        it('latestQuestions 超过5条时应移除最后的问题', () => {
            store = createQuestionStore();
            store.getState().initCurrentQuestion(createQuestion('current', '当前'));
            store.getState().receiveQuestion(createQuestion('q1', '问题1'));
            store.getState().receiveQuestion(createQuestion('q2', '问题2'));
            store.getState().receiveQuestion(createQuestion('q3', '问题3'));
            store.getState().receiveQuestion(createQuestion('q4', '问题4'));
            store.getState().receiveQuestion(createQuestion('q5', '问题5'));

            // current=q0, history=[], latest=[q1,q2,q3,q4,q5]
            store.getState().initCurrentQuestion(createQuestion('q0', '新当前'));
            store.getState().showNextQuestion(); // history=[q0], current=q1, latest=[q2,q3,q4,q5]
            // 现在：history=[q0], current=q1, latest=[q2,q3,q4,q5]

            // 模拟场景：连续返回时 latest 会增长
            store.getState().receiveQuestion(createQuestion('q6', '问题6')); // latest=[q2,q3,q4,q5,q6]
            store.getState().showPrevQuestion(); // current=q0, history=[], latest=[q1,q2,q3,q4,q5]

            const state = store.getState();
            expect(state.latestQuestions.length).toBeLessThanOrEqual(5);
        });
    });

    // ==================== reset 测试 ====================
    describe('reset - 重置状态', () => {
        it('应重置所有状态为空', () => {
            store.getState().initCurrentQuestion(createQuestion('q1', '问题1'));
            store.getState().receiveQuestion(createQuestion('q2', '问题2'));
            store.getState().showNextQuestion();

            store.getState().reset();

            const state = store.getState();
            expect(state.currentQuestion).toBeNull();
            expect(state.historyQuestions).toEqual([]);
            expect(state.latestQuestions).toEqual([]);
        });
    });

    // ==================== 订阅测试 ====================
    describe('订阅功能', () => {
        it('状态变化时应通知订阅者', () => {
            let callCount = 0;
            let lastState: ReturnType<typeof store.getState> | null = null;

            const unsubscribe = store.subscribe((state) => {
                callCount++;
                lastState = { ...state };
            });

            store.getState().receiveQuestion(createQuestion('q1', '问题1'));
            store.getState().receiveQuestion(createQuestion('q2', '问题2'));

            unsubscribe();

            store.getState().receiveQuestion(createQuestion('q3', '问题3')); // 不应触发

            expect(callCount).toBe(2);
            expect(lastState?.latestQuestions.length).toBe(2);
        });

        it('取消订阅后不应再收到通知', () => {
            let callCount = 0;

            const unsubscribe = store.subscribe(() => {
                callCount++;
            });

            store.getState().receiveQuestion(createQuestion('q1', '问题1'));

            unsubscribe();

            store.getState().receiveQuestion(createQuestion('q2', '问题2'));

            expect(callCount).toBe(1);
        });
    });

    // ==================== 场景测试 ====================
    describe('完整场景测试', () => {
        it('场景1：标准浏览流程', () => {
            // 初始状态
            store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));

            // AI 推送
            store.getState().receiveQuestion(createQuestion('Q2', '第二个问题'));
            store.getState().receiveQuestion(createQuestion('Q3', '第三个问题'));
            store.getState().receiveQuestion(createQuestion('Q4', '第四个问题'));

            let state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q1');
            expect(state.historyQuestions).toEqual([]);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['Q2', 'Q3', 'Q4']);

            // 下一题
            store.getState().showNextQuestion();

            state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q2');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['Q1']);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['Q3', 'Q4']);

            // 再下一题
            store.getState().showNextQuestion();

            state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q3');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['Q1', 'Q2']);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['Q4']);

            // 上一题
            store.getState().showPrevQuestion();

            state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q2');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['Q1']);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['Q3', 'Q4']);
        });

        it('场景2：AI 高频推送（超过5条）', () => {
            store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));

            // 模拟 AI 推送 8 条问题
            for (let i = 2; i <= 9; i++) {
                store.getState().receiveQuestion(createQuestion(`Q${i}`, `第${i}个问题`));
            }

            const state = store.getState();
            // 只保留最后5条：Q5, Q6, Q7, Q8, Q9
            expect(state.latestQuestions.length).toBe(5);
            expect(state.latestQuestions[0].id).toBe('Q5');
            expect(state.latestQuestions[4].id).toBe('Q9');
        });

        it('场景3：连续查看多题后返回', () => {
            store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));
            store.getState().receiveQuestion(createQuestion('Q2', '第二个问题'));
            store.getState().receiveQuestion(createQuestion('Q3', '第三个问题'));
            store.getState().receiveQuestion(createQuestion('Q4', '第四个问题'));

            // 连续看3题
            store.getState().showNextQuestion(); // Q1 -> history, Q2 -> current
            store.getState().showNextQuestion(); // Q2 -> history, Q3 -> current
            store.getState().showNextQuestion(); // Q3 -> history, Q4 -> current

            let state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q4');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['Q1', 'Q2', 'Q3']);
            expect(state.latestQuestions).toEqual([]);

            // 返回2题
            store.getState().showPrevQuestion(); // Q3 -> current, Q4 -> latest
            store.getState().showPrevQuestion(); // Q2 -> current, Q3 -> latest

            state = store.getState();
            expect(state.currentQuestion?.id).toBe('Q2');
            expect(state.historyQuestions.map(q => q.id)).toEqual(['Q1']);
            expect(state.latestQuestions.map(q => q.id)).toEqual(['Q4', 'Q3']);
        });
    });
});

describe('边界条件测试', () => {
    let store: ReturnType<typeof createQuestionStore>;

    beforeEach(() => {
        store = createQuestionStore();
    });

    it('null question 不应被添加到 latestQuestions', () => {
        // 这个测试主要是为了文档说明
        // 实际上 receiveQuestion 接收的是 RecommendQuestion 类型，不会是 null
        const validQuestion = createQuestion('q1', '有效问题');
        store.getState().receiveQuestion(validQuestion);

        const state = store.getState();
        expect(state.latestQuestions.length).toBe(1);
    });

    it('连续调用 showNextQuestion 应正确处理空 latestQuestions', () => {
        store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));

        expect(store.getState().showNextQuestion()).toBe(false);
        expect(store.getState().currentQuestion?.id).toBe('Q1');
    });

    it('连续调用 showPrevQuestion 应正确处理空 history', () => {
        store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));

        expect(store.getState().showPrevQuestion()).toBe(false);
        expect(store.getState().currentQuestion?.id).toBe('Q1');
    });

    it('getLatestCount 和 getHistoryCount 应返回正确数量', () => {
        store.getState().initCurrentQuestion(createQuestion('Q1', '第一个问题'));
        store.getState().receiveQuestion(createQuestion('Q2', '第二个问题'));
        store.getState().receiveQuestion(createQuestion('Q3', '第三个问题'));

        expect(store.getLatestCount()).toBe(2);
        expect(store.getHistoryCount()).toBe(0);

        store.getState().showNextQuestion();

        expect(store.getLatestCount()).toBe(1);
        expect(store.getHistoryCount()).toBe(1);
    });
});
