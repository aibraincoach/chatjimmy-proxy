'use client';

import { useEffect, useMemo, useState } from 'react';

function nowLabel() {
  return new Date().toLocaleTimeString();
}

export default function HomePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [connection, setConnection] = useState({ status: 'checking', latencyMs: null });
  const [logs, setLogs] = useState([]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

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

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });

      if (!response.body) {
        throw new Error('No streaming body found in proxy response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setMessages((current) => {
                const updated = [...current];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: `${updated[updated.length - 1].content}${token}`,
                };
                return updated;
              });
            } catch {
              // We keep this parser permissive so malformed inspector lines don't break the entire chat demo.
            }
          }
        }
      }

      if (buffer.trim()) {
        pushLog('stream', buffer);
      }

      const elapsedMs = Math.round(performance.now() - startedAt);
      pushLog('stats', `chunks=${chunkCount}, chars=${totalChars}, elapsedMs=${elapsedMs}`);
    } catch (error) {
      pushLog('error', error instanceof Error ? error.message : 'unknown');
    } finally {
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
              <div>{msg.content || (msg.role === 'assistant' && isSending ? '…' : '')}</div>
            </div>
          ))}
        </div>

        <form style={styles.form} onSubmit={handleSend}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            disabled={isSending}
          />
          <button style={styles.button} type="submit" disabled={!canSend}>
            {isSending ? 'Streaming...' : 'Send'}
          </button>
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
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '12px',
    background: '#0a0f1a',
  },
  panel: {
    border: '1px solid #27324a',
    borderRadius: '12px',
    background: '#101827',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 'calc(100vh - 24px)',
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
  input: {
    flex: 1,
    background: '#0d1422',
    color: '#e6e9ef',
    border: '1px solid #33415f',
    borderRadius: '8px',
    padding: '10px',
    fontFamily: 'inherit',
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
  inspector: {
    margin: 0,
    padding: '12px',
    flex: 1,
    overflow: 'auto',
    fontSize: '12px',
    lineHeight: 1.45,
    color: '#b5c7ff',
  },
};
