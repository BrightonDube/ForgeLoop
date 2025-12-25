import React, { useState, useRef, useEffect } from 'react';
import { LogEntry, ChatMessage } from '../types';
import { streamArchitectureAdvice } from '../services/geminiService';
import { Send, User, Bot, X } from 'lucide-react';
import clsx from 'clsx';

interface ChatInterfaceProps {
  logs: LogEntry[];
  isOpen: boolean;
  onClose: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ logs, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: "I am the Architect. I'm monitoring the build process. Ask me anything about the current state, the repository structure, or the plan." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const modelMsgId = (Date.now() + 1).toString();
    const modelMsg: ChatMessage = { id: modelMsgId, role: 'model', text: '', isStreaming: true };
    setMessages(prev => [...prev, modelMsg]);

    await streamArchitectureAdvice(userMsg.text, logs, (chunk) => {
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: chunk } : m));
    });

    setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, isStreaming: false } : m));
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-ocean-900 border-l border-ocean-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-ocean-700 flex justify-between items-center bg-ocean-800">
        <h3 className="text-neon-purple font-mono font-bold flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Architect
        </h3>
        <button onClick={onClose} className="text-ocean-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll bg-ocean-900">
        {messages.map((msg) => (
            <div key={msg.id} className={clsx("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                <div className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    msg.role === 'user' ? "bg-ocean-700 text-ocean-200" : "bg-neon-purple/20 text-neon-purple border border-neon-purple/30"
                )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={clsx(
                    "p-3 rounded-lg text-sm max-w-[80%] leading-relaxed",
                    msg.role === 'user' ? "bg-ocean-700 text-white" : "bg-ocean-800 text-ocean-100 border border-ocean-700"
                )}>
                    {msg.text}
                    {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-neon-purple animate-pulse"/>}
                </div>
            </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-4 bg-ocean-800 border-t border-ocean-700">
        <div className="relative">
            <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask about the build..."
                className="w-full bg-ocean-900 border border-ocean-600 rounded-md py-2 pl-3 pr-10 text-sm text-white focus:outline-none focus:border-neon-purple transition-colors placeholder:text-ocean-600"
            />
            <button 
                onClick={handleSend}
                disabled={isLoading}
                className="absolute right-2 top-2 text-neon-purple hover:text-white transition-colors disabled:opacity-50"
            >
                <Send className="w-4 h-4" />
            </button>
        </div>
        <p className="text-[10px] text-ocean-500 mt-2 text-center">Powered by Gemini 3 Flash Preview</p>
      </div>
    </div>
  );
};