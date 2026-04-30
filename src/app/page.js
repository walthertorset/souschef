"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChefHat, Loader2, Menu, X, Plus, MessageSquare, LogOut, Package, BookOpen, Calendar, ShoppingCart, ChevronLeft, Camera, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeView, setActiveView] = useState("chat"); // 'chat', 'lager', 'kokebok', 'ukesmeny', 'handleliste'
  
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

  // Kokebok Modal & Sort State
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeSortOrder, setRecipeSortOrder] = useState("newest"); // 'newest', 'oldest'
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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

  useEffect(() => {
    if (!session) return;
    if (activeView === "lager") fetchLager();
    if (activeView === "kokebok") fetchKokebok();
    if (activeView === "ukesmeny" || activeView === "handleliste") {
      fetchUkesmeny();
      fetchKokebok(); // Pre-fetch to enable clicking days
    }
  }, [activeView, session]);

  const fetchChats = async (userId) => {
    const { data } = await supabase.from("chats").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) setChats(data);
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
    const { data, error } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
    if (!error) setMessages(data || []);
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
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    else if (isSignUp) setAuthError("Bruker opprettet! Du kan logge inn.");
    setIsLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleImageUpload = async (e, recipeId) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${recipeId}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from('recipe-images').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(fileName);

      const { error: updateError } = await supabase.from('kokebok').update({ image_url: publicUrl }).eq('id', recipeId);
      if (updateError) throw updateError;

      setSelectedRecipe(prev => ({ ...prev, image_url: publicUrl }));
      setKokebok(prev => prev.map(r => r.id === recipeId ? { ...r, image_url: publicUrl } : r));
    } catch (error) {
      console.error("Upload error", error);
      alert("Feil ved opplasting av bilde.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    let currentChatId = activeChatId;
    
    if (!currentChatId) {
      const { data: newChat, error: chatError } = await supabase
        .from("chats").insert({ user_id: session.user.id, title: input.substring(0, 30) + "..." }).select().single();
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

    if (currentChatId) await supabase.from("messages").insert({ chat_id: currentChatId, role: "user", content: userMessage.content });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const assistantMsg = { role: "assistant", content: data.content };
      setMessages(prev => [...prev, assistantMsg]);
      
      if (currentChatId) await supabase.from("messages").insert({ chat_id: currentChatId, role: "assistant", content: assistantMsg.content });
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: `Beklager, en feil oppstod: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUkesmenyClick = (dishName) => {
    if (!dishName) return;
    const foundRecipe = kokebok.find(r => r.navn.toLowerCase().includes(dishName.toLowerCase()) || dishName.toLowerCase().includes(r.navn.toLowerCase()));
    if (foundRecipe) {
      setSelectedRecipe(foundRecipe);
    } else {
      alert(`Fant ikke "${dishName}" i kokeboken din. Kanskje du må lagre den via chatten først?`);
    }
  };

  if (!session) {
    return (
      <main className="flex items-center justify-center min-h-[100dvh] bg-slate-50 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="flex flex-col items-center mb-8 relative z-10">
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 p-4 rounded-2xl shadow-lg mb-4">
              <ChefHat className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-br from-emerald-800 to-emerald-600 bg-clip-text text-transparent">Souschef</h1>
          </div>
          <form className="flex flex-col gap-4 relative z-10">
            <input type="email" placeholder="E-post" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" />
            <input type="password" placeholder="Passord" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3" />
            {authError && <p className="text-red-500 text-sm">{authError}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={(e) => handleLogin(e, false)} disabled={isLoginLoading} className="flex-1 bg-emerald-600 text-white font-medium py-3 rounded-xl">Logg inn</button>
              <button onClick={(e) => handleLogin(e, true)} disabled={isLoginLoading} className="flex-1 bg-slate-100 text-slate-700 font-medium py-3 rounded-xl">Registrer</button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // --- Render Functions ---

  const renderLager = () => {
    const groupedLager = lager.reduce((acc, item) => {
      const cat = item.kategori || "Annet";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Ditt Lager</h2>
        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-8">
            {Object.keys(groupedLager).sort().map(category => (
              <div key={category}>
                <h3 className="text-lg font-bold text-emerald-800 mb-3 capitalize flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>{category}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {groupedLager[category].map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                      <h4 className="font-semibold text-slate-800 capitalize text-sm">{item.navn}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.mengde}</p>
                      {item.notat && <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-1.5 rounded">{item.notat}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {lager.length === 0 && <p className="text-slate-500 text-center py-10">Lageret er tomt.</p>}
          </div>
        )}
      </div>
    );
  };

  const renderKokebok = () => {
    const sortedKokebok = [...kokebok].sort((a, b) => {
      const dateA = new Date(a.sist_laget || a.created_at || 0);
      const dateB = new Date(b.sist_laget || b.created_at || 0);
      return recipeSortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    const groupedKokebok = sortedKokebok.reduce((acc, item) => {
      const c = item.cuisine || "Annet";
      if (!acc[c]) acc[c] = [];
      acc[c].push(item);
      return acc;
    }, {});

    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 pb-20 relative">
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Din Kokebok</h2>
          <select 
            value={recipeSortOrder} 
            onChange={e => setRecipeSortOrder(e.target.value)}
            className="bg-white border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="newest">Nyeste først</option>
            <option value="oldest">Eldste først</option>
          </select>
        </div>

        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-8">
            {Object.keys(groupedKokebok).sort().map(cuisine => (
              <div key={cuisine}>
                <h3 className="text-lg font-bold text-emerald-800 mb-3 capitalize flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>{cuisine}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedKokebok[cuisine].map(item => (
                    <div key={item.id} onClick={() => setSelectedRecipe(item)} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col">
                      <div className="h-40 bg-slate-100 relative">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.navn} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon className="w-10 h-10" />
                          </div>
                        )}
                        {item.rangering && <div className="absolute top-2 right-2 bg-white/90 backdrop-blur text-amber-600 text-xs font-bold px-2 py-1 rounded-md shadow-sm">★ {item.rangering}/5</div>}
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h4 className="font-semibold text-slate-800 text-lg mb-1">{item.navn}</h4>
                        <p className="text-sm text-slate-500 mb-3 capitalize">{item.kategori}</p>
                        {item.sist_laget && <p className="text-xs text-slate-400 mt-auto">Sist laget: {item.sist_laget}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {kokebok.length === 0 && <p className="text-slate-500 text-center py-10">Kokoboken er tom.</p>}
          </div>
        )}
      </div>
    );
  };

  const renderRecipeModal = () => {
    if (!selectedRecipe) return null;
    
    let parsedOppskrift = selectedRecipe.oppskrift;
    if (typeof parsedOppskrift === "string") {
      try { parsedOppskrift = JSON.parse(selectedRecipe.oppskrift); } catch(e) {}
    }

    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
          <button onClick={() => setSelectedRecipe(null)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full flex items-center gap-1 font-medium">
            <ChevronLeft className="w-5 h-5" /> Tilbake
          </button>
          <div className="flex items-center gap-2">
            <label className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full cursor-pointer transition-colors relative">
              {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleImageUpload(e, selectedRecipe.id)} disabled={isUploadingImage} />
            </label>
          </div>
        </div>

        <div className="w-full h-64 bg-slate-100 relative shrink-0">
          {selectedRecipe.image_url ? (
            <img src={selectedRecipe.image_url} alt={selectedRecipe.navn} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
              <ImageIcon className="w-12 h-12 opacity-50" />
              <span className="text-sm">Bruk kamera-ikonet oppe til høyre for å legge til bilde</span>
            </div>
          )}
        </div>

        <div className="px-5 py-6 max-w-3xl mx-auto w-full">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-3xl font-bold text-slate-800">{selectedRecipe.navn}</h1>
            {selectedRecipe.rangering && <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-lg">★ {selectedRecipe.rangering}/5</span>}
          </div>
          <div className="flex gap-2 text-sm font-medium text-emerald-600 mb-6 capitalize">
            {selectedRecipe.cuisine && <span>{selectedRecipe.cuisine} • </span>}
            <span>{selectedRecipe.kategori}</span>
          </div>

          {selectedRecipe.notater && (
            <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl text-sm italic mb-8">"{selectedRecipe.notater}"</div>
          )}

          {parsedOppskrift && typeof parsedOppskrift === "object" ? (
            <div className="flex flex-col gap-8">
              {parsedOppskrift.ingredienser && (
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Ingredienser</h3>
                  <ul className="space-y-2">
                    {parsedOppskrift.ingredienser.map((ing, i) => (
                      <li key={i} className="flex gap-2 items-center text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                        <span className="font-medium">{ing.mengde}</span> {ing.navn}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsedOppskrift.instruksjoner && (
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Slik gjør du</h3>
                  <div className="space-y-4">
                    {parsedOppskrift.instruksjoner.map((step, i) => (
                      <div key={i} className="flex gap-4 items-start">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                        <p className="text-slate-700 leading-relaxed pt-1">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="prose prose-emerald max-w-none">
              <ReactMarkdown>{selectedRecipe.oppskrift || "Ingen oppskrift lagt til."}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUkesmeny = () => {
    const dager = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag", "sondag"];
    const norskeDager = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 pb-20">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Din Ukesmeny</h2>
        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {!ukesmeny ? (
              <div className="bg-white p-8 rounded-3xl text-center border border-slate-200">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-800 mb-2">Ingen meny satt opp</h3>
                <button onClick={() => navigateTo("chat")} className="bg-emerald-600 text-white px-6 py-2 rounded-full mt-4">Gå til Chat</button>
              </div>
            ) : (
              dager.map((dag, i) => (
                <div 
                  key={dag} 
                  onClick={() => handleUkesmenyClick(ukesmeny[dag])}
                  className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 ${ukesmeny[dag] ? 'cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all' : ''}`}
                >
                  <div className="w-16 text-right shrink-0">
                    <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">{norskeDager[i].substring(0,3)}</span>
                  </div>
                  <div className="w-px h-8 bg-slate-100 shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    {ukesmeny[dag] ? (
                      <span className="font-medium text-slate-800 truncate block">{ukesmeny[dag]}</span>
                    ) : (
                      <span className="text-slate-400 italic">Ingen plan</span>
                    )}
                  </div>
                  {ukesmeny[dag] && <ChevronLeft className="w-5 h-5 text-slate-300 rotate-180 shrink-0" />}
                </div>
              ))
            )}
            {ukesmeny?.oppdatert && <p className="text-center text-xs text-slate-400 mt-4">Oppdatert: {new Date(ukesmeny.oppdatert).toLocaleDateString()}</p>}
          </div>
        )}
      </div>
    );
  };

  const renderHandleliste = () => (
    <div className="flex-1 overflow-y-auto px-4 py-6 bg-slate-50 pb-20">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Handleliste</h2>
      {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
          {ukesmeny && ukesmeny.handleliste ? (
            <div className="prose prose-emerald max-w-none text-slate-700">
              <ReactMarkdown>{ukesmeny.handleliste}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-10">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Du har ingen aktiv handleliste.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

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
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-3 border-b border-slate-100 flex flex-col gap-1">
          <button onClick={() => navigateTo("chat")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "chat" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><MessageSquare className="w-5 h-5" /> Chat</button>
          <button onClick={() => navigateTo("lager")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "lager" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><Package className="w-5 h-5" /> Lageroversikt</button>
          <button onClick={() => navigateTo("kokebok")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "kokebok" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><BookOpen className="w-5 h-5" /> Kokebok</button>
          <button onClick={() => navigateTo("ukesmeny")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "ukesmeny" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><Calendar className="w-5 h-5" /> Ukesoversikt</button>
          <button onClick={() => navigateTo("handleliste")} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeView === "handleliste" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}><ShoppingCart className="w-5 h-5" /> Handleliste</button>
        </div>

        <div className="p-3 flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Historikk</span>
          <button onClick={createNewChat} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1">
          {chats.map(chat => (
            <button key={chat.id} onClick={() => loadChat(chat.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left ${activeView === "chat" && activeChatId === chat.id ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-500 hover:bg-slate-50"}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div><span className="truncate text-sm">{chat.title}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium"><LogOut className="w-4 h-4" /> Logg ut</button>
        </div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"><Menu className="w-6 h-6" /></button>
            <h1 className="text-xl font-bold text-slate-800 capitalize">{activeView === "chat" ? "Souschef" : activeView}</h1>
          </div>
        </header>

        {activeView === "lager" && renderLager()}
        {activeView === "kokebok" && renderKokebok()}
        {activeView === "ukesmeny" && renderUkesmeny()}
        {activeView === "handleliste" && renderHandleliste()}

        {activeView === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 pb-32">
              {messages.map((m, i) => (
                <div key={i} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-3xl px-5 py-4 ${m.role === "user" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"}`}>
                    <div className={`prose max-w-none text-[15px] ${m.role === "user" ? "text-white prose-invert" : "text-slate-700"}`}><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  </div>
                </div>
              ))}
              {isLoading && <div className="bg-white border border-slate-200 rounded-3xl rounded-bl-sm px-6 py-4 flex w-max gap-3"><Loader2 className="w-4 h-4 text-emerald-500 animate-spin" /><span className="text-slate-500 text-[15px]">Tenker...</span></div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-12 z-20">
              <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto relative group">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Spør Souschef..." disabled={isLoading} className="flex-1 bg-white border border-slate-200 rounded-full pl-6 pr-14 py-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <button type="submit" disabled={!input.trim() || isLoading} className="absolute right-2 top-2 bottom-2 bg-emerald-50 text-emerald-600 rounded-full w-10 flex items-center justify-center disabled:opacity-50"><Send className="w-4 h-4 ml-0.5" /></button>
              </form>
            </div>
          </>
        )}

        {renderRecipeModal()}
      </div>
    </main>
  );
}
