"use client";

import { useState, useRef, useEffect } from "react";
import { Send, ChefHat, Loader2, Menu, X, Plus, MessageSquare, LogOut, Package, BookOpen, Calendar, ShoppingCart, ChevronLeft, Camera, Image as ImageIcon, ChevronDown, CheckCircle2, Star, Utensils, Clock, ArrowRight, LayoutDashboard, Sparkles, Zap, ArrowUpRight, Trash2, Edit3, Save, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard', 'chat', 'lager', 'kokebok', 'ukesmeny', 'handleliste'
  
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const loginRef = useRef(null);

  // Data States
  const [lager, setLager] = useState([]);
  const [kokebok, setKokebok] = useState([]);
  const [ukesmeny, setUkesmeny] = useState(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Kokebok Modal & Sort State
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeSortOrder, setRecipeSortOrder] = useState("newest"); // 'newest', 'oldest'
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // CRUD UI State
  const [isLagerModalOpen, setIsLagerModalOpen] = useState(false);
  const [editingLagerItem, setEditingLagerItem] = useState(null);
  const [isRecipeEditModalOpen, setIsRecipeEditModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [recipePickerDish, setRecipePickerDish] = useState(null); // For manuelt valg hvis match feiler
  const [isFetchingRecipe, setIsFetchingRecipe] = useState(false);

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
        setActiveView("dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (activeView === "dashboard") {
      fetchLager();
      fetchKokebok();
      fetchUkesmeny();
    }
    if (activeView === "lager") fetchLager();
    if (activeView === "kokebok") fetchKokebok();
    if (activeView === "ukesmeny" || activeView === "handleliste") {
      fetchUkesmeny();
      fetchKokebok();
    }
  }, [activeView, session]);

  const fetchChats = async (userId) => {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    
    if (data) {
      setChats(data);
    } else if (error) {
      console.error("Feil ved henting av chatter:", error.message);
    }
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
      alert("Feil ved opplasting.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  // CRUD Functions - Lager
  const saveLagerItem = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const itemData = {
      navn: formData.get("navn"),
      mengde: formData.get("mengde"),
      kategori: formData.get("kategori"),
      notat: formData.get("notat"),
      user_id: session.user.id
    };

    if (editingLagerItem) {
      const { error } = await supabase.from("lager").update(itemData).eq("id", editingLagerItem.id);
      if (!error) {
        setLager(prev => prev.map(item => item.id === editingLagerItem.id ? { ...item, ...itemData } : item));
        setIsLagerModalOpen(false);
        setEditingLagerItem(null);
      }
    } else {
      const { data, error } = await supabase.from("lager").insert(itemData).select().single();
      if (!error) {
        setLager(prev => [...prev, data]);
        setIsLagerModalOpen(false);
      }
    }
  };

  const deleteLagerItem = async (id) => {
    if (!confirm("Er du sikker på at du vil slette denne varen?")) return;
    const { error } = await supabase.from("lager").delete().eq("id", id);
    if (!error) setLager(prev => prev.filter(item => item.id !== id));
  };

  // CRUD Functions - Kokebok
  const saveRecipe = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Parse ingredients
    const ingredientsText = formData.get("ingredienser") || "";
    const ingredienser = ingredientsText.split('\n').filter(line => line.trim()).map(line => {
      const trimmed = line.trim();
      // Try to match "quantity unit name" or just "quantity name"
      // Looking for leading numbers/fractions
      const match = trimmed.match(/^([\d.,/\\\-]+\s*\w+)\s+(.*)$/) || trimmed.match(/^([\d.,/\\\-]+)\s+(.*)$/);
      if (match) {
        return { mengde: match[1].trim(), navn: match[2].trim() };
      }
      return { mengde: "", navn: trimmed };
    });

    // Parse instructions
    const instructionsText = formData.get("instruksjoner") || "";
    const instruksjoner = instructionsText.split('\n').filter(line => line.trim());

    const recipeData = {
      navn: formData.get("navn"),
      kategori: formData.get("kategori"),
      cuisine: formData.get("cuisine"),
      notater: formData.get("notater"),
      oppskrift: JSON.stringify({ ingredienser, instruksjoner }),
      user_id: session.user.id
    };

    if (editingRecipe) {
      const { error } = await supabase.from("kokebok").update(recipeData).eq("id", editingRecipe.id);
      if (!error) {
        setKokebok(prev => prev.map(r => r.id === editingRecipe.id ? { ...r, ...recipeData, oppskrift: JSON.parse(recipeData.oppskrift) } : r));
        setSelectedRecipe(prev => prev ? { ...prev, ...recipeData, oppskrift: JSON.parse(recipeData.oppskrift) } : null);
        setIsRecipeEditModalOpen(false);
        setEditingRecipe(null);
      }
    } else {
      const { data, error } = await supabase.from("kokebok").insert(recipeData).select().single();
      if (!error) {
        setKokebok(prev => [...prev, data]);
        setIsRecipeEditModalOpen(false);
      }
    }
  };

  const deleteRecipe = async (id) => {
    if (!confirm("Er du sikker på at du vil slette denne oppskriften?")) return;
    const { error } = await supabase.from("kokebok").delete().eq("id", id);
    if (!error) {
      setKokebok(prev => prev.filter(r => r.id !== id));
      setSelectedRecipe(null);
    }
  };

  const deleteUkesmeny = async () => {
    if (!confirm("Er du sikker på at du vil fjerne hele ukesmenyen og handlelisten?")) return;
    const { error } = await supabase.from("ukesmeny").delete().eq("user_id", session.user.id);
    if (!error) {
      setUkesmeny(null);
    } else {
      alert("Feil ved sletting: " + error.message);
    }
  };

  const nullstillUkesmenyOnly = async () => {
    if (!confirm("Er du sikker på at du vil fjerne ukesmenyen? Handlelisten vil bli bevart.")) return;
    const updates = {
      mandag: "", tirsdag: "", onsdag: "", torsdag: "", fredag: "", lordag: "", sondag: "",
      oppdatert: new Date().toISOString()
    };
    const { error } = await supabase.from("ukesmeny").update(updates).eq("user_id", session.user.id);
    if (!error) {
      setUkesmeny(prev => ({ ...prev, ...updates }));
    } else {
      alert("Feil ved nullstilling av ukesmeny: " + error.message);
    }
  };

  const nullstillHandlelisteOnly = async () => {
    if (!confirm("Er du sikker på at du vil tømme handlelisten? Ukesmenyen vil bli bevart.")) return;
    const updates = {
      handleliste: "",
      oppdatert: new Date().toISOString()
    };
    const { error } = await supabase.from("ukesmeny").update(updates).eq("user_id", session.user.id);
    if (!error) {
      setUkesmeny(prev => ({ ...prev, ...updates }));
    } else {
      alert("Feil ved nullstilling av handleliste: " + error.message);
    }
  };

  const scrollToLogin = () => {
    loginRef.current?.scrollIntoView({ behavior: "smooth" });
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
    if (currentChatId) {
      setChats(prev => {
        const chatIndex = prev.findIndex(c => c.id === currentChatId);
        if (chatIndex > 0) {
          const newChats = [...prev];
          const [chat] = newChats.splice(chatIndex, 1);
          return [chat, ...newChats];
        }
        return prev;
      });
      // Oppdater database for å refreshe tidsstempel (ignorer feil hvis kolonnen mangler)
      supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", currentChatId).then(({ error }) => {
        if (error) console.warn("Kunne ikke oppdatere updated_at på chats-tabellen:", error.message);
      });
      await supabase.from("messages").insert({ chat_id: currentChatId, role: "user", content: userMessage.content });
    }
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ messages: [...messages, userMessage] })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Ukjent feil" }));
        throw new Error(errorData.error || "Noe gikk galt");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      // Legg til en tom assistent-melding som vi kan fylle med innhold
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = { role: "assistant", content: assistantContent };
          return newMessages;
        });
      }

      if (currentChatId) {
        await supabase.from("messages").insert({ 
          chat_id: currentChatId, 
          role: "assistant", 
          content: assistantContent 
        });
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: `Feil: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUkesmenyClick = (dishName) => {
    if (!dishName) return;
    const cleanName = dishName.toLowerCase().trim();
    const foundRecipe = kokebok.find(r => {
      const rName = r.navn.toLowerCase().trim();
      return rName.includes(cleanName) || cleanName.includes(rName);
    });
    
    if (foundRecipe) {
      setSelectedRecipe(foundRecipe);
    } else {
      fetchRecipeDetails(dishName);
    }
  };

  const fetchRecipeDetails = async (dishName) => {
    setIsFetchingRecipe(true);
    setSelectedRecipe({ navn: dishName, oppskrift: "Henter oppskrift fra Souschef..." });
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ 
          messages: [
            { role: "user", content: `Gi meg en detaljert oppskrift på "${dishName}". Svar KUN med selve oppskriften formatert som JSON. Bruk formatet: {"navn": "...", "cuisine": "...", "kategori": "hverdag/helg", "ingredienser": [{"navn": "...", "mengde": "..."}], "instruksjoner": ["...", "..."]}` }
          ] 
        })
      });
      
      if (!response.ok) throw new Error("Kunne ikke hente oppskrift");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }
      
      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          setSelectedRecipe({
            id: 'temp-' + Date.now(),
            navn: parsed.navn || dishName,
            cuisine: parsed.cuisine || "Annet",
            kategori: parsed.kategori || "hverdag",
            oppskrift: JSON.stringify({
              ingredienser: parsed.ingredienser || [],
              instruksjoner: parsed.instruksjoner || []
            }),
            is_temporary: true
          });
        } catch (e) { throw new Error("Ugyldig JSON-format fra AI"); }
      } else {
        setSelectedRecipe({
          id: 'temp-' + Date.now(),
          navn: dishName,
          oppskrift: fullContent,
          is_temporary: true
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Kunne ikke hente oppskrift automatisk. Du kan prøve å spørre Souschef i chatten.");
      setSelectedRecipe(null);
    } finally {
      setIsFetchingRecipe(false);
    }
  };

  const toggleHandlelisteItem = async (lineText) => {
    if (!ukesmeny || !ukesmeny.handleliste) return;
    
    // Rens teksten vi fikk inn for å matche nøyaktig med det som står etter '- [ ] ' eller liknende
    const targetText = lineText.replace(/^\[[ x]\]\s*/, '').trim();
    
    const lines = ukesmeny.handleliste.split('\n');
    const newLines = lines.map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith('-')) return line;
      
      const cleanLineText = trimmedLine.replace(/^- (\[[ x]\] )?/, '').trim();
      
      if (cleanLineText === targetText) {
        if (line.includes('[ ]')) return line.replace('[ ]', '[x]');
        if (line.includes('[x]')) return line.replace('[x]', '[ ]');
        // Hvis ingen boks finnes, legg til en som er krysset av
        return line.replace(/^- /, '- [x] ');
      }
      return line;
    });
    
    const newHandleliste = newLines.join('\n');
    setUkesmeny(prev => ({ ...prev, handleliste: newHandleliste }));
    
    await supabase.from("ukesmeny").update({ handleliste: newHandleliste, oppdatert: new Date().toISOString() }).eq("user_id", session.user.id);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-100 scroll-smooth">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 w-full bg-white/70 backdrop-blur-lg z-50 border-b border-slate-200/50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="bg-emerald-500 p-1.5 rounded-lg">
                <ChefHat className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-800">Souschef</span>
            </div>
            <button onClick={scrollToLogin} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-full font-medium transition-all text-sm shadow-md shadow-emerald-600/10 active:scale-95">Logg inn</button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-4 sm:px-6 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-100/50 blur-[120px] rounded-full -z-10" />
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-6 border border-emerald-100">
              <Star className="w-4 h-4 fill-emerald-500 text-emerald-500" />
              Din personlige AI-kokk i lomma
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-8 tracking-tight text-balance">
              Middagsløsningen du har <span className="text-emerald-600">ventet på.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              Souschef foreslår retter basert på de unike råvarene du har i skapet, kombinert med enkle ting du får på nærbutikken. Din matglede, systematisert.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={scrollToLogin} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-slate-900/10">
                Kom i gang nå
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-6 bg-white border-y border-slate-200/50">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { icon: Utensils, title: "Smarte Middagsvalg", desc: "Få forslag basert på spesialvarene du faktisk har, kombinert med enkle basisvarer fra nærbutikken din." },
                { icon: Package, title: "Full Lagerkontroll", desc: "Vit nøyaktig hva du har av krydder og tørrvarer, slik at du aldri kjøper dobbelt eller mangler det viktigste." },
                { icon: BookOpen, title: "Din Digitale Kokebok", desc: "Samle alle favorittene dine på ett sted. Lagre nye oppskrifter rett fra chatten med ett enkelt klikk." },
                { icon: ShoppingCart, title: "Smart Handleliste", desc: "Automatiske lister som grupperes etter varekategori for en mest mulig effektiv butikktur." }
              ].map((f, i) => (
                <div key={i} className="flex flex-col gap-4 p-6 rounded-3xl bg-slate-50 border border-slate-100 hover:shadow-lg hover:shadow-slate-200/50 transition-all">
                  <div className="bg-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                    <f.icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Login Section */}
        <section ref={loginRef} className="py-32 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-slate-100 -z-10" />
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-2xl shadow-slate-300/40 border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -z-10" />
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Velkommen</h2>
                <p className="text-slate-500">Opprett bruker eller logg inn under</p>
              </div>
              
              <form className="flex flex-col gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-post</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="navn@epost.no" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all font-medium" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Passord</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition-all font-medium" />
                </div>
                
                {authError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100">{authError}</div>}
                
                <div className="flex flex-col gap-3 mt-4">
                  <button onClick={(e) => handleLogin(e, false)} disabled={isLoginLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                    {isLoginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Logg inn"}
                  </button>
                  <button onClick={(e) => handleLogin(e, true)} disabled={isLoginLoading} className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl transition-all border border-slate-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                    Registrer ny bruker
                  </button>
                </div>
              </form>
            </div>
            
            <p className="text-center text-slate-400 text-sm mt-10">
              © 2026 Souschef AI. Din middag, planlagt bedre.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // --- Authenticated App Rendering (Lager, Kokebok, etc.) ---

  const renderLager = () => {
    const groupedLager = lager.reduce((acc, item) => {
      const cat = item.kategori || "Annet";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
    return (
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 bg-slate-50 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Ditt Lager</h2>
          <button onClick={() => { setEditingLagerItem(null); setIsLagerModalOpen(true); }} className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition-colors">
            <Plus className="w-5 h-5" />
          </button>
        </div>
        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-8">
            {Object.keys(groupedLager).sort().map(category => (
              <div key={category}>
                <h3 className="text-lg font-bold text-emerald-800 mb-3 capitalize flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>{category}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {groupedLager[category].map(item => (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 group relative">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingLagerItem(item); setIsLagerModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteLagerItem(item.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <h4 className="font-semibold text-slate-800 capitalize text-sm">{item.navn}</h4>
                      <p className="text-xs text-slate-500 mt-1">{item.mengde}</p>
                      {item.notat && <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-1.5 rounded">{item.notat}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderKokebok = () => {
    const getRecipeTime = (r) => {
      const d = r.sist_laget || r.created_at;
      if (!d) return 0;
      const time = new Date(d).getTime();
      return isNaN(time) ? 0 : time;
    };

    const sortedKokebok = [...kokebok].sort((a, b) => {
      if (recipeSortOrder === "alphabetical") {
        return a.navn.localeCompare(b.navn);
      }
      const timeA = getRecipeTime(a);
      const timeB = getRecipeTime(b);
      return recipeSortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });

    const groupedKokebok = sortedKokebok.reduce((acc, item) => {
      const c = item.cuisine || "Annet";
      if (!acc[c]) acc[c] = [];
      acc[c].push(item);
      return acc;
    }, {});

    // Sort categories based on the first recipe in each (which is already sorted)
    const sortedCuisines = Object.keys(groupedKokebok).sort((a, b) => {
      if (recipeSortOrder === "alphabetical") {
        return a.localeCompare(b);
      }
      const firstA = groupedKokebok[a][0];
      const firstB = groupedKokebok[b][0];
      const timeA = getRecipeTime(firstA);
      const timeB = getRecipeTime(firstB);
      return recipeSortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    return (
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 bg-slate-50 pb-20 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Din Kokebok</h2>
          <div className="flex items-center gap-3">
            <select value={recipeSortOrder} onChange={e => setRecipeSortOrder(e.target.value)} className="bg-white border border-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all">
              <option value="newest">Nyeste først</option>
              <option value="oldest">Eldste først</option>
              <option value="alphabetical">Alfabetisk (A-Å)</option>
            </select>
            <button onClick={() => { setEditingRecipe(null); setIsRecipeEditModalOpen(true); }} className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        {isDataLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-500 mx-auto" /> : (
          <div className="flex flex-col gap-8">
            {sortedCuisines.map(cuisine => (
              <div key={cuisine}>
                <h3 className="text-lg font-bold text-emerald-800 mb-3 capitalize flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>{cuisine}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedKokebok[cuisine].map(item => (
                    <div key={item.id} onClick={() => setSelectedRecipe(item)} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col">
                      <div className="h-40 bg-slate-100 relative">
                        {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="w-10 h-10" /></div>}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-semibold text-slate-800 text-lg mb-1 line-clamp-1">{item.navn}</h4>
                          <p className="text-xs text-slate-500 capitalize bg-slate-50 px-2 py-0.5 rounded-full w-fit border border-slate-100">{item.kategori}</p>
                        </div>
                        {(item.sist_laget || item.created_at) && (
                          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <Clock className="w-3 h-3" />
                            <span>{item.sist_laget ? `Laget ${item.sist_laget}` : `Lagt til ${new Date(item.created_at).toLocaleDateString('nb-NO')}`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRecipeModal = () => {
    if (!selectedRecipe) return null;
    let parsedOppskrift = selectedRecipe.oppskrift;
    if (typeof parsedOppskrift === "string") { try { parsedOppskrift = JSON.parse(selectedRecipe.oppskrift); } catch(e) {} }
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-100">
          <button onClick={() => setSelectedRecipe(null)} className="p-2 -ml-2 text-slate-600 flex items-center gap-1 font-medium"><ChevronLeft className="w-5 h-5" /> Tilbake</button>
          <div className="flex items-center gap-1">
            {selectedRecipe.is_temporary ? (
              <button 
                onClick={async () => {
                  let parsed = selectedRecipe.oppskrift;
                  if (typeof parsed === "string") { try { parsed = JSON.parse(parsed); } catch(e) {} }
                  const recipeData = {
                    navn: selectedRecipe.navn,
                    oppskrift: selectedRecipe.oppskrift,
                    user_id: session.user.id,
                    kategori: selectedRecipe.kategori || "hverdag",
                    cuisine: selectedRecipe.cuisine || "Annet"
                  };
                  const { data, error } = await supabase.from("kokebok").insert(recipeData).select().single();
                  if (!error) {
                    setKokebok(prev => [...prev, data]);
                    setSelectedRecipe(data);
                    alert("Oppskriften er lagret i kokeboken!");
                  } else {
                    alert("Feil ved lagring: " + error.message);
                  }
                }}
                className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Lagre i kokebok
              </button>
            ) : (
              <>
                <button onClick={() => { setEditingRecipe(selectedRecipe); setIsRecipeEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"><Edit3 className="w-5 h-5" /></button>
                <button onClick={() => deleteRecipe(selectedRecipe.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 className="w-5 h-5" /></button>
                <label className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full cursor-pointer transition-colors relative">
                  {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, selectedRecipe.id)} disabled={isUploadingImage} />
                </label>
              </>
            )}
          </div>
        </div>
        <div className="w-full h-64 bg-slate-100 relative shrink-0">
          {selectedRecipe.image_url ? <img src={selectedRecipe.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2"><ImageIcon className="w-12 h-12 opacity-50" /></div>}
        </div>
        <div className="px-5 py-6 max-w-3xl mx-auto w-full">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">{selectedRecipe.navn}</h1>
          {isFetchingRecipe ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
              <p className="text-slate-500 font-medium">Henter detaljer fra Souschef...</p>
            </div>
          ) : parsedOppskrift && typeof parsedOppskrift === "object" ? (
            <div className="flex flex-col gap-8 mt-8">
              {parsedOppskrift.ingredienser && (
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Ingredienser</h3>
                  <ul className="space-y-2">{parsedOppskrift.ingredienser.map((ing, i) => (<li key={i} className="flex gap-3 items-start sm:items-center text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-2 sm:mt-0 shrink-0"></div><div className="flex flex-col sm:flex-row sm:gap-2 w-full"><span className="font-semibold whitespace-normal">{ing.mengde?.trim()}</span><span className="whitespace-normal break-words">{ing.navn?.trim()}</span></div></li>))}</ul>
                </div>
              )}
              {parsedOppskrift.instruksjoner && (
                <div>
                  <h3 className="text-xl font-bold text-slate-800 mb-4">Slik gjør du</h3>
                  <div className="space-y-4">{parsedOppskrift.instruksjoner.map((step, i) => (<div key={i} className="flex gap-4 items-start"><div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div><p className="text-slate-700 leading-relaxed pt-1">{step}</p></div>))}</div>
                </div>
              )}
            </div>
          ) : <ReactMarkdown className="prose" components={{ p: ({node, ...props}) => <p className="mb-4 whitespace-pre-wrap" {...props} /> }}>{selectedRecipe.oppskrift}</ReactMarkdown>}
        </div>
      </div>
    );
  };

  const getRecipeForDish = (dishName) => {
    if (!dishName) return null;
    const cleanName = dishName.toLowerCase().trim();
    return kokebok.find(r => {
      const rName = r.navn.toLowerCase().trim();
      return rName.includes(cleanName) || cleanName.includes(rName);
    });
  };

  const renderRecipePickerModal = () => {
    if (!recipePickerDish) return null;
    
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-slate-100 flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-800">Velg oppskrift</h3>
              <p className="text-sm text-slate-500 mt-1">Fant ingen automatisk match for "{recipePickerDish}"</p>
            </div>
            <button onClick={() => setRecipePickerDish(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Alle oppskrifter</p>
            {kokebok.length === 0 ? (
              <p className="text-center py-8 text-slate-400">Du har ingen oppskrifter i kokeboken ennå.</p>
            ) : (
              kokebok.map(recipe => (
                <button 
                  key={recipe.id} 
                  onClick={() => { setSelectedRecipe(recipe); setRecipePickerDish(null); }}
                  className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all flex items-center justify-between group"
                >
                  <span className="font-medium text-slate-700">{recipe.navn}</span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderUkesmeny = () => {
    const dager = ["mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lordag", "sondag"];
    const norskeDager = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
    return (
      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 bg-slate-50 pb-20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Din Ukesmeny</h2>
          {ukesmeny && (
            <button onClick={nullstillUkesmenyOnly} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors text-sm font-semibold">
              <Trash2 className="w-4 h-4" /> Nullstill
            </button>
          )}
        </div>
        {!ukesmeny ? <div className="bg-white p-8 rounded-3xl text-center border border-slate-200"><Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" /><button onClick={() => navigateTo("chat")} className="bg-emerald-600 text-white px-6 py-2 rounded-full mt-4">Gå til Chat</button></div> : (
          <div className="flex flex-col gap-3 max-w-2xl mx-auto">
            {dager.map((dag, i) => {
              const dishName = ukesmeny[dag];
              const recipe = getRecipeForDish(dishName);
              return (
                <div key={dag} onClick={() => handleUkesmenyClick(dishName)} className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-all ${dishName ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md group' : 'opacity-60'}`}>
                  <div className="w-16 text-right shrink-0"><span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">{norskeDager[i].substring(0,3)}</span></div>
                  <div className="w-px h-8 bg-slate-100 shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 leading-snug">{dishName || "Ingen plan"}</span>
                  </div>
                  {dishName && (
                    <div className={`p-2 rounded-xl transition-colors ${recipe ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400 group-hover:text-emerald-500'}`}>
                      {recipe ? <BookOpen className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderHandleliste = () => (
    <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 bg-slate-50 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Handleliste</h2>
        {ukesmeny && ukesmeny.handleliste && (
          <button onClick={nullstillHandlelisteOnly} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors text-sm font-semibold">
            <Trash2 className="w-4 h-4" /> Nullstill
          </button>
        )}
      </div>
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 max-w-2xl mx-auto">
        {ukesmeny && ukesmeny.handleliste ? (
          <ReactMarkdown 
            className="prose prose-emerald max-w-none"
            components={{
              li: ({ children, ...props }) => {
                const childrenArray = Array.isArray(children) ? children : [children];
                // Hent råtekst for matching
                const rawText = childrenArray.map(child => typeof child === 'string' ? child : (child.props?.children || '')).join('');
                // Rens teksten for eventuelle [ ] eller [x] som ligger i markdown-noden
                const cleanText = rawText.replace(/^\[[ x]\]\s*/, '').trim();
                
                // Sjekk om denne spesifikke linjen er markert som ferdig i markdown-strengen
                const isChecked = ukesmeny.handleliste.split('\n').some(line => 
                  line.trim().startsWith('-') && 
                  line.includes('[x]') && 
                  line.replace(/^- (\[[ x]\] )?/, '').trim() === cleanText
                );

                return (
                  <li className="list-none flex items-start gap-3 py-1.5 cursor-pointer group" onClick={() => toggleHandlelisteItem(cleanText)}>
                    <div className={`mt-1 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isChecked ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'border-slate-300 group-hover:border-emerald-400 bg-white'}`}>
                      {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                    </div>
                    <span className={`text-[15px] transition-all leading-relaxed ${isChecked ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}`}>
                      {childrenArray.map((child, idx) => {
                        if (typeof child === 'string') return child.replace(/^\[[ x]\]\s*/, '');
                        if (child.props?.children && typeof child.props.children === 'string') {
                          return { ...child, props: { ...child.props, children: child.props.children.replace(/^\[[ x]\]\s*/, '') } };
                        }
                        return child;
                      })}
                    </span>
                  </li>
                );
              },
              ul: ({ children }) => <ul className="pl-0 space-y-1">{children}</ul>,
              h3: ({ children }) => <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-8 mb-3 first:mt-0">{children}</h3>
            }}
          >
            {ukesmeny.handleliste}
          </ReactMarkdown>
        ) : (
          <div className="text-center py-10">
            <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Tom handleliste.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderDashboard = () => {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-8 bg-slate-50 pb-24">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Hei igjen! 👋</h2>
              <p className="text-slate-500 mt-1">Hva står på menyen i dag?</p>
            </div>
            <button onClick={createNewChat} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 w-fit">
              <Plus className="w-5 h-5" />
              Ny samtale
            </button>
          </div>

          {/* Quick Start / Onboarding */}
          <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl -z-10" />
            <div className="flex items-start gap-4 mb-6">
              <div className="bg-emerald-100 p-3 rounded-2xl">
                <Sparkles className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Kom i gang med Souschef</h3>
                <p className="text-slate-500 text-sm">Følg disse stegene for å få mest mulig ut av din personlige kokk.</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { step: 1, title: "Opprett varelager", desc: "Legg inn det du har i skapet slik at jeg kan foreslå retter.", view: "lager", icon: Package },
                { step: 2, title: "Finn en oppskrift", desc: "Be meg om tips basert på ingrediensene dine.", view: "chat", icon: MessageSquare },
                { step: 3, title: "Planlegg uken", desc: "Lag en ukesmeny og få automatiske handlelister.", view: "ukesmeny", icon: Calendar }
              ].map((item) => (
                <div key={item.step} onClick={() => navigateTo(item.view)} className="group cursor-pointer bg-slate-50 hover:bg-white hover:shadow-md border border-slate-100 rounded-2xl p-5 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] bg-emerald-50 px-2 py-1 rounded-md">Steg {item.step}</span>
                    <item.icon className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                  <h4 className="font-bold text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div onClick={() => navigateTo("lager")} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="bg-blue-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Ditt Lager</h3>
                <p className="text-slate-500 text-sm mt-1">Du har {lager.length} varer registrert.</p>
              </div>
              <div className="flex items-center text-blue-600 font-bold text-sm mt-4 gap-1">
                Se lager <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div onClick={() => navigateTo("kokebok")} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Kokeboken</h3>
                <p className="text-slate-500 text-sm mt-1">{kokebok.length} lagrede oppskrifter.</p>
              </div>
              <div className="flex items-center text-amber-600 font-bold text-sm mt-4 gap-1">
                Åpne kokebok <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div onClick={() => navigateTo("ukesmeny")} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="bg-purple-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Ukesmeny</h3>
                <p className="text-slate-500 text-sm mt-1">{ukesmeny ? "Planen er klar." : "Ingen aktiv plan."}</p>
              </div>
              <div className="flex items-center text-purple-600 font-bold text-sm mt-4 gap-1">
                Se ukesmeny <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <div onClick={() => navigateTo("handleliste")} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[180px]">
              <div>
                <div className="bg-rose-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Handleliste</h3>
                <p className="text-slate-500 text-sm mt-1">Alt du trenger til uken.</p>
              </div>
              <div className="flex items-center text-rose-600 font-bold text-sm mt-4 gap-1">
                Vis handleliste <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="flex h-[100dvh] bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      <div className={`fixed inset-y-0 left-0 w-[280px] sm:w-80 bg-white border-r border-slate-200 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col overflow-y-auto min-h-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`} style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="bg-emerald-500 p-1.5 rounded-lg"><ChefHat className="text-white w-4 h-4" /></div><h2 className="font-bold text-slate-800">Souschef</h2></div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 border-b border-slate-100 flex flex-col gap-1">
          <button onClick={() => navigateTo("dashboard")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "dashboard" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><LayoutDashboard className="w-5 h-5" /> Oversikt</button>
          <button onClick={() => navigateTo("chat")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "chat" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><MessageSquare className="w-5 h-5" /> Chat</button>
          <button onClick={() => navigateTo("lager")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "lager" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><Package className="w-5 h-5" /> Lager</button>
          <button onClick={() => navigateTo("kokebok")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "kokebok" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><BookOpen className="w-5 h-5" /> Kokebok</button>
          <button onClick={() => navigateTo("ukesmeny")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "ukesmeny" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><Calendar className="w-5 h-5" /> Ukesmeny</button>
          <button onClick={() => navigateTo("handleliste")} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${activeView === "handleliste" ? "bg-emerald-50 text-emerald-700 font-semibold" : "text-slate-600"}`}><ShoppingCart className="w-5 h-5" /> Handleliste</button>
        </div>
        <div className="p-3 flex items-center justify-between mt-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Historikk</span>
          <button onClick={createNewChat} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-lg"><Plus className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 px-3 pb-3 flex flex-col gap-1">
          {chats.map(chat => (<button key={chat.id} onClick={() => loadChat(chat.id)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-left ${activeChatId === chat.id ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-500"}`}><div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></div><span className="truncate text-sm">{chat.title}</span></button>))}
        </div>
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-600 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium"><LogOut className="w-4 h-4" /> Logg ut</button>
        </div>
      </div>
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col h-full min-h-0 relative">
        <header className="flex items-center justify-between px-6 py-5 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"><Menu className="w-6 h-6" /></button>
            <h1 className="text-xl font-bold text-slate-800 capitalize">{activeView}</h1>
          </div>
        </header>
        {activeView === "dashboard" && renderDashboard()}
        {activeView === "lager" && renderLager()}
        {activeView === "kokebok" && renderKokebok()}
        {activeView === "ukesmeny" && renderUkesmeny()}
        {activeView === "handleliste" && renderHandleliste()}
        {activeView === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-6 flex flex-col gap-6 pb-32">
              {messages.map((m, i) => (
                <div key={i} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-3xl px-5 py-4 ${m.role === "user" ? "bg-emerald-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"}`}>
                    <ReactMarkdown className="prose text-base leading-relaxed" components={{ p: ({node, ...props}) => <p className="mb-5 whitespace-pre-wrap" {...props} /> }}>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && <div className="bg-white border border-slate-200 rounded-3xl rounded-bl-sm px-6 py-4 flex w-max gap-3"><Loader2 className="w-4 h-4 text-emerald-500 animate-spin" /><span className="text-slate-500">Tenker...</span></div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent pt-12 z-20">
              <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto relative group">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder="Spør Souschef..." disabled={isLoading} className="flex-1 bg-white border border-slate-200 rounded-full pl-6 pr-14 py-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                <button type="submit" disabled={!input.trim() || isLoading} className="absolute right-2 top-2 bottom-2 bg-emerald-50 text-emerald-600 rounded-full w-10 flex items-center justify-center"><Send className="w-4 h-4 ml-0.5" /></button>
              </form>
            </div>
          </>
        )}
        {renderRecipeModal()}
        {renderRecipePickerModal()}

        {/* Lager Modal */}
        {isLagerModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">{editingLagerItem ? "Rediger vare" : "Legg til vare"}</h3>
                <button onClick={() => setIsLagerModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={saveLagerItem} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Navn</label>
                  <input name="navn" defaultValue={editingLagerItem?.navn} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Mengde</label>
                  <input name="mengde" defaultValue={editingLagerItem?.mengde} placeholder="f.eks. 1 stk, 500g" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                  <input name="kategori" defaultValue={editingLagerItem?.kategori} placeholder="f.eks. Krydder, Meieri" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Notat</label>
                  <textarea name="notat" defaultValue={editingLagerItem?.notat} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 resize-none" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-2">
                  <Save className="w-5 h-5" />
                  {editingLagerItem ? "Lagre endringer" : "Legg til i lager"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Recipe Edit Modal */}
        {isRecipeEditModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">{editingRecipe ? "Rediger oppskrift" : "Ny oppskrift"}</h3>
                <button onClick={() => setIsRecipeEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={saveRecipe} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Navn</label>
                  <input name="navn" defaultValue={editingRecipe?.navn} required className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kategori</label>
                    <select name="kategori" defaultValue={editingRecipe?.kategori || "hverdag"} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50">
                      <option value="hverdag">Hverdag</option>
                      <option value="helg">Helg</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kjøkken</label>
                    <input name="cuisine" defaultValue={editingRecipe?.cuisine} placeholder="f.eks. Italiensk" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50" />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Ingredienser (én per linje)</label>
                  <textarea 
                    name="ingredienser" 
                    defaultValue={(() => {
                      if (!editingRecipe?.oppskrift) return '';
                      let parsed = editingRecipe.oppskrift;
                      if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch(e) { return ''; }
                      }
                      return parsed.ingredienser?.map(i => `${i.mengde || ''} ${i.navn || ''}`.trim()).join('\n') || '';
                    })()} 
                    rows={5} 
                    placeholder="f.eks.&#10;2 stk Løk&#10;500 g Kylling"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 resize-none" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Fremgangsmåte (ett steg per linje)</label>
                  <textarea 
                    name="instruksjoner" 
                    defaultValue={(() => {
                      if (!editingRecipe?.oppskrift) return '';
                      let parsed = editingRecipe.oppskrift;
                      if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch(e) { return typeof parsed === 'string' ? parsed : ''; }
                      }
                      return parsed.instruksjoner?.join('\n') || '';
                    })()} 
                    rows={5} 
                    placeholder="f.eks.&#10;Stek løken til den er mør&#10;Tilsett kylling og brun godt"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 resize-none" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Notater</label>
                  <textarea name="notater" defaultValue={editingRecipe?.notater} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 resize-none" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-2">
                  <Save className="w-5 h-5" />
                  {editingRecipe ? "Oppdater oppskrift" : "Opprett oppskrift"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
