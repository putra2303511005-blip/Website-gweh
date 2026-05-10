import { useState } from "react";
import Dashboard from "./pages/Dashboard";

// App.jsx sekarang bertindak sebagai pengatur utama (Main Container)
function App() {
  // Kita menggunakan state untuk mengatur halaman mana yang aktif
  // Ini memastikan transisi antar fitur berjalan lancar tanpa refresh
  return (
    <div className="min-h-screen bg-slate-50">
      <Dashboard />
    </div>
  );
}

export default App;
