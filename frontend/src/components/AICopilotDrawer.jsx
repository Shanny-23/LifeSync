import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';

export default function AICopilotDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [aiStatus, setAiStatus] = useState({ has_key: false, model: 'llama-3.3-70b', mode: 'rule-manager' });

  const { addToast } = useToast();
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      sender: 'copilot',
      text: '👋 **Hello! I am your LifeSync AI Manager.**\n\nI actively manage your schedule, deadlines, priorities, and calendar conflicts. Ask me about your workload, tell me to add tasks, auto-schedule your study blocks, or resolve overlaps.'
    }
  ]);

  const quickPrompts = [
    'What are my deadlines this week?',
    'Generate an optimized study schedule',
    'Check and resolve calendar conflicts',
    'What is my highest priority task?',
    'Add CS450 Raft project due Friday 5pm'
  ];

  // Fetch AI status on mount and when drawer opens
  useEffect(() => {
    fetchStatus();
  }, [isOpen]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiStatus(data);
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleSaveApiKey = async (e) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setSavingKey(true);
    try {
      const res = await fetch('/api/ai/set-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKeyInput.trim() })
      });

      if (!res.ok) throw new Error('Failed to save API key');

      addToast('Groq API key saved! Live Llama 3.3 & DeepSeek-R1 activated.', 'success');
      setApiKeyInput('');
      setShowKeyConfig(false);
      await fetchStatus();
    } catch (err) {
      addToast(`Error saving key: ${err.message}`, 'alert');
    } finally {
      setSavingKey(false);
    }
  };

  const handleSend = async (promptText) => {
    const textToSend = promptText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('lifesync_token') || 'demo-token-demo_user_1'}`
        },
        body: JSON.stringify({ prompt: textToSend })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const botMsg = {
        sender: 'copilot',
        text: result.reply || 'Understood.',
        action: result.action,
        engine: result.engine || 'rule_based_fallback',
        details: result.details
      };
      setMessages((prev) => [...prev, botMsg]);

      // Give feedback toast based on actual action performed
      if (result.action === 'create_task') {
        addToast(`AI created task: "${result.details?.title || 'New Task'}"`, 'success');
      } else if (result.action === 'create_event') {
        addToast(`AI scheduled event: "${result.details?.title || 'New Event'}"`, 'success');
      } else if (result.action === 'generate_schedule') {
        addToast(`AI generated ${result.details?.slots_created || 0} scheduled focus slots!`, 'success');
      } else if (result.action === 'resolve_conflicts') {
        addToast(`Conflict audit completed (${result.details?.resolved_count || 0} resolved)`, 'info');
      } else if (result.action === 'complete_task') {
        addToast('Task marked as completed!', 'success');
      } else if (result.action === 'delete_task') {
        addToast('Task deleted from workspace.', 'info');
      }

      // Refresh frontend views
      window.dispatchEvent(new CustomEvent('lifesync:refresh'));
    } catch (err) {
      console.error('Copilot error:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'copilot',
          text: `⚠️ I encountered an error processing that: ${err.message}. Please try again.`
        }
      ]);
      addToast('Error communicating with LifeSync AI Manager', 'alert');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format basic markdown (bold, bullet points, headers)
  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');

    return lines.map((line, idx) => {
      // Bold replacer: **text**
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const formattedLine = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={pIdx}>{part.slice(1, -1)}</em>;
        }
        return part;
      });

      if (line.startsWith('• ') || line.startsWith('* ')) {
        return (
          <div key={idx} style={{ display: 'flex', gap: '6px', margin: '2px 0 2px 8px' }}>
            <span>•</span>
            <span style={{ flex: 1 }}>{formattedLine}</span>
          </div>
        );
      }

      if (line.match(/^\d+\.\s/)) {
        return (
          <div key={idx} style={{ margin: '3px 0 3px 6px', fontWeight: 500 }}>
            {formattedLine}
          </div>
        );
      }

      return (
        <div key={idx} style={{ minHeight: line === '' ? '8px' : 'auto', margin: '1px 0' }}>
          {formattedLine}
        </div>
      );
    });
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#1B3B2E',
            color: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '30px',
            boxShadow: '0 8px 24px rgba(27,59,46,0.35)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 12px 28px rgba(27,59,46,0.45)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(27,59,46,0.35)';
          }}
        >
          <span style={{ fontSize: '16px' }}>✨</span>
          <span>LifeSync AI Manager</span>
        </button>
      )}

      {/* Slide-over Drawer Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 9990,
            display: 'flex',
            justifyContent: 'flex-end',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setIsOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              height: '100%',
              backgroundColor: '#FFFFFF',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: '#1B3B2E',
                color: '#FFFFFF',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>✨</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                    LifeSync AI Manager
                  </h3>
                  <div style={{ fontSize: '11px', color: '#B4D3C2', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{aiStatus.has_key ? '🟢 Groq (Llama 3.3 & DeepSeek-R1)' : '⚡ Smart App Manager'}</span>
                    <button
                      onClick={() => setShowKeyConfig(!showKeyConfig)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#E7F0EA',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '11px',
                        padding: 0
                      }}
                    >
                      {aiStatus.has_key ? '• Change Key' : '• Add Groq Key'}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '22px',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Inline Gemini API Key Config Section */}
            {showKeyConfig && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#F0FDF4',
                  borderBottom: '1px solid #BBF7D0'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534', marginBottom: '6px' }}>
                  🔑 Configure Groq API Key
                </div>
                <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '8px' }}>
                  Paste your key from <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{ color: '#1F5C3D', fontWeight: 600 }}>console.groq.com</a> to enable high-speed LLM reasoning.
                </div>
                <form onSubmit={handleSaveApiKey} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="gsk_..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: '12px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={savingKey || !apiKeyInput.trim()}
                    style={{
                      backgroundColor: '#1F5C3D',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {savingKey ? 'Saving...' : 'Save'}
                  </button>
                </form>
              </div>
            )}

            {/* Quick Prompts Bar */}
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                whiteSpace: 'nowrap'
              }}
            >
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(qp)}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#1B3B2E',
                    borderRadius: '14px',
                    padding: '5px 11px',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#E7F0EA')}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Chat Messages */}
            <div
              style={{
                flex: 1,
                padding: '18px 16px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                backgroundColor: '#F8FAFC'
              }}
            >
              {messages.map((m, idx) => {
                const isUser = m.sender === 'user';
                return (
                  <div
                    key={idx}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      backgroundColor: isUser ? '#1F5C3D' : '#FFFFFF',
                      color: isUser ? '#FFFFFF' : '#1E293B',
                      padding: '12px 16px',
                      borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      fontSize: '13px',
                      lineHeight: 1.5,
                      border: isUser ? 'none' : '1px solid #E2E8F0'
                    }}
                  >
                    <div>{renderFormattedText(m.text)}</div>
                    {m.action && m.action !== 'chat' && (
                      <div
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#E7F0EA',
                          color: '#1F5C3D',
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        ✓ ACTION: {m.action.replace('_', ' ').toUpperCase()}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#FFFFFF',
                    padding: '12px 16px',
                    borderRadius: '16px 16px 16px 4px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                    color: '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ animation: 'spin 1s linear infinite' }}>✨</span>
                  <span>AI Manager is analyzing schedule and workspace...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              style={{
                padding: '14px 16px',
                borderTop: '1px solid #E2E8F0',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                gap: '8px'
              }}
            >
              <input
                type="text"
                placeholder="Ask AI Manager (e.g. What deadlines do I have?)..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#F8FAFC'
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1F5C3D')}
                onBlur={(e) => (e.target.style.borderColor = '#CBD5E1')}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#1F5C3D',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !input.trim() ? 0.5 : 1
                }}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
