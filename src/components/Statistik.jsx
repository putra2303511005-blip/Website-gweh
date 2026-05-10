import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function Statistik({ dataSapi }) {
  // 1. DATA STATUS KESEHATAN
  const baseColors = {
    "Sehat": "#10b981",
    "Sakit": "#ef4444",
    "Pengawasan": "#f59e0b",
    "Karantina": "#f97316",
    "Hamil": "#a855f7",
    "Menyusui": "#6366f1",
    "Tidak Diketahui": "#9ca3af",
  };

  const statusCount = dataSapi.reduce((acc, sapi) => {
    const status = sapi.status || "Tidak Diketahui";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const dataPie = Object.keys(statusCount).map(key => ({
    name: key,
    value: statusCount[key],
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* CARD KIRI: PIE CHART */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Status Kesehatan</h3>
        <p className="text-sm text-slate-500 mb-6">Distribusi kondisi kesehatan populasi</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dataPie} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {dataPie.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={baseColors[entry.name] || "#cbd5e1"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CARD KANAN: BAR CHART */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Distribusi Berat</h3>
        <p className="text-sm text-slate-500 mb-6">Statistik berat badan sapi (Kg)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataSapi.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="idSapi" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="berat" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}