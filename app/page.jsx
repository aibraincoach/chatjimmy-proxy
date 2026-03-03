'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function nowLabel() {
  return new Date().toLocaleTimeString();
}

function getHelpDocSections(baseUrl) {
  return {
    chat: [
      {
        title: 'POST /api/chat',
        description:
          'Proxy chat endpoint with streaming output by default and optional JSON mode via ?format=json.',
      },
      {
        title: 'Streaming mode (default)',
        code: `curl -N -X POST "${baseUrl}/api/chat" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "message": "Explain what this API does",
    "history": [
      { "role": "user", "content": "Hi" },
      { "role": "assistant", "content": "Hello!" }
    ]
  }'`,
      },
      {
        title: 'JSON mode (?format=json)',
        code: `curl -X POST "${baseUrl}/api/chat?format=json" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "message": "Explain what this API does",
    "history": [],
    "chatOptions": {
      "selectedModel": "llama3.1-8B",
      "systemPrompt": "",
      "topK": 8
    }
  }'`,
      },
      {
        title: 'Request body schema',
        code: `{
  "message": "string (required)",
  "history": [
    {
      "role": "string (default: \"user\")",
      "content": "string (default: \"\")"
    }
  ],
  "chatOptions": {
    "selectedModel": "string (default forwarded upstream: \"llama3.1-8B\")",
    "systemPrompt": "string (default: \"\")",
    "topK": "number (default: 8)"
  }
}`,
      },
      {
        title: 'JSON response schema (?format=json)',
        code: `{
  "id": "string",
  "object": "chat.completion",
  "created": "number (unix seconds)",
  "model": "string",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "string" },
      "finish_reason": "string"
    }
  ],
  "usage": {
    "prefill_tokens": "number | null",
    "decode_tokens": "number | null",
    "total_tokens": "number | null",
    "total_duration": "number | null"
  }
}`,
      },
    ],
    health: [
      {
        title: 'GET /api/health',
        description: 'Checks proxy + upstream health and includes latency in milliseconds.',
      },
      {
        title: 'Example request',
        code: `curl "${baseUrl}/api/health"`,
      },
      {
        title: 'Example response',
        code: `{
  "proxy": "ok",
  "latencyMs": 123,
  "upstreamStatus": 200,
  "upstream": {
    "status": "ok"
  }
}`,
      },
    ],
    models: [
      {
        title: 'GET /api/models',
        description: 'Returns model metadata proxied directly from the upstream API.',
      },
      {
        title: 'Example request',
        code: `curl "${baseUrl}/api/models"`,
      },
      {
        title: 'Example response',
        code: `[
  {
    "id": "llama3.1-8B",
    "name": "Llama 3.1 8B",
    "provider": "Taalas Inc."
  }
]`,
      },
    ],
    completions: [
      {
        title: 'POST /v1/chat/completions',
        description:
          'OpenAI-compatible chat completions endpoint. Works as a drop-in backend for any standard OpenAI SDK client. Supports both streaming (SSE) and non-streaming responses.',
      },
      {
        title: 'Non-streaming request',
        code: `curl -X POST "${baseUrl}/v1/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "model": "llama3.1-8B",
    "messages": [
      {"role": "system", "content": "You are helpful."},
      {"role": "user", "content": "What is 2+2?"}
    ],
    "stream": false
  }'`,
      },
      {
        title: 'Streaming request (SSE)',
        code: `curl -N -X POST "${baseUrl}/v1/chat/completions" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "model": "llama3.1-8B",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "stream": true
  }'`,
      },
      {
        title: 'Python OpenAI SDK example',
        code: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}/v1",
    api_key="anything"
)
response = client.chat.completions.create(
    model="llama3.1-8B",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "What is 2+2?"}
    ]
)
print(response.choices[0].message.content)`,
      },
      {
        title: 'Request body schema',
        code: `{
  "model": "string (default: \"llama3.1-8B\")",
  "messages": [
    { "role": "system | user | assistant", "content": "string" }
  ],
  "stream": "boolean (default: false)",
  "top_k": "number (default: 8, also accepts topK)"
}`,
      },
      {
        title: 'Non-streaming response schema',
        code: `{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1725840132,
  "model": "llama3.1-8B",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "string" },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": -1,
    "completion_tokens": -1,
    "total_tokens": -1
  }
}`,
      },
    ],
  };
}

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION || 'unknown';
const COMMIT_SHA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'unknown';
const BUILD_TIMESTAMP = process.env.NEXT_PUBLIC_BUILD_TIMESTAMP || 'unknown';

const WHY_THIS_EXISTS_LINES = [
  'WHY THIS EXISTS',
  '',
  "ChatJimmy.ai is a demo chatbot built by Taalas (taalas.com) to showcase their HC1 chip — custom silicon that hardwires Meta's Llama 3.1 8B directly into the hardware. The result: ~17,000 tokens per second per user, roughly 10x faster than the next fastest inference provider, at a fraction of the cost and power.",
  '',
  'But a chatbot is just a toy. The real power of sub-millisecond inference is in programmatic access — applications where microseconds matter: real-time agents, high-frequency decision loops, latency-sensitive pipelines, and any workflow where waiting 500ms for a response is a dealbreaker.',
  '',
  "This proxy exists to unlock that power. It wraps ChatJimmy's frontend-only interface in a clean, OpenAI-compatible API so developers can build real applications on top of the fastest inference hardware in the world.",
  '',
  'Architecture: Your app → This proxy → Taalas HC1 silicon → response in under 5ms.',
];

function getHelpPayload(commandText) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const normalized = commandText.trim().toLowerCase();
  const sections = getHelpDocSections(baseUrl);

  if (normalized === '/help chat') {
    return { title: 'API Help: /api/chat', sections: sections.chat };
  }

  if (normalized === '/help health') {
    return { title: 'API Help: /api/health', sections: sections.health };
  }

  if (normalized === '/help models') {
    return { title: 'API Help: /api/models', sections: sections.models };
  }

  if (normalized === '/help completions') {
    return { title: 'API Help: /v1/chat/completions', sections: sections.completions };
  }

  return {
    title: 'API Help: chatjimmy-proxy',
    intro: [
      ...WHY_THIS_EXISTS_LINES,
      '',
      `Base URL: ${baseUrl}`,
      'Authentication: none required.',
      'Upstream: chatjimmy.ai running Llama 3.1 8B by Taalas Inc.',
    ],
    sections: [...sections.chat, ...sections.health, ...sections.models, ...sections.completions],
  };
}

function getVersionPayload() {
  return {
    title: 'Proxy Version',
    lines: [
      `version: ${VERSION}`,
      `commit: ${COMMIT_SHA}`,
      `buildTimestamp: ${BUILD_TIMESTAMP}`,
    ],
  };
}

export default function HomePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [connection, setConnection] = useState({ status: 'checking', latencyMs: null });
  const [logs, setLogs] = useState([]);
  const abortRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  const pushLog = (type, text) => {
    setLogs((current) => [...current, `[${nowLabel()}] ${type}: ${text}`]);
  };

  useEffect(() => {
    let mounted = true;

    async function checkHealth() {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        if (!mounted) return;
        setConnection({ status: data.proxy === 'ok' ? 'online' : 'degraded', latencyMs: data.latencyMs });
        pushLog('health', JSON.stringify(data));
      } catch (error) {
        if (!mounted) return;
        setConnection({ status: 'offline', latencyMs: null });
        pushLog('health-error', error instanceof Error ? error.message : 'unknown');
      }
    }

    checkHealth();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSend(event) {
    event.preventDefault();
    if (!canSend) return;

    const outgoingMessage = input.trim();
    setInput('');

    if (/^\/help(\s+(chat|health|models|completions))?$/i.test(outgoingMessage)) {
      const helpPayload = getHelpPayload(outgoingMessage);
      setMessages((current) => [
        ...current,
        { role: 'user', content: outgoingMessage },
        { role: 'assistant', content: '', type: 'help', helpPayload },
      ]);
      pushLog('command', `${outgoingMessage} (intercepted — not sent to API)`);
      return;
    }

    if (/^\/version$/i.test(outgoingMessage)) {
      const versionPayload = getVersionPayload();
      setMessages((current) => [
        ...current,
        { role: 'user', content: outgoingMessage },
        { role: 'assistant', content: '', type: 'version', versionPayload },
      ]);
      pushLog('command', `${outgoingMessage} (intercepted — not sent to API)`);
      return;
    }

    const nextMessages = [
      ...messages,
      { role: 'user', content: outgoingMessage },
      { role: 'assistant', content: '' },
    ];
    setMessages(nextMessages);
    setIsSending(true);

    const requestPayload = {
      message: outgoingMessage,
      history: messages.map(({ role, content }) => ({ role, content })),
    };

    pushLog('request', JSON.stringify(requestPayload, null, 2));
    pushLog('path', 'Browser -> /api/chat -> https://chatjimmy.ai/api/chat -> Browser');

    const startedAt = performance.now();
    let chunkCount = 0;
    let totalChars = 0;

    const appendAssistantContent = (contentChunk) => {
      if (!contentChunk) return;

      setMessages((current) => {
        const updated = [...current];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: `${updated[updated.length - 1].content}${contentChunk}`,
        };
        return updated;
      });
    };

    const fetchController = new AbortController();
    abortRef.current = fetchController;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: fetchController.signal,
      });

      if (!response.body) {
        throw new Error('No streaming body found in proxy response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inStatsBlock = false;

      const stripStatsBlocks = (text) => {
        if (!text) return '';

        let visibleText = '';
        let cursor = 0;

        while (cursor < text.length) {
          if (inStatsBlock) {
            const statsEnd = text.indexOf('<|/stats|>', cursor);
            if (statsEnd === -1) {
              return visibleText;
            }

            cursor = statsEnd + '<|/stats|>'.length;
            inStatsBlock = false;
            continue;
          }

          const statsStart = text.indexOf('<|stats|>', cursor);
          if (statsStart === -1) {
            visibleText += text.slice(cursor);
            break;
          }

          visibleText += text.slice(cursor, statsStart);
          cursor = statsStart + '<|stats|>'.length;
          inStatsBlock = true;
        }

        return visibleText;
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;
        chunkCount += 1;
        totalChars += chunkText.length;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          pushLog('stream', line);

          if (line.startsWith('0:')) {
            const payload = line.slice(2);
            try {
              const token = JSON.parse(payload);
              appendAssistantContent(token);
            } catch {
              // We keep this parser permissive so malformed inspector lines don't break the entire chat demo.
            }
            continue;
          }

          appendAssistantContent(stripStatsBlocks(`${line}\n`));
        }
      }

      if (buffer.trim()) {
        pushLog('stream', buffer);

        if (buffer.startsWith('0:')) {
          const payload = buffer.slice(2);
          try {
            const token = JSON.parse(payload);
            appendAssistantContent(token);
          } catch {
            // We keep this parser permissive so malformed inspector lines don't break the entire chat demo.
          }
        } else {
          appendAssistantContent(stripStatsBlocks(buffer));
        }
      }

      const elapsedMs = Math.round(performance.now() - startedAt);
      pushLog('stats', `chunks=${chunkCount}, chars=${totalChars}, elapsedMs=${elapsedMs}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        appendAssistantContent('[Response cancelled]');
        pushLog('cancelled', 'Request aborted by user');
      } else {
        pushLog('error', error instanceof Error ? error.message : 'unknown');
      }
    } finally {
      abortRef.current = null;
      setIsSending(false);
    }
  }

  const statusColor = connection.status === 'online' ? '#45d483' : connection.status === 'checking' ? '#ffc857' : '#ff6b6b';

  return (
    <main style={styles.main}>
      <section style={styles.panel}>
        <header style={styles.header}>
          <h1 style={styles.title}>ChatJimmy Proxy Chat</h1>
          <span style={{ ...styles.badge, borderColor: statusColor, color: statusColor }}>
            {connection.status}
            {typeof connection.latencyMs === 'number' ? ` (${connection.latencyMs}ms)` : ''}
          </span>
        </header>

        <div style={styles.chatWindow}>
          {messages.map((msg, idx) => (
            <div
              key={`${msg.role}-${idx}`}
              style={{
                ...styles.bubble,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                background: msg.role === 'user' ? '#21466b' : '#202636',
              }}
            >
              <div style={styles.role}>{msg.role}</div>
              {msg.type === 'help' ? (
                <div style={styles.helpDoc}>
                  <div style={styles.helpTitle}>{msg.helpPayload.title}</div>
                  {msg.helpPayload.intro?.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                  {msg.helpPayload.sections.map((section) => (
                    <div key={section.title} style={styles.helpSection}>
                      <div style={styles.helpSectionTitle}>{section.title}</div>
                      {section.description ? <div>{section.description}</div> : null}
                      {section.code ? <pre style={styles.codeBlock}>{section.code}</pre> : null}
                    </div>
                  ))}
                </div>
              ) : msg.type === 'version' ? (
                <div style={styles.helpDoc}>
                  <div style={styles.helpTitle}>{msg.versionPayload.title}</div>
                  {msg.versionPayload.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ) : (
                <div>{msg.content || (msg.role === 'assistant' && isSending ? '…' : '')}</div>
              )}
            </div>
          ))}
        </div>

        <form style={styles.form} onSubmit={handleSend}>
          <div style={styles.inputColumn}>
            <input
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something..."
              disabled={isSending}
            />
            <div style={styles.hint}>Type /help for API docs or /version for build info</div>
          </div>
          {isSending ? (
            <button style={styles.cancelButton} type="button" onClick={handleCancel}>
              Cancel
            </button>
          ) : (
            <button style={styles.button} type="submit" disabled={!canSend}>
              Send
            </button>
          )}
        </form>
      </section>

      <section style={styles.panel}>
        <header style={styles.header}>
          <h2 style={styles.subtitle}>Network Inspector</h2>
        </header>
        <pre style={styles.inspector}>{logs.join('\n')}</pre>
      </section>
    </main>
  );
}

const styles = {
  main: {
    height: '100vh',
    overflow: 'hidden',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '12px',
    background: '#0a0f1a',
    boxSizing: 'border-box',
  },
  panel: {
    border: '1px solid #27324a',
    borderRadius: '12px',
    background: '#101827',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  },
  header: {
    padding: '12px',
    borderBottom: '1px solid #27324a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { margin: 0, fontSize: '16px' },
  subtitle: { margin: 0, fontSize: '15px' },
  badge: {
    border: '1px solid',
    borderRadius: '999px',
    padding: '2px 10px',
    fontSize: '12px',
    textTransform: 'uppercase',
  },
  chatWindow: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    overflowY: 'auto',
  },
  bubble: {
    maxWidth: '85%',
    borderRadius: '10px',
    padding: '8px 10px',
    border: '1px solid #3a4a68',
    fontSize: '13px',
    whiteSpace: 'pre-wrap',
  },
  role: {
    fontSize: '11px',
    opacity: 0.75,
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  form: {
    display: 'flex',
    gap: '8px',
    padding: '12px',
    borderTop: '1px solid #27324a',
  },
  inputColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  input: {
    background: '#0d1422',
    color: '#e6e9ef',
    border: '1px solid #33415f',
    borderRadius: '8px',
    padding: '10px',
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: '11px',
    color: '#8f9bb3',
  },
  button: {
    background: '#2e5bff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  cancelButton: {
    background: '#ff6b6b',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '0 14px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  inspector: {
    margin: 0,
    padding: '12px',
    flex: 1,
    overflow: 'auto',
    fontSize: '12px',
    lineHeight: 1.45,
    color: '#b5c7ff',
  },
  helpDoc: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  helpTitle: {
    fontWeight: 600,
  },
  helpSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  helpSectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d6def0',
  },
  codeBlock: {
    margin: 0,
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #3a4a68',
    background: '#0a1120',
    fontSize: '12px',
    lineHeight: 1.5,
    overflowX: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
};
