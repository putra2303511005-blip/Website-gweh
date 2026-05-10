import { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { X, Syringe, Trash2, Stethoscope, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion"; // Tambahan: Import Framer Motion untuk animasi

// 🧠 DATABASE PENGETAHUAN VETERINER
const DATABASE_PENYAKIT = [
  {
    penyakit: "Kembung (Bloat / Timpani)",
    keywords: ["kembung", "perut besar", "sesak", "napas", "gelisah", "kiri bengkak"],
    ciri: "Perut sebelah kiri membesar, sapi gelisah, sering menendang perut, dan sesak napas.",
    penanganan: "Posisikan kepala sapi lebih tinggi dari badan. Jangan biarkan sapi berbaring. Bawa berjalan-jalan.",
    obat: "Cekok dengan obat Anti-bloat (Tympanol) atau minyak nabati (minyak goreng) secukupnya."
  },
  {
    penyakit: "Demam Tiga Hari (BEF)",
    keywords: ["demam", "panas", "pincang", "kaku", "liur", "gemetar", "lemas"],
    ciri: "Sapi mendadak lemas, demam tinggi, kaku otot, pincang (terutama kaki depan), dan keluar air liur/ingus.",
    penanganan: "Isolasi di tempat teduh, sediakan air minum bersih yang banyak. Jangan dipaksa berdiri jika ambruk.",
    obat: "Injeksi Antipiretik (Penurun Panas seperti Sulpidon/Analgesik) dan Vitamin B-Complex."
  },
  {
    penyakit: "Cacingan (Helminthiasis)",
    keywords: ["kurus", "mencret", "diare", "bulu kusam", "pucat", "perut buncit", "makan", "rakus"],
    ciri: "Pertumbuhan terhambat (ADG rendah), bulu kusam/berdiri, diare/mencret, dan selaput mata pucat.",
    penanganan: "Pisahkan feses dari area pakan. Bersihkan kandang secara rutin. Evaluasi pakan hijauan.",
    obat: "Obat Cacing (Anthelmintik) seperti Albendazole, Ivermectin, atau Kalbazen sesuai dosis berat badan."
  },
  {
    penyakit: "PMK (Penyakit Mulut dan Kuku)",
    keywords: ["lepuh", "luka", "mulut", "kuku", "ngiler", "liur berlebih", "copot", "tidak mau makan"],
    ciri: "Air liur berbusa sangat banyak (hipersalivasi), luka lepuh di gusi, lidah, dan celah kuku. Sapi pincang parah.",
    penanganan: "KARANTINA TOTAL! Jangan pindahkan sapi. Semprot kandang dengan desinfektan setiap hari.",
    obat: "Obat semprot luka (Gusanex) untuk kuku, Vitamin (Vitol/B-Complex), dan Antibiotik untuk cegah infeksi."
  },
  {
    penyakit: "LSD (Lumpy Skin Disease / Lato-lato)",
    keywords: ["benjolan", "bentol", "lato-lato", "lato", "kulit", "koreng", "bengkak bulat"],
    ciri: "Muncul benjolan keras (nodul) pada kulit di seluruh tubuh, demam, mata berair, dan lemas.",
    penanganan: "Pisahkan sapi dari kawanannya. Jaga kebersihan kandang dan basmi serangga (nyamuk/lalat/caplak).",
    obat: "Injeksi Vitamin untuk imun, Antipiretik untuk demam, dan obat semprot anti-lalat jika luka."
  }
];

export default function RekamMedis({ sapi, onClose }) {
  const [riwayat, setRiwayat] = useState([]);
  const [formData, setFormData] = useState({ tindakan: "Vaksin", keterangan: "" });
  const [isLoading, setIsLoading] = useState(false);
  
  const [gejalaInput, setGejalaInput] = useState("");
  const [hasilDiagnosa, setHasilDiagnosa] = useState(null);

  // Perbaikan 1: Pastikan idFirebase benar-benar ada sebelum mengambil data
  useEffect(() => {
    if (!sapi?.idFirebase) return; 

    const q = query(collection(db, "sapi", sapi.idFirebase, "rekam_medis"), orderBy("tanggal", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setRiwayat(data);
    });
    return () => unsubscribe();
  }, [sapi]);

  useEffect(() => {
    if (gejalaInput.trim().length < 3) {
      setHasilDiagnosa(null);
      return;
    }

    const inputLower = gejalaInput.toLowerCase();
    let bestMatch = null;
    let maxScore = 0;

    DATABASE_PENYAKIT.forEach((item) => {
      let score = 0;
      item.keywords.forEach(keyword => {
        if (inputLower.includes(keyword)) score++;
      });

      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;
      }
    });

    if (maxScore > 0) {
      setHasilDiagnosa(bestMatch);
    } else {
      setHasilDiagnosa({
        penyakit: "Penyakit Belum Terdeteksi",
        ciri: "Gejala yang dimasukkan belum cocok dengan database kami.",
        penanganan: "Pantau terus kondisi sapi, berikan pakan bernutrisi.",
        obat: "Konsultasikan langsung dengan Dokter Hewan atau Mantri."
      });
    }
  }, [gejalaInput]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sapi?.idFirebase) return alert("Error: ID Sapi tidak ditemukan!");

    setIsLoading(true);
    try {
      await addDoc(collection(db, "sapi", sapi.idFirebase, "rekam_medis"), {
        ...formData, tanggal: new Date().toISOString()
      });
      setFormData({ tindakan: "Vaksin", keterangan: "" }); 
      setGejalaInput(""); // Reset input gejala setelah menyimpan tindakan
    } catch (error) { 
      console.error(error);
      alert("Gagal menyimpan rekam medis!"); 
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleDelete = async (idMedis) => {
    if(window.confirm("Apakah Anda yakin ingin menghapus catatan medis ini?")) {
      try {
        await deleteDoc(doc(db, "sapi", sapi.idFirebase, "rekam_medis", idMedis));
      } catch (error) {
        console.error(error);
        alert("Gagal menghapus data.");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 text-teal-600 p-2 rounded-lg">
              <Syringe size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Klinik & Rekam Medis</h3>
              <p className="text-sm text-slate-500">Sapi: <span className="font-bold text-blue-600">{sapi?.idSapi || "N/A"}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-auto p-6 flex flex-col md:flex-row gap-6">
          
          <div className="w-full md:w-1/2 space-y-4 border-r border-slate-100 pr-0 md:pr-6">
            
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 text-indigo-600 mb-3">
                <Stethoscope size={20} />
                <h4 className="font-bold text-md">AI Asisten Diagnosa Pintar</h4>
              </div>
              <label className="block text-xs font-bold text-slate-500 mb-2">KETIKKAN GEJALA YANG TERLIHAT:</label>
              <textarea 
                rows="2" placeholder="Contoh: Sapi lemas, demam panas, keluar air liur..."
                className="w-full border-2 border-indigo-200 p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={gejalaInput} onChange={e => setGejalaInput(e.target.value)}
              ></textarea>
            </div>

            {/* Perbaikan 2: Menggunakan motion.div dari Framer Motion untuk animasi yang lebih rapi */}
            {hasilDiagnosa && (
              <motion.div 
                initial={{ opacity: 0, y: -15 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-indigo-100 p-2 rounded-full mt-1">
                    <AlertTriangle size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h5 className="font-bold text-indigo-900 text-lg mb-1">Dugaan: {hasilDiagnosa.penyakit}</h5>
                    <p className="text-sm text-indigo-700 mb-3">{hasilDiagnosa.ciri}</p>
                    
                    <div className="space-y-2 mt-4">
                      <div>
                        <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded uppercase">Penanganan:</span>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">{hasilDiagnosa.penanganan}</p>
                      </div>
                      <div className="pt-2">
                        <span className="text-xs font-bold bg-green-100 text-green-800 px-2 py-1 rounded uppercase">Rekomendasi Obat:</span>
                        <p className="text-sm text-slate-700 mt-1 font-medium">{hasilDiagnosa.obat}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="pt-4 border-t border-slate-100 mt-6">
              <h4 className="font-bold text-slate-700 mb-3">Catat Tindakan ke Buku Medis</h4>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex gap-3">
                  <select className="w-1/3 border border-slate-300 p-2 rounded-lg text-sm" value={formData.tindakan} onChange={e => setFormData({...formData, tindakan: e.target.value})}>
                    <option value="Vaksin">Vaksin</option>
                    <option value="Vitamin">Vitamin</option>
                    <option value="Obat Cacing">Obat Cacing</option>
                    <option value="Pengobatan Sakit">Pengobatan Sakit</option>
                  </select>
                  <input type="text" required placeholder="Nama Obat / Keterangan..." className="w-2/3 border border-slate-300 p-2 rounded-lg text-sm" value={formData.keterangan} onChange={e => setFormData({...formData, keterangan: e.target.value})} />
                </div>
                <button disabled={isLoading} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-bold shadow-sm transition-colors text-sm">
                  {isLoading ? "Menyimpan..." : "Simpan Tindakan"}
                </button>
              </form>
            </div>
          </div>

          <div className="w-full md:w-1/2">
            <h4 className="font-bold text-slate-700 mb-4">Riwayat Perawatan & Medis</h4>
            {riwayat.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-500">
                Belum ada rekam medis untuk sapi ini.
              </div>
            ) : (
              <div className="space-y-3 h-[450px] overflow-y-auto pr-2">
                {riwayat.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-between items-start hover:border-teal-300 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                          {new Date(item.tanggal).toLocaleDateString("id-ID")}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                          item.tindakan === "Pengobatan Sakit" ? "bg-red-100 text-red-700" : "bg-teal-100 text-teal-700"
                        }`}>{item.tindakan}</span>
                      </div>
                      <p className="text-sm text-slate-700">{item.keterangan}</p>
                    </div>
                    <button onClick={() => handleDelete(item.id)} className="text-slate-300 hover:text-red-500 p-2 rounded-lg"><Trash2 size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}