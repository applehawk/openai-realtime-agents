# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Guidelines

**Documentation Policy:**
- Do NOT create a new markdown file to document each change or summarize your work unless specifically requested by the user.
- Only create documentation when explicitly asked or when it's critical for understanding complex architectural changes.
- Focus on making code changes rather than writing reports about them.

## Overview

This is a Next.js TypeScript demonstration of advanced voice agent patterns using the OpenAI Realtime API and the OpenAI Agents SDK (`@openai/agents`). The project showcases two main agentic patterns: **Chat-Supervisor** (a realtime chat agent backed by a more intelligent supervisor for complex tasks) and **Sequential Handoff** (specialized agents that transfer users between them).

## Development Commands

```bash
# Install dependencies
npm i

# Start development server
npm run dev
# Then open http://localhost:3000

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Setup

- Copy `.env.sample` to `.env` and add your `OPENAI_API_KEY`
- Alternatively, add `OPENAI_API_KEY` to your `.bash_profile` or equivalent

## Architecture

### Core Structure

The application follows a Next.js App Router structure with the main orchestration in `src/app/App.tsx`. Key architectural concepts:

1. **Agent Configurations** (`src/app/agentConfigs/`): Each scenario is defined as an array of `RealtimeAgent` objects from the OpenAI Agents SDK. Agent configs include:
   - `chatSupervisor/`: Chat agent that defers complex tasks to a supervisor model (gpt-4.1)
   - `customerServiceRetail/`: Complex multi-agent flow with authentication, returns, sales, and escalation agents
   - `simpleHandoff.ts`: Basic example of agent handoffs
   - `severstalAssistantAgent/`: Custom agent implementation

2. **Session Management** (`src/app/hooks/useRealtimeSession.ts`):
   - Manages WebRTC connection to OpenAI Realtime API
   - Uses `RealtimeSession` from `@openai/agents/realtime`
   - Handles codec selection (opus/PCMU/PCMA) for simulating phone line quality
   - Coordinates agent handoffs and tool execution

3. **Context Providers**:
   - `TranscriptContext`: Manages conversation transcript and messages
   - `EventContext`: Logs client and server events for debugging

4. **API Routes** (`src/app/api/`):
   - `/api/session`: Creates ephemeral OpenAI Realtime API session tokens
   - `/api/responses`: Handles supervisor agent responses in chat-supervisor pattern
   - `/api/health`: Health check endpoint

### Agent Configuration Pattern

Agent configs are defined in `src/app/agentConfigs/` and registered in `index.ts`. Each scenario exports an array of `RealtimeAgent` objects:

```typescript
export const agentName = new RealtimeAgent({
  name: 'agentName',
  handoffDescription: 'Description for transfer context',
  instructions: 'System prompt for the agent',
  tools: [/* tool definitions */],
  handoffs: [/* other agents this can hand off to */],
});
```

The `allAgentSets` map in `agentConfigs/index.ts` determines which scenarios appear in the UI dropdown.

### Chat-Supervisor Pattern

The chat-supervisor pattern uses two agents working in tandem:
- **Chat Agent** (`chatSupervisor/index.ts`): Handles basic interactions, greetings, and information collection using `gpt-4o-realtime-mini`
- **Supervisor Agent** (`chatSupervisor/supervisorAgent.ts`): More intelligent model (`gpt-4.1`) that handles tool calls and complex responses

The chat agent explicitly defers to the supervisor via `getNextResponseFromSupervisor` tool, maintaining low latency while leveraging higher intelligence for complex tasks.

### Sequential Handoff Pattern

Agents can transfer users between each other using tool-based handoffs. The agent graph is defined by `handoffs` arrays in each agent config. When an agent calls a transfer tool, a `session.update` event changes instructions and available tools for the new agent.

## Key Files to Understand

- `src/app/App.tsx`: Main application orchestration, session management, agent selection
- `src/app/hooks/useRealtimeSession.ts`: WebRTC session lifecycle and event handling
- `src/app/hooks/useHandleSessionHistory.ts`: Processes session events and updates transcript
- `src/app/agentConfigs/types.ts`: Shared types for agent definitions (thin wrapper around SDK types)
- `src/app/lib/codecUtils.ts`: Codec selection logic for simulating phone line quality

## Adding a New Agent Scenario

1. Create a new file in `src/app/agentConfigs/` (e.g., `myAgent.ts`)
2. Define your agent(s) using `new RealtimeAgent({ ... })`
3. Export an array of agents as the default export
4. Import and add to `allAgentSets` in `src/app/agentConfigs/index.ts`
5. The scenario will appear in the "Scenario" dropdown in the UI

## Testing Agent Flows

- Use the **Scenario** dropdown (top right) to switch between agent configurations
- Use the **Agent** dropdown to manually switch to different agents in multi-agent scenarios
- The left pane shows the conversation transcript with expandable tool calls and agent changes
- The right pane shows detailed event logs (both client and server events)
- Bottom toolbar controls connection, push-to-talk, audio playback, and logs visibility

## Tools and Function Calling

Tools are defined using the `tool` helper from `@openai/agents/realtime`. Tool execution happens within the `RealtimeSession` which processes tool calls via the context passed during initialization. In the chat-supervisor pattern, the supervisor agent executes tools via API calls to `/api/responses`.

## Voice Agent Metaprompt

A metaprompt template for creating new voice agents is available at `src/app/agentConfigs/voiceAgentMetaprompt.txt`. This provides conventions for state machines, confirmation flows, and voice-optimized instructions.

## Branch Information

- `main`: Uses OpenAI Agents SDK (`@openai/agents`)
- `without-agents-sdk`: Alternative implementation without the SDK

## Notes on Implementation

- Agent names must be unique within a scenario
- The first agent in the array becomes the default/root agent
- Sessions use ephemeral tokens generated server-side for security
- Audio recording/download functionality is available via `useAudioDownload` hook
- Codec selection (via `?codec=` query param) affects both input and output audio format
