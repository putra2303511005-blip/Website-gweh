import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { signOut, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, 
  getDocs, orderBy, limit, serverTimestamp, setDoc, where 
} from "firebase/firestore";
import { 
  LayoutDashboard, Beef, LogOut, Scale, Plus, X, Edit, Trash2, Search, Filter, Syringe,
  Wallet, BrainCircuit, TrendingUp, TrendingDown, Send, Cpu, Download, ArrowUpDown, CheckCircle2, AlertCircle
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
  
  // Fitur Baru: Sorting & Toast
  const [sortConfig, setSortConfig] = useState({ key: 'idSapi', direction: 'asc' });
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // --- STATE KEUANGAN & AI ---
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({ population: 0, balance: 0, totalIncome: 0, totalExpense: 0 });
  const [messages, setMessages] = useState([{ text: "Halo Juragan! Saya AI Assistant Feedlot Pro. Ada keluhan penyakit atau pertanyaan manajemen hari ini?", role: 'ai', id: 1 }]);
  const [inputMsg, setInputMsg] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef(null);

  const statusBadgeColors = {
    "Sehat": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Sakit": "bg-rose-100 text-rose-700 border-rose-200",
    "Pengawasan": "bg-amber-100 text-amber-700 border-amber-200",
    "Karantina": "bg-orange-100 text-orange-700 border-orange-200",
    "Hamil": "bg-purple-100 text-purple-700 border-purple-200",
    "Menyusui": "bg-indigo-100 text-indigo-700 border-indigo-200",
    "Tidak Diketahui": "bg-slate-100 text-slate-700 border-slate-200",
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
    const qSapi = query(collection(db, "sapi"), where("userId", "==", user.uid));
    const unsubscribeSapi = onSnapshot(qSapi, (querySnapshot) => {
      const sapiArray = [];
      querySnapshot.forEach((doc) => sapiArray.push({ idFirebase: doc.id, ...doc.data() }));
      setDataSapi(sapiArray);
    });

    const qTrans = query(collection(db, 'transactions'), where("userId", "==", user.uid));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubStats = onSnapshot(doc(db, 'stats', user.uid), (snap) => {
      if (snap.exists()) setStats(snap.data());
      else setStats({ population: 0, balance: 0, totalIncome: 0, totalExpense: 0 });
    });

    return () => { unsubscribeSapi(); unsubTrans(); unsubStats(); };
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      showToast("Gagal login, silakan coba lagi.", "error");
    }
  };

  const handleSubmitSapi = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, "sapi", editId), { ...formData, berat: Number(formData.berat) });
        showToast("Data sapi berhasil diperbarui!");
      } else {
        const docRef = await addDoc(collection(db, "sapi"), {
          ...formData, berat: Number(formData.berat), adgTerakhir: 0, 
          tanggalMasuk: new Date().toISOString(), userId: user.uid
        });
        await addDoc(collection(db, "sapi", docRef.id, "riwayat_timbangan"), {
          berat: Number(formData.berat), tanggal: new Date().toISOString()
        });
        showToast("Sapi baru berhasil ditambahkan!");
      }
      closeModal();
    } catch (error) { 
      showToast("Terjadi kesalahan sistem!", "error");
    } finally { setIsLoading(false); }
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

      setIsWeightModalOpen(false);
      setNewWeight("");
      showToast("Timbangan & ADG berhasil disimpan!");
    } catch (error) { showToast("Gagal menyimpan timbangan", "error"); }
    finally { setIsLoading(false); }
  };

  const closeModal = () => {
    setIsModalOpen(false); setIsEditing(false);
    setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
  };

  // Logika Sorting & Filtering
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = dataSapi
    .filter((sapi) => {
      const cocokPencarian = (sapi.idSapi || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                             (sapi.jenis || "").toLowerCase().includes(searchTerm.toLowerCase());
      const cocokStatus = filterStatus === "Semua" || sapi.status === filterStatus;
      return cocokPencarian && cocokStatus;
    })
    .sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  // Fitur Export CSV
  const handleExportCSV = () => {
    const headers = ["ID Sapi", "Jenis", "Berat (Kg)", "ADG", "Status"];
    const csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + filteredAndSortedData.map(e => `${e.idSapi},${e.jenis},${e.berat},${e.adgTerakhir},${e.status}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_FeedlotPro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("Laporan CSV berhasil diunduh!");
  };

  const handleFinance = async (type) => {
    const amt = prompt(`Masukkan Nominal ${type} (Rp):`);
    if (amt && !isNaN(amt)) {
      const val = Number(amt);
      const newIncome = type === 'Pemasukan' ? (stats.totalIncome || 0) + val : (stats.totalIncome || 0);
      const newExpense = type === 'Pengeluaran' ? (stats.totalExpense || 0) + val : (stats.totalExpense || 0);
      
      await addDoc(collection(db, 'transactions'), { 
        type, amount: val, timestamp: serverTimestamp(), userId: user.uid
      });
      await setDoc(doc(db, 'stats', user.uid), { 
        ...stats, totalIncome: newIncome, totalExpense: newExpense, balance: newIncome - newExpense 
      }, {merge: true});
      showToast(`Data ${type} berhasil dicatat!`);
    }
  };

  const handleAiChat = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const userMsg = { text: inputMsg, role: 'user', id: Date.now() };
    setMessages(p => [...p, userMsg]);
    setInputMsg("");
    setIsAiLoading(true);

    try {
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      if (!API_KEY) throw new Error("API Key Gemini tidak ditemukan.");
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: inputMsg }] }] }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error("Gagal mengambil respon AI.");

      setMessages(p => [...p, { text: data.candidates[0].content.parts[0].text, role: 'ai', id: Date.now() + 1 }]);
    } catch (err) {
      setMessages(p => [...p, { text: `Maaf, terjadi gangguan server AI: ${err.message}`, role: 'ai', id: Date.now() + 1 }]);
    } finally {
      setIsAiLoading(false);
      setTimeout(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  };

  if (isAuthLoading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center max-w-md w-full mx-4">
          <div className="flex justify-center mb-6"><div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200"><Beef size={48} className="text-white"/></div></div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Feedlot Pro</h1>
          <p className="text-slate-500 mb-8 font-medium">Enterprise Livestock Management. Masuk untuk mengelola aset peternakan Anda.</p>
          <button onClick={handleLogin} className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-6 h-6" />
            Lanjutkan dengan Google
          </button>
        </div>
      </div>
    );
  }

  // Menghitung Estimasi Aset (Berat Total * Rp 50.000)
  const totalBerat = dataSapi.reduce((acc, curr) => acc + (Number(curr.berat) || 0), 0);
  const estimasiAset = totalBerat * 50000;

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden text-slate-800">
      
      {/* --- TOAST NOTIFICATION --- */}
      <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 transform ${toast.show ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl border ${toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-white border-emerald-100 text-emerald-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={20} className="text-rose-500"/> : <CheckCircle2 size={20} className="text-emerald-500"/>}
          <p className="font-bold text-sm">{toast.message}</p>
        </div>
      </div>

      {/* --- SIDEBAR ENTERPRISE --- */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden md:flex md:flex-col shadow-sm z-20">
        <div className="h-24 flex items-center gap-3 px-8 border-b border-slate-100">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2.5 rounded-xl shadow-lg shadow-blue-200">
            <Beef size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Feedlot<span className="text-blue-600">Pro</span></h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Enterprise Edition</p>
          </div>
        </div>
        
        <nav className="p-5 flex-1 space-y-2 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 mb-4 ml-3 uppercase tracking-wider">Main Menu</div>
          
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
            <LayoutDashboard size={20}/> Dashboard
          </button>
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'finance' ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
            <Wallet size={20}/> Finance
          </button>
          
          <div className="text-xs font-bold text-slate-400 mt-8 mb-4 ml-3 uppercase tracking-wider">Intelligence</div>
          
          <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${activeTab === 'ai' ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>
            <BrainCircuit size={20}/> Vet AI Assistant
          </button>
        </nav>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <img src={user.photoURL} alt="Profil" className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{user.displayName}</p>
                <p className="text-xs font-medium text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={async () => await signOut(auth)} className="w-full flex justify-center items-center gap-2 px-4 py-2.5 text-rose-600 rounded-xl hover:bg-rose-50 font-bold transition-colors border border-transparent hover:border-rose-100">
            <LogOut size={18}/> Keluar Aplikasi
          </button>
        </div>
      </aside>

      {/* --- KONTEN UTAMA --- */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* TOP NAVBAR GLASSMORPHISM */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 z-10 sticky top-0">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 capitalize">
              {activeTab === 'dashboard' ? 'Ikhtisar Kandang' : activeTab === 'finance' ? 'Manajemen Keuangan' : 'Kecerdasan Buatan (AI)'}
            </h2>
            <p className="text-sm font-medium text-slate-500">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          
          {/* TAB DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
              
              {/* Toolbar Atas */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex gap-3">
                  <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl">
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Total Populasi</p>
                    <p className="text-xl font-extrabold text-indigo-700">{dataSapi.length} Ekor</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl hidden md:block">
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Estimasi Nilai Aset</p>
                    <p className="text-xl font-extrabold text-emerald-700">Rp {estimasiAset.toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex w-full md:w-auto gap-3">
                  <button onClick={handleExportCSV} className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-sm transition-all">
                    <Download size={18}/> Export CSV
                  </button>
                  <button onClick={() => setIsModalOpen(true)} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-md shadow-blue-200 transition-all">
                    <Plus size={18}/> Tambah Sapi
                  </button>
                </div>
              </div>

              {/* Tempat Statistik Lama (Bisa dihapus jika Anda tidak butuh komponen Statistik.jsx lagi) */}
              <Statistik dataSapi={dataSapi} />

              {/* Area Tabel Premium */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/50">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
                    <input type="text" placeholder="Cari ID Tagging atau Jenis Sapi..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="relative md:w-64">
                    <Filter className="absolute left-3.5 top-3 text-slate-400" size={18} />
                    <select className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      <option value="Semua">Semua Status Kandang</option>
                      <option value="Sehat">Sehat</option>
                      <option value="Pengawasan">Pengawasan</option>
                      <option value="Sakit">Sakit</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                        {['idSapi', 'jenis', 'berat', 'adgTerakhir', 'status'].map((key) => (
                          <th key={key} className="p-4 font-bold cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => handleSort(key)}>
                            <div className="flex items-center gap-2">
                              {key === 'idSapi' ? 'ID Sapi' : key === 'adgTerakhir' ? 'ADG' : key.charAt(0).toUpperCase() + key.slice(1)}
                              <ArrowUpDown size={14} className={sortConfig.key === key ? 'text-blue-500' : 'text-slate-300'}/>
                            </div>
                          </th>
                        ))}
                        <th className="p-4 font-bold text-center">Tindakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAndSortedData.length === 0 ? (
                        <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-medium">Belum ada data sapi yang sesuai kriteria.</td></tr>
                      ) : (
                        filteredAndSortedData.map((sapi) => {
                          const badge = statusBadgeColors[sapi.status] || statusBadgeColors["Tidak Diketahui"];
                          return (
                            <tr key={sapi.idFirebase} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="p-4"><span className="font-extrabold text-slate-800">{sapi.idSapi}</span></td>
                              <td className="p-4 text-slate-600 font-semibold">{sapi.jenis}</td>
                              <td className="p-4 font-bold text-slate-700">{sapi.berat} <span className="text-xs font-normal text-slate-400">kg</span></td>
                              <td className="p-4">
                                <div className={`inline-flex items-center gap-1.5 font-bold px-2 py-1 rounded-lg ${sapi.adgTerakhir > 0 ? 'bg-emerald-50 text-emerald-600' : sapi.adgTerakhir < 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-500'}`}>
                                  {sapi.adgTerakhir > 0 ? <TrendingUp size={14}/> : sapi.adgTerakhir < 0 ? <TrendingDown size={14}/> : null}
                                  {sapi.adgTerakhir > 0 ? `+${sapi.adgTerakhir}` : sapi.adgTerakhir}
                                </div>
                              </td>
                              <td className="p-4"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${badge}`}>{sapi.status}</span></td>
                              <td className="p-4 flex justify-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setSelectedSapi(sapi); setIsWeightModalOpen(true); }} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 shadow-sm transition-all" title="Timbang"><Scale size={16}/></button>
                                <button onClick={() => { setSelectedSapi(sapi); setIsMedisModalOpen(true); }} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 shadow-sm transition-all" title="Rekam Medis"><Syringe size={16}/></button>
                                <button onClick={() => { setIsEditing(true); setEditId(sapi.idFirebase); setFormData(sapi); setIsModalOpen(true); }} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 shadow-sm transition-all" title="Edit"><Edit size={16}/></button>
                                <button onClick={async () => { if(window.confirm("Hapus data sapi ini permanen?")) { await deleteDoc(doc(db, "sapi", sapi.idFirebase)); showToast("Data dihapus", "error"); } }} className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 shadow-sm transition-all" title="Hapus"><Trash2 size={16}/></button>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB FINANCE */}
          {activeTab === 'finance' && (
            <div className="max-w-5xl mx-auto animate-in fade-in duration-500 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: "Total Pemasukan", val: stats.totalIncome, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
                  { title: "Total Pengeluaran", val: stats.totalExpense, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
                  { title: "Saldo Kas Tersedia", val: stats.balance, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
                ].map((s, i) => (
                  <div key={i} className={`p-6 rounded-3xl border shadow-sm ${s.bg} ${s.border}`}>
                    <div className="text-slate-600 text-sm font-bold uppercase tracking-wider mb-2">{s.title}</div>
                    <div className={`text-3xl font-extrabold ${s.color}`}>Rp {s.val?.toLocaleString() || 0}</div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-4">
                <button onClick={() => handleFinance('Pemasukan')} className="flex-1 bg-emerald-600 text-white p-4 rounded-2xl font-bold flex justify-center items-center gap-2 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition-all"><TrendingUp size={20}/> Catat Pemasukan</button>
                <button onClick={() => handleFinance('Pengeluaran')} className="flex-1 bg-rose-600 text-white p-4 rounded-2xl font-bold flex justify-center items-center gap-2 hover:bg-rose-700 shadow-md shadow-rose-200 transition-all"><TrendingDown size={20}/> Catat Pengeluaran</button>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <div className="font-extrabold text-slate-800">Riwayat Transaksi</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {transactions.length === 0 ? <div className="p-10 text-center text-slate-400 font-medium">Belum ada aktivitas transaksi.</div> : (
                    transactions.sort((a,b) => b.timestamp - a.timestamp).map(t => (
                      <div key={t.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${t.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {t.type === 'Pemasukan' ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{t.type} Kandang</div>
                            <div className="text-xs font-medium text-slate-400">Diproses otomatis</div>
                          </div>
                        </div>
                        <span className={`font-extrabold text-lg ${t.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Pemasukan' ? '+' : '-'} Rp {t.amount?.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB AI ASSISTANT */}
          {activeTab === 'ai' && (
            <div className="max-w-4xl mx-auto h-[calc(100vh-10rem)] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-xl shadow-indigo-900/5 overflow-hidden animate-in fade-in duration-500">
              <div className="p-5 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm"><Cpu size={24} className="text-white"/></div>
                  <div>
                    <h3 className="font-extrabold text-white text-lg tracking-wide">AI Vet Assistant</h3>
                    <p className="text-indigo-100 text-sm font-medium">Powered by Gemini AI</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                     <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex gap-2 items-center">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                     </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>

              <form onSubmit={handleAiChat} className="p-4 bg-white border-t border-slate-100">
                <div className="relative flex items-center">
                  <input value={inputMsg} onChange={e => setInputMsg(e.target.value)} className="w-full bg-slate-100 border-none py-3.5 pl-5 pr-14 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow text-sm font-medium" placeholder="Ketik gejala penyakit atau resep pakan..." />
                  <button disabled={isAiLoading || !inputMsg.trim()} className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:bg-slate-300 disabled:cursor-not-allowed">
                    <Send size={18}/>
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* MODAL TAMBAH/EDIT SAPI */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl scale-in-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-extrabold text-slate-800">{isEditing ? "Edit Data Sapi" : "Input Sapi Baru"}</h3>
              <button onClick={closeModal} className="p-2 bg-slate-50 text-slate-500 hover:text-slate-800 rounded-full"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmitSapi} className="space-y-5">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">ID Tagging Kandang</label>
                <input type="text" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={formData.idSapi} onChange={e => setFormData({...formData, idSapi: e.target.value})} disabled={isEditing} required placeholder="Contoh: LM-001" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Jenis Ras</label>
                  <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" value={formData.jenis} onChange={e => setFormData({...formData, jenis: e.target.value})}>
                    <option value="Limousin">Limousin</option><option value="Simmental">Simmental</option><option value="Brahman">Brahman</option><option value="Angus">Angus</option><option value="PO">PO</option><option value="Bali">Bali</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Berat (Kg)</label>
                  <input type="number" className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-700" value={formData.berat} onChange={e => setFormData({...formData, berat: e.target.value})} required placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Status Awal</label>
                <select className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Sehat">Sehat</option><option value="Pengawasan">Pengawasan</option><option value="Sakit">Sakit</option>
                </select>
              </div>
              <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 transition-all text-white py-3.5 rounded-xl font-extrabold shadow-lg shadow-blue-200 disabled:bg-blue-300 mt-2">
                {isLoading ? "Menyimpan Database..." : "Simpan Data Sapi"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TIMBANGAN */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
           <div className="bg-white p-8 rounded-3xl w-full max-w-sm shadow-2xl text-center">
            <div className="bg-orange-100 text-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Scale size={32}/></div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-1">Timbang {selectedSapi?.idSapi}</h3>
            <p className="text-sm font-medium text-slate-500 mb-6">Berat sebelumnya: <span className="font-bold text-orange-600">{selectedSapi?.berat} kg</span></p>
            <form onSubmit={handleAddWeight} className="space-y-4">
              <input type="number" autoFocus required placeholder="Masukkan Berat Baru" className="w-full border-2 border-slate-200 focus:border-orange-500 bg-slate-50 focus:bg-white outline-none p-4 rounded-2xl text-2xl font-extrabold text-center transition-all" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setIsWeightModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Batal</button>
                <button disabled={isLoading} className="flex-[2] bg-orange-500 hover:bg-orange-600 transition-all text-white py-3 rounded-xl font-extrabold shadow-lg shadow-orange-200 disabled:bg-orange-300">
                  {isLoading ? "Loading..." : "Simpan ADG"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMedisModalOpen && (
        <RekamMedis sapi={selectedSapi} onClose={() => setIsMedisModalOpen(false)} />
      )}
    </div>
  );
}