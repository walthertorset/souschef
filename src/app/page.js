"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChefHat, Loader2, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hei! Jeg er Souschef, din personlige AI-kokk. Hva kan jeg hjelpe deg med i dag?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: `Beklager, en feil oppstod: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20">
            <ChefHat className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-br from-emerald-800 to-emerald-600 bg-clip-text text-transparent tracking-tight">
              Souschef
            </h1>
            <p className="text-xs text-emerald-600/80 font-medium">AI Agent</p>
          </div>
        </div>
        <button className="p-2 text-slate-400 hover:text-emerald-700 transition-colors bg-slate-100/50 hover:bg-slate-100 rounded-full">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 custom-scrollbar z-10 pb-32">
        {messages.map((m, i) => (
          <div key={i} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-3xl px-5 py-4 message-anim shadow-sm ${
              m.role === "user" 
                ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/20 text-white rounded-br-sm" 
                : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
            }`}>
              <div className={`prose prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700 max-w-none text-[15px] ${m.role === "user" ? "text-white prose-invert" : "text-slate-700"}`}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex w-full justify-start">
            <div className="bg-white border border-slate-200 rounded-3xl rounded-bl-sm px-6 py-4 flex items-center gap-3 shadow-sm">
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
              <span className="text-slate-500 text-[15px] animate-pulse">Souschef tenker...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 pb-6 absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-12 z-20">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto relative group">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Spør Souschef..."
            className="flex-1 bg-white border border-slate-200 rounded-full pl-6 pr-14 py-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all shadow-lg text-[15px]"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 bottom-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 rounded-full w-10 flex items-center justify-center transition-all"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </main>
  );
}
