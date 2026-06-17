/**
 * 推荐问题 WebSocket - React Hook
 *
 * 与 Zustand Store 配合使用
 *
 * 使用方式：
 * ```tsx
 * import { useQuestionWebSocket } from './questionWebSocketHook';
 * import { useQuestionStore } from './questionStore';
 *
 * function QuestionPanel() {
 *   const receiveQuestion = useQuestionStore((s) => s.receiveQuestion);
 *   const { isConnected, error, connect, disconnect } = useQuestionWebSocket({
 *     url: 'ws://localhost:3000/ws/questions',
 *     onQuestion: receiveQuestion,
 *   });
 *
 *   return (
 *     <div>
 *       <p>状态: {isConnected ? '已连接' : '未连接'}</p>
 *       <button onClick={connect}>连接</button>
 *       <button onClick={disconnect}>断开</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RecommendQuestion } from './types';

export interface UseQuestionWebSocketOptions {
    /** WebSocket 服务器地址 */
    url: string;
    /** 收到推荐问题的回调 */
    onQuestion?: (question: RecommendQuestion) => void;
    /** 是否自动连接，默认 false */
    autoConnect?: boolean;
    /** 重连延迟（毫秒），默认 3000 */
    reconnectDelay?: number;
    /** 最大重连次数，默认 10 */
    maxReconnectAttempts?: number;
    /** 是否自动重连，默认 true */
    autoReconnect?: boolean;
}

export interface UseQuestionWebSocketReturn {
    /** 是否已连接 */
    isConnected: boolean;
    /** 连接错误 */
    error: Event | null;
    /** 重连次数 */
    reconnectAttempts: number;
    /** 建立连接 */
    connect: () => void;
    /** 断开连接 */
    disconnect: () => void;
}

/**
 * useQuestionWebSocket Hook
 */
export function useQuestionWebSocket(
    options: UseQuestionWebSocketOptions
): UseQuestionWebSocketReturn {
    const {
        url,
        onQuestion,
        autoConnect = false,
        reconnectDelay = 3000,
        maxReconnectAttempts = 10,
        autoReconnect = true,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Event | null>(null);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const intentionalCloseRef = useRef(false);
    const reconnectCountRef = useRef(0);

    /**
     * 关闭连接
     */
    const disconnect = useCallback(() => {
        intentionalCloseRef.current = true;

        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }

        setIsConnected(false);
    }, []);

    /**
     * 建立连接
     */
    const connect = useCallback(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            return;
        }

        intentionalCloseRef.current = false;
        reconnectCountRef.current = 0;
        setError(null);

        try {
            socketRef.current = new WebSocket(url);

            socketRef.current.onopen = () => {
                console.log('[QuestionWebSocket] 连接已建立');
                setIsConnected(true);
                setReconnectAttempts(0);
                reconnectCountRef.current = 0;
            };

            socketRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'recommend_question' && message.data) {
                        onQuestion?.(message.data);
                    }
                } catch (parseError) {
                    console.error('[QuestionWebSocket] 解析消息失败:', parseError);
                }
            };

            socketRef.current.onclose = (event) => {
                console.log('[QuestionWebSocket] 连接已关闭', event.code, event.reason);
                setIsConnected(false);

                // 非预期断开且启用自动重连
                if (autoReconnect && !intentionalCloseRef.current && reconnectCountRef.current < maxReconnectAttempts) {
                    reconnectCountRef.current++;
                    setReconnectAttempts(reconnectCountRef.current);
                    console.log(`[QuestionWebSocket] ${reconnectDelay}ms 后尝试第 ${reconnectCountRef.current} 次重连...`);

                    reconnectTimerRef.current = setTimeout(() => {
                        connect();
                    }, reconnectDelay);
                }
            };

            socketRef.current.onerror = (event) => {
                console.error('[QuestionWebSocket] 发生错误:', event);
                setError(event);
            };
        } catch (err) {
            console.error('[QuestionWebSocket] 创建连接失败:', err);
            setError(err as Event);
        }
    }, [url, onQuestion, autoReconnect, maxReconnectAttempts, reconnectDelay]);

    // 自动连接
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        isConnected,
        error,
        reconnectAttempts,
        connect,
        disconnect,
    };
}
