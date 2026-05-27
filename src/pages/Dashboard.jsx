import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { signOut, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, 
  getDocs, orderBy, limit, serverTimestamp, setDoc, where 
} from "firebase/firestore";
import { 
  LayoutDashboard, Beef, LogOut, Scale, Plus, X, Edit, Trash2, Search, Filter, Syringe,
  Wallet, BrainCircuit, TrendingUp, TrendingDown, Send, Cpu, Wheat, PlaySquare, Video, Activity, Droplets, Heart, MessageCircle, Share2
} from "lucide-react";

import RekamMedis from "../components/RekamMedis";
import Statistik from "../components/Statistik";
import FormPakan from "../components/formPakan";
  // --- 0. STATE AUTENTIKASI ---
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- 1. STATE NAVIGASI TAB ---
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- 2. STATE DATABASE SAPI & FILTER ---
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

  // --- 3. STATE KEUANGAN & AI ---
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ population: 0, balance: 0, totalIncome: 0, totalExpense: 0 });
  const [messages, setMessages] = useState([{ text: "Halo Juragan! Saya Asisten AI Feedlot Pro. Ada yang bisa saya bantu terkait kesehatan atau pakan ternak?", role: 'ai', id: 1 }]);
  const [inputMsg, setInputMsg] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef(null);

  // --- 4. STATE PAKAN & EDUKASI ---
  const [pakanLogs, setPakanLogs] = useState([]);
  const [isPakanModalOpen, setIsPakanModalOpen] = useState(false);
  const [pakanForm, setPakanForm] = useState({ jenisPakan: "Hijauan", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });

  const statusBadgeColors = {
    "Sehat": "bg-emerald-100 text-emerald-700",
    "Sakit": "bg-rose-100 text-rose-700",
    "Pengawasan": "bg-amber-100 text-amber-700",
    "Karantina": "bg-orange-100 text-orange-700",
    "Hamil": "bg-purple-100 text-purple-700",
    "Menyusui": "bg-indigo-100 text-indigo-700",
    "Tidak Diketahui": "bg-slate-100 text-slate-700",
  };

  // --- EFFECT: AUTENTIKASI ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- EFFECT: AMBIL DATA DARI FIREBASE ---
  useEffect(() => {
    if (!user) return;

    // Data Sapi
    const qSapi = query(collection(db, "sapi"), where("userId", "==", user.uid));
    const unsubSapi = onSnapshot(qSapi, (snap) => setDataSapi(snap.docs.map(doc => ({ idFirebase: doc.id, ...doc.data() }))));

    // Data Transaksi & Stats Keuangan
    const qTrans = query(collection(db, 'transactions'), where("userId", "==", user.uid), orderBy("timestamp", "desc"), limit(20));
    const unsubTrans = onSnapshot(qTrans, (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubStats = onSnapshot(doc(db, 'stats', user.uid), (snap) => {
      if (snap.exists()) setStats(snap.data());
      else setStats({ population: 0, balance: 0, totalIncome: 0, totalExpense: 0 });
    });

    // Data Pakan
    const qPakan = query(collection(db, "pakan"), where("userId", "==", user.uid), orderBy("tanggal", "desc"), limit(50));
    const unsubPakan = onSnapshot(qPakan, (snap) => setPakanLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    return () => { unsubSapi(); unsubTrans(); unsubStats(); unsubPakan() };
  }, [user]);

  // --- LOGIKA SAPI UTAMA (DARI KODE ASLI) ---
  const handleSubmitSapi = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, "sapi", editId), { ...formData, berat: Number(formData.berat) });
      } else {
        const docRef = await addDoc(collection(db, "sapi"), {
          ...formData, berat: Number(formData.berat), adgTerakhir: 0, 
          tanggalMasuk: new Date().toISOString(), userId: user.uid 
        });
        await addDoc(collection(db, "sapi", docRef.id, "riwayat_timbangan"), {
          berat: Number(formData.berat), tanggal: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) { alert("Gagal simpan data sapi!"); }
    finally { setIsLoading(false); }
  };

  const handleAddWeight = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const riwayatRef = collection(db, "sapi", selectedSapi.idFirebase, "riwayat_timbangan");
      const q = query(riwayatRef, orderBy("tanggal", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      
      let adg = 0;
      if (!querySnapshot.empty) {
        const dataTerakhir = querySnapshot.docs[0].data();
        const selisihHari = Math.ceil((new Date().getTime() - new Date(dataTerakhir.tanggal).getTime()) / (1000 * 3600 * 24)) || 1;
        adg = ((Number(newWeight) - dataTerakhir.berat) / selisihHari).toFixed(2);
      }

      await addDoc(riwayatRef, { berat: Number(newWeight), tanggal: new Date().toISOString(), adg: Number(adg) });
      await updateDoc(doc(db, "sapi", selectedSapi.idFirebase), { berat: Number(newWeight), adgTerakhir: Number(adg) });

      setIsWeightModalOpen(false); setNewWeight("");
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const closeModal = () => {
    setIsModalOpen(false); setIsEditing(false);
    setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
  };

  const filteredData = dataSapi.filter((sapi) => {
    const cocokPencarian = (sapi.idSapi || "").toLowerCase().includes(searchTerm.toLowerCase()) || (sapi.jenis || "").toLowerCase().includes(searchTerm.toLowerCase());
    const cocokStatus = filterStatus === "Semua" || sapi.status === filterStatus;
    return cocokPencarian && cocokStatus;
  });

  // --- LOGIKA KEUANGAN (DARI KODE ASLI) ---
  const handleFinance = async (type) => {
    const amt = prompt(`Masukkan Nominal ${type} (Rp):`);
    if (amt && !isNaN(amt)) {
      const val = Number(amt);
      const newIncome = type === 'Pemasukan' ? (stats.totalIncome || 0) + val : (stats.totalIncome || 0);
      const newExpense = type === 'Pengeluaran' ? (stats.totalExpense || 0) + val : (stats.totalExpense || 0);
      
      await addDoc(collection(db, 'transactions'), { type, amount: val, timestamp: serverTimestamp(), userId: user.uid });
      await setDoc(doc(db, 'stats', user.uid), { ...stats, totalIncome: newIncome, totalExpense: newExpense, balance: newIncome - newExpense }, {merge: true});
    }
  };

  // --- LOGIKA VET AI ASSISTANT (KONEKSI GEMINI ASLI) ---
  const handleAiChat = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg = { text: inputMsg, role: 'user', id: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInputMsg("");
    setIsAiLoading(true);

    try {
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      if (!API_KEY) throw new Error("API Key belum disetting");
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: inputMsg }] }], generationConfig: { temperature: 0.7 } }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);

      const aiResponse = data.candidates[0].content.parts[0].text;
      setMessages(p => [...p, { text: aiResponse, role: 'ai', id: Date.now() + 1 }]);
    } catch (err) {
      setMessages(p => [...p, { text: `Sistem Error: ${err.message}`, role: 'ai', id: Date.now() + 1 }]);
    } finally {
      setIsAiLoading(false);
      setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  };

  // --- LOGIKA PAKAN & EDUKASI ---
  const handleSubmitPakan = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "pakan"), { ...pakanForm, jumlahKg: Number(pakanForm.jumlahKg), konsentrat: Number(pakanForm.konsentrat), tanggal: new Date().toISOString(), userId: user.uid });
      setIsPakanModalOpen(false); setPakanForm({ jenisPakan: "Hijauan", jumlahKg: "", konsentrat: "", nutrisi: "Sedang" });
    } catch (error) { alert("Gagal menyimpan pakan"); } finally { setIsLoading(false); }
  };

  const handleSubmitReel = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await addDoc(collection(db, "reels"), { ...reelForm, likes: 0, uploaderId: user.uid, uploaderName: user.displayName, createdAt: serverTimestamp() });
      setIsReelModalOpen(false); setReelForm({ title: "", desc: "", url: "" });
    } catch (error) { alert("Gagal mengunggah video"); } finally { setIsLoading(false); }
  };

  // --- RENDER SCREEN ---
  if (isAuthLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-md w-full"><h1 className="text-3xl font-extrabold text-slate-800">Feedlot Pro</h1><button onClick={async () => await signInWithPopup(auth, new GoogleAuthProvider())} className="mt-8 w-full bg-slate-50 border border-slate-200 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-100">Login Google</button></div>
    </div>
  );
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex md:flex-col shadow-sm z-20">
        <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-100">
          <div className="bg-blue-600 p-2 rounded-xl"><Beef size={24} className="text-white" /></div>
          <h1 className="text-xl font-extrabold">Feedlot<span className="text-blue-600">Pro</span></h1>
        </div>
        
        <nav className="p-4 flex-1 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 mb-2 ml-2 uppercase">Menu Utama</div>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={20}/> Dashboard Sapi</button>
          <button onClick={() => setActiveTab('pakan')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pakan' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}><Wheat size={20}/> Formulasi Pakan</button>
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'finance' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50'}`}><Wallet size={20}/> Buku Kas</button>
          
          <div className="text-xs font-bold text-slate-400 mt-6 mb-2 ml-2 uppercase">Pintar & Sosial</div>
          <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'ai' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}><BrainCircuit size={20}/> Vet AI Assistant</button>
          <button onClick={() => setActiveTab('edukasi')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'edukasi' ? 'bg-rose-50 text-rose-700' : 'text-slate-500 hover:bg-slate-50'}`}><PlaySquare size={20}/> Farm Reels</button>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 px-2 mb-4"><img src={user.photoURL} alt="Profil" className="w-8 h-8 rounded-full" /><p className="text-sm font-bold truncate">{user.displayName}</p></div>
          <button onClick={async () => await signOut(auth)} className="w-full flex justify-center items-center gap-2 px-4 py-2.5 text-rose-600 rounded-xl hover:bg-rose-50 font-bold"><LogOut size={18}/> Logout</button>
        </div>
      </aside>
          
          {/* ================= TAB 1: DASHBOARD SAPI ================= */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-extrabold">Database Ternak</h2> 
                <button onClick={() => { setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" }); setIsModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex gap-2"><Plus size={18}/> Tambah</button>
              </div>

              {/* Filter & Pencarian Dikembalikan */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="Cari Eartag / Jenis..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative md:w-64">
                  <Filter className="absolute left-3 top-3 text-slate-400" size={18} />
                  <select className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                    <option value="Semua">Semua Status</option><option value="Sehat">Sehat</option><option value="Pengawasan">Pengawasan</option><option value="Sakit">Sakit</option><option value="Hamil">Hamil</option><option value="Menyusui">Menyusui</option><option value="Karantina">Karantina</option>
                  </select>
                </div>
              </div>

              <Statistik dataSapi={dataSapi} />

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase font-bold">
                    <tr><th className="p-4">ID Sapi</th><th className="p-4">Jenis</th><th className="p-4">Berat</th><th className="p-4">ADG</th><th className="p-4">Status</th><th className="p-4 text-center">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredData.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-slate-400">Tidak ada data.</td></tr> : 
                      filteredData.map(sapi => (
                        <tr key={sapi.idFirebase} className="hover:bg-slate-50">
                          <td className="p-4 font-extrabold text-blue-700">{sapi.idSapi}</td>
                          <td className="p-4 font-medium text-slate-700">{sapi.jenis}</td>
                          <td className="p-4 font-bold">{sapi.berat} Kg</td>
                          <td className="p-4"><span className={`font-bold ${sapi.adgTerakhir > 0 ? 'text-emerald-600' : sapi.adgTerakhir < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{sapi.adgTerakhir > 0 ? `+${sapi.adgTerakhir}` : sapi.adgTerakhir}</span></td>
                          <td className="p-4"><span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusBadgeColors[sapi.status] || statusBadgeColors["Tidak Diketahui"]}`}>{sapi.status}</span></td>
                          
                          {/* Tombol Aksi Lengkap Dikembalikan */}
                          <td className="p-4 flex justify-center gap-2">
                            <button onClick={() => { setSelectedSapi(sapi); setIsWeightModalOpen(true); }} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="Timbang"><Scale size={16}/></button>
                            <button onClick={() => { setSelectedSapi(sapi); setIsMedisModalOpen(true); }} className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100" title="Rekam Medis"><Syringe size={16}/></button>
                            <button onClick={() => { setIsEditing(true); setEditId(sapi.idFirebase); setFormData(sapi); setIsModalOpen(true); }} className="p-2 text-blue-600 rounded-lg hover:bg-blue-50" title="Edit"><Edit size={16}/></button>
                            <button onClick={async () => { if(window.confirm("Hapus data sapi ini?")) await deleteDoc(doc(db, "sapi", sapi.idFirebase)) }} className="p-2 text-rose-500 rounded-lg hover:bg-rose-50" title="Hapus"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 2: PAKAN ================= */}
          {activeTab === 'pakan' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex justify-between items-center bg-amber-500 p-8 rounded-2xl text-white shadow-md">
                <div><h2 className="text-2xl font-extrabold mb-1">Manajemen Pakan</h2><p className="text-amber-100">Pantau asupan nutrisi harian untuk target ADG.</p></div>
                <button onClick={() => setIsPakanModalOpen(true)} className="bg-white text-amber-600 px-5 py-2.5 rounded-xl font-bold flex gap-2"><Plus size={18}/> Catat Pakan</button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b bg-slate-50 font-bold">Riwayat Pemberian Pakan</div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b text-slate-400 text-xs uppercase"><tr><th className="p-4">Tanggal</th><th className="p-4">Pakan Utama</th><th className="p-4">Jumlah</th><th className="p-4">Konsentrat</th><th className="p-4">Nutrisi</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pakanLogs.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-4">{new Date(p.tanggal).toLocaleDateString('id-ID')}</td>
                        <td className="p-4 font-bold">{p.jenisPakan}</td>
                        <td className="p-4">{p.jumlahKg} Kg</td>
                        <td className="p-4 text-amber-600 font-bold">+{p.konsentrat} Kg</td>
                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${p.nutrisi === 'Tinggi' ? 'bg-emerald-100 text-emerald-700' : p.nutrisi === 'Sedang' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>{p.nutrisi}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 3: KEUANGAN (LOGIKA ASLI) ================= */}
          {activeTab === 'finance' && (
             <div className="max-w-5xl mx-auto space-y-6">
                <h2 className="text-2xl font-bold text-slate-800">Buku Kas Peternakan</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 font-medium">Total Pemasukan</div><div className="text-2xl font-bold text-emerald-600 mt-2">Rp {stats.totalIncome?.toLocaleString() || 0}</div></div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 font-medium">Total Pengeluaran</div><div className="text-2xl font-bold text-rose-600 mt-2">Rp {stats.totalExpense?.toLocaleString() || 0}</div></div>
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className="text-slate-500 font-medium">Saldo Kas Saat Ini</div><div className="text-2xl font-bold text-blue-600 mt-2">Rp {stats.balance?.toLocaleString() || 0}</div></div>
                </div>
                
                <div className="flex gap-4">
                  <button onClick={() => handleFinance('Pemasukan')} className="flex-1 bg-emerald-50 text-emerald-600 border border-emerald-200 py-3 rounded-xl font-bold flex justify-center gap-2"><TrendingUp size={20}/> Catat Pemasukan</button>
                  <button onClick={() => handleFinance('Pengeluaran')} className="flex-1 bg-rose-50 text-rose-600 border border-rose-200 py-3 rounded-xl font-bold flex justify-center gap-2"><TrendingDown size={20}/> Catat Pengeluaran</button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-4">
                  <div className="p-4 border-b bg-slate-50 font-bold">Riwayat Transaksi Terbaru</div>
                  <div className="divide-y divide-slate-100">
                    {transactions.map(t => (
                      <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${t.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{t.type === 'Pemasukan' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}</div>
                          <span className="font-semibold">{t.type}</span>
                        </div>
                        <span className={`font-bold ${t.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {t.amount?.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          )}

          {/* ================= TAB 4: VET AI ASSISTANT ================= */}
          {activeTab === 'ai' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-indigo-50 border-b flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-xl text-white"><Cpu size={20}/></div>
                <div><h3 className="font-bold text-indigo-900">Veterinary AI Specialist</h3><p className="text-xs text-indigo-600">Konsultasi real-time via Gemini AI</p></div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'}`}>{m.text}</div>
                  </div>
                ))}
                {isAiLoading && <div className="text-indigo-500 text-sm font-bold animate-pulse">AI sedang menganalisis...</div>}
                <div ref={scrollRef} />
              </div>
              <form onSubmit={handleAiChat} className="p-4 bg-white border-t flex gap-2">
                <input value={inputMsg} onChange={e => setInputMsg(e.target.value)} className="flex-1 bg-slate-100 border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ketik gejala penyakit atau tanya nutrisi pakan..." />
                <button disabled={isAiLoading || !inputMsg.trim()} className="bg-indigo-600 text-white px-5 rounded-xl hover:bg-indigo-700 disabled:opacity-50"><Send size={20}/></button>
              </form>
            </div>
          )}

      {/* --- MODAL TAMBAH/EDIT SAPI (LOGIKA ASLI DIKEMBALIKAN) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">{isEditing ? "Edit Sapi" : "Tambah Sapi Baru"}</h3><button onClick={closeModal}><X/></button></div>
            <form onSubmit={handleSubmitSapi} className="space-y-4">
              <input type="text" placeholder="ID Sapi / Eartag" className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={formData.idSapi} onChange={e => setFormData({...formData, idSapi: e.target.value})} disabled={isEditing} required />
              <select className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={formData.jenis} onChange={e => setFormData({...formData, jenis: e.target.value})}>
                <option value="Limousin">Limousin</option><option value="Simmental">Simmental</option><option value="Brahman">Brahman</option><option value="Angus">Angus</option><option value="PO (Peranakan Ongole)">PO</option><option value="Bali">Bali</option>
              </select>
              <input type="number" placeholder="Berat Awal (Kg)" className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={formData.berat} onChange={e => setFormData({...formData, berat: e.target.value})} required />
              <select className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Sehat">Sehat</option><option value="Pengawasan">Pengawasan</option><option value="Sakit">Sakit</option><option value="Hamil">Hamil</option><option value="Menyusui">Menyusui</option><option value="Karantina">Karantina</option>
              </select>
              <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold mt-2">Simpan Data</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TIMBANG (LOGIKA ASLI DIKEMBALIKAN) --- */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Timbang ID: {selectedSapi?.idSapi}</h3><button onClick={() => setIsWeightModalOpen(false)}><X/></button></div>
            <form onSubmit={handleAddWeight} className="space-y-4">
              <div className="text-lg font-bold text-slate-500">Berat Lama: <span className="text-blue-600">{selectedSapi?.berat} kg</span></div>
              <input type="number" autoFocus required placeholder="Berat Baru (Kg)" className="w-full border-2 border-amber-200 focus:border-amber-500 bg-amber-50 outline-none p-4 rounded-xl text-2xl font-extrabold text-center" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
              <button disabled={isLoading} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold">Hitung ADG & Simpan</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL REKAM MEDIS --- */}
      {isMedisModalOpen && <RekamMedis sapi={selectedSapi} onClose={() => setIsMedisModalOpen(false)} />}

      {/* --- MODAL TAMBAH PAKAN --- */}
      {isPakanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">Catat Pakan</h3><button onClick={() => setIsPakanModalOpen(false)}><X/></button></div>
            <form onSubmit={handleSubmitPakan} className="space-y-4">
              <select className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={pakanForm.jenisPakan} onChange={e => setPakanForm({...pakanForm, jenisPakan: e.target.value})}><option value="Hijauan">Hijauan</option><option value="Jerami">Jerami</option><option value="Silase">Silase</option></select>
              <input type="number" placeholder="Jumlah Pakan (Kg)" className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={pakanForm.jumlahKg} onChange={e => setPakanForm({...pakanForm, jumlahKg: e.target.value})} required />
              <input type="number" placeholder="Konsentrat (Kg)" className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={pakanForm.konsentrat} onChange={e => setPakanForm({...pakanForm, konsentrat: e.target.value})} required />
              <select className="w-full border p-3 rounded-xl font-bold bg-slate-50" value={pakanForm.nutrisi} onChange={e => setPakanForm({...pakanForm, nutrisi: e.target.value})}><option value="Tinggi">Nutrisi Tinggi</option><option value="Sedang">Nutrisi Sedang</option></select>
              <button disabled={isLoading} className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold">Simpan Pakan</button>
            </form>
          </div>
        </div>
      );
      }