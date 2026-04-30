"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChefHat, Loader2, Menu, X, Plus, MessageSquare, LogOut, Package, BookOpen, Calendar, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeView, setActiveView] = useState("chat"); // 'chat', 'lager', 'kokebok', 'ukesmeny'
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Data States
  const [lager, setLager] = useState([]);
  const [kokebok, setKokebok] = useState([]);
  const [ukesmeny, setUkesmeny] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

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
        setActiveView("chat");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch Data depending on activeView
  useEffect(() => {
    if (!session) return;
    if (activeView === "lager") fetchLager();
    if (activeView === "kokebok") fetchKokebok();
    if (activeView === "ukesmeny") fetchUkesmeny();
  }, [activeView, session]);

  const fetchChats = async (userId) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) setChats(data || []);
  };

  const fetchLager = async () => {
    setIsDataLoading(true);
    const { data } = await supabase.from("lager").select("*").order("navn");
    setLager(data || []);
    setIsDataLoading(false);
  };

  const fetchKokebok = async () => {
    setIsDataLoading(true);
    const { data } = await supabase.from("kokebok").select("*").order("navn");
    setKokebok(data || []);
    setIsDataLoading(false);
  };

  const fetchUkesmeny = async () => {
    setIsDataLoading(true);
    const { data } = await supabase.from("ukesmeny").select("*").single();
    setUkesmeny(data || null);
    setIsDataLoading(false);
  };

  const loadChat = async (chatId) => {
    setActiveChatId(chatId);
    setActiveView("chat");
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
    setActiveView("chat");
    setMessages([{ role: "assistant", content: "Hei! Jeg er Souschef, din personlige AI-kokk. Hva kan jeg hjelpe deg med i dag?" }]);
    setIsSidebarOpen(false);
  };

  const navigateTo = (view) => {
    setActiveView(view);
    setIsSidebarOpen(false);
  };

  const handleLogin = async (e, isSignUp = false) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setAuthError("");
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
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
    if (activeView === "chat") scrollToBottom();
  }, [messages, isLoading, activeView]);

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
      await supabase.from("messages").insert({ chat_id: currentChatId, role: "user", content: userMessage.content });
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
        await supabase.from("messages").insert({ chat_id: currentChatId, role: "assistant", content: assistantMsg.content });
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

  const renderLager = () => (
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50 pb-20">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Ditt Lager</h2>
      {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {lager.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-semibold text-slate-800 capitalize">{item.navn}</h3>
              <p className="text-sm text-slate-500">{item.mengde} {item.kategori && `• ${item.kategori}`}</p>
              {item.notat && <p className="text-xs text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg">{item.notat}</p>}
            </div>
          ))}
          {lager.length === 0 && <p className="text-slate-500 text-center col-span-full py-10">Lageret ditt er tomt. Gå til chatten for å legge til varer!</p>}
        </div>
      )}
    </div>
  );

  const renderKokebok = () => (
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50 pb-20">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Din Kokebok</h2>
      {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kokebok.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-slate-800 text-lg">{item.navn}</h3>
                {item.rangering && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">★ {item.rangering}/5</span>}
              </div>
              <p className="text-sm font-medium text-emerald-600 capitalize">{item.kategori}</p>
              {item.notater && <p className="text-sm text-slate-500 italic">"{item.notater}"</p>}
              {item.sist_laget && <p className="text-xs text-slate-400 mt-auto pt-4">Sist laget: {item.sist_laget}</p>}
            </div>
          ))}
          {kokebok.length === 0 && <p className="text-slate-500 text-center col-span-full py-10">Kokeboken er tom. Be Souschef lagre en oppskrift!</p>}
        </div>
      )}
    </div>
  );

  const renderUkesmeny = () => {
    const dager = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag", "sondag"];
    const norskeDager = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50/50 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Ukesoversikt</h2>
        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {!ukesmeny ? (
              <div className="bg-white p-8 rounded-3xl text-center border border-slate-200 shadow-sm">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">Ingen ukemeny satt opp</h3>
                <p className="text-slate-500 mb-6">Gå til chatten og be Souschef om å foreslå en ukemeny for deg, så lagres den automatisk her!</p>
                <button onClick={() => navigateTo("chat")} className="bg-emerald-600 text-white px-6 py-2 rounded-full font-medium hover:bg-emerald-700 transition-colors">Gå til Chat</button>
              </div>
            ) : (
              dager.map((dag, i) => (
                <div key={dag} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className="w-16 text-right">
                    <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">{norskeDager[i].substring(0,3)}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100"></div>
                  <div className="flex-1">
                    {ukesmeny[dag] ? (
                      <span className="font-medium text-slate-800">{ukesmeny[dag]}</span>
                    ) : (
                      <span className="text-slate-400 italic">Ingen plan</span>
                    )}
                  </div>
                </div>
              ))
            )}
            {ukesmeny && ukesmeny.oppdatert && (
              <p className="text-center text-xs text-slate-400 mt-4">Sist oppdatert: {new Date(ukesmeny.oppdatert).toLocaleDateString("no-NO", { weekday: 'long', hour: '2-digit', minute:'2-digit' })}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="flex h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-white border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1.5 rounded-lg"><ChefHat className="text-white w-4 h-4" /></div>
            <h2 className="font-bold text-slate-800">Souschef</h2>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Main Navigation */}
        <div className="p-3 border-b border-slate-100 flex flex-col gap-1">
          <button onClick={() => navigateTo("chat")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "chat" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <MessageSquare className="w-5 h-5" /> Chat
          </button>
          <button onClick={() => navigateTo("lager")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "lager" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <Package className="w-5 h-5" /> Lageroversikt
          </button>
          <button onClick={() => navigateTo("kokebok")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "kokebok" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <BookOpen className="w-5 h-5" /> Kokebok
          </button>
          <button onClick={() => navigateTo("ukesmeny")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "ukesmeny" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <Calendar className="w-5 h-5" /> Ukesoversikt
          </button>
        </div>

        <div className="p-3 flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Historikk</span>
          <button onClick={createNewChat} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg transition-colors" title="Ny samtale">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1">
          {chats.map(chat => (
            <button 
              key={chat.id} 
              onClick={() => loadChat(chat.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors ${activeView === "chat" && activeChatId === chat.id ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div>
              <span className="truncate text-sm">{chat.title}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-400 truncate mb-3 text-center">{session?.user?.email}</p>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 hover:bg-red-50 py-2.5 rounded-xl transition-colors text-sm font-medium border border-slate-200 bg-white">
            <LogOut className="w-4 h-4" /> Logg ut
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-emerald-700 transition-colors hover:bg-slate-100 rounded-full">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight capitalize">
              {activeView === "chat" ? "Souschef" : activeView}
            </h1>
          </div>
        </header>

        {activeView === "lager" && renderLager()}
        {activeView === "kokebok" && renderKokebok()}
        {activeView === "ukesmeny" && renderUkesmeny()}

        {activeView === "chat" && (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}
