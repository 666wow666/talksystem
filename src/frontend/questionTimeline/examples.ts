/**
 * 推荐问题时间轴管理 - 状态流转示意代码
 *
 * 本文件展示状态流转的可视化示例和完整使用流程
 */

import { createQuestionStore } from './questionStoreVanilla';
import type { RecommendQuestion } from './types';

/**
 * 状态可视化工具函数
 */
function visualizeState(
    history: RecommendQuestion[],
    current: RecommendQuestion | null,
    latest: RecommendQuestion[]
) {
    console.log('\n┌─────────────────────────────────────────────────────────┐');
    console.log('│                    状态可视化                             │');
    console.log('├─────────────────────────────────────────────────────────┤');

    // 历史问题
    const historyStr = history.length > 0
        ? history.map(q => q.id).join(' ← ')
        : '(空)';
    console.log(`│ 历史 (已浏览) : ${historyStr.padEnd(43)} │`);

    // 当前问题
    const currentStr = current ? `${current.id}: ${current.content.substring(0, 30)}...` : '(无)';
    console.log(`│ 当前 (显示中) : ${currentStr.padEnd(43)} │`);

    // 最新问题池
    const latestStr = latest.length > 0
        ? latest.map(q => q.id).join(', ')
        : '(空)';
    console.log(`│ 缓冲 (最新5条): [${latestStr.padEnd(41)}] │`);

    console.log('└─────────────────────────────────────────────────────────┘');
}

/**
 * 完整的场景演示
 */
export function runDemo() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('           推荐问题时间轴管理 - 状态流转演示');
    console.log('═══════════════════════════════════════════════════════════════');

    const store = createQuestionStore();

    // 订阅状态变化
    store.subscribe((state) => {
        visualizeState(
            state.historyQuestions,
            state.currentQuestion,
            state.latestQuestions
        );
    });

    // ─────────────────────────────────────────────────────────────────
    // 场景1：初始化
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤1: 初始化当前问题');
    console.log('   调用: initCurrentQuestion(Q1)');
    store.getState().initCurrentQuestion({
        id: 'Q1',
        content: '最近学习压力大吗？',
        createTime: Date.now(),
    });

    // ─────────────────────────────────────────────────────────────────
    // 场景2：AI 推送新问题
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤2: AI 推送3个新问题');
    console.log('   调用: receiveQuestion(Q2), receiveQuestion(Q3), receiveQuestion(Q4)');

    store.getState().receiveQuestion({
        id: 'Q2',
        content: '睡眠质量怎么样？',
        createTime: Date.now(),
    });

    store.getState().receiveQuestion({
        id: 'Q3',
        content: '和同学关系如何？',
        createTime: Date.now(),
    });

    store.getState().receiveQuestion({
        id: 'Q4',
        content: '对未来有什么规划？',
        createTime: Date.now(),
    });

    // ─────────────────────────────────────────────────────────────────
    // 场景3：查看下一题
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤3: 点击"下一题"');
    console.log('   调用: showNextQuestion()');
    console.log('   说明: Q1 → 历史，Q2 → 当前');

    store.getState().showNextQuestion();

    // ─────────────────────────────────────────────────────────────────
    // 场景4：继续查看下一题
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤4: 再次点击"下一题"');
    console.log('   调用: showNextQuestion()');
    console.log('   说明: Q2 → 历史，Q3 → 当前');

    store.getState().showNextQuestion();

    // ─────────────────────────────────────────────────────────────────
    // 场景5：查看上一题
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤5: 点击"上一题"');
    console.log('   调用: showPrevQuestion()');
    console.log('   说明: Q2 ← 历史（弹出），Q3 → 缓冲，Q2 → 当前');

    store.getState().showPrevQuestion();

    // ─────────────────────────────────────────────────────────────────
    // 场景6：继续查看上一题
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤6: 再次点击"上一题"');
    console.log('   调用: showPrevQuestion()');
    console.log('   说明: Q1 ← 历史（弹出），Q2 → 缓冲，Q1 → 当前');

    store.getState().showPrevQuestion();

    // ─────────────────────────────────────────────────────────────────
    // 场景7：AI 高频推送（超过5条）
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤7: AI 连续推送6个问题');
    console.log('   说明: 只保留最新的5条，最早的会被移除');

    for (let i = 5; i <= 10; i++) {
        store.getState().receiveQuestion({
            id: `Q${i}`,
            content: `AI推荐问题${i}`,
            createTime: Date.now(),
        });
    }

    console.log('\n📌 步骤8: 再次点击"下一题"');
    console.log('   说明: 从最新的缓冲池中取出问题');

    store.getState().showNextQuestion();

    // ─────────────────────────────────────────────────────────────────
    // 场景8：重置
    // ─────────────────────────────────────────────────────────────────
    console.log('\n📌 步骤9: 重置状态');
    console.log('   调用: reset()');

    store.getState().reset();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                        演示结束');
    console.log('═══════════════════════════════════════════════════════════════\n');
}

