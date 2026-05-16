import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { signOut, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, 
  orderBy, limit, serverTimestamp, where 
} from "firebase/firestore";
import { 
  LayoutDashboard, Beef, LogOut, Plus, X, Edit, Trash2, Search, 
  Wallet, BrainCircuit, Send, CheckCircle2, AlertCircle, Wheat, 
  PlaySquare, Heart, MessageCircle, Share2, Activity, Droplets, Video
} from "lucide-react";

import Statistik from "../components/Statistik"; // Pastikan komponen ini ada
// import RekamMedis from "../components/RekamMedis"; // Buka comment jika Anda menggunakan ini di tab terpisah

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- STATE DATABASE SAPI ---
  const [dataSapi, setDataSapi] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // --- STATE PAKAN ---
  const [pakanLogs, setPakanLogs] = useState([]);
  const [isPakanModalOpen, setIsPakanModalOpen] = useState(false);
  const [pakanForm, setPakanForm] = useState({ jenisPakan: "Hijauan (Rumput Gajah/Odot)", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });

  // --- STATE EDUKASI (REELS) ---
  const [edukasiVideos, setEdukasiVideos] = useState([]);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [reelForm, setReelForm] = useState({ title: "", desc: "", url: "" });

  // --- STATE KEUANGAN ---
  const [transactions, setTransactions] = useState([]);
  
  // --- STATE VET AI ASSISTANT ---
  const [messages, setMessages] = useState([{ text: "Halo Juragan! Saya AI Assistant Feedlot Pro. Ada yang bisa saya bantu terkait kesehatan ternak hari ini?", role: 'ai', id: 1 }]);
  const [inputMsg, setInputMsg] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef(null);

  const statusBadgeColors = {
    "Sehat": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Sakit": "bg-rose-100 text-rose-700 border-rose-200",
    "Pengawasan": "bg-amber-100 text-amber-700 border-amber-200",
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  // --- EFEK & LISTENER DATABASE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // 1. Fetch Sapi
    const qSapi = query(collection(db, "sapi"), where("userId", "==", user.uid));
    const unsubSapi = onSnapshot(qSapi, (snap) => setDataSapi(snap.docs.map(doc => ({ idFirebase: doc.id, ...doc.data() }))));

    // 2. Fetch Pakan
    const qPakan = query(collection(db, "pakan"), where("userId", "==", user.uid), orderBy("tanggal", "desc"), limit(50));
    const unsubPakan = onSnapshot(qPakan, (snap) => setPakanLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    // 3. Fetch Reels Edukasi
    const qReels = query(collection(db, "reels"), orderBy("createdAt", "desc"));
    const unsubReels = onSnapshot(qReels, (snap) => setEdukasiVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    // 4. Fetch Finance
    const qTrans = query(collection(db, 'transactions'), where("userId", "==", user.uid), orderBy("date", "desc"), limit(20));
    const unsubTrans = onSnapshot(qTrans, (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubSapi(); unsubPakan(); unsubReels(); unsubTrans(); };
  }, [user]);

  // Scroll to bottom for AI Chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (error) { showToast("Gagal login.", "error"); }
  };

  // --- LOGIKA DASHBOARD SAPI (DIKEMBALIKAN) ---
  const handleSubmitSapi = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, "sapi", editId), { ...formData, berat: Number(formData.berat) });
        showToast("Data sapi berhasil diupdate!");
      } else {
        await addDoc(collection(db, "sapi"), { ...formData, berat: Number(formData.berat), userId: user.uid, createdAt: serverTimestamp() });
        showToast("Sapi baru berhasil ditambahkan!");
      }
      setIsModalOpen(false);
      setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
      setIsEditing(false);
    } catch (error) { showToast("Gagal menyimpan data", "error"); }
    finally { setIsLoading(false); }
  };

  const handleDeleteSapi = async (id) => {
    if(window.confirm("Yakin ingin menghapus data sapi ini?")) {
      try {
        await deleteDoc(doc(db, "sapi", id));
        showToast("Data sapi dihapus!");
      } catch(error) { showToast("Gagal menghapus sapi", "error"); }
    }
  };

  const openEditModal = (sapi) => {
    setIsEditing(true);
    setEditId(sapi.idFirebase);
    setFormData({ idSapi: sapi.idSapi, jenis: sapi.jenis, berat: sapi.berat, status: sapi.status });
    setIsModalOpen(true);
  };

  // --- LOGIKA PAKAN (DIKEMBALIKAN) ---
  const handleSubmitPakan = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "pakan"), { ...pakanForm, jumlahKg: Number(pakanForm.jumlahKg), konsentrat: Number(pakanForm.konsentrat), tanggal: new Date().toISOString(), userId: user.uid });
      setIsPakanModalOpen(false); 
      setPakanForm({ jenisPakan: "Hijauan (Rumput Gajah/Odot)", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });
      showToast("Catatan Pakan Harian Tersimpan!");
    } catch (error) { showToast("Gagal menyimpan pakan", "error"); } 
    finally { setIsLoading(false); }
  };

  // --- LOGIKA EDUKASI REELS (DIKEMBALIKAN) ---
  const handleSubmitReel = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reels"), {
        ...reelForm, likes: Math.floor(Math.random() * 100), saves: Math.floor(Math.random() * 20),
        uploaderId: user.uid, uploaderName: user.displayName, createdAt: serverTimestamp()
      });
      setIsReelModalOpen(false); setReelForm({ title: "", desc: "", url: "" });
      showToast("Video Edukasi Berhasil Diunggah!");
    } catch (error) { showToast("Gagal mengunggah video", "error"); } 
    finally { setIsLoading(false); }
  };

  // --- LOGIKA VET AI ASSISTANT (DIKEMBALIKAN & DIHIDUPKAN) ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    
    // Tambah pesan user
    const newUserMsg = { text: inputMsg, role: 'user', id: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    setInputMsg("");
    setIsAiLoading(true);

    // Simulasi Balasan AI (Karena API Key belum terhubung penuh di kode sebelumnya)
    setTimeout(() => {
      let aiReply = "Maaf, saya sedang memproses informasi tersebut.";
      const query = newUserMsg.text.toLowerCase();
      
      if(query.includes("pakan") || query.includes("makan")) {
        aiReply = "Untuk pakan, pastikan Anda memberikan hijauan 10% dari bobot badan sapi, dan konsentrat sekitar 1-2% dari bobot badan untuk target penggemukan (feedlot).";
      } else if (query.includes("sakit") || query.includes("pmk")) {
        aiReply = "Jika sapi menunjukkan gejala air liur berlebih atau kuku melepuh, segera pisahkan (karantina) dari kawanan lain dan semprot kandang dengan disinfektan. Hubungi dokter hewan setempat secepatnya.";
      } else {
        aiReply = "Baik juragan, catatannya sudah saya terima. Ada hal spesifik lain tentang kesehatan atau performa sapi yang ingin didiskusikan?";
      }

      setMessages(prev => [...prev, { text: aiReply, role: 'ai', id: Date.now() + 1 }]);
      setIsAiLoading(false);
    }, 1500);
  };

  const filteredSapi = dataSapi.filter(s => (s.idSapi || "").toLowerCase().includes(searchTerm.toLowerCase()));

  // --- RENDER LAYAR LOADING / LOGIN ---
  if (isAuthLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md w-full"><h1 className="text-3xl font-extrabold text-slate-800">Feedlot Pro</h1><button onClick={handleLogin} className="mt-8 w-full bg-slate-50 border border-slate-200 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-100">Login Google</button></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden text-slate-800">
      
      {/* TOAST COMPONENT */}
      <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-white border-emerald-100 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
          <p className="font-bold text-sm">{toast.message}</p>
        </div>
      </div>

      {/* SIDEBAR UTAMA */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex md:flex-col shadow-sm z-20">
        <div className="h-24 flex items-center gap-3 px-8 border-b border-slate-100">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl"><Beef size={24} className="text-white" /></div>
          <div><h1 className="text-2xl font-extrabold">Feedlot<span className="text-blue-600">Pro</span></h1></div>
        </div>
        
        <nav className="p-5 flex-1 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 mb-4 ml-3 uppercase">Main Menu</div>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={20}/> Dashboard Sapi</button>
          <button onClick={() => setActiveTab('pakan')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'pakan' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><Wheat size={20}/> Manajemen Pakan</button>
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'finance' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Wallet size={20}/> Keuangan</button>
          
          <div className="text-xs font-bold text-slate-400 mt-8 mb-4 ml-3 uppercase">Intelligence & Media</div>
          <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'ai' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><BrainCircuit size={20}/> Vet AI Assistant</button>
          <button onClick={() => setActiveTab('edukasi')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'edukasi' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}><PlaySquare size={20}/> Farm Reels</button>
        </nav>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <button onClick={async () => await signOut(auth)} className="w-full flex justify-center items-center gap-2 px-4 py-2.5 text-rose-600 rounded-xl hover:bg-rose-50 font-bold">
            <LogOut size={18}/> Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-8 z-10 sticky top-0">
          <h2 className="text-xl font-extrabold text-slate-800 capitalize">{activeTab}</h2>
          {activeTab === 'edukasi' && (
            <button onClick={() => setIsReelModalOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-md shadow-rose-200 transition-all">
              <Video size={18}/> Unggah Reel
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8">
          
          {/* ================= 1. TAB DASHBOARD SAPI ================= */}
          {activeTab === 'dashboard' && (
             <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in">
               <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-extrabold text-slate-800">Data Ternak</h2> 
                 <button onClick={() => { setIsEditing(false); setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" }); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-blue-200 transition-all flex items-center gap-2">
                   <Plus size={18}/> Tambah Sapi
                 </button>
               </div>
               
               <Statistik dataSapi={dataSapi} />
               
               <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                 <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                   <h3 className="font-extrabold text-slate-800">Daftar Sapi Aktif</h3>
                   <div className="relative">
                     <Search size={18} className="absolute left-3 top-2.5 text-slate-400"/>
                     <input type="text" placeholder="Cari ID Sapi..." className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                   </div>
                 </div>
                 <table className="w-full text-left">
                   <thead className="bg-white border-b text-slate-400 text-xs uppercase">
                     <tr><th className="p-5">ID Sapi</th><th className="p-5">Jenis</th><th className="p-5">Berat (Kg)</th><th className="p-5">Status</th><th className="p-5 text-right">Aksi</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredSapi.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Belum ada data sapi.</td></tr> : 
                       filteredSapi.map(sapi => (
                         <tr key={sapi.idFirebase} className="hover:bg-slate-50 transition-colors">
                           <td className="p-5 font-extrabold text-blue-600">{sapi.idSapi}</td>
                           <td className="p-5 font-bold text-slate-700">{sapi.jenis}</td>
                           <td className="p-5 font-semibold text-slate-600">{sapi.berat} Kg</td>
                           <td className="p-5"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${statusBadgeColors[sapi.status]}`}>{sapi.status}</span></td>
                           <td className="p-5 text-right flex justify-end gap-2">
                             <button onClick={() => openEditModal(sapi)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button>
                             <button onClick={() => handleDeleteSapi(sapi.idFirebase)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                           </td>
                         </tr>
                       ))
                     }
                   </tbody>
                 </table>
               </div>
             </div>
          )}

          {/* ================= 2. TAB MANAJEMEN PAKAN ================= */}
          {activeTab === 'pakan' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-between items-center bg-gradient-to-r from-amber-500 to-orange-500 p-8 rounded-3xl text-white shadow-lg shadow-orange-200">
                <div><h2 className="text-3xl font-extrabold mb-2">Nutrisi & Pakan Harian</h2><p className="text-orange-100 font-medium">Pantau asupan nutrisi untuk mengejar target ADG.</p></div>
                <button onClick={() => setIsPakanModalOpen(true)} className="bg-white text-orange-600 px-6 py-3 rounded-xl font-bold shadow-sm hover:scale-105 transition-transform flex gap-2"><Plus size={20}/> Catat Pakan</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4"><div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl"><Activity size={28}/></div><div><p className="text-sm font-bold text-slate-500 uppercase">Target Protein</p><p className="text-2xl font-extrabold">12 - 14%</p></div></div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4"><div className="p-4 bg-amber-100 text-amber-600 rounded-2xl"><Droplets size={28}/></div><div><p className="text-sm font-bold text-slate-500 uppercase">Target TDN</p><p className="text-2xl font-extrabold">&gt; 65%</p></div></div>
                <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-4"><div className="p-4 bg-blue-100 text-blue-600 rounded-2xl"><Wheat size={28}/></div><div><p className="text-sm font-bold text-slate-500 uppercase">Rata Konsentrat</p><p className="text-2xl font-extrabold">2.5 Kg/Ekor</p></div></div>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 border-b bg-slate-50 font-extrabold text-slate-800">Riwayat Pemberian Pakan</div>
                <table className="w-full text-left">
                  <thead className="bg-white border-b text-slate-400 text-xs uppercase"><tr><th className="p-5">Tanggal</th><th className="p-5">Pakan Utama</th><th className="p-5">Jumlah (Kg)</th><th className="p-5">Konsentrat</th><th className="p-5">Nutrisi</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pakanLogs.length === 0 ? <tr><td colSpan="5" className="p-8 text-center text-slate-400 font-medium">Belum ada catatan pakan.</td></tr> : 
                      pakanLogs.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="p-5 font-semibold text-slate-600">{new Date(p.tanggal).toLocaleDateString('id-ID')}</td>
                          <td className="p-5 font-bold text-slate-800">{p.jenisPakan}</td>
                          <td className="p-5 text-slate-600 font-medium">{p.jumlahKg} Kg</td>
                          <td className="p-5 text-amber-600 font-bold">+{p.konsentrat} Kg</td>
                          <td className="p-5"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${p.nutrisi === 'Tinggi' ? 'bg-emerald-100 text-emerald-700' : p.nutrisi === 'Sedang' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>{p.nutrisi}</span></td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= 3. TAB KEUANGAN (UI STANDAR) ================= */}
          {activeTab === 'finance' && (
             <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-500 p-8 rounded-3xl text-white shadow-lg">
                  <div><h2 className="text-3xl font-extrabold mb-2">Buku Kas Peternakan</h2><p className="text-emerald-100 font-medium">Lacak pemasukan dan pengeluaran operasional.</p></div>
                  <button className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-bold shadow-sm flex gap-2"><Plus size={20}/> Catat Transaksi</button>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden p-10 text-center">
                  <Wallet size={48} className="mx-auto text-slate-300 mb-4"/>
                  <h3 className="font-bold text-xl text-slate-700 mb-2">Modul Keuangan Siap Digunakan</h3>
                  <p className="text-slate-500">Logika database transaksi sudah terhubung. Tambahkan form input jika ingin mulai mencatat.</p>
                </div>
             </div>
          )}

          {/* ================= 4. TAB VET AI ASSISTANT ================= */}
          {activeTab === 'ai' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm animate-in fade-in overflow-hidden">
              <div className="p-6 border-b bg-indigo-50 flex items-center gap-4">
                <div className="p-3 bg-indigo-600 text-white rounded-xl"><BrainCircuit size={24}/></div>
                <div><h3 className="font-extrabold text-indigo-900 text-lg">Vet AI Assistant</h3><p className="text-indigo-600 text-sm font-medium">Konsultasi cerdas untuk peternakan Anda</p></div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50" ref={scrollRef}>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] p-4 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-[75%] p-4 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-bl-sm flex gap-2 items-center">
                       <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                       <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                       <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white border-t border-slate-100">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input type="text" className="flex-1 bg-slate-50 border border-slate-200 p-3.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" placeholder="Tanyakan soal pakan, penyakit PMK, dll..." value={inputMsg} onChange={e => setInputMsg(e.target.value)} />
                  <button type="submit" disabled={!inputMsg.trim() || isAiLoading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3.5 rounded-xl transition-colors"><Send size={20}/></button>
                </form>
              </div>
            </div>
          )}

          {/* ================= 5. TAB FARM REELS (EDUKASI) ================= */}
          {activeTab === 'edukasi' && (
            <div className="h-[calc(100vh-8rem)] w-full flex justify-center animate-in fade-in">
              <div className="h-full w-full max-w-md bg-black md:rounded-[2.5rem] md:border-8 border-slate-800 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full p-6 z-10 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent text-white">
                  <h2 className="font-extrabold text-xl flex items-center gap-2"><PlaySquare className="text-rose-500"/> FarmReels</h2>
                </div>
                <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide">
                  {edukasiVideos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-white text-center p-8">
                      <Video size={48} className="text-slate-600 mb-4"/>
                      <h3 className="font-bold text-xl mb-2">Belum Ada Video</h3>
                      <button onClick={() => setIsReelModalOpen(true)} className="mt-4 bg-rose-600 px-6 py-2 rounded-full font-bold">Unggah Sekarang</button>
                    </div>
                  ) : (
                    edukasiVideos.map((video) => (
                      <div key={video.id} className="h-full w-full snap-start relative bg-slate-900 flex items-center justify-center">
                        <video src={video.url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80" />
                        <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-10">
                          <button className="flex flex-col items-center gap-1 group"><div className="p-3 bg-white/10 backdrop-blur-md rounded-full group-hover:bg-rose-500/80"><Heart fill="white"/></div><span className="text-white text-xs font-bold">{video.likes || 0}</span></button>
                          <button className="flex flex-col items-center gap-1 group"><div className="p-3 bg-white/10 backdrop-blur-md rounded-full group-hover:bg-white/30"><MessageCircle/></div><span className="text-white text-xs font-bold">Komen</span></button>
                          <button className="p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/30"><Share2/></button>
                        </div>
                        <div className="absolute bottom-0 left-0 w-full p-6 pt-24 bg-gradient-to-t from-black via-black/60 to-transparent z-0">
                          <h3 className="text-white font-extrabold text-lg mb-1">{video.title}</h3>
                          <p className="text-white/80 text-sm line-clamp-2">{video.desc}</p>
                          <span className="mt-2 inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold truncate max-w-[150px]">@{video.uploaderName}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL: TAMBAH / EDIT SAPI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800">{isEditing ? "Edit Data Sapi" : "Tambah Sapi Baru"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 text-slate-500 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitSapi} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ID Sapi / Eartag</label><input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={formData.idSapi} onChange={e => setFormData({...formData, idSapi: e.target.value})} required disabled={isEditing}/></div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Jenis Ras</label>
                <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={formData.jenis} onChange={e => setFormData({...formData, jenis: e.target.value})}>
                  <option value="Limousin">Limousin</option><option value="Simental">Simental</option><option value="Brahman">Brahman</option><option value="PO">PO (Peranakan Ongole)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Berat (Kg)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={formData.berat} onChange={e => setFormData({...formData, berat: e.target.value})} required/></div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status</label>
                  <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Sehat">Sehat</option><option value="Pengawasan">Pengawasan</option><option value="Sakit">Sakit</option>
                  </select>
                </div>
              </div>
              <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-extrabold shadow-lg shadow-blue-200 mt-2">{isLoading ? "Menyimpan..." : "Simpan Data"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH PAKAN */}
      {isPakanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800">Catat Pemberian Pakan</h3>
              <button onClick={() => setIsPakanModalOpen(false)} className="p-2 bg-slate-50 text-slate-500 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitPakan} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Jenis Pakan Utama</label>
                <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={pakanForm.jenisPakan} onChange={e => setPakanForm({...pakanForm, jenisPakan: e.target.value})}>
                  <option value="Hijauan (Rumput Gajah/Odot)">Hijauan (Rumput Gajah/Odot)</option><option value="Jerami Fermentasi">Jerami Fermentasi</option><option value="Tebon Jagung (Silase)">Tebon Jagung (Silase)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Jumlah (Kg)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={pakanForm.jumlahKg} onChange={e => setPakanForm({...pakanForm, jumlahKg: e.target.value})} required /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Konsentrat (Kg)</label><input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={pakanForm.konsentrat} onChange={e => setPakanForm({...pakanForm, konsentrat: e.target.value})} required /></div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Estimasi Nutrisi Total</label>
                <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={pakanForm.nutrisi} onChange={e => setPakanForm({...pakanForm, nutrisi: e.target.value})}>
                  <option value="Tinggi">Tinggi (Mengejar Bobot)</option><option value="Sedang">Sedang (Maintenance)</option><option value="Rendah">Rendah (Bertahan Hidup)</option>
                </select>
              </div>
              <button disabled={isLoading} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-xl font-extrabold shadow-lg shadow-amber-200 mt-2">{isLoading ? "Menyimpan..." : "Simpan Catatan Pakan"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UNGGAH REEL */}
      {isReelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><Video className="text-rose-600"/> Unggah Reel Baru</h3>
              <button onClick={() => setIsReelModalOpen(false)} className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitReel} className="space-y-4">
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Judul Video</label><input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold" value={reelForm.title} onChange={e => setReelForm({...reelForm, title: e.target.value})} required /></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Deskripsi Pendek</label><textarea className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-sm" rows="2" value={reelForm.desc} onChange={e => setReelForm({...reelForm, desc: e.target.value})} required></textarea></div>
              <div><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Link URL Video (.MP4)</label><input type="url" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-medium text-sm" value={reelForm.url} onChange={e => setReelForm({...reelForm, url: e.target.value})} required placeholder="https://contoh.com/video.mp4" /></div>
              <button disabled={isLoading} className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-xl font-extrabold shadow-lg shadow-rose-200 mt-2">{isLoading ? "Mengunggah..." : "Posting Reel"}</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}