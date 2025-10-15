# How to Verify MCP Tools Connection

This document provides multiple methods to verify that `hostedMcpTool` instances are properly connected to the `severstalAssistant` RealtimeAgent.

## Quick Summary

The `severstalAssistant` agent has **3 tools** configured:
1. **Calendar MCP** - Email and calendar operations (`https://rndaibot.app.n8n.cloud/mcp/google_my_account`)
2. **RAG MCP** - Knowledge base queries (`http://79.132.139.57:9621/`)
3. **delegateToSupervisor** - Custom tool for complex task delegation

## Verification Methods

### Method 1: Static Code Inspection ✅

**Location:** [index.ts:111-118](./index.ts)

```typescript
tools: [
    hostedMcpTool({
        serverLabel: 'calendar',
        serverUrl: 'https://rndaibot.app.n8n.cloud/mcp/google_my_account',
    }),
    hostedMcpTool({
        serverLabel: 'RAG',
        serverUrl: 'http://79.132.139.57:9621/',
    }),
    delegateToSupervisor,
],
```

### Method 2: Browser Console Logs ✅

When you start the app, check the browser console for:

```
[severstalAssistant] Agent initialized with tools: {
  toolCount: 3,
  toolNames: [...],
  toolTypes: [...]
}
```

### Method 3: Test Page (Recommended) ✅

Visit the dedicated test page: **http://localhost:3000/test-mcp**

This page will show:
- Connection status (✅ Connected / ❌ Not Connected)
- Total tool count
- MCP tools detected with full details
- Any errors or warnings
- Step-by-step verification instructions

### Method 4: Verification Utility ✅

Use the programmatic verification function:

```typescript
import { verifyMcpToolsConnection } from '@/app/agentConfigs/severstalAssistantAgent/verifyMcpTools';

const result = verifyMcpToolsConnection();
console.log('MCP Tools Connected:', result.isConnected);
console.log('Details:', result.mcpTools);
```

### Method 5: Runtime Monitoring ✅

Monitor MCP tool calls in real-time using the global monitor:

```typescript
// In browser console after app loads:
mcpMonitor.printReport()  // View statistics
mcpMonitor.getCalls()     // Get all logged calls
mcpMonitor.getStats()     // Get usage statistics
```

### Method 6: Session Events Inspection ✅

When running the main app:

1. Select "Severstal Assistant" from the Scenario dropdown
2. Click "Connect" to start a session
3. Open the **Events** pane (right side of the UI)
4. Look for `session.update` events
5. Expand the event and check the `tools` array

Example of what you should see:
```json
{
  "type": "session.update",
  "session": {
    "tools": [
      {
        "type": "function",
        "name": "calendar_...",
        ...
      },
      {
        "type": "function",
        "name": "RAG_...",
        ...
      }
    ]
  }
}
```

### Method 7: Trigger a Tool Call ✅

Test that tools are actually working:

1. Connect to the agent
2. Say (in Russian): **"Прочитай последнее письмо"** (Read the last email)
3. Watch for:
   - Function call events in the Events pane
   - Console logs showing `[supervisorAgent] function call: ...`
   - Network requests to the MCP server URLs

### Method 8: Network Tab Monitoring ✅

Open browser DevTools → Network tab:

1. Connect to the agent and trigger a tool
2. Look for requests to:
   - `https://rndaibot.app.n8n.cloud/mcp/google_my_account`
   - `https://79.132.139.57:9621/`
3. Verify the requests complete successfully (status 200)

## Expected Results

### ✅ Successful Connection

You should see:
- ✅ Tool count: 3
- ✅ MCP tools detected: 2
- ✅ `calendar` server present with correct URL
- ✅ `RAG` server present with correct URL
- ✅ `delegateToSupervisor` tool present
- ✅ No critical errors

### ❌ Connection Issues

Common problems and solutions:

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| "No tools found" | Agent not initialized | Check import path and ensure module loaded |
| "No MCP tools detected" | SDK may proxy tools | Check session events for actual tool names |
| "Tool count mismatch" | Runtime vs config difference | Verify session.update events |
| "Server URL missing protocol" | Invalid URL format | Ensure URLs start with `https://` |
| Network errors during tool calls | Server unreachable | Check server status and CORS configuration |

## Debugging Checklist

- [ ] Run test page at `/test-mcp`
- [ ] Check browser console for initialization logs
- [ ] Verify agent appears in Scenario dropdown
- [ ] Connect to agent and check Events pane
- [ ] Try triggering a simple tool call
- [ ] Monitor network requests during tool execution
- [ ] Check `mcpMonitor.getStats()` in console
- [ ] Review supervisor agent logs if delegation occurs

## Additional Resources

- **OpenAI Agents SDK Docs**: https://openai.github.io/openai-agents-js/
- **MCP Tools Guide**: https://openai.github.io/openai-agents-js/guides/tools/
- **Verification Utility**: [verifyMcpTools.ts](./verifyMcpTools.ts)
- **Monitor Utility**: [mcpToolMonitor.ts](./mcpToolMonitor.ts)
- **Test Page**: [/src/app/test-mcp/page.tsx](../../test-mcp/page.tsx)

## Quick Commands

```bash
# Start dev server
npm run dev

# Open test page
open http://localhost:3000/test-mcp

# Open main app
open http://localhost:3000
```

## Console Commands

```javascript
// In browser console after app loads:

// Check tool configuration
window.mcpMonitor.printReport()

// Get detailed call history
window.mcpMonitor.getCalls()

// Export for analysis
console.log(window.mcpMonitor.exportCalls())

// Clear history
window.mcpMonitor.clear()
```

## Notes

- The supervisor agent (GPT-5) also has access to the same MCP tools via `supervisorMcpTools` in [supervisorAgent.ts:7-18](./supervisorAgent.ts)
- MCP tools from the OpenAI SDK may be wrapped/proxied, so direct inspection might not show all internal properties
- Tool execution happens within the `RealtimeSession` context
- For complex tasks, tools are delegated to the supervisor agent which has its own MCP tool instances

## Troubleshooting

### "MCP tools not appearing in session.update events"

This could be because:
1. The SDK automatically registers the tools - check for `function` type tools in the event
2. Tool names might be auto-generated (e.g., `calendar_list_emails` instead of `calendar`)

### "Tool calls failing with network errors"

Verify:
1. Server URLs are accessible from your network
2. CORS is properly configured on the MCP servers
3. API keys/authentication are set up correctly
4. Firewall isn't blocking requests

### "Verification shows 0 MCP tools"

If verification shows 0 MCP tools but the agent works:
- The SDK may be structuring tools differently than expected
- Check the actual session events to see how tools appear at runtime
- MCP tools might be registered but not exposed via the properties the verification script checks
