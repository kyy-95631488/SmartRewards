/* eslint-disable react-hooks/set-state-in-effect */
// app/components/landing/DoorprizeFeature.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Gift, PackageOpen, History, Box, Clock, Calendar, Crown, X, Target, Ticket, Users, Search
} from "lucide-react";
import { Timestamp } from "firebase/firestore";

// --- TYPES ---
interface Prize {
  id: string;
  name: string;
  stock: number;
  image_url?: string;
  price?: number;
  isGrandPrize?: boolean;
}

interface Participant {
  id: string;
  name: string;
  lotteryNumber: string;
}

interface WinnerLog {
  id: string;
  name: string;
  prizeName: string;
  prizeImage: string;
  timestamp: Timestamp | null;
  displayTime?: string;
  lotteryNumber?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  width: number;
  height: number;
  rotation: number;
  sway: number;
  duration: number;
  delay: number;
}

interface DoorprizeFeatureProps {
  config: { doorprizeStart: string };
  prizes: Prize[];
  participants: Participant[];
  doorprizeLog: WinnerLog[];
  totalItemsRemaining: number;
  isSpinning: boolean;
  winner: { name: string; lotteryNumber: string; prize: Prize } | null;
  pendingDoorprize: { winner: Participant; prize: Prize } | null;
  rollingName: string;
  handleDoorprizeSpin: (prizeId?: string | null) => void;
  resetAll: () => void;
  confettiParticles: Particle[];
}

