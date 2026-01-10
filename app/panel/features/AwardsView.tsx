// app/panel/features/AwardsView.tsx
"use client";

import { useState } from "react";
import { Unlock, Lock, Power, Clock, Key, Shuffle, Medal, Save, Layers, Loader2, RefreshCw, Trophy } from "lucide-react";
import { AwardWinnerSlot, AwardNominee } from "../types";

interface AwardsViewProps {
  winners: AwardWinnerSlot[];
  setWinners: (p: AwardWinnerSlot[]) => void;
  nominees: AwardNominee[];
  onSave: () => void;
  isSaving: boolean;
  onInitialize: () => void;
  onAddManual: (cat: string, slots: number, label: string) => void;
  schedule: string;
  onSaveSchedule: (val: string) => void;
  passcode: string;
  onSavePasscode: (val: string) => void;
  status: "open" | "closed";
  onToggleStatus: () => void;
}

export default function AwardsView({ 
  winners, 
  setWinners, 
  nominees, 
  onSave, 
  isSaving,
  onInitialize,
  schedule,
  onSaveSchedule,
  passcode,
  onSavePasscode,
  status,
  onToggleStatus
}: AwardsViewProps) {
  const [tempSchedule, setTempSchedule] = useState(schedule || "");
  const [tempPasscode, setTempPasscode] = useState(passcode || "");
     
  const handleChange = (id: string, field: keyof AwardWinnerSlot, value: string | number) => {
    setWinners(winners.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const getNomineeLabel = (candidateId: string) => {
    const nominee = nominees.find(c => c.id === candidateId);
    return nominee ? nominee.company : "";
  };

  const generatePasscode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTempPasscode(randomCode);
  }

  // --- LOGIC PENYARINGAN DATA ---
  // 1. Dapatkan Set ID kandidat yang sudah terpilih di slot manapun
  const usedCandidateIds = new Set(winners.map(w => w.candidateId).filter(id => id));

  // 1. Group winners by Event Label first
  const groupedByEvent = winners.reduce((acc, curr) => {
      const label = curr.eventLabel || "Main Event";
      if (!acc[label]) acc[label] = [];
      acc[label].push(curr);
      return acc;
  }, {} as Record<string, AwardWinnerSlot[]>);

  if (winners.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border border-dashed border-slate-300 text-center p-6">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Trophy className="text-slate-300 w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Belum ada kategori Award</h2>
              <p className="text-slate-500 text-center max-w-md mb-6">
                  Anda perlu inisialisasi 3 kategori (Top Spender, Most Loyal, Rising Star) terlebih dahulu.
              </p>
              <button 
                onClick={onInitialize}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                  {isSaving ? <Loader2 className="animate-spin"/> : <RefreshCw size={18} />}
                  Inisialisasi Kategori (6 Slot)
              </button>
          </div>
      )
  }

  return (
    <div className="space-y-6">
        
       {/* CONFIGURATION SECTION - SEKARANG KONSISTEN DENGAN DOORPRIZE */}
       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           
           {/* STATUS CARD */}
           <div className={`rounded-2xl shadow-sm border p-6 flex flex-col justify-between gap-4 transition-colors ${status === 'open' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100'}`}>
               <div className="flex items-center gap-3">
                   <div className={`p-3 rounded-xl ${status === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                       {status === 'open' ? <Unlock size={24} /> : <Lock size={24} />}
                   </div>
                   <div>
                       <h3 className={`font-bold ${status === 'open' ? 'text-green-800' : 'text-slate-800'}`}>Status Sesi</h3>
                       <p className={`text-sm ${status === 'open' ? 'text-green-600' : 'text-slate-500'}`}>
                           {status === 'open' ? "Sesi Sedang Aktif" : "Sesi Ditutup"}
                       </p>
                   </div>
               </div>
               <button 
                   onClick={onToggleStatus}
                   disabled={isSaving}
                   className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                       status === 'open' 
                       ? 'bg-white text-green-700 hover:bg-green-100 border border-green-200' 
                       : 'bg-slate-800 text-white hover:bg-slate-900'
                   }`}
               >
                   <Power size={16} />
                   {status === 'open' ? "Tutup Sesi" : "Buka Sesi"}
               </button>
           </div>

           {/* SCHEDULE CARD */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between gap-4">
               <div className="flex items-center gap-3">
                   <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                       <Clock size={24} />
                   </div>
                   <div>
                       <h3 className="font-bold text-slate-800">Atur Jadwal Awards</h3>
                       <p className="text-sm text-slate-500">Kapan sesi dimulai?</p>
                   </div>
               </div>
               <div className="flex flex-col gap-2 mt-2">
                   <input 
                       type="datetime-local" 
                       value={tempSchedule}
                       onChange={(e) => setTempSchedule(e.target.value)}
                       className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-blue-500"
                   />
                   <button 
                       onClick={() => onSaveSchedule(tempSchedule)}
                       disabled={isSaving}
                       className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors disabled:opacity-50"
                   >
                       Save
                   </button>
               </div>
           </div>

           {/* PASSCODE CARD */}
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between gap-4">
               <div className="flex items-center gap-3">
                   <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
                       <Key size={24} />
                   </div>
                   <div>
                       <h3 className="font-bold text-slate-800">Passcode Generator</h3>
                       <p className="text-sm text-slate-500">Keamanan halaman spin</p>
                   </div>
               </div>
               <div className="flex flex-col gap-2 mt-2">
                   <input 
                       type="text" 
                       value={tempPasscode}
                       placeholder="123456"
                       onChange={(e) => setTempPasscode(e.target.value)}
                       className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-blue-500 font-mono tracking-widest text-center font-bold"
                   />
                   <div className="flex gap-2">
                       <button 
                           onClick={generatePasscode}
                           title="Generate Random"
                           className="p-2 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors shrink-0"
                       >
                           <Shuffle size={18} />
                       </button>
                       <button 
                           onClick={() => onSavePasscode(tempPasscode)}
                           disabled={isSaving}
                           className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors disabled:opacity-50"
                       >
                           Save
                       </button>
                   </div>
               </div>
           </div>

       </div>
       
      <div className="flex flex-col sm:flex-row justify-between items-center bg-yellow-50 p-4 rounded-xl border border-yellow-100 gap-4">
        <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600 hidden sm:block"><Medal size={20} /></div>
            <p className="text-sm text-yellow-800 font-medium">Pilih pemenang untuk setiap kategori award.</p>
        </div>
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {isSaving ? "Menyimpan..." : <><Save size={18} /> Simpan Perubahan</>}
        </button>
      </div>

      {/* RENDER GROUPED BY EVENT */}
      {Object.entries(groupedByEvent).map(([eventLabel, eventWinners]) => {
          // 2. Group by Category within this event
          const groupedByCategory = eventWinners.reduce((acc, curr) => {
             if (!acc[curr.category]) acc[curr.category] = [];
             acc[curr.category].push(curr);
             return acc;
          }, {} as Record<string, AwardWinnerSlot[]>);

          return (
             <div key={eventLabel} className="space-y-4">
                 <div className="flex items-center gap-2 px-2 pt-4">
                     <Layers className="text-slate-400" size={18} />
                     <h2 className="text-lg font-black text-slate-700 uppercase tracking-wide">{eventLabel}</h2>
                     <div className="h-px bg-slate-200 flex-1"></div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {Object.entries(groupedByCategory).map(([category, slots]) => (
                        <div key={`${eventLabel}-${category}`} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="bg-slate-50 p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800 text-center">{category}</h3>
                            </div>
                            <div className="p-4 space-y-4 flex-1">
                                {slots.sort((a,b) => a.rank - b.rank).map((slot) => (
                                    <div key={slot.id} className="relative">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-xs font-black px-2 py-0.5 rounded text-white ${
                                                slot.rank === 1 ? 'bg-yellow-500' : 
                                                slot.rank === 2 ? 'bg-slate-400' : 
                                                slot.rank === 3 ? 'bg-orange-400' :
                                                'bg-indigo-500' // Changed for 4,5,6
                                            }`}>
                                                {/* UPDATE: Logic to show JUARA/POSISI for all ranks */}
                                                {`JUARA ${slot.rank}`}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <select 
                                                value={slot.candidateId || ""} 
                                                onChange={(e) => handleChange(slot.id, "candidateId", e.target.value)} 
                                                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-blue-500"
                                            >
                                                <option value="">-- Pilih Pemenang --</option>
                                                {/* LOGIKA FILTER:
                                                  Tampilkan kandidat jika:
                                                  1. Belum digunakan di slot manapun (!usedCandidateIds.has(c.id))
                                                  2. ATAU kandidat ini adalah yang sedang terpilih di slot ini (c.id === slot.candidateId)
                                                */}
                                                {nominees
                                                  .filter(c => !usedCandidateIds.has(c.id) || c.id === slot.candidateId)
                                                  .map(c => (
                                                    <option key={c.id} value={c.id}>{c.company}</option>
                                                  ))}
                                            </select>
                                        </div>
                                         {/* Read Only Preview */}
                                         <div className="mt-1 px-2">
                                                 <p className="text-xs text-slate-400">
                                                        Selected: <span className="font-bold text-slate-600">{getNomineeLabel(slot.candidateId) || "-"}</span>
                                                 </p>
                                          </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
             </div>
          );
      })}
    </div>
  );
}