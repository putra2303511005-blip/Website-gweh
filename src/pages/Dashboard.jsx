import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { signOut } from "firebase/auth";
import { 
  collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, 
  getDocs, orderBy, limit, serverTimestamp, setDoc 
} from "firebase/firestore";
import { 
  LayoutDashboard, Beef, LogOut, Scale, Plus, X, Edit, Trash2, Search, Filter, Syringe,
  Wallet, BrainCircuit, TrendingUp, TrendingDown, Send, Cpu
} from "lucide-react";

import RekamMedis from "../components/RekamMedis";
import Statistik from "../components/Statistik";

export default function Dashboard() {
  // --- 1. STATE UNTUK TAB NAVIGASI ---
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- 2. STATE DATABASE SAPI (DARI KODE ANDA) ---
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
  const [messages, setMessages] = useState([{ text: "Halo! Saya Asisten AI Feedlot. Ada yang bisa saya bantu?", role: 'ai', id: 1 }]);
  const [inputMsg, setInputMsg] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const scrollRef = useRef(null);

  // KAMUS WARNA UNTUK TABEL
  const statusBadgeColors = {
    "Sehat": "bg-green-100 text-green-700",
    "Sakit": "bg-red-100 text-red-700",
    "Pengawasan": "bg-yellow-100 text-yellow-700",
    "Karantina": "bg-orange-100 text-orange-700",
    "Hamil": "bg-purple-100 text-purple-700",
    "Menyusui": "bg-indigo-100 text-indigo-700",
    "Tidak Diketahui": "bg-gray-100 text-gray-700",
  };

  // --- EFFECT: AMBIL DATA DARI FIREBASE ---
  useEffect(() => {
    // Data Sapi
    const q = query(collection(db, "sapi"));
    const unsubscribeSapi = onSnapshot(q, (querySnapshot) => {
      const sapiArray = [];
      querySnapshot.forEach((doc) => {
        sapiArray.push({ idFirebase: doc.id, ...doc.data() });
      });
      setDataSapi(sapiArray);
    });

    // Data Transaksi
    const unsubTrans = onSnapshot(collection(db, 'transactions'), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Data Statistik Keuangan
    const unsubStats = onSnapshot(doc(db, 'stats', 'overview'), (snap) => {
      if (snap.exists()) setStats(snap.data());
    });

    return () => { unsubscribeSapi(); unsubTrans(); unsubStats(); };
  }, []);

  // --- FUNGSI LOGIKA SAPI (100% DARI KODE ANDA) ---
  const handleSubmitSapi = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isEditing) {
        await updateDoc(doc(db, "sapi", editId), { ...formData, berat: Number(formData.berat) });
      } else {
        const docRef = await addDoc(collection(db, "sapi"), {
          ...formData, berat: Number(formData.berat), adgTerakhir: 0, tanggalMasuk: new Date().toISOString()
        });
        await addDoc(collection(db, "sapi", docRef.id, "riwayat_timbangan"), {
          berat: Number(formData.berat), tanggal: new Date().toISOString()
        });
      }
      closeModal();
    } catch (error) { 
      console.error(error);
      alert("Gagal simpan!"); 
    }
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

      setIsWeightModalOpen(false);
      setNewWeight("");
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  };

  const closeModal = () => {
    setIsModalOpen(false); setIsEditing(false);
    setFormData({ idSapi: "", jenis: "Limousin", berat: "", status: "Sehat" });
  };

  const filteredData = dataSapi.filter((sapi) => {
    const cocokPencarian = 
      (sapi.idSapi || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
      (sapi.jenis || "").toLowerCase().includes(searchTerm.toLowerCase());
    const cocokStatus = filterStatus === "Semua" || sapi.status === filterStatus;
    return cocokPencarian && cocokStatus;
  });

  // --- FUNGSI TAMBAHAN: KEUANGAN & AI ---
  const handleFinance = async (type) => {
    const amt = prompt(`Masukkan Nominal ${type} (Rp):`);
    if (amt && !isNaN(amt)) {
      const val = Number(amt);
      const newIncome = type === 'Pemasukan' ? (stats.totalIncome || 0) + val : (stats.totalIncome || 0);
      const newExpense = type === 'Pengeluaran' ? (stats.totalExpense || 0) + val : (stats.totalExpense || 0);
      await addDoc(collection(db, 'transactions'), { type, amount: val, timestamp: serverTimestamp() });
      await setDoc(doc(db, 'stats', 'overview'), { ...stats, totalIncome: newIncome, totalExpense: newExpense, balance: newIncome - newExpense }, {merge: true});
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
      // 1. Ambil API KEY dari environment variable
      const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
      
      // Validasi kecil agar tidak error jika key kosong
      if (!API_KEY) {
        throw new Error("API Key tidak ditemukan di pengaturan Vercel/ENV");
      }
      // 2. KITA GUNAKAN MODEL TERBARU DARI DAFTAR ANDA
      const MODEL_NAME = "gemini-2.5-flash"; 
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: inputMsg }] }],
            generationConfig: {
              temperature: 0.7, // Kreativitas AI
              maxOutputTokens: 800, // Panjang maksimal jawaban
            }
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || `Status: ${response.status}`);
      }

      // 3. Menampilkan jawaban asli dari AI
      const aiResponse = data.candidates[0].content.parts[0].text;
      setMessages(p => [...p, { text: aiResponse, role: 'ai', id: Date.now() + 1 }]);

    } catch (err) {
      console.error("AI Error:", err);
      setMessages(p => [
        ...p, 
        { text: `Sistem Error: ${err.message}`, role: 'ai', id: Date.now() + 1 }
      ]);
    } finally {
      setIsAiLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Langsung masuk ke return, tidak ada kurung kurawal penutup fungsi Dashboard di sini
  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* SIDEBAR DENGAN MENU LENGKAP */}
      <aside className="w-64 bg-white border-r p-6 hidden md:flex md:flex-col">
        <div className="flex items-center gap-3 text-blue-700 mb-10">
          <Beef size={32} /> <h1 className="text-xl font-bold">Feedlot Pro</h1>
        </div>
        
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-colors ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <LayoutDashboard size={20}/> Dashboard Sapi
          </button>
          <button onClick={() => setActiveTab('finance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-colors ${activeTab === 'finance' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Wallet size={20}/> Keuangan
          </button>
          <button onClick={() => setActiveTab('ai')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-bold transition-colors ${activeTab === 'ai' ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
            <BrainCircuit size={20}/> Asisten AI
          </button>
        </nav>

        <button onClick={async () => await signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 text-red-600 rounded-lg hover:bg-red-50 font-bold transition-colors mt-auto">
          <LogOut size={20}/> Logout
        </button>
      </aside>

      {/* KONTEN UTAMA */}
      <main className="flex-1 overflow-auto p-8">
        
        {/* TAB 1: DASHBOARD DATABASE SAPI (Kode Asli Anda) */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Database Ternak</h2>
              <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
                <Plus size={20}/> Tambah Sapi
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 text-slate-400" size={20} />
                <input type="text" placeholder="Cari ID Tagging atau Jenis Sapi..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <div className="relative md:w-64">
                <Filter className="absolute left-3 top-3 text-slate-400" size={20} />
                <select className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none bg-white" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="Semua">Semua Status</option>
                  <option value="Sehat">Sehat</option>
                  <option value="Pengawasan">Pengawasan</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Hamil">Hamil</option>
                  <option value="Menyusui">Menyusui</option>
                  <option value="Karantina">Karantina</option>
                </select>
              </div>
            </div>

            <Statistik dataSapi={dataSapi} />

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden mt-6">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b text-slate-500 text-sm">
                    <th className="p-4">ID Sapi</th>
                    <th className="p-4">Jenis</th>
                    <th className="p-4">Berat (Kg)</th>
                    <th className="p-4">ADG</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-400">Tidak ada sapi yang cocok.</td></tr>
                  ) : (
                    filteredData.map((sapi) => {
                      const currentBadgeColor = statusBadgeColors[sapi.status] || statusBadgeColors["Tidak Diketahui"];
                      return (
                        <tr key={sapi.idFirebase} className="border-b hover:bg-slate-50">
                          <td className="p-4 font-bold text-blue-700">{sapi.idSapi}</td>
                          <td className="p-4">{sapi.jenis}</td>
                          <td className="p-4 font-semibold text-slate-700">{sapi.berat} kg</td>
                          <td className="p-4">
                            <span className={`font-bold ${sapi.adgTerakhir > 0 ? 'text-green-600' : sapi.adgTerakhir < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                              {sapi.adgTerakhir > 0 ? `+${sapi.adgTerakhir}` : sapi.adgTerakhir}
                            </span>
                          </td>
                          <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${currentBadgeColor}`}>{sapi.status}</span></td>
                          <td className="p-4 flex justify-center gap-2">
                            <button onClick={() => { setSelectedSapi(sapi); setIsWeightModalOpen(true); }} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100" title="Timbang"><Scale size={18}/></button>
                            <button onClick={() => { setSelectedSapi(sapi); setIsMedisModalOpen(true); }} className="p-2 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors" title="Rekam Medis"><Syringe size={18}/></button>
                            <button onClick={() => { setIsEditing(true); setEditId(sapi.idFirebase); setFormData(sapi); setIsModalOpen(true); }} className="p-2 text-blue-600 rounded-lg hover:bg-blue-50" title="Edit"><Edit size={18}/></button>
                            <button onClick={async () => { if(window.confirm("Hapus data sapi ini?")) await deleteDoc(doc(db, "sapi", sapi.idFirebase)) }} className="p-2 text-red-500 rounded-lg hover:bg-red-50" title="Hapus"><Trash2 size={18}/></button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: KEUANGAN */}
        {activeTab === 'finance' && (
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-8">Manajemen Keuangan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Total Pemasukan</div>
                <div className="text-2xl font-bold text-emerald-600 mt-2">Rp {stats.totalIncome?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Total Pengeluaran</div>
                <div className="text-2xl font-bold text-rose-600 mt-2">Rp {stats.totalExpense?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-slate-500 text-sm font-medium">Saldo Kas Saat Ini</div>
                <div className="text-2xl font-bold text-blue-600 mt-2">Rp {stats.balance?.toLocaleString() || 0}</div>
              </div>
            </div>
            
            <div className="flex gap-4 mb-8">
              <button onClick={() => handleFinance('Pemasukan')} className="flex-1 bg-emerald-50 text-emerald-600 border border-emerald-200 p-4 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-emerald-100"><TrendingUp size={20}/> Catat Pemasukan</button>
              <button onClick={() => handleFinance('Pengeluaran')} className="flex-1 bg-rose-50 text-rose-600 border border-rose-200 p-4 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-rose-100"><TrendingDown size={20}/> Catat Pengeluaran</button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b bg-slate-50 font-bold text-slate-700">Riwayat Transaksi Terbaru</div>
              <div className="divide-y divide-slate-100">
                {transactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">Belum ada transaksi.</div>
                ) : (
                  transactions.map(t => (
                    <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${t.type === 'Pemasukan' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {t.type === 'Pemasukan' ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                        </div>
                        <span className="font-semibold text-slate-700">{t.type}</span>
                      </div>
                      <span className={`font-bold ${t.type === 'Pemasukan' ? 'text-emerald-600' : 'text-rose-600'}`}>Rp {t.amount?.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ASISTEN AI */}
        {activeTab === 'ai' && (
          <div className="max-w-3xl mx-auto h-[75vh] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white"><Cpu size={20}/></div>
              <div>
                <h3 className="font-bold text-slate-800">Veterinary AI Specialist</h3>
                <p className="text-xs text-slate-500">Tanya seputar pakan, penyakit, & manajemen ternak</p>
              </div>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isAiLoading && <div className="text-blue-600 text-xs font-bold animate-pulse">AI sedang mengetik balasan...</div>}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={handleAiChat} className="p-4 bg-white border-t flex gap-2">
              <input value={inputMsg} onChange={e => setInputMsg(e.target.value)} className="flex-1 bg-slate-100 border-none p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ketik pertanyaan Anda di sini..." />
              <button disabled={isAiLoading || !inputMsg.trim()} className="bg-blue-600 text-white px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"><Send size={20}/></button>
            </form>
          </div>
        )}

      </main>

      {/* --- MODAL TAMBAH DATA (KODE ASLI) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{isEditing ? "Edit Sapi" : "Tambah Sapi Baru"}</h3>
              <button onClick={closeModal}><X/></button>
            </div>
            <form onSubmit={handleSubmitSapi} className="space-y-4">
              <input type="text" placeholder="ID Sapi" className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.idSapi} onChange={e => setFormData({...formData, idSapi: e.target.value})} disabled={isEditing} required />
              <select className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.jenis} onChange={e => setFormData({...formData, jenis: e.target.value})}>
                <option value="Limousin">Limousin</option>
                <option value="Simmental">Simmental</option>
                <option value="Brahman">Brahman</option>
                <option value="Angus">Angus</option>
                <option value="PO (Peranakan Ongole)">PO</option>
                <option value="Bali">Bali</option>
              </select>
              <input type="number" placeholder="Berat (Kg)" className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.berat} onChange={e => setFormData({...formData, berat: e.target.value})} required />
              
              <select className="w-full border border-slate-300 p-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Sehat">Sehat</option>
                <option value="Pengawasan">Pengawasan</option>
                <option value="Sakit">Sakit</option>
                <option value="Hamil">Hamil</option>
                <option value="Menyusui">Menyusui</option>
                <option value="Karantina">Karantina</option>
              </select>
              <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-2 rounded-lg font-bold disabled:bg-blue-300">
                {isLoading ? "Proses..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL TIMBANG (KODE ASLI) --- */}
      {isWeightModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
           <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Timbang Sapi: {selectedSapi?.idSapi}</h3>
              <button onClick={() => setIsWeightModalOpen(false)}><X/></button>
            </div>
            <form onSubmit={handleAddWeight} className="space-y-4">
              <div className="text-xl font-bold text-slate-400">Berat Sebelumnya: <span className="text-blue-600">{selectedSapi?.berat} kg</span></div>
              <input type="number" autoFocus required placeholder="Berat Baru (Kg)" className="w-full border-2 border-slate-300 focus:border-orange-500 outline-none p-3 rounded-lg text-2xl font-bold" value={newWeight} onChange={e => setNewWeight(e.target.value)} />
              <button disabled={isLoading} className="w-full bg-orange-500 hover:bg-orange-600 transition-colors text-white py-3 rounded-lg font-bold disabled:bg-orange-300">
                {isLoading ? "Menghitung..." : "Simpan & Hitung ADG"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- KOMPONEN LEGO REKAM MEDIS (KODE ASLI) --- */}
      {isMedisModalOpen && (
        <RekamMedis sapi={selectedSapi} onClose={() => setIsMedisModalOpen(false)} />
      )}
    </div>
  );
}