import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { getAccessToken } from '../utils/auth';

interface TerminalProps {
  hostID: string;
  containerID: string;
}

export default function Terminal({ hostID, containerID }: TerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectRef = useRef(0);

  const connect = () => {
    setError(null);

    const token = getAccessToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    const wsUrl = `ws://localhost:8080/api/ws/hosts/${hostID}/containers/${containerID}/exec?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectRef.current = 0;

      if (xtermRef.current) {
        xtermRef.current.clear();
        xtermRef.current.focus();
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output' && xtermRef.current) {
          xtermRef.current.write(msg.data);
        } else if (msg.type === 'connected') {
          if (xtermRef.current) {
            xtermRef.current.write('\r\n\x1b[32mConnected to container terminal.\x1b[0m\r\n\r\n');
          }
        } else if (msg.type === 'error') {
          if (xtermRef.current) {
            xtermRef.current.write(`\r\n\x1b[31mError: ${msg.data}\x1b[0m\r\n`);
          }
          setError(msg.data);
        }
      } catch {
        if (xtermRef.current) {
          xtermRef.current.write(event.data);
        }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (xtermRef.current) {
        xtermRef.current.write('\r\n\x1b[33mConnection closed.\x1b[0m\r\n');
      }
    };

    ws.onerror = () => {
      setError('Connection failed');
      setConnected(false);
    };
  };

  useEffect(() => {
    if (!termRef.current) return;

    const xterm = new XTerminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, monospace',
      theme: {
        background: '#0c0c0c',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#0c0c0c',
        red: '#c50f1f',
        green: '#13a10e',
        yellow: '#c19c00',
        blue: '#0037da',
        magenta: '#881798',
        cyan: '#3a96dd',
        white: '#cccccc',
        brightBlack: '#767676',
        brightRed: '#e74856',
        brightGreen: '#16c60c',
        brightYellow: '#f9f1a5',
        brightBlue: '#3b78ff',
        brightMagenta: '#b4009e',
        brightCyan: '#61d6d6',
        brightWhite: '#f2f2f2',
      },
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    xterm.onResize(({ rows, cols }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', rows, cols }));
      }
    });

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    connect();

    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [hostID, containerID]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Terminal</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="flex gap-2">
          {!connected && reconnectRef.current <= 5 && (
            <button
              onClick={() => {
                reconnectRef.current = 0;
                if (wsRef.current) {
                  wsRef.current.close();
                }
                connect();
              }}
              className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs text-white hover:bg-zinc-600"
            >
              Reconnect
            </button>
          )}
          {connected && (
            <button
              onClick={() => {
                if (wsRef.current) {
                  wsRef.current.close();
                }
              }}
              className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {error && !connected && (
        <div className="rounded-md border border-red-800 bg-red-900/20 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div
        ref={termRef}
        className="overflow-hidden rounded-lg border border-zinc-700 bg-[#0c0c0c]"
        style={{ height: '480px' }}
      />
    </div>
  );
}