/**
 * WebSocket 集成示例
 */
export function runWebSocketDemo() {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('           WebSocket 集成演示');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const store = createQuestionStore();

    // 模拟 WebSocket 消息
    function simulateWebSocketMessage(message: string) {
        console.log(`📡 收到 WebSocket 消息: ${message}`);

        try {
            const data = JSON.parse(message);

            if (data.type === 'recommend_question') {
                store.getState().receiveQuestion(data.data);
                console.log(`✅ 已添加到缓冲池，当前缓冲: [${store.getState().latestQuestions.map(q => q.id).join(', ')}]`);
            }
        } catch (e) {
            console.error('❌ 解析失败:', e);
        }
    }

    // 模拟接收消息
    simulateWebSocketMessage(JSON.stringify({
        type: 'recommend_question',
        data: { id: 'Q1', content: '最近怎么样？', createTime: Date.now() },
    }));

    simulateWebSocketMessage(JSON.stringify({
        type: 'recommend_question',
        data: { id: 'Q2', content: '有什么困扰吗？', createTime: Date.now() },
    }));

    simulateWebSocketMessage(JSON.stringify({
        type: 'recommend_question',
        data: { id: 'Q3', content: '睡眠如何？', createTime: Date.now() },
    }));

    console.log('\n═══════════════════════════════════════════════════════════════\n');
}

/**
 * 状态流转图（ASCII 版本）
 */
export function printStateDiagram() {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                    推荐问题时间轴 - 状态流转图                        ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║   ┌─────────────┐     receiveQuestion      ┌─────────────────────┐    ║
║   │   AI 推送   │ ──────────────────────► │   latestQuestions  │    ║
║   │ (WebSocket) │                           │   (最多5条, FIFO)   │    ║
║   └─────────────┘                           └──────────┬──────────┘    ║
║                                                         │               ║
║                                                         ▼               ║
║   ┌─────────────┐     showNextQuestion    ┌─────────────────────┐    ║
║   │  用户点击   │ ──────────────────────► │    currentQuestion  │    ║
║   │  "下一题"  │                         │    (当前显示问题)    │    ║
║   └─────────────┘                         └──────────┬──────────┘    ║
║                                                         │               ║
║                                                         ▼               ║
║   ┌─────────────┐     showPrevQuestion    ┌─────────────────────┐    ║
║   │  用户点击   │ ◄────────────────────── │  historyQuestions   │    ║
║   │  "上一题"  │                         │  (历史浏览记录)      │    ║
║   └─────────────┘                         └─────────────────────┘    ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                         核心规则说明                                   ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║   1. currentQuestion 永远不会被 AI 自动抢占                            ║
║   2. AI 新问题只进入 latestQuestions（缓冲池）                         ║
║   3. 用户点击"下一题"时才从缓冲池取出问题                              ║
║   4. 历史问题永久保存，不限制数量                                     ║
║   5. 缓冲池最多5条，先进先出                                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
`);
}

// 运行演示
if (typeof require !== 'undefined' && require.main === module) {
    runDemo();
    printStateDiagram();
}
