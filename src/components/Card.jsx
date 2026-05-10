export default function Card({ 
  id = "N/A", 
  jenis = "Tidak Diketahui", 
  berat = 0, 
  status = "Tidak Diketahui" 
}) {
  
  // Kamus warna status yang sudah sangat lengkap
  const statusColors = {
    "Sehat": "bg-green-100 text-green-800",
    "Sakit": "bg-red-100 text-red-800",
    "Hamil": "bg-purple-100 text-purple-800",
    "Menyusui": "bg-indigo-100 text-indigo-800",
    "Karantina": "bg-orange-100 text-orange-800",
    "Tidak Diketahui": "bg-gray-100 text-gray-800",
  };

  // Ambil warna sesuai status, gunakan kuning sebagai default/warning jika tidak ada di daftar
  const currentColor = statusColors[status] || "bg-yellow-100 text-yellow-800";

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">{jenis}</h3>
          <p className="text-sm text-gray-500">ID Sapi: {id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${currentColor}`}>
          {status}
        </span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
        <span className="text-gray-600">Berat Saat Ini:</span>
        <span className="text-xl font-bold text-blue-600">{berat} kg</span>
      </div>
    </div>
  );
}