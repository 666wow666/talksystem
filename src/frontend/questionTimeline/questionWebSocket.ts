/**
 * 推荐问题 WebSocket 连接管理器
 *
 * 功能：
 * - 管理 WebSocket 连接生命周期
 * - 自动重连
 * - 接收 AI 推荐问题并推送到 Store
 *
 * 使用方式（Vanilla）：
 * ```js
 * import { createQuestionWebSocket } from './questionWebSocket';
 *
 * const ws = createQuestionWebSocket({
 *   url: 'ws://localhost:3000/ws/questions',
 *   onQuestion: (question) => {
 *     console.log('收到推荐问题:', question);
 *   },
 *   onConnect: () => console.log('连接成功'),
 *   onDisconnect: () => console.log('连接断开'),
 * });
 *
 * ws.connect();
 * ws.disconnect();
 * ```
 *
 * 使用方式（React）：
 * ```tsx
 * import { useQuestionWebSocket } from './questionWebSocket';
 *
 * function App() {
 *   const { isConnected, error } = useQuestionWebSocket({
 *     url: 'ws://localhost:3000/ws/questions',
 *   });
 *   // ...
 * }
 * ```
 */

import { RecommendQuestion, RecommendQuestionMessage } from './types';

export interface QuestionWebSocketOptions {
    /** WebSocket 服务器地址 */
    url: string;
    /** 收到推荐问题的回调 */
    onQuestion?: (question: RecommendQuestion) => void;
    /** 连接成功回调 */
    onConnect?: () => void;
    /** 连接断开回调 */
    onDisconnect?: (event: CloseEvent) => void;
    /** 错误回调 */
    onError?: (error: Event) => void;
    /** 重连延迟（毫秒），默认 3000 */
    reconnectDelay?: number;
    /** 最大重连次数，默认 10 */
    maxReconnectAttempts?: number;
    /** 是否自动重连，默认 true */
    autoReconnect?: boolean;
}

export interface QuestionWebSocket {
    /** 建立连接 */
    connect: () => void;
    /** 断开连接 */
    disconnect: () => void;
    /** 发送消息 */
    send: (data: unknown) => void;
    /** 当前连接状态 */
    isConnected: () => boolean;
}

/**
 * 创建 WebSocket 管理器（Vanilla 版本）
 */
export function createQuestionWebSocket(options: QuestionWebSocketOptions): QuestionWebSocket {
    const {
        url,
        onQuestion,
        onConnect,
        onDisconnect,
        onError,
        reconnectDelay = 3000,
        maxReconnectAttempts = 10,
        autoReconnect = true,
    } = options;

    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let intentionalClose = false;

    /**
     * 处理接收到的消息
     */
    function handleMessage(event: MessageEvent) {
        try {
            const message: RecommendQuestionMessage = JSON.parse(event.data);

            if (message.type === 'recommend_question' && message.data) {
                // 触发回调
                onQuestion?.(message.data);
            }
        } catch (error) {
            console.error('[QuestionWebSocket] 解析消息失败:', error);
        }
    }

    /**
     * 建立连接
     */
    function connect() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            return;
        }

        intentionalClose = false;
        reconnectAttempts = 0;

        try {
            socket = new WebSocket(url);

            socket.onopen = () => {
                console.log('[QuestionWebSocket] 连接已建立');
                reconnectAttempts = 0;
                onConnect?.();
            };

            socket.onmessage = handleMessage;

            socket.onclose = (event) => {
                console.log('[QuestionWebSocket] 连接已关闭', event.code, event.reason);
                onDisconnect?.(event);

                // 如果是非预期断开，尝试重连
                if (autoReconnect && !intentionalClose && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`[QuestionWebSocket] ${reconnectDelay}ms 后尝试第 ${reconnectAttempts} 次重连...`);
                    reconnectTimer = setTimeout(connect, reconnectDelay);
                }
            };

            socket.onerror = (error) => {
                console.error('[QuestionWebSocket] 发生错误:', error);
                onError?.(error);
            };
        } catch (error) {
            console.error('[QuestionWebSocket] 创建连接失败:', error);
        }
    }

    /**
     * 断开连接
     */
    function disconnect() {
        intentionalClose = true;

        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }

        if (socket) {
            socket.close();
            socket = null;
        }
    }

    /**
     * 发送消息
     */
    function send(data: unknown) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        } else {
            console.warn('[QuestionWebSocket] WebSocket 未连接，无法发送消息');
        }
    }

    /**
     * 检查连接状态
     */
    function isConnected() {
        return socket !== null && socket.readyState === WebSocket.OPEN;
    }

    return {
        connect,
        disconnect,
        send,
        isConnected,
    };
}
