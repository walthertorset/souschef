"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChefHat, Loader2, Menu, X, Plus, MessageSquare, LogOut } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchChats(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchChats(session.user.id);
      } else {
        setChats([]);
        setMessages([]);
        setActiveChatId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchChats = async (userId) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setChats(data || []);
  };

  const loadChat = async (chatId) => {
    setActiveChatId(chatId);
    setIsSidebarOpen(false);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    
    if (!error) {
      setMessages(data || []);
    }
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setMessages([{ role: "assistant", content: "Hei! Jeg er Souschef, din personlige AI-kokk. Hva kan jeg hjelpe deg med i dag?" }]);
    setIsSidebarOpen(false);
  };

  const handleLogin = async (e, isSignUp = false) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setAuthError("");
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
      
    if (error) setAuthError(error.message);
    else if (isSignUp) setAuthError("Bruker opprettet! Sjekk evt innboks, ellers logg inn.");
    setIsLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let currentChatId = activeChatId;
    
    if (!currentChatId) {
      const { data: newChat, error: chatError } = await supabase
        .from("chats")
        .insert({ user_id: session.user.id, title: input.substring(0, 30) + "..." })
        .select()
        .single();
        
      if (!chatError) {
        currentChatId = newChat.id;
        setActiveChatId(newChat.id);
        setChats(prev => [newChat, ...prev]);
      }
    }

    const userMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (currentChatId) {
      await supabase.from("messages").insert({
        chat_id: currentChatId,
        role: "user",
        content: userMessage.content
      });
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg = { role: "assistant", content: data.content };
      setMessages(prev => [...prev, assistantMsg]);
      
      if (currentChatId) {
        await supabase.from("messages").insert({
          chat_id: currentChatId,
          role: "assistant",
          content: assistantMsg.content
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: "assistant", content: `Beklager, en feil oppstod: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <main className="flex items-center justify-center min-h-[100dvh] bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-emerald-500/10 blur-[50px] pointer-events-none" />
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-4 rounded-2xl shadow-lg shadow-emerald-500/20 mb-4">
              <ChefHat className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-br from-emerald-800 to-emerald-600 bg-clip-text text-transparent">Souschef</h1>
            <p className="text-slate-500 text-sm mt-1">Logg inn for å få tilgang til ditt kjøkken</p>
          </div>
          
          <form className="flex flex-col gap-4 relative z-10">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">E-post</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1 mb-1 block">Passord</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={(e) => handleLogin(e, false)} disabled={isLoginLoading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50">Logg inn</button>
              <button onClick={(e) => handleLogin(e, true)} disabled={isLoginLoading} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors disabled:opacity-50">Registrer</button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  if (!activeChatId && messages.length === 0) {
    setMessages([{ role: "assistant", content: "Hei! Jeg er Souschef, din personlige AI-kokk. Hva kan jeg hjelpe deg med i dag?" }]);
  }

  return (
    <main className="flex h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Dine chatter</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3">
          <button onClick={createNewChat} className="w-full flex items-center gap-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium px-4 py-3 rounded-xl transition-colors">
            <Plus className="w-5 h-5" /> Ny samtale
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
          {chats.map(chat => (
            <button 
              key={chat.id} 
              onClick={() => loadChat(chat.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${activeChatId === chat.id ? "bg-slate-100 text-emerald-700 font-medium" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span className="truncate text-sm">{chat.title}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-xl transition-colors text-sm font-medium">
            <LogOut className="w-4 h-4" /> Logg ut
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20">
              <ChefHat className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-br from-emerald-800 to-emerald-600 bg-clip-text text-transparent tracking-tight">Souschef</h1>
              <p className="text-xs text-emerald-600/80 font-medium">{session?.user?.email}</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-emerald-700 transition-colors bg-slate-100/50 hover:bg-slate-100 rounded-full">
            <Menu className="w-5 h-5" />
          </button>
        </header>

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
      </div>
    </main>
  );
}
