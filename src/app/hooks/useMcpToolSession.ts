"use client";

import { useRef } from "react";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

/**
 * Hook to handle MCP (Model Context Protocol) tool events from the RealtimeSession.
 *
 * This hook manages three main types of MCP events:
 *
 * 1. Session-level events (emitted by RealtimeSession):
 *    - mcp_tools_changed: Fired when the list of available MCP tools changes
 *    - mcp_tool_call_completed: Fired when an MCP tool call finishes execution
 *
 * 2. Server events for MCP call arguments (via transport_event):
 *    - response.mcp_call.arguments.delta: Streaming chunks of MCP tool arguments
 *    - response.mcp_call.arguments.done: MCP tool arguments have been fully received
 *
 * 3. Server events for MCP call status (via transport_event):
 *    - response.mcp_call.in_progress: MCP tool call execution has started
 *    - response.mcp_call.completed: MCP tool call execution finished successfully
 *    - response.mcp_call.failed: MCP tool call execution failed with an error
 */
export function useMcpToolSession() {
  const {
    addTranscriptBreadcrumb,
  } = useTranscript();

  const { logServerEvent } = useEvent();

  // Track MCP tool calls in progress (keyed by call_id or item_id)
  const mcpCallsInProgressRef = useRef<Map<string, {
    name: string;
    argumentsBuffer: string;
    itemId: string;
  }>>(new Map());

  /* ----------------------- Session-level MCP Event Handlers ------------------------- */

  /**
   * Handles the mcp_tools_changed event.
   * Fired when the available MCP tools list changes (e.g., when a new MCP server is connected).
   *
   * @param tools - Array of available MCP tools with their definitions
   */
  function handleMcpToolsChanged(tools: any) {
    console.log("[MCP] Tools changed:", tools);
    logServerEvent({
      type: 'mcp_tools_changed',
      tools: tools,
      count: Array.isArray(tools) ? tools.length : 0,
    });

    addTranscriptBreadcrumb('MCP Tools Changed', {
      toolCount: Array.isArray(tools) ? tools.length : 0,
      tools: tools,
    });
  }

  /**
   * Handles the mcp_tool_call_completed event.
   * Fired when an MCP tool call has completed execution and returned a result.
   *
   * @param _details - Contains context about the completed call (unused)
   * @param toolCall - The tool call object with name, arguments, and call_id
   * @param result - The result returned from the MCP tool execution
   */
  function handleMcpToolCallCompleted(_details: any, toolCall: any, result: any) {
    console.log("[MCP] Tool call completed:", toolCall, result);

    const callId = toolCall?.call_id || toolCall?.id;

    logServerEvent({
      type: 'mcp_tool_call_completed',
      toolName: toolCall?.name,
      callId: callId,
      result: result,
    });

    // Clean up from our tracking map
    if (callId) {
      mcpCallsInProgressRef.current.delete(callId);
    }

    addTranscriptBreadcrumb(`MCP Tool Completed: ${toolCall?.name}`, {
      callId: callId,
      result: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
    });
  }

  /* ----------------------- Server Event Handlers (via transport_event) ------------------------- */

  /**
   * Handles response.mcp_call.arguments.delta event.
   * Fired during streaming of MCP tool call arguments. Each delta contains a chunk
   * of the arguments JSON string being constructed.
   *
   * @param event - Server event containing the delta chunk
   */
  function handleMcpCallArgumentsDelta(event: any) {
    const { item_id, call_id, delta, name, tool_name } = event;
    const id = call_id || item_id;

    if (!id) return;

    logServerEvent(event);

    // Try multiple fields for the tool name
    const toolName = name || tool_name || event.tool?.name || 'unknown';

    // Initialize or update the arguments buffer
    const existing = mcpCallsInProgressRef.current.get(id);
    if (existing) {
      existing.argumentsBuffer += delta || '';
      // Update name if we got a better one
      if (toolName !== 'unknown' && existing.name === 'unknown') {
        existing.name = toolName;
      }
    } else {
      mcpCallsInProgressRef.current.set(id, {
        name: toolName,
        argumentsBuffer: delta || '',
        itemId: item_id || id,
      });
    }

    console.log(`[MCP] Arguments delta for ${toolName} (${id}):`, delta);
  }

  /**
   * Handles response.mcp_call.arguments.done event.
   * Fired when all argument chunks have been received and the complete arguments
   * string is available.
   *
   * @param event - Server event with complete arguments
   */
  function handleMcpCallArgumentsDone(event: any) {
    const { item_id, call_id, arguments: args } = event;
    const id = call_id || item_id;

    if (!id) return;

    logServerEvent(event);

    const callInfo = mcpCallsInProgressRef.current.get(id);
    const finalArguments = args || callInfo?.argumentsBuffer || '';

    console.log(`[MCP] Arguments done for ${id}:`, finalArguments);

    // Parse arguments if it's a JSON string
    let parsedArgs = finalArguments;
    if (typeof finalArguments === 'string') {
      try {
        parsedArgs = JSON.parse(finalArguments);
      } catch {
        console.warn('[MCP] Failed to parse arguments:', finalArguments);
      }
    }

    addTranscriptBreadcrumb(`MCP Tool Arguments Ready: ${callInfo?.name || 'unknown'}`, {
      callId: id,
      arguments: parsedArgs,
    });
  }

  /**
   * Handles response.mcp_call.in_progress event.
   * Fired when an MCP tool call execution has started on the server.
   *
   * @param event - Server event indicating execution start
   */
  function handleMcpCallInProgress(event: any) {
    const { item_id, call_id, name, tool_name } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    // Update the tracking map with the tool name if we have it
    if (id && toolName !== 'unknown') {
      if (callInfo) {
        callInfo.name = toolName;
      } else {
        mcpCallsInProgressRef.current.set(id, {
          name: toolName,
          argumentsBuffer: '',
          itemId: item_id || id,
        });
      }
    }

    console.log(`[MCP] Call in progress: ${toolName} (${id})`, event);

    logServerEvent(event);

    addTranscriptBreadcrumb(`MCP Tool Executing: ${toolName}`, {
      callId: id,
      status: 'in_progress',
    });
  }

  /**
   * Handles response.mcp_call.completed event.
   * Fired when an MCP tool call has successfully completed execution.
   *
   * @param event - Server event with completion details and result
   */
  function handleMcpCallCompleted(event: any) {
    const { item_id, call_id, name, tool_name, output } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    console.log(`[MCP] Call completed: ${toolName} (${id})`, event);

    logServerEvent(event);

    // Clean up from tracking
    if (id) {
      mcpCallsInProgressRef.current.delete(id);
    }

    addTranscriptBreadcrumb(`MCP Tool Success: ${toolName}`, {
      callId: id,
      status: 'completed',
      output: output,
    });
  }

  /**
   * Handles response.mcp_call.failed event.
   * Fired when an MCP tool call execution failed with an error.
   *
   * @param event - Server event with error details
   */
  function handleMcpCallFailed(event: any) {
    const { item_id, call_id, name, tool_name, error } = event;
    const id = call_id || item_id;

    // Try to get the name from the event, tracking map, or use a fallback
    const callInfo = id ? mcpCallsInProgressRef.current.get(id) : undefined;
    const toolName = name || tool_name || event.tool?.name || callInfo?.name || 'unknown';

    console.error(`[MCP] Call failed: ${toolName} (${id})`, error, event);

    logServerEvent({
      type: 'mcp_call_failed',
      name: toolName,
      callId: id,
      error: error,
    });

    // Clean up from tracking
    if (id) {
      mcpCallsInProgressRef.current.delete(id);
    }

    addTranscriptBreadcrumb(`MCP Tool Failed: ${toolName}`, {
      callId: id,
      status: 'failed',
      error: error?.message || error,
    });
  }

  /**
   * Handles response.output_item.added event for MCP calls.
   * This event contains the tool name and item ID, which we need to track.
   */
  function handleMcpItemAdded(event: any) {
    const item = event.item;
    if (!item || item.type !== 'mcp_call') return;

    const itemId = item.id;
    const toolName = item.name;

    if (!itemId || !toolName) return;

    console.log(`[MCP] Item added: ${toolName} (${itemId})`);

    // Store the tool name in our tracking map
    mcpCallsInProgressRef.current.set(itemId, {
      name: toolName,
      argumentsBuffer: '',
      itemId: itemId,
    });

    logServerEvent(event);
  }

  /**
   * Handles response.output_item.done event.
   * Fired when an output item (including function_call items) is completed.
   *
   * @param event - Server event with the completed item details
   */
  function handleOutputItemDone(event: any) {
    const item = event.item;

    if (!item) {
      logServerEvent(event);
      return;
    }

    console.log(`[MCP] Output item done:`, item);

    // Handle function_call completion
    if (item.type === 'function_call') {
      const { id, name, call_id, status, arguments: args } = item;
      const itemId = id || call_id;

      logServerEvent(event);

      // Check if this is an error status
      if (status === 'failed' || status === 'error') {
        console.error(`[MCP] Function call failed: ${name} (${itemId})`, event);

        addTranscriptBreadcrumb(`MCP Function Call Failed: ${name}`, {
          callId: itemId,
          status: status,
          arguments: args,
          event: event,
        });

        // Clean up from tracking
        if (itemId) {
          mcpCallsInProgressRef.current.delete(itemId);
        }
      } else if (status === 'completed') {
        console.log(`[MCP] Function call completed: ${name} (${itemId})`);

        addTranscriptBreadcrumb(`MCP Function Call Done: ${name}`, {
          callId: itemId,
          status: status,
          arguments: args,
        });

        // Clean up from tracking
        if (itemId) {
          mcpCallsInProgressRef.current.delete(itemId);
        }
      }
    } else {
      // Log other types of output items
      logServerEvent(event);
    }
  }

  /**
   * Main handler for MCP-related transport events.
   * Routes server events to the appropriate handler based on event type.
   *
   * @param event - Raw server event from the transport layer
   * @returns true if event was handled, false otherwise
   */
  function handleMcpTransportEvent(event: any): boolean {
    if (!event?.type) return false;

    // Debug: log all MCP-related events to see their structure
    if (event.type?.includes('mcp')) {
      console.log('[MCP Debug] Full event:', JSON.stringify(event, null, 2));
    }

    switch (event.type) {
      case "response.output_item.added":
      case "conversation.item.added":
        // Check if this is an MCP call and handle it
        if (event.item?.type === 'mcp_call') {
          handleMcpItemAdded(event);
          return true;
        }
        return false;

      case "response.output_item.done":
        // Handle completion of function_call items (including MCP tools)
        handleOutputItemDone(event);
        return true;

      case "response.mcp_call.arguments.delta":
      case "response.mcp_call_arguments.delta":
        handleMcpCallArgumentsDelta(event);
        return true;

      case "response.mcp_call.arguments.done":
      case "response.mcp_call_arguments.done":
        handleMcpCallArgumentsDone(event);
        return true;

      case "response.mcp_call.in_progress":
        handleMcpCallInProgress(event);
        return true;

      case "response.mcp_call.completed":
        handleMcpCallCompleted(event);
        return true;

      case "response.mcp_call.failed":
        handleMcpCallFailed(event);
        return true;

      default:
        return false;
    }
  }

  const handlersRef = useRef({
    handleMcpToolsChanged,
    handleMcpToolCallCompleted,
    handleMcpTransportEvent,
  });

  return handlersRef;
}