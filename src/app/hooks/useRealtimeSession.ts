import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
  RealtimeMessageItem,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { useMcpToolSession } from './useMcpToolSession';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
  onSessionTimeout?: () => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
  model?: string;
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks, logClientEvent],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;
  const mcpHandlers = useMcpToolSession().current;

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session

    // Debug: log events that might contain MCP tool info
    if (event.type?.includes('function_call') || event.type?.includes('item.created')) {
      console.log('[MCP Tool Debug] Potential MCP event:', event.type, event);
    }

    // First, try MCP-specific event handlers
    const mcpHandled = mcpHandlers.handleMcpTransportEvent(event);
    if (mcpHandled) return;

    // Then handle other event types
    switch (event.type) {
      case "error": {
        // Handle error events that come through transport
        const errorObj = event.error || event;
        let errorMessage = 'Unknown error';
        let errorDetails = errorObj;

        // Check if error object is empty
        if (errorObj && typeof errorObj === 'object' && Object.keys(errorObj.error || {}).length === 0) {
          console.warn('[Transport] Received empty error object:', event);
          errorMessage = 'Empty error object received from transport';
          errorDetails = { raw: event };
        } else if (errorObj.message) {
          errorMessage = errorObj.message;
        } else if (errorObj.error) {
          errorMessage = typeof errorObj.error === 'string'
            ? errorObj.error
            : JSON.stringify(errorObj.error);
          errorDetails = errorObj.error;
        } else if (event.message && event.message !== '{}') {
          errorMessage = event.message;
        } else {
          errorMessage = 'Error event with no details';
          errorDetails = event;
        }

        console.error('[Transport] Error event:', errorMessage, errorDetails);

        logServerEvent({
          type: "error",
          message: errorMessage,
          details: errorDetails,
          raw: event,
        });
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        console.log("[useRealtimeSession] response.audio_transcript.delta event:", event);
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      case "response.output_audio_transcript.delta": {
        console.log("[useRealtimeSession] response.output_audio_transcript.delta event:", event);
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      case "response.output_audio_transcript.done": {
        console.log("[useRealtimeSession] response.output_audio_transcript.done event:", event);
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.done": {
        historyHandlers.handleResponseDone(event);
        break;
      }
      default: {
        logServerEvent(event);
        break;
      }
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = useCallback((item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  }, [callbacks]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    // Define error handler
    const handleError = (...args: any[]) => {
      const errorArg = args[0];

      // Handle empty error objects or missing error details
      let errorMessage = 'Unknown error';
      let errorDetails = errorArg;

      if (errorArg && typeof errorArg === 'object') {
        // Check if error object is empty
        if (Object.keys(errorArg).length === 0) {
          console.warn('[Session] Received empty error object:', args);
          errorMessage = 'Empty error object received';
          errorDetails = { raw: args };
        } else if (errorArg.message) {
          errorMessage = errorArg.message;
        } else if (errorArg.error) {
          errorMessage = typeof errorArg.error === 'string'
            ? errorArg.error
            : JSON.stringify(errorArg.error);
          errorDetails = errorArg.error;
        } else {
          errorMessage = JSON.stringify(errorArg);
        }
      } else if (typeof errorArg === 'string') {
        errorMessage = errorArg;
      }

      console.error('[Session] Error:', errorMessage, errorDetails);

      logServerEvent({
        type: "error",
        message: errorMessage,
        details: errorDetails,
        raw: args,
      });
    };

    // Register all event listeners
    session.on("error", handleError);
    session.on("agent_handoff", handleAgentHandoff);
    session.on("agent_tool_start", historyHandlers.handleAgentToolStart);
    session.on("agent_tool_end", historyHandlers.handleAgentToolEnd);
    session.on("history_updated", historyHandlers.handleHistoryUpdated);
    session.on("history_added", historyHandlers.handleHistoryAdded);
    session.on("guardrail_tripped", historyHandlers.handleGuardrailTripped);
    session.on("transport_event", handleTransportEvent);

    // Register MCP-specific event listeners
    session.on("mcp_tools_changed", mcpHandlers.handleMcpToolsChanged);
    session.on("mcp_tool_call_completed", mcpHandlers.handleMcpToolCallCompleted);

    // Cleanup function to remove all listeners
    return () => {
      session.off("error", handleError);
      session.off("agent_handoff", handleAgentHandoff);
      session.off("agent_tool_start", historyHandlers.handleAgentToolStart);
      session.off("agent_tool_end", historyHandlers.handleAgentToolEnd);
      session.off("history_updated", historyHandlers.handleHistoryUpdated);
      session.off("history_added", historyHandlers.handleHistoryAdded);
      session.off("guardrail_tripped", historyHandlers.handleGuardrailTripped);
      session.off("transport_event", handleTransportEvent);

      // Remove MCP event listeners
      session.off("mcp_tools_changed", mcpHandlers.handleMcpToolsChanged);
      session.off("mcp_tool_call_completed", mcpHandlers.handleMcpToolCallCompleted);
    };
  }, [status, logServerEvent, historyHandlers, mcpHandlers, handleAgentHandoff]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
      model,
    }: ConnectOptions) => {
      console.log('[useRealtimeSession] connect() called');

      // Prevent concurrent connections or connecting when already connected
      if (sessionRef.current || isConnectingRef.current) {
        console.warn('[useRealtimeSession] Already connected or connecting, aborting');
        return;
      }

      isConnectingRef.current = true;
      updateStatus('CONNECTING');

      try {
        console.log('[useRealtimeSession] Initializing session with agents:', {
          agentCount: initialAgents.length,
          rootAgent: initialAgents[0]?.name,
          agents: initialAgents.map(a => a.name),
        });

        const rootAgent = initialAgents[0];

        // Check if root agent has MCP servers
        if (rootAgent.mcpServers && rootAgent.mcpServers.length > 0) {
          console.log('[useRealtimeSession] Root agent has MCP servers:', {
            count: rootAgent.mcpServers.length,
            servers: rootAgent.mcpServers.map((s: any) => ({
              name: s.name,
              type: s.constructor.name,
            })),
          });
        }

        const ek = await getEphemeralKey();
        console.log('[useRealtimeSession] Ephemeral key received, length:', ek.length);

        // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
        //  simulate how the voice agent sounds over a PSTN/SIP phone call.
        const codecParam = codecParamRef.current;
        const audioFormat = audioFormatForCodec(codecParam);
        console.log('[useRealtimeSession] Audio format:', audioFormat, 'codec:', codecParam);

        console.log('[useRealtimeSession] Creating RealtimeSession...');
        sessionRef.current = new RealtimeSession(rootAgent, {
          apiKey: ek, // SDK 0.1.9 requires apiKey in constructor
          transport: new OpenAIRealtimeWebRTC({
            audioElement,
            // Set preferred codec before offer creation
            changePeerConnection: async (pc: RTCPeerConnection) => {
              applyCodec(pc);
              return pc;
            },
          }),
          model: model,
          config: {
            inputAudioFormat: audioFormat,
            outputAudioFormat: audioFormat,
            inputAudioTranscription: {
              model: 'gpt-4o-mini-transcribe',
            },
          },
          outputGuardrails: outputGuardrails ?? [],
          context: extraContext ?? {},
        });
        console.log('[useRealtimeSession] RealtimeSession created successfully');

        console.log('[useRealtimeSession] Calling session.connect()...');
        await sessionRef.current.connect({
          apiKey: ek, // SDK 0.1.9 requires apiKey in connect()
        });
        console.log('[useRealtimeSession] session.connect() completed successfully');

        updateStatus('CONNECTED');
        isConnectingRef.current = false;

        // Set up 15-minute session timeout warning (OpenAI Realtime API limit)
        const SESSION_WARNING_TIME = 14 * 60 * 1000; // 14 minutes
        sessionTimeoutRef.current = setTimeout(() => {
          callbacks.onSessionTimeout?.();
        }, SESSION_WARNING_TIME);

        console.log('[useRealtimeSession] Connection fully established');
      } catch (error) {
        console.error('[useRealtimeSession] Connection failed:', {
          error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });

        // Clean up on connection failure
        sessionRef.current = null;
        isConnectingRef.current = false;
        updateStatus('DISCONNECTED');
        throw error;
      }
    },
    [callbacks, updateStatus, applyCodec],
  );

  const disconnect = useCallback(() => {
    if (!sessionRef.current) return;

    try {
      updateStatus('DISCONNECTING');

      // Clear session timeout if exists
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }

      sessionRef.current.close();
    } catch (error) {
      console.error('Error during disconnect:', error);
    } finally {
      sessionRef.current = null;
      updateStatus('DISCONNECTED');
    }
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  /**
   * Add a context message to the RealtimeSession history
   * This allows external events (like SSE task completions) to be injected into the session context
   *
   * Uses updateHistory() to append a new message item to the session history,
   * making it available in the agent's context for future responses.
   *
   * Based on RealtimeMessageItem type from SDK:
   * - System messages: { type: "message", role: "system", itemId: string, content: object[] }
   * - User messages: { type: "message", role: "user", itemId: string, status: "completed", content: [{ type: "input_text", text: string }] }
   * - Assistant messages: { type: "message", role: "assistant", itemId: string, status: "completed", content: [{ type: "output_text", text: string }] }
   */
  const addContextMessage = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    if (!sessionRef.current) {
      console.warn('[useRealtimeSession] Cannot add context message - session not connected');
      return;
    }

    try {
      console.log('[useRealtimeSession] Adding context message to session:', { role, contentLength: content.length });

      // Get current history using the history getter accessor
      const currentHistory = sessionRef.current.history;

      // Generate unique item ID
      const itemId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Create a new message item with proper RealtimeMessageItem structure based on role
      let newItem: RealtimeMessageItem;

      if (role === 'system') {
        // System message: RealtimeMessageItem with role "system"
        // System messages don't have 'status' field
        newItem = {
          type: 'message',
          role: 'system',
          itemId,
          content: [
            {
              type: 'input_text',
              text: content,
            },
          ],
        } as RealtimeMessageItem;
      } else if (role === 'user') {
        // User message: RealtimeMessageItem with role "user"
        newItem = {
          type: 'message',
          role: 'user',
          itemId,
          status: 'completed',
          content: [
            {
              type: 'input_text',
              text: content,
            },
          ],
        } as RealtimeMessageItem;
      } else {
        // Assistant message: RealtimeMessageItem with role "assistant"
        newItem = {
          type: 'message',
          role: 'assistant',
          itemId,
          status: 'completed',
          content: [
            {
              type: 'output_text',
              text: content,
            },
          ],
        } as RealtimeMessageItem;
      }

      console.log('[useRealtimeSession] Appending message to history:', {
        currentHistoryLength: currentHistory.length,
        newItemId: itemId,
        role,
      });

      // Use updateHistory with new array (not callback)
      sessionRef.current.updateHistory([...currentHistory, newItem]);

      console.log('[useRealtimeSession] Context message added successfully to history');
    } catch (error) {
      console.error('[useRealtimeSession] Failed to add context message:', error);
    }
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    addContextMessage,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
