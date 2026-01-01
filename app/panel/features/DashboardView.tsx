"use client";

import { Users, Star, Medal, Gift, ArrowRight, FileText, AlertCircle, Archive, Loader2, RefreshCw } from "lucide-react";
import { TabType } from "../types";

interface DashboardViewProps {
  doorprizeCount: number;
  awardNomineeCount: number;
  awardWinnerCount: number;
  prizeCount: number;
  setActiveTab: (tab: TabType) => void;
  onResetSession: () => void;
  isResetting: boolean;
}

export default function DashboardView({ 
    doorprizeCount, awardNomineeCount, awardWinnerCount, prizeCount, setActiveTab, onResetSession, isResetting 
}: DashboardViewProps) {
    
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-12 text-white shadow-xl shadow-blue-200">
        <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl md:text-4xl font-black mb-4">Dashboard Overview</h2>
            <p className="text-blue-100 text-sm md:text-lg mb-8 leading-relaxed">
                Kelola semua data acara dari satu tempat. Pantau statistik peserta, nominasi award, dan inventori hadiah secara realtime.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setActiveTab('doorprize')} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center sm:justify-start gap-2 shadow-sm text-sm md:text-base">
                    Kelola Peserta <ArrowRight size={18}/>
                </button>
                <button onClick={() => setActiveTab('recap')} className="bg-white/20 text-white border border-white/30 px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-colors flex items-center justify-center sm:justify-start gap-2 shadow-sm text-sm md:text-base">
                    Lihat Rekap <FileText size={18}/>
                </button>
            </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 right-20 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Stat Cards */}
        <StatCard 
            icon={<Users size={24} />} 
            color="bg-blue-50 text-blue-600" 
            label="Peserta Doorprize" 
            value={doorprizeCount}
            desc="Total Data Masuk"
        />
        <StatCard 
            icon={<Star size={24} />} 
            color="bg-yellow-50 text-yellow-600" 
            label="Award Nominees" 
            value={awardNomineeCount}
            desc="Kandidat Terdaftar"
        />
        <StatCard 
            icon={<Medal size={24} />} 
            color="bg-purple-50 text-purple-600" 
            label="Award Winners" 
            value={awardWinnerCount}
            desc="Slot Terisi"
        />
        <StatCard 
            icon={<Gift size={24} />} 
            color="bg-green-50 text-green-600" 
            label="Stok Doorprize" 
            value={prizeCount}
            desc="Item Tersedia"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-blue-500"/> Informasi Sistem
            </h3>
            <div className="text-slate-500 text-sm space-y-2">
                <p>• Gunakan menu <span className="font-bold text-slate-700">Awards</span> untuk menentukan Top 3 pemenang per kategori.</p>
                <p>• Gambar pada stok hadiah akan otomatis menyesuaikan ukuran kartu (auto-fill).</p>
                <p>• Gunakan generator passcode untuk keamanan halaman spin/award.</p>
                <p>• <strong>Fitur Baru:</strong> Anda bisa menambahkan kategori untuk Event/Tanggal berbeda di menu Awards.</p>
                <p>• <strong>Rekap:</strong> Data pemenang dapat diunduh ke Excel atau PDF pada menu Rekap.</p>
            </div>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-red-800 mb-2 flex items-center gap-2">
                <Archive size={20} /> Session Management
            </h3>
            <p className="text-red-600 text-sm mb-6">
                Selesai dengan acara? Tombol ini akan mengarsipkan data saat ini (peserta & pemenang) dan membersihkan sistem untuk sesi baru.
            </p>
            <button 
                onClick={onResetSession}
                disabled={isResetting}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isResetting ? <Loader2 className="animate-spin" size={20}/> : <RefreshCw size={20}/>}
                {isResetting ? "Mengarsipkan & Reset..." : "Arsipkan & Reset Data"}
            </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, color, label, value, desc }: { icon: React.ReactNode, color: string, label: string, value: number, desc: string }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 hover:shadow-md transition-shadow group">
          <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center transition-transform group-hover:scale-110 shrink-0`}>
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-slate-500 text-sm font-medium mb-1 truncate">{label}</p>
            <h3 className="text-3xl font-black text-slate-800 truncate">{value}</h3>
            <p className="text-xs text-slate-400 mt-1 truncate">{desc}</p>
          </div>
        </div>
    )
}