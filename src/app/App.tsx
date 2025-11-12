"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

// UI components
import Transcript from "./components/Transcript";
import Events from "./components/Events";
import BottomToolbar from "./components/BottomToolbar";
import UserProfile from "./components/UserProfile";
import SeverstalLogo from "./components/SeverstalLogo";
import InterviewButton from "./components/InterviewButton";
import RagStatusChecker from "./components/RagStatusChecker";

// Types
import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from '@openai/agents/realtime';

// Context providers & hooks
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";

// Agent configs
// import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import {
  chatSeverstalAssistantScenario,
  mcpServerManager,
  getCurrentRouterAgent,
} from "@/app/agentConfigs/severstalAssistantAgent";

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import { useTaskCompletionSync } from "./hooks/useTaskCompletionSync";

function App() {
  const searchParams = useSearchParams()!;

  // ---------------------------------------------------------------------
  // Codec selector – lets you toggle between wide-band Opus (48 kHz)
  // and narrow-band PCMU/PCMA (8 kHz) to hear what the agent sounds like on
  // a traditional phone line and to validate ASR / VAD behaviour under that
  // constraint.
  //
  // We read the `?codec=` query-param and rely on the `changePeerConnection`
  // hook (configured in `useRealtimeSession`) to set the preferred codec
  // before the offer/answer negotiation.
  // ---------------------------------------------------------------------
  const urlCodec = searchParams.get("codec") || "opus";

  // Agents SDK doesn't currently support codec selection so it is now forced 
  // via global codecPatch at module load 

  const {
    addTranscriptMessage,
    addTranscriptBreadcrumb,
    addTaskProgressMessage,
    updateTaskProgress,
    activeSessionId,
  } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  const [selectedAgentName, setSelectedAgentName] = useState<string>("");
  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<
    RealtimeAgent[] | null
  >(null);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  // Ref to identify whether the latest agent switch came from an automatic handoff
  const handoffTriggeredRef = useRef(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  // Attach SDK audio element once it exists (after first render in browser)
  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const {
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    addContextMessage,
    interrupt,
    mute,
  } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      handoffTriggeredRef.current = true;
      setSelectedAgentName(agentName);
    },
  });

  const [sessionStatus, setSessionStatus] =
    useState<SessionStatus>("DISCONNECTED");

  // Store current user info for use in session
  const [currentUserInfo, setCurrentUserInfo] = useState<{
    userId: string;
    username: string;
    email: string;
    googleConnected?: boolean;
    googleServices?: string[];
  } | null>(null);

  const [isEventsPaneExpanded, setIsEventsPaneExpanded] =
    useState<boolean>(true);
  const [userText, setUserText] = useState<string>("");
  const [isPTTActive, setIsPTTActive] = useState<boolean>(false);
  const [isPTTUserSpeaking, setIsPTTUserSpeaking] = useState<boolean>(false);
  const [isAudioPlaybackEnabled, setIsAudioPlaybackEnabled] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return true;
      const stored = localStorage.getItem('audioPlaybackEnabled');
      return stored ? stored === 'true' : true;
    },
  );
  const [isRagStatusVisible, setIsRagStatusVisible] = useState<boolean>(false);

  // Initialize the recording hook.
  const { startRecording, stopRecording, downloadRecording } =
    useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

  useHandleSessionHistory();

  // Sync task progress and completion to RealtimeSession context
  // - Syncs step_completed events for intermediate progress
  // - Syncs final completed event with full results
  useTaskCompletionSync({
    sessionId: activeSessionId,
    addContextMessage,
    enabled: sessionStatus === 'CONNECTED',
    syncStepCompletions: true, // Sync intermediate step completions
  });

  // Note: MCP server initialization moved to UserProfile.tsx
  // It will be initialized after container starts successfully

  useEffect(() => {
    // Set default agent name for severstalAssistant
    const agentKeyToUse = 'routerAgent';
    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(chatSeverstalAssistantScenario);
  }, []);

  useEffect(() => {
    const onMcpReady = () => {
      console.log('[App] Received mcp:ready event');
      // Verify MCP is actually connected before connecting to Realtime
      if (mcpServerManager.isServerConnected()) {
        console.log('[App] MCP server confirmed connected, proceeding with Realtime connection');
        if (selectedAgentName && sessionStatus === 'DISCONNECTED') {
          connectToRealtime();
        }
      } else {
        console.warn('[App] Received mcp:ready but server not connected, skipping Realtime connection');
      }
    };
    window.addEventListener('mcp:ready', onMcpReady);

    return () => {
      window.removeEventListener('mcp:ready', onMcpReady);
    };
  }, [selectedAgentName, sessionStatus]);

  // useEffect(() => {
  //   if (selectedAgentName && sessionStatus === "DISCONNECTED") {
  //     connectToRealtime();
  //   }
  // }, [selectedAgentName]);


  useEffect(() => {
    if (
      sessionStatus === "CONNECTED" &&
      selectedAgentConfigSet &&
      selectedAgentName
    ) {
      const currentAgent = selectedAgentConfigSet.find(
        (a) => a.name === selectedAgentName
      );
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      updateSession(!handoffTriggeredRef.current);
      // Reset flag after handling so subsequent effects behave normally
      handoffTriggeredRef.current = false;
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive]);

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");

    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();

    logServerEvent(data, "fetch_session_token_response");

    if (!data.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }

    return data.value;
  };

  const connectToRealtime = async () => {
    console.log('[App] connectToRealtime() called');
    console.log('[App] Current sessionStatus:', sessionStatus);
    if (sessionStatus !== "DISCONNECTED") {
      console.warn('[App] Session not DISCONNECTED, aborting connection');
      return;
    }

    try {
      // NOTE: MCP servers will be initialized AFTER connection to avoid trace context errors
      console.log('[App] 🔄 Skipping MCP initialization before connect() to avoid trace context errors');

      console.log('[App] Fetching ephemeral key...');
      const EPHEMERAL_KEY = await fetchEphemeralKey();
      if (!EPHEMERAL_KEY) {
        console.error('[App] No ephemeral key received, aborting connection');
        return;
      }
      console.log('[App] Ephemeral key received successfully');

      // Fetch user info to include in context
      console.log('[App] 👤 Fetching user info for context...');
      let currentUser = null;
      try {
        const userResponse = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include',
        });
        if (userResponse.ok) {
          currentUser = await userResponse.json();
          console.log('[App] ✅ User info retrieved:', {
            username: currentUser.username,
            email: currentUser.email,
          });

          // Save to state for later use
          setCurrentUserInfo({
            userId: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            googleConnected: currentUser.google_connected,
            googleServices: currentUser.google_services,
          });
        } else {
          console.warn('[App] ⚠️ Failed to fetch user info (not authenticated)');
        }
      } catch (userError) {
        console.error('[App] ❌ Error fetching user info:', userError);
      }

      // Get the current router agent (may have MCP servers after initialization)
      const currentRouterAgent = getCurrentRouterAgent();
      console.log('[App] 📡 Using router agent for session:', {
        name: currentRouterAgent.name,
        mcpServersCount: currentRouterAgent.mcpServers?.length || 0,
      });

      await connect({
        getEphemeralKey: async () => EPHEMERAL_KEY,
        initialAgents: [currentRouterAgent], // Use current agent with MCP servers
        audioElement: sdkAudioElement,
        outputGuardrails: [],
        extraContext: {
          addTranscriptBreadcrumb,
          addTaskProgressMessage,
          updateTaskProgress,
          // Allow agents to access task context from IntelligentSupervisor
          getTaskContext: async (sessionId: string) => {
            // Import dynamically to avoid circular dependencies
            const { taskContextStore } = await import('./api/supervisor/unified/taskContextStore');
            return taskContextStore.getContext(sessionId);
          },
          // Include user info in context so tools can access it without async fetch
          currentUser: currentUser ? {
            userId: currentUser.id,
            username: currentUser.username,
            email: currentUser.email,
            googleConnected: currentUser.google_connected,
            googleServices: currentUser.google_services,
          } : null,
        },
        model: "gpt-realtime",
      });
      console.log('[App] ✅ connect() completed successfully');
      
    } catch (err) {
      console.error("[App] Error connecting via SDK:", {
        error: err,
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setSessionStatus("DISCONNECTED");
    }
    return;
  };

  const disconnectFromRealtime = () => {
    disconnect();
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);

    sendClientEvent({
      type: 'conversation.item.create',
      item: {
        id,
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const handleStartInterview = () => {
    // Отправляем сообщение агенту для запуска интервью
    sendSimulatedUserMessage("Проведи со мной первичное интервью для настройки предпочтений");
  };

  const updateSession = (shouldTriggerResponse: boolean = false) => {
    // Reflect Push-to-Talk UI state by (de)activating server VAD on the
    // backend. The Realtime SDK supports live session updates via the
    // `session.update` event.
    sendEvent({
      type: 'session.update',
      session: {
        type: 'realtime',
      },
    });

    // Send an initial message with user context
    if (shouldTriggerResponse && currentUserInfo) {
      const userContextMessage = `Привет! Я ${currentUserInfo.username} (email: ${currentUserInfo.email}). Проверь статус моего интервью и предложи помощь.`;
      sendSimulatedUserMessage(userContextMessage);
    } else if (shouldTriggerResponse) {
      sendSimulatedUserMessage('Привет! Проверь статус моего интервью и предложи помощь.');
    }
    return;
  }

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();

    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }

    setUserText("");
  };

  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();

    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');

    // No placeholder; we'll rely on server transcript once ready.
  };

  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking)
      return;

    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      // Verify MCP server is connected before attempting Realtime connection
      if (!mcpServerManager.isServerConnected()) {
        console.warn('[App] Cannot connect to Realtime: MCP server is not connected');
        alert('Please start the MCP container first from your user profile dropdown.');
        return;
      }

      try {
        console.log('[App] MCP server verified connected, initiating Realtime connection');
        connectToRealtime();
        // при успешном подключении connectToRealtime обычно сам установит sessionStatus,
        // но если вы хотите — можно здесь setSessionStatus("CONNECTING") до вызова и т.д.
      } catch (err) {
        console.error('connectToRealtime failed from onToggleConnection:', err);
      }
    }
  };

  // Because we need a new connection, refresh the page when codec changes
  const handleCodecChange = (newCodec: string) => {
    const url = new URL(window.location.toString());
    url.searchParams.set("codec", newCodec);
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const storedPushToTalkUI = localStorage.getItem("pushToTalkUI");
    if (storedPushToTalkUI) {
      setIsPTTActive(storedPushToTalkUI === "true");
    }
    const storedLogsExpanded = localStorage.getItem("logsExpanded");
    if (storedLogsExpanded) {
      setIsEventsPaneExpanded(storedLogsExpanded === "true");
    }
    const storedAudioPlaybackEnabled = localStorage.getItem(
      "audioPlaybackEnabled"
    );
    if (storedAudioPlaybackEnabled) {
      setIsAudioPlaybackEnabled(storedAudioPlaybackEnabled === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pushToTalkUI", isPTTActive.toString());
  }, [isPTTActive]);

  useEffect(() => {
    localStorage.setItem("logsExpanded", isEventsPaneExpanded.toString());
  }, [isEventsPaneExpanded]);

  useEffect(() => {
    localStorage.setItem(
      "audioPlaybackEnabled",
      isAudioPlaybackEnabled.toString()
    );
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch((err) => {
          console.warn("Autoplay may be blocked by browser:", err);
        });
      } else {
        // Mute and pause to avoid brief audio blips before pause takes effect.
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }

    // Toggle server-side audio stream mute so bandwidth is saved when the
    // user disables playback. 
    try {
      mute(!isAudioPlaybackEnabled);
    } catch (err) {
      console.warn('Failed to toggle SDK mute', err);
    }
  }, [isAudioPlaybackEnabled]);

  // Ensure mute state is propagated to transport right after we connect or
  // whenever the SDK client reference becomes available.
  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try {
        mute(!isAudioPlaybackEnabled);
      } catch (err) {
        console.warn('mute sync after connect failed', err);
      }
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      // The remote audio stream from the audio element.
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }

    // Clean up on unmount or when sessionStatus is updated.
    return () => {
      stopRecording();
    };
  }, [sessionStatus]);

  return (
    <div className="text-base flex flex-col h-screen bg-gray-100 text-gray-800 relative">
      <div className="p-5 text-lg font-semibold flex justify-between items-center">
        <div
          className="flex items-center cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <div className="logo">
            <SeverstalLogo width={168} height={52} className="mr-2" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsRagStatusVisible(!isRagStatusVisible)}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            title="Toggle RAG Status"
          >
            RAG Status
          </button>
          <InterviewButton onStartInterview={handleStartInterview} />
          <UserProfile />
        </div>
      </div>

      {isRagStatusVisible && (
        <div className="px-5 pb-2">
          <RagStatusChecker />
        </div>
      )}

      <div className="flex flex-1 gap-2 px-2 overflow-hidden relative">
        <Transcript
          userText={userText}
          setUserText={setUserText}
          onSendMessage={handleSendTextMessage}
          downloadRecording={downloadRecording}
          canSend={
            sessionStatus === "CONNECTED"
          }
        />

        <Events isExpanded={isEventsPaneExpanded} />
      </div>

      <BottomToolbar
        sessionStatus={sessionStatus}
        onToggleConnection={onToggleConnection}
        isPTTActive={isPTTActive}
        setIsPTTActive={setIsPTTActive}
        isPTTUserSpeaking={isPTTUserSpeaking}
        handleTalkButtonDown={handleTalkButtonDown}
        handleTalkButtonUp={handleTalkButtonUp}
        isEventsPaneExpanded={isEventsPaneExpanded}
        setIsEventsPaneExpanded={setIsEventsPaneExpanded}
        isAudioPlaybackEnabled={isAudioPlaybackEnabled}
        setIsAudioPlaybackEnabled={setIsAudioPlaybackEnabled}
        codec={urlCodec}
        onCodecChange={handleCodecChange}
      />
    </div>
  );
}

export default App;
