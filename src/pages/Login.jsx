import { useState } from "react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase/firebase";
import { Beef, LogIn } from "lucide-react";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // Memunculkan popup login Google
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error saat login:", error);
      alert("Gagal login! Pastikan Anda mengizinkan popup di browser ini.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans p-4">
      <div className="bg-white p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center max-w-md w-full">
        
        {/* LOGO APLIKASI */}
        <div className="flex justify-center mb-6">
          <div className="bg-blue-50 p-4 rounded-full text-blue-600">
            <Beef size={48} strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-800 mb-2">Feedlot Pro</h1>
        <p className="text-slate-400 font-medium mb-10">
          Sistem Manajemen Penggemukan Sapi Modern. Silakan masuk untuk melanjutkan.
        </p>
        
        <button 
          onClick={handleLogin} 
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed"
        >
          {isLoading ? (
             <span className="animate-pulse">Memproses...</span>
          ) : (
            <>
              {/* Anda bisa mengganti ikon ini dengan logo Google jika punya SVG-nya, tapi LogIn dari lucide juga bagus */}
              <LogIn size={20} /> 
              Lanjutkan dengan Google
            </>
          )}
        </button>

        <p className="mt-8 text-xs text-slate-400 font-medium">
          Akses terbatas hanya untuk staf & manajemen yang terdaftar.
        </p>
      </div>
    </div>
  );
}