export default function DoorprizeFeature({
  config, prizes, participants, doorprizeLog, totalItemsRemaining,
  isSpinning, winner, pendingDoorprize, rollingName, handleDoorprizeSpin, resetAll, confettiParticles
}: DoorprizeFeatureProps) {

  // State untuk Mobile Floating Lists
  const [showMobilePrizeList, setShowMobilePrizeList] = useState(false);
  const [showMobileParticipantList, setShowMobileParticipantList] = useState(false);
  
  // State Search Peserta
  const [participantSearch, setParticipantSearch] = useState("");
  
  // State untuk menyimpan hadiah yang dipilih manual oleh MC
  const [selectedPrizeId, setSelectedPrizeId] = useState<string | null>(null);

  // List nama pemenang untuk pengecekan strikethrough
  const winnerNames = useMemo(() => doorprizeLog.map(log => log.name), [doorprizeLog]);

  // Reset selected prize jika winner muncul atau di reset
  useEffect(() => {
    if (winner || pendingDoorprize) {
        setSelectedPrizeId(null);
    }
  }, [winner, pendingDoorprize]);

  // Sort visual: Grand Prize di awal
  const sortedPrizes = [...prizes].sort((a, b) => {
    if (a.isGrandPrize && !b.isGrandPrize) return -1;
    if (!a.isGrandPrize && b.isGrandPrize) return 1;
    return a.name.localeCompare(b.name);
  });

  // Filter Participants
  const filteredParticipants = useMemo(() => {
    const search = participantSearch.toLowerCase();
    return participants.filter(p => 
        p.name.toLowerCase().includes(search) || 
        (p.lotteryNumber && p.lotteryNumber.includes(search))
    ).sort((a, b) => {
         // Sort by lottery number if available
         const numA = parseInt(a.lotteryNumber) || 0;
         const numB = parseInt(b.lotteryNumber) || 0;
         return numA - numB;
    });
  }, [participants, participantSearch]);

  // Komponen Helper untuk Merender Item Hadiah
  const renderPrizeItem = (p: Prize) => {
    const isGrand = p.isGrandPrize;
    const outOfStock = p.stock === 0;
    const isSelected = selectedPrizeId === p.id;

    return (
      <div 
        key={p.id} 
        onClick={() => {
            if (!outOfStock && !isSpinning) {
                setSelectedPrizeId(isSelected ? null : p.id);
            }
        }}
        className={`group relative flex items-center gap-3 transition-all rounded-2xl border ${
        outOfStock 
          ? 'opacity-50 grayscale border-white/5 bg-slate-900/30 cursor-not-allowed' 
          : isSelected
            ? 'bg-slate-800 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] cursor-pointer scale-[1.02]' 
            : isGrand 
                ? 'bg-gradient-to-r from-slate-900 to-amber-950/40 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)] cursor-pointer hover:scale-[1.01]' 
                : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-cyan-500/30 cursor-pointer hover:scale-[1.01]'
      } p-3 overflow-hidden shrink-0`}
      >
        
        {/* Badge Grand Prize */}
        {isGrand && (
          <div className="absolute top-0 right-0 z-20 pointer-events-none">
              <div className="bg-amber-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg shadow-lg flex items-center gap-1">
                 <Crown size={9} className="fill-white" /> UTAMA
              </div>
          </div>
        )}

        {/* Badge Selected (Target) */}
        {isSelected && (
           <div className="absolute top-0 left-0 z-20 pointer-events-none">
              <div className="bg-green-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-br-lg shadow-lg flex items-center gap-1">
                 <Target size={9} /> TARGET
              </div>
           </div>
        )}

        {/* Gambar */}
        <div className={`w-16 h-16 lg:w-14 lg:h-14 rounded-xl overflow-hidden shrink-0 relative bg-white ${isGrand ? 'border border-amber-500' : 'border border-white/10'}`}>
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={p.image_url} 
              alt={p.name} 
              className="w-full h-full object-contain p-1.5 transition-transform group-hover:scale-110 duration-500" 
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500"><Gift size={20} /></div>
          )}
          {outOfStock && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10">
               <span className="text-[9px] text-white font-bold border border-red-500/80 px-1.5 py-0.5 rounded bg-red-900/80 -rotate-12 shadow-lg">HABIS</span>
            </div>
          )}
        </div>
        
        {/* Text Content */}
        <div className="flex flex-col flex-1 min-w-0 justify-center h-full py-0.5">
          <div className={`text-xs md:text-sm font-bold leading-snug break-words ${isGrand ? 'text-amber-100' : 'text-slate-200'} mb-1`}>
              {p.name}
          </div>
          <div className="flex items-center w-full">
              <div className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
               outOfStock ? 'bg-red-500/10 border-red-500/20 text-red-400' : isGrand ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
              }`}>
                Stok: {p.stock}
              </div>
          </div>
        </div>
      </div>
    );
  };

  // Komponen Helper untuk Merender Item Peserta
  const renderParticipantItem = (p: Participant) => {
    // Logic: Cek apakah nama peserta ada di list pemenang
    const isWinner = winnerNames.includes(p.name);

    return (
        <div 
          key={p.id}
          className={`group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-default ${
            isWinner 
             ? 'bg-slate-900/40 border-red-500/10 opacity-50 hover:bg-slate-900/40' // Tampilan tercoret/sudah menang
             : 'bg-slate-900/60 border-white/5 hover:bg-slate-800/80 hover:border-blue-500/30'
          }`}
        >
            {/* Badge Nomor Undian */}
            <div className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center shadow-inner transition-colors border ${
                isWinner 
                ? 'bg-red-950/30 border-red-500/20' 
                : 'bg-slate-800 border-white/10 group-hover:border-blue-500/50 group-hover:bg-blue-500/10'
            }`}>
                <span className={`font-mono font-bold text-xs ${isWinner ? 'text-red-500/50 line-through decoration-2' : 'text-cyan-400'}`}>
                    {p.lotteryNumber || "-"}
                </span>
            </div>

            {/* Nama Peserta */}
            <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate transition-colors ${
                    isWinner 
                    ? 'text-red-300/50 line-through decoration-red-500/50' 
                    : 'text-slate-300 group-hover:text-white'
                }`}>
                    {p.name}
                </div>
                {isWinner && <div className="text-[9px] text-red-500 uppercase font-bold tracking-wider">Sudah Menang</div>}
            </div>
        </div>
    )
  }

  return (
    // CONTAINER UTAMA - Grid 5 Kolom (Kiri: Hadiah, Tengah: Stage, Kanan: Peserta)
    <motion.div 
      key="doorprize" 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="w-full h-full flex flex-col lg:grid lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6 lg:overflow-hidden relative z-10"
    >
      
      {/* --- SIDEBAR KIRI (PRIZE LIST) --- */}
      <div className="hidden lg:flex lg:col-span-1 flex-col gap-3 h-full overflow-hidden bg-slate-950/40 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl order-1">
        <div className="p-5 border-b border-white/5 bg-slate-900/50 shrink-0 z-10 flex justify-between items-center">
           <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-wide">
             <PackageOpen size={18} /> Hadiah
           </h3>
           <span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded text-[10px] font-mono border border-cyan-500/20">
             {totalItemsRemaining} Sisa
           </span>
        </div>
        
        <div className="px-5 py-2 bg-blue-500/5 border-b border-white/5 text-[10px] text-blue-300/70 text-center">
            Klik item untuk memilih target
        </div>

        {/* Scrollbar hidden via utility class */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] p-3">
          {sortedPrizes.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs uppercase tracking-widest">
              Database Kosong
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedPrizes.map((p) => renderPrizeItem(p))}
            </div>
          )}
        </div>
      </div>

      {/* --- MIDDLE AREA (STAGE & HISTORY) --- */}
      <div className="lg:col-span-3 xl:col-span-3 flex flex-col gap-4 lg:gap-4 h-full min-w-0 order-2 lg:order-2">
        
        {/* === KOMPONEN ATAS: MAIN STAGE & COUNTDOWN === */}
        <div className="flex flex-col gap-4 lg:flex-[1.5] xl:flex-[2] min-h-0 shrink-0 relative">
          
          {/* Countdown Area */}
          <div className="shrink-0">
              <CountdownTimer targetDate={config.doorprizeStart} title="Waktu Menuju Doorprize" theme="cyan" />
          </div>

          {/* SPINNER AREA */}
          <div className="flex-1 min-h-[350px] lg:min-h-0 relative flex flex-col">
             {/* Logic Tampilan Spinner / Winner */}
             {!isSpinning && !winner ? (
              <div className={`flex-1 rounded-[2.5rem] p-6 lg:p-8 border flex flex-col items-center justify-center relative overflow-hidden group transition-all duration-500 ${
                selectedPrizeId 
                ? 'bg-gradient-to-br from-slate-900 to-green-950/30 border-green-500/30 shadow-[0_0_60px_rgba(34,197,94,0.1)]' 
                : 'bg-gradient-to-br from-slate-900 to-slate-950 border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.05)]'
              }`}>
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-20"></div>
                  <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-50 ${selectedPrizeId ? 'via-green-500/50' : 'via-cyan-500/50'}`}></div>
                  <div className={`absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-30 ${selectedPrizeId ? 'via-green-500/20' : 'via-cyan-500/20'}`}></div>

                  <div className="relative z-10 text-center w-full max-w-lg flex flex-col items-center justify-center h-full">
                    <motion.div 
                      animate={{ y: [0, -10, 0] }} 
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} 
                      className={`w-24 h-24 md:w-32 md:h-32 mb-6 rounded-full flex items-center justify-center border-4 shadow-[0_0_40px_rgba(6,182,212,0.2)] relative ${
                        selectedPrizeId 
                        ? 'bg-green-950/50 border-green-500/20'
                        : 'bg-cyan-950/50 border-cyan-500/20'
                      }`}
                    >
                      <div className={`absolute inset-0 rounded-full border animate-ping opacity-20 ${selectedPrizeId ? 'border-green-400/30' : 'border-cyan-400/30'}`}></div>
                      
                      {selectedPrizeId ? (
                          <Target className="text-green-400 w-10 h-10 md:w-14 md:h-14 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
                      ) : (
                          <Zap className="text-cyan-400 w-10 h-10 md:w-14 md:h-14 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
                      )}
                    </motion.div>

                    <h2 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight">
                        {selectedPrizeId ? "TARGET LOCKED" : "RANDOMIZER"}
                    </h2>
                    <p className={`${selectedPrizeId ? 'text-green-200/70' : 'text-cyan-200/50'} mb-8 text-sm md:text-base max-w-xs mx-auto leading-relaxed`}>
                      {selectedPrizeId 
                        ? "Hadiah spesifik dipilih untuk diundi." 
                        : "Sistem pengacakan otomatis."}
                    </p>
                    
                    <TimeDependentButton
                      targetDate={config.doorprizeStart}
                      onClick={() => handleDoorprizeSpin(selectedPrizeId)}
                      disabled={totalItemsRemaining === 0 || participants.length === 0}
                      text={selectedPrizeId ? "UNDI HADIAH INI" : "PUTAR SEKARANG"}
                      icon={selectedPrizeId ? <Target size={20} /> : <Zap fill="currentColor" size={20} />}
                      theme={selectedPrizeId ? "green" : "cyan"}
                    />

                    {selectedPrizeId && (
                        <button onClick={() => setSelectedPrizeId(null)} className="mt-4 text-[10px] text-slate-500 hover:text-white underline">
                            Batalkan Pilihan (Kembali ke Auto)
                        </button>
                    )}
                  </div>
              </div>
             ) : (isSpinning || pendingDoorprize) ? (
              <div className="flex-1 bg-black/60 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-cyan-500/50 shadow-[0_0_100px_rgba(6,182,212,0.15)] flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>
                  
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                    <motion.div animate={{ scale: [0.8, 1.2], opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className="w-[60vw] h-[60vw] max-w-[300px] max-h-[300px] border-4 border-cyan-500 rounded-full" />
                    <motion.div animate={{ scale: [0.5, 1.5], opacity: [0, 0.5, 0] }} transition={{ duration: 0.8, delay: 0.2, repeat: Infinity }} className="absolute w-[50vw] h-[50vw] max-w-[250px] max-h-[250px] border-2 border-white rounded-full" />
                  </div>

                  <p className="text-cyan-400 font-mono tracking-[0.3em] text-xs md:text-sm mb-6 animate-pulse relative z-10 bg-black/20 px-4 py-1 rounded-full border border-cyan-500/30">
                    MENGACAK DATA...
                  </p>
                  
                  <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-white break-all w-full blur-[0.5px] relative z-10 leading-tight px-4">
                    <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.1, repeat: Infinity }}>
                      {rollingName}
                    </motion.span>
                  </h2>
              </div>
             ) : (
               <motion.div 
                initial={{ scale: 0.95, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                className={`flex-1 bg-gradient-to-b ${winner?.prize.isGrandPrize ? 'from-amber-950 to-black border-amber-500/50 shadow-amber-500/20' : 'from-slate-900 to-black border-cyan-400/50 shadow-cyan-500/20'} rounded-[2.5rem] p-6 md:p-10 border shadow-2xl text-center relative overflow-hidden flex flex-col items-center justify-center w-full`}
               >
                 <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                   {confettiParticles.map((p, i) => (
                     <motion.div
                       key={i}
                       initial={{ y: -50, x: 0, opacity: 1, rotate: 0 }}
                       animate={{ y: '100vh', x: p.sway, rotateX: p.rotation * 2, rotateY: p.rotation * 2, rotateZ: p.rotation }}
                       transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
                       className={`absolute ${p.color}`}
                       style={{ left: `${p.x}%`, width: p.width, height: p.height }}
                     />
                   ))}
                 </div>
                 
                 <div className="relative z-10 w-full max-w-xl flex flex-col h-full justify-center items-center">
                   <div className="shrink-0 mb-6">
                      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`inline-flex items-center gap-2 px-5 py-2 rounded-full border font-bold shadow-xl backdrop-blur-md text-xs md:text-sm tracking-wide uppercase ${winner?.prize.isGrandPrize ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'}`}>
                        {winner?.prize.isGrandPrize ? <Crown size={18} fill="currentColor"/> : <Gift size={18} />} 
                        {winner?.prize.isGrandPrize ? "Pemenang Grand Prize" : "Pemenang Terpilih"}
                      </motion.div>
                   </div>
                   
                   {/* Tampilan Nomor Undian Pemenang */}
                   {winner?.lotteryNumber && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                        className={`mb-4 px-4 py-1.5 rounded-lg border ${winner.prize.isGrandPrize ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-slate-800/80 border-cyan-500 text-cyan-300'} font-mono text-xl md:text-2xl font-black tracking-widest flex items-center gap-3 shadow-lg`}
                      >
                          <Ticket size={20} /> {winner.lotteryNumber}
                      </motion.div>
                   )}

                   <motion.h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-8 drop-shadow-2xl break-words leading-tight w-full">
                     {winner?.name}
                   </motion.h1>

                   <div className="relative group w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-4 flex items-center gap-5 text-left shadow-2xl mb-8 max-w-md mx-auto hover:bg-white/10 transition-colors">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white shrink-0 flex items-center justify-center p-2 shadow-inner">
                        {winner?.prize.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={winner?.prize.image_url} alt="Prize" className="w-full h-full object-contain" />
                        ) : (
                          <Gift className="text-slate-300 w-10 h-10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${winner?.prize.isGrandPrize ? 'text-amber-400' : 'text-cyan-400'}`}>
                             {winner?.prize.isGrandPrize ? "Membawa Pulang" : "Mendapatkan"}
                          </div>
                          <div className="text-lg md:text-xl font-bold text-white leading-tight break-words">
                             {winner?.prize.name}
                          </div>
                      </div>
                   </div>
                   
                   <div className="flex gap-3 justify-center w-full mt-auto">
                     <button onClick={resetAll} className="px-6 py-3 rounded-full font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all text-sm border border-transparent hover:border-white/10">Tutup</button>
                     <button onClick={() => { resetAll(); handleDoorprizeSpin(); }} className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-full font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:scale-105 transition-all text-sm flex items-center gap-2">
                        <Zap size={16} fill="currentColor" /> Undi Lagi
                     </button>
                   </div>
                 </div>
               </motion.div>
             )}
          </div>
        </div>

        {/* === KOMPONEN BAWAH: HISTORY (WIDE) === */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="bg-slate-950/40 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden h-full flex flex-col relative">
            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none"></div>

            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900/50 relative z-10 shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm"><History className="text-cyan-400" size={18} /> Winners Feed</h3>
              <div className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 text-[10px] px-2 py-1 rounded-md font-mono">{doorprizeLog.length}</div>
            </div>

            {/* CONTAINER LIST PEMENANG - Scrollbar Hidden */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] p-3 relative z-10">
              {doorprizeLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                      <Box size={20} className="opacity-30" />
                  </div>
                  <p className="opacity-50">Menunggu pemenang...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  <AnimatePresence>
                    {doorprizeLog.map((log) => (
                      <motion.div key={log.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="bg-slate-900/80 p-3 rounded-2xl border border-white/5 flex gap-3 items-center hover:bg-slate-800 transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-white shrink-0 flex items-center justify-center p-1 border border-white/10 shadow-sm">
                          {log.prizeImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={log.prizeImage} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Gift size={16} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-slate-200 text-xs group-hover:text-white transition-colors whitespace-normal break-words leading-tight">
                                {log.lotteryNumber && <span className="text-cyan-400 font-mono mr-1">#{log.lotteryNumber}</span>}
                                {log.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono shrink-0">{log.displayTime}</span>
                          </div>
                          <div className="text-[10px] text-cyan-400/80 font-medium truncate mt-1">{log.prizeName}</div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* --- SIDEBAR KANAN (PARTICIPANT LIST) - NEW FEATURE --- */}
      <div className="hidden lg:flex lg:col-span-1 flex-col gap-3 h-full overflow-hidden bg-slate-950/40 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl order-3 lg:order-3">
        <div className="p-5 border-b border-white/5 bg-slate-900/50 shrink-0 z-10 flex flex-col gap-3">
           <div className="flex justify-between items-center w-full">
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2 uppercase tracking-wide">
                <Users size={18} /> Peserta
              </h3>
              <span className="bg-blue-950 text-blue-400 px-2 py-0.5 rounded text-[10px] font-mono border border-blue-500/20">
                {participants.length} Total
              </span>
           </div>
           
           {/* Search Input */}
           <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input 
                type="text" 
                placeholder="Cari nama / nomor..." 
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
              />
           </div>
        </div>
        
        {/* Scrollbar hidden via utility class */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] p-3">
          {filteredParticipants.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs uppercase tracking-widest">
              Data Tidak Ditemukan
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredParticipants.map((p) => renderParticipantItem(p))}
            </div>
          )}
        </div>
      </div>

      {/* --- MOBILE BUTTONS & MODALS --- */}
      <div className="lg:hidden fixed bottom-6 left-6 z-50 flex flex-col gap-3">
        
        {/* Button Peserta (Mobile) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowMobileParticipantList(true)}
          className="w-12 h-12 bg-slate-800 rounded-full shadow-lg border border-blue-400/30 flex items-center justify-center text-blue-400 relative"
        >
          <Users size={20} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white border border-slate-900">
             {participants.length > 99 ? '99+' : participants.length}
          </span>
        </motion.button>

        {/* Button Hadiah (Mobile) */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowMobilePrizeList(true)}
          className="w-14 h-14 bg-gradient-to-br from-cyan-600 to-cyan-800 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400/50 flex items-center justify-center text-white relative group"
        >
          <Gift size={24} className="animate-pulse" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center border border-white/20 shadow-sm">
            {totalItemsRemaining}
          </span>
        </motion.button>
      </div>

      {/* MODAL PRIZE (MOBILE) */}
      <AnimatePresence>
        {showMobilePrizeList && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setShowMobilePrizeList(false)}></div>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-slate-900 w-full sm:max-w-md max-h-[80vh] rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 shadow-2xl flex flex-col relative overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-slate-950/50 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <PackageOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Daftar Hadiah</h3>
                    <p className="text-xs text-slate-400">Total {totalItemsRemaining} item tersisa</p>
                  </div>
                </div>
                <button onClick={() => setShowMobilePrizeList(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-slate-950/30">
                 {sortedPrizes.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">Tidak ada hadiah</div>
                 ) : (
                    <div className="flex flex-col gap-3">
                      {sortedPrizes.map((p) => renderPrizeItem(p))}
                    </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL PARTICIPANT (MOBILE) */}
      <AnimatePresence>
        {showMobileParticipantList && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] lg:hidden flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setShowMobileParticipantList(false)}></div>
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-slate-900 w-full sm:max-w-md max-h-[80vh] rounded-t-[2rem] sm:rounded-[2rem] border border-white/10 shadow-2xl flex flex-col relative overflow-hidden"
            >
              <div className="p-5 border-b border-white/10 bg-slate-950/50 shrink-0 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold">Daftar Peserta</h3>
                        <p className="text-xs text-slate-400">Total {participants.length} orang</p>
                    </div>
                    </div>
                    <button onClick={() => setShowMobileParticipantList(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <X size={20} />
                    </button>
                </div>
                {/* Search Mobile */}
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Cari nama / nomor..." 
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                        autoFocus
                    />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] bg-slate-950/30">
                 {filteredParticipants.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">Data tidak ditemukan</div>
                 ) : (
                    <div className="flex flex-col gap-2">
                      {filteredParticipants.map((p) => renderParticipantItem(p))}
                    </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

// SHARED UTILS (TETAP SAMA SEPERTI SEBELUMNYA)
function CountdownTimer({ targetDate, title, theme = "gold" }: { targetDate: string, title: string, theme?: "gold" | "cyan" }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeLeft(null);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;
  const boxBorder = theme === "gold" ? "border-amber-500/20" : "border-cyan-500/20";

  return (
    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`w-full bg-slate-950/60 backdrop-blur-md rounded-2xl border ${boxBorder} p-3 flex flex-wrap gap-2 items-center justify-between px-4 lg:px-6 shadow-lg relative overflow-hidden`}>
      <div className={`flex items-center gap-2 ${theme === "gold" ? "text-amber-200" : "text-cyan-200"} text-[10px] font-bold uppercase tracking-wider`}>
        <Clock size={14} /> {title}
      </div>
      <div className="flex gap-3 md:gap-4 relative z-10 ml-auto">
        <TimeBoxCompact val={timeLeft.days} label="H" theme={theme} />
        <TimeBoxCompact val={timeLeft.hours} label="J" theme={theme} />
        <TimeBoxCompact val={timeLeft.minutes} label="M" theme={theme} />
        <TimeBoxCompact val={timeLeft.seconds} label="D" theme={theme} />
      </div>
    </motion.div>
  );
}

function TimeBoxCompact({ val, label, theme }: { val: number, label: string, theme: string }) {
  const textColor = theme === "gold" ? "text-amber-500" : "text-cyan-400";
  return (
    <div className="flex items-baseline gap-0.5 md:gap-1">
      <span className={`text-lg md:text-xl font-black ${textColor} tabular-nums`}>{val < 10 ? `0${val}` : val}</span>
      <span className="text-[9px] text-slate-500 font-bold">{label}</span>
    </div>
  )
}

function TimeDependentButton({ targetDate, onClick, disabled, text, icon, theme = "gold" }: { targetDate: string, onClick: () => void, disabled?: boolean, text: string, icon: React.ReactNode, theme?: "gold" | "cyan" | "green" }) {
  const [isStarted, setIsStarted] = useState(false);
  useEffect(() => {
    const checkTime = () => {
      if (!targetDate) { setIsStarted(true); return; }
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const setIsStartedVal = now >= target;
      setIsStarted(setIsStartedVal);
    }
    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  const isLocked = !isStarted;
  let btnClass = "";
  if (isLocked || disabled) {
    btnClass = "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed";
  } else {
    if (theme === "gold") btnClass = "bg-gradient-to-r from-amber-600 to-amber-500 text-white border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.5)]";
    else if (theme === "green") btnClass = "bg-gradient-to-r from-green-600 to-green-500 text-white border-green-400 hover:shadow-[0_0_25px_rgba(34,197,94,0.5)]";
    else btnClass = "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]";
  }

  return (
    <button onClick={onClick} disabled={disabled || isLocked} className={`mt-2 px-6 lg:px-8 py-3 rounded-full font-bold text-sm md:text-base transition-all w-auto relative overflow-hidden group flex items-center justify-center gap-2 shadow-lg active:scale-95 ${btnClass}`}>
      {isLocked ? (
        <> <Calendar size={16} /> LOCKED</>
      ) : (
        <>
          {!disabled && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>}
          {icon} {text}
        </>
      )}
    </button>
  )
}