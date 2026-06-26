'use client';

import { useState, useRef, useEffect } from 'react';

interface SafeAction { id: string; tool: string; label: string; redFlag?: boolean; }

interface CmdEntry { input: string; output: string; }

function processCommand(
  cmd: string,
  onAction: (id: string, tool: string) => void,
  state: Record<string, unknown> | undefined,
): string {
  const trimmed = cmd.trim().toLowerCase();
  if (!trimmed) return '';

  const toolStates = (state as any)?.toolStates || {};
  const printer = toolStates.printer || {};
  const vpn = toolStates.vpn || {};
  const network = toolStates.network || {};

  switch (true) {
    case trimmed === 'help':
      return `Available commands:
  help              Show this help
  cls               Clear screen
  whoami            Display current user
  dir               List directory contents
  ping              Test network connectivity
  ipconfig          Show network configuration
  nslookup          DNS lookup
  tracert           Trace route
  net start/stop    Manage Windows services
  sc query          Query service status
  exit              Close command prompt`;

    case trimmed.startsWith('ping'):
      onAction('run_ping', 'cmd');
      return `Pinging outlook.office365.com [52.96.19.66] with 32 bytes of data:
Reply from 52.96.19.66: bytes=32 time=24ms TTL=114
Reply from 52.96.19.66: bytes=32 time=22ms TTL=114
Reply from 52.96.19.66: bytes=32 time=23ms TTL=114
Reply from 52.96.19.66: bytes=32 time=25ms TTL=114

Ping statistics for 52.96.19.66:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss)
Approximate round trip times in milli-seconds:
    Minimum = 22ms, Maximum = 25ms, Average = 23ms`;

    case trimmed.startsWith('ipconfig') && !trimmed.includes('/flushdns'):
      onAction('run_ipconfig', 'cmd');
      return `Windows IP Configuration

Ethernet adapter Ethernet0:
   Connection-specific DNS Suffix  . : connexiondental.com
   Link-local IPv6 Address . . . . . : fe80::a4b2:c8d1:4e3f:8a2d%12
   IPv4 Address. . . . . . . . . . . : 10.0.50.23
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 10.0.50.1

Ethernet adapter Wi-Fi:
   Media State . . . . . . . . . . . : Media disconnected`;

    case trimmed === 'ipconfig /flushdns':
      onAction('flush_dns', 'cmd');
      return `Windows IP Configuration

Successfully flushed the DNS Resolver Cache.`;

    case trimmed.startsWith('nslookup'): {
      const dnsWorks = network.dnsWorks !== false;
      if (!dnsWorks) {
        return `Server:  dns.connexiondental.com
Address:  10.0.50.2

*** dns.connexiondental.com can't find ${cmd.replace('nslookup ', '').trim()}: Non-existent domain`;
      }
      return `Server:  dns.connexiondental.com
Address:  10.0.50.2

Non-authoritative answer:
Name:    outlook.office365.com
Addresses:  52.96.19.66
          52.96.60.82
          52.96.14.146`;
    }

    case trimmed.startsWith('tracert'):
      return `Tracing route to outlook.office365.com [52.96.19.66] over a maximum of 30 hops:
  1    <1 ms    <1 ms    <1 ms  10.0.50.1
  2     2 ms     1 ms     2 ms  192.168.100.1
  3    12 ms    10 ms    11 ms  core-router.lon.uk
  4    15 ms    14 ms    16 ms  52.96.19.66
Trace complete.`;

    case trimmed === 'whoami':
      return 'alder\\sarah';

    case trimmed.startsWith('dir'):
      return ` Volume in drive C has no label.
 Directory of C:\\Users\\Sarah

06/24/2026  10:15 AM    <DIR>          Desktop
06/24/2026  10:15 AM    <DIR>          Documents
06/22/2026  02:30 PM    <DIR>          Downloads
06/20/2026  09:00 AM    <DIR>          Pictures
06/26/2026  08:00 AM             1,024 invoices.xlsx
               1 File(s)          1,024 bytes
               4 Dir(s)  128,450,560,000 bytes free`;

    case trimmed === 'sc query spooler': {
      const spoolerRunning = printer.spoolerRunning === true;
      return `SERVICE_NAME: spooler
        TYPE               : 10  WIN32_OWN_PROCESS
        STATE              : ${spoolerRunning ? '4  RUNNING' : '1  STOPPED'}
                                (${spoolerRunning ? 'NOT_STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN' : 'STOPPABLE, NOT_PAUSABLE, ACCEPTS_SHUTDOWN'})
        WIN32_EXIT_CODE    : 0  (0x0)
        SERVICE_EXIT_CODE  : 0  (0x0)
        CHECKPOINT         : 0x0
        WAIT_HINT          : 0x0`;
    }

    case trimmed === 'net start spooler':
      onAction('restart_spooler', 'cmd');
      return `The Print Spooler service is starting.
The Print Spooler service was started successfully.`;

    case trimmed === 'net stop spooler': {
      const spoolerRunning = printer.spoolerRunning === true;
      if (!spoolerRunning) {
        return `The Print Spooler service is not started.`;
      }
      return `The Print Spooler service was stopped successfully.`;
    }

    case trimmed === 'cls':
      return '__CLEAR__';

    default:
      return `'${cmd.trim()}' is not recognized as an internal or external command, operable program or batch file.`;
  }
}

export default function CmdApp({ actions, onAction, onRecordInteraction, state }: {
  actions?: SafeAction[];
  state?: Record<string, unknown>;
  onAction: (id: string, tool: string) => void;
  onRecordInteraction?: (actionId: string, label: string, eventType?: string) => void;
}) {
  const [history, setHistory] = useState<CmdEntry[]>([
    { input: '', output: 'Microsoft Windows [Version 11.0.22631]\n(c) Connexion Dental. All rights reserved.\n\nC:\\Users\\Sarah>' }
  ]);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [history]);

  const handleSubmit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    const output = processCommand(cmd, onAction, state);
    if (output === '__CLEAR__') {
      setHistory([]);
    } else {
      setHistory(p => [...p, { input: cmd, output }]);
    }
    onRecordInteraction?.(`cmd_${cmd.split(' ')[0]}`, `Ran command: ${cmd}`);
    setInput('');
    setHistoryIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const cmds = history.filter(h => h.input);
      if (cmds.length > 0) {
        const newIdx = historyIndex < cmds.length - 1 ? historyIndex + 1 : cmds.length - 1;
        setHistoryIndex(newIdx);
        setInput(cmds[cmds.length - 1 - newIdx].input);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const cmds = history.filter(h => h.input);
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setInput(cmds[cmds.length - 1 - newIdx].input);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#e2e8f0', fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace" }}>
      <div
        ref={outputRef}
        onClick={() => inputRef.current?.focus()}
        style={{ flex: 1, overflow: 'auto', padding: '12px 14px', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', cursor: 'text', userSelect: 'text' }}
      >
        {history.map((entry, i) => (
          <div key={i}>
            {entry.input ? (
              <><span style={{ color: '#4ade80' }}>C:\Users\Sarah&gt;</span> <span style={{ color: '#f1f5f9' }}>{entry.input}</span></>
            ) : null}
            {entry.output ? <div style={{ color: '#94a3b8' }}>{entry.output}</div> : null}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: '#4ade80', flexShrink: 0 }}>C:\Users\Sarah&gt;&nbsp;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit', padding: 0, caretColor: '#f1f5f9',
            }}
          />
        </div>
      </div>
    </div>
  );
}
