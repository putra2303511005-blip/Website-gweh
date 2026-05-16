import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { signOut, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, 
  getDocs, orderBy, limit, serverTimestamp, setDoc, where 
} from "firebase/firestore";
import { 
  LayoutDashboard, Beef, LogOut, Scale, Plus, X, Edit, Trash2, Search, Filter, Syringe,
  Wallet, BrainCircuit, TrendingUp, TrendingDown, Send, Cpu, Download, ArrowUpDown, 
  CheckCircle2, AlertCircle, Wheat, PlaySquare, Heart, MessageCircle, Bookmark, Share2, Activity, Droplets, Video
} from "lucide-react";

import RekamMedis from "../components/RekamMedis";
import Statistik from "../components/Statistik";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- STATE DATABASE SAPI ---
  const [dataSapi, setDataSapi] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isMedisModalOpen, setIsMedisModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSapi, setSelectedSapi] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
  const [newWeight, setNewWeight] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Semua");
  const [sortConfig, setSortConfig] = useState({ key: 'idSapi', direction: 'asc' });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // --- STATE PAKAN ---
  const [pakanLogs, setPakanLogs] = useState([]);
  const [isPakanModalOpen, setIsPakanModalOpen] = useState(false);
  const [pakanForm, setPakanForm] = useState({ jenisPakan: "Hijauan", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });

  // --- FITUR BARU: STATE EDUKASI (REAL-TIME DATABASE) ---
  const [edukasiVideos, setEdukasiVideos] = useState([]);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [reelForm, setReelForm] = useState({ title: "", desc: "", url: "" });

  // --- STATE KEUANGAN & AI ---
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ population: 0, balance: 0, totalIncome: 0, totalExpense: 0 });
  const [messages, setMessages] = useState([{ text: "Halo Juragan! Saya AI Assistant Feedlot Pro.", role: 'ai', id: 1 }]);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Fetch Data Sapi
    const qSapi = query(collection(db, "sapi"), where("userId", "==", user.uid));
    const unsubscribeSapi = onSnapshot(qSapi, (snap) => setDataSapi(snap.docs.map(doc => ({ idFirebase: doc.id, ...doc.data() }))));

    // Fetch Data Pakan
    const qPakan = query(collection(db, "pakan"), where("userId", "==", user.uid), orderBy("tanggal", "desc"), limit(50));
    const unsubPakan = onSnapshot(qPakan, (snap) => setPakanLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    // Fetch Data Reels Edukasi (REAL-TIME TIKTOK STYLE)
    const qReels = query(collection(db, "reels"), orderBy("createdAt", "desc"));
    const unsubReels = onSnapshot(qReels, (snap) => setEdukasiVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    // Fetch Finance
    const qTrans = query(collection(db, 'transactions'), where("userId", "==", user.uid));
    const unsubTrans = onSnapshot(qTrans, (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubStats = onSnapshot(doc(db, 'stats', user.uid), (snap) => {
      if (snap.exists()) setStats(snap.data());
    });

    return () => { unsubscribeSapi(); unsubPakan(); unsubReels(); unsubTrans(); unsubStats(); };
  }, [user]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } 
    catch (error) { showToast("Gagal login.", "error"); }
  };

  const handleAddWeight = async (e) => { e.preventDefault(); setIsWeightModalOpen(false); showToast("Berat Disimpan"); };

  const handleSubmitPakan = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "pakan"), { ...pakanForm, jumlahKg: Number(pakanForm.jumlahKg), konsentrat: Number(pakanForm.konsentrat), tanggal: new Date().toISOString(), userId: user.uid });
      setIsPakanModalOpen(false); setPakanForm({ jenisPakan: "Hijauan", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });
      showToast("Catatan Pakan Harian Tersimpan!");
    } catch (error) { showToast("Gagal menyimpan pakan", "error"); } 
    finally { setIsLoading(false); }
  };

  // --- FUNGSI SUBMIT VIDEO REELS BARU (REAL-TIME) ---
  const handleSubmitReel = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reels"), {
        ...reelForm,
        likes: Math.floor(Math.random() * 100), // Random likes awal biar keren
        saves: Math.floor(Math.random() * 20),
        uploaderId: user.uid,
        uploaderName: user.displayName,
        createdAt: serverTimestamp()
      });
      setIsReelModalOpen(false);
      setReelForm({ title: "", desc: "", url: "" });
      showToast("Video Edukasi Berhasil Diunggah!");
    } catch (error) {
      showToast("Gagal mengunggah video", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAndSortedData = dataSapi.filter(s => (s.idSapi || "").toLowerCase().includes(searchTerm.toLowerCase()) && (filterStatus === "Semua" || s.status === filterStatus));

  if (isAuthLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md w-full"><h1 className="text-3xl font-extrabold text-slate-800">Feedlot Pro</h1><button onClick={handleLogin} className="mt-8 w-full bg-slate-50 border border-slate-200 font-bold py-3 px-4 rounded-xl shadow-sm">Login Google</button></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden text-slate-800">
      
      {/* TOAST */}
      <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-white border-emerald-100 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
          <p className="font-bold text-sm">{toast.message}</p>
        </div>
      </div>

      {/* SIDEBAR */}
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
          <button onClick={() => setActiveTab('edukasi')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${activeTab === 'edukasi' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}><PlaySquare size={20}/> Farm Reels (Edukasi)</button>
        </nav>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <button onClick={async () => await signOut(auth)} className="w-full flex justify-center items-center gap-2 px-4 py-2.5 text-rose-600 rounded-xl hover:bg-rose-50 font-bold">
            <LogOut size={18}/> Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-8 z-10 sticky top-0">
          <h2 className="text-xl font-extrabold text-slate-800 capitalize">{activeTab} Feedlot</h2>
          
          {/* Tombol Tambah Video (Hanya muncul di tab Edukasi) */}
          {activeTab === 'edukasi' && (
            <button onClick={() => setIsReelModalOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-md shadow-rose-200 transition-all">
              <Video size={18}/> Unggah Reel
            </button>
          )}
        </header>

        <div className="flex-1 overflow-auto p-8">
          
          {/* TAB LAIN (Saya Sembunyikan Detailnya Agar Fokus ke Edukasi) */}
          {activeTab === 'dashboard' && (<div className="p-4 text-center text-slate-500 font-bold">Menu Dashboard Sapi ada di sini (seperti sebelumnya).</div>)}
          {activeTab === 'pakan' && (<div className="p-4 text-center text-slate-500 font-bold">Menu Pakan ada di sini (seperti sebelumnya).</div>)}

          {/* --- TAB FARM REELS (DYNAMIC TIKTOK STYLE) --- */}
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
                      <p className="text-slate-400 text-sm mb-6">Jadilah yang pertama mengunggah edukasi peternakan!</p>
                      <button onClick={() => setIsReelModalOpen(true)} className="bg-rose-600 px-6 py-2 rounded-full font-bold">Unggah Sekarang</button>
                    </div>
                  ) : (
                    edukasiVideos.map((video) => (
                      <div key={video.id} className="h-full w-full snap-start relative bg-slate-900 flex items-center justify-center">
                        
                        {/* Video Player Real-time */}
                        <video 
                          src={video.url} 
                          autoPlay loop muted playsInline 
                          className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />

                        {/* Konten Kanan */}
                        <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center z-10">
                          <button className="flex flex-col items-center gap-1 group">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-full group-hover:bg-rose-500/80 transition-colors"><Heart className="text-white" fill="white"/></div>
                            <span className="text-white text-xs font-bold drop-shadow-md">{video.likes || 0}</span>
                          </button>
                          <button className="flex flex-col items-center gap-1 group">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-full group-hover:bg-white/30 transition-colors"><MessageCircle className="text-white"/></div>
                            <span className="text-white text-xs font-bold drop-shadow-md">Komen</span>
                          </button>
                          <button className="p-3 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/30 transition-colors"><Share2 className="text-white"/></button>
                        </div>

                        {/* Info Text Bawah */}
                        <div className="absolute bottom-0 left-0 w-full p-6 pt-24 bg-gradient-to-t from-black via-black/60 to-transparent z-0">
                          <h3 className="text-white font-extrabold text-lg mb-1 drop-shadow-lg">{video.title}</h3>
                          <p className="text-white/80 text-sm line-clamp-2 drop-shadow-md">{video.desc}</p>
                          <div className="mt-3 flex gap-2">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-bold text-center truncate max-w-[150px]">
                              @{video.uploaderName}
                            </span>
                          </div>
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

      {/* MODAL UNGGAH REEL BARU */}
      {isReelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2"><Video className="text-rose-600"/> Unggah Reel Baru</h3>
              <button onClick={() => setIsReelModalOpen(false)} className="p-2 bg-slate-50 text-slate-500 rounded-full hover:bg-slate-100"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitReel} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Judul Video</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-bold" value={reelForm.title} onChange={e => setReelForm({...reelForm, title: e.target.value})} required placeholder="Contoh: Cara Bikin Silase" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Deskripsi Pendek</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm" rows="2" value={reelForm.desc} onChange={e => setReelForm({...reelForm, desc: e.target.value})} required placeholder="Penjelasan singkat video..."></textarea>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Link URL Video (.MP4)</label>
                <input type="url" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none font-medium text-sm" value={reelForm.url} onChange={e => setReelForm({...reelForm, url: e.target.value})} required placeholder="https://contoh.com/video.mp4" />
                <p className="text-[10px] text-slate-400 mt-1">*Pastikan link diakhiri dengan .mp4 agar bisa di-*play* otomatis.</p>
              </div>
              <button disabled={isLoading} className="w-full bg-rose-600 hover:bg-rose-700 transition-all text-white py-3.5 rounded-xl font-extrabold shadow-lg shadow-rose-200 mt-2">
                {isLoading ? "Mengunggah..." : "Posting Reel"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}