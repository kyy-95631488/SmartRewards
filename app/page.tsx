// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Crown, Gift, ArrowLeft, Trophy, ChevronRight, 
  Medal, Search, Zap, List, X, History, PartyPopper, 
  Box, HelpCircle, PackageOpen, Loader2, Clock, Calendar
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { db } from "./lib/firebase"; 
import { 
  collection, onSnapshot, query, orderBy, 
  doc, updateDoc, addDoc, serverTimestamp 
} from "firebase/firestore";

// --- TIPE DATA ---
interface Participant {
  id: string;
  name: string;
}

interface Prize {
  id: string;
  name: string;
  stock: number;
  image_url?: string;
}

interface WinnerLog {
  id: string;
  name: string;
  prizeName: string;
  prizeImage: string;
  timestamp: unknown; 
  displayTime?: string;
}

interface RoyalCandidate {
  id: string;
  name: string;
  company: string;
}

interface RoyalParticipant {
  id: string;
  rank: number;
  candidateId: string;
  title: string;
}

interface MergedRoyalWinner {
  id: string;
  rank: number;
  title: string;
  name: string;
  company: string;
}

interface AppConfig {
  doorprizeStart: string;
  royalStart: string;
}

type Particle = { id: number; x: number; y: number; color: string; };

export default function Home() {
  const [view, setView] = useState<"menu" | "royal" | "doorprize">("menu");
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- STATE DATA ---
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [doorprizeLog, setDoorprizeLog] = useState<WinnerLog[]>([]);
  
  // Royal Data
  const [royalCandidates, setRoyalCandidates] = useState<RoyalCandidate[]>([]);
  const [royalSlots, setRoyalSlots] = useState<RoyalParticipant[]>([]);
  
  // Config & Schedule
  const [config, setConfig] = useState<{ doorprizeStart: string; royalStart: string }>({ doorprizeStart: "", royalStart: "" });
  
  // Real-time Timer Check State
  // eslint-disable-next-line react-hooks/purity
  const [currentTime, setCurrentTime] = useState(Date.now());

  // --- STATE INTERACTIVE ---
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingName, setRollingName] = useState("Ready?");
  const [winner, setWinner] = useState<{ name: string; prize: Prize } | null>(null);

  const [royalStep, setRoyalStep] = useState(0); 
  const [isRoyalSpinning, setIsRoyalSpinning] = useState(false);
  const [revealedRoyalWinner, setRevealedRoyalWinner] = useState<MergedRoyalWinner | null>(null);

  const [confettiParticles, setConfettiParticles] = useState<Particle[]>([]);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- FETCH DATA ---
  useEffect(() => {
    // Timer Interval untuk Update Waktu Realtime
    const timeInterval = setInterval(() => {
        setCurrentTime(Date.now());
    }, 1000);

    // 1. Fetch Config (Jadwal)
    const unsubConfig = onSnapshot(
      doc(db, "settings", "config"),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setConfig(docSnapshot.data() as AppConfig);
        }
      }
    );

    // 2. Fetch Peserta Doorprize
    const unsubParticipants = onSnapshot(collection(db, "doorprize_participants"), (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant)));
    });

    // 3. Fetch Hadiah
    const unsubPrizes = onSnapshot(collection(db, "prizes"), (snapshot) => {
      setPrizes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prize)));
    });

    // 4. Log Pemenang
    const qHistory = query(collection(db, "doorprize_winners"), orderBy("timestamp", "desc"));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          displayTime: data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"
        } as WinnerLog;
      });
      setDoorprizeLog(logs);
    });

    // 5. Royal Data
    const unsubRoyalSlots = onSnapshot(query(collection(db, "royal_participants"), orderBy("rank", "asc")), (snapshot) => {
      setRoyalSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoyalParticipant)));
    });

    const unsubCandidates = onSnapshot(collection(db, "royal_candidates"), (snapshot) => {
      setRoyalCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoyalCandidate)));
      setLoading(false);
    });

    return () => {
      clearInterval(timeInterval);
      unsubConfig();
      unsubParticipants();
      unsubPrizes();
      unsubHistory();
      unsubRoyalSlots();
      unsubCandidates();
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, []);

  // --- COMPUTED DATA ---
  const mergedRoyalWinners: MergedRoyalWinner[] = royalSlots.map(slot => {
    const candidate = royalCandidates.find(c => c.id === slot.candidateId);
    return {
      id: slot.id,
      rank: slot.rank,
      title: slot.title,
      name: candidate ? candidate.name : "Belum Dipilih",
      company: candidate ? candidate.company : "-"
    };
  }).filter(w => w.name !== "Belum Dipilih");

  const totalItemsRemaining = prizes.reduce((acc, curr) => acc + curr.stock, 0);

  // Check Schedule Status
  const isRoyalOpen = !config.royalStart || currentTime >= new Date(config.royalStart).getTime();
  const isDoorprizeOpen = !config.doorprizeStart || currentTime >= new Date(config.doorprizeStart).getTime();

  // --- HELPER FUNCTIONS ---
  const generateConfetti = (amount = 40) => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];
    return Array.from({ length: amount }).map((_, i) => ({
      id: Math.random(),
      x: (Math.random() - 0.5) * 800, 
      y: -100 - Math.random() * 400,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
  };

  const triggerCelebration = () => {
      setConfettiParticles(prev => [...prev.slice(-50), ...generateConfetti(50)]);
  };

  const resetAll = () => {
    setWinner(null);
    setRevealedRoyalWinner(null);
    setRollingName("Ready?");
    setConfettiParticles([]);
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
  };

  // --- LOGIC ACTIONS ---
  const handleRoyalReveal = () => {
    const currentWinnerData = mergedRoyalWinners[royalStep];
    if (isRoyalSpinning || !currentWinnerData) return;
    
    setIsRoyalSpinning(true);
    setRevealedRoyalWinner(null);
    setConfettiParticles([]);

    spinIntervalRef.current = setInterval(() => {
      const randomName = royalCandidates.length > 0 
        ? royalCandidates[Math.floor(Math.random() * royalCandidates.length)].name 
        : "Loading...";
      setRollingName(randomName);
    }, 60);

    setTimeout(() => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      setRollingName(currentWinnerData.name);
      
      setTimeout(() => {
        setIsRoyalSpinning(false);
        setRevealedRoyalWinner(currentWinnerData);
        setRoyalStep((prev) => prev + 1);
        setConfettiParticles(generateConfetti(60));
      }, 500);
    }, 3000);
  };

  const handleDoorprizeSpin = async () => {
    const availablePrizes = prizes.filter(p => p.stock > 0);
    if (isSpinning || availablePrizes.length === 0 || participants.length === 0) {
      if(participants.length === 0) alert("Data peserta kosong!");
      return;
    }
    
    setIsSpinning(true);
    setWinner(null);
    setConfettiParticles([]); 

    spinIntervalRef.current = setInterval(() => {
      setRollingName(participants[Math.floor(Math.random() * participants.length)].name);
    }, 60); 

    setTimeout(async () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      
      const finalWinnerName = participants[Math.floor(Math.random() * participants.length)].name;
      setRollingName(finalWinnerName);
      
      const randomPrizeIndex = Math.floor(Math.random() * availablePrizes.length);
      const selectedPrize = availablePrizes[randomPrizeIndex];

      setTimeout(async () => {
        setIsSpinning(false);
        setWinner({ name: finalWinnerName, prize: selectedPrize });
        setConfettiParticles(generateConfetti());
        
        try {
          const prizeRef = doc(db, "prizes", selectedPrize.id);
          await updateDoc(prizeRef, {
            stock: selectedPrize.stock - 1
          });

          await addDoc(collection(db, "doorprize_winners"), {
            name: finalWinnerName,
            prizeName: selectedPrize.name,
            prizeImage: selectedPrize.image_url || "",
            timestamp: serverTimestamp()
          });

        } catch (error) {
          console.error("Error saving winner:", error);
        }

      }, 500);
    }, 4000); 
  };

  // --- LOGIC MENENTUKAN LIST MODAL (PESERTA vs ROYAL) ---
  const modalData = view === "royal" ? royalCandidates : participants;
  const modalTitle = view === "royal" ? "Kandidat Royal Top 6" : "Peserta Doorprize";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Memuat Data Acara...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative flex flex-col items-center py-6 md:py-10 overflow-hidden font-sans text-slate-800 bg-slate-50">
      
      {/* BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div animate={{ x: [-30, 30, -30], y: [-20, 20, -20] }} transition={{ duration: 10, repeat: Infinity }} className="absolute top-[-10%] left-[-10%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-blue-300/30 rounded-full blur-[80px] md:blur-[100px]" />
        <motion.div animate={{ x: [30, -30, 30], y: [20, -20, 20] }} transition={{ duration: 12, repeat: Infinity }} className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-cyan-300/30 rounded-full blur-[100px] md:blur-[120px]" />
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
      </div>

      {/* --- MODAL DAFTAR PESERTA (DINAMIS SESUAI TAB) --- */}
      <AnimatePresence>
        {showParticipantModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-2xl md:rounded-3xl w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-white/50">
              <div className="p-4 md:p-6 border-b flex justify-between items-center bg-slate-50">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2"><List size={20} /> {modalTitle}</h3>
                <button onClick={() => setShowParticipantModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-sm text-slate-500 border-b border-slate-200 bg-slate-50/50">
                      <th className="py-2 px-3 md:py-3 md:px-4 rounded-tl-lg">No</th>
                      <th className="py-2 px-3 md:py-3 md:px-4">Nama</th>
                      {view === "royal" && <th className="py-2 px-3 md:py-3 md:px-4">Perusahaan</th>}
                      <th className="py-2 px-3 md:py-3 md:px-4 text-center rounded-tr-lg">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((p, i) => (
                      <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 text-sm md:text-base">
                        <td className="py-2 px-3 md:py-3 md:px-4 text-slate-400 font-mono">{i + 1}</td>
                        <td className="py-2 px-3 md:py-3 md:px-4 font-medium text-slate-700">{p.name}</td>
                        {view === "royal" && (
                            <td className="py-2 px-3 md:py-3 md:px-4 text-slate-600">{(p as RoyalCandidate).company}</td>
                        )}
                        <td className="py-2 px-3 md:py-3 md:px-4 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold bg-green-100 text-green-600 border border-green-200">Ready</span>
                        </td>
                      </tr>
                    ))}
                    {modalData.length === 0 && (
                        <tr><td colSpan={view === "royal" ? 4 : 3} className="text-center py-8 text-slate-400">Belum ada data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-7xl px-4 z-10 relative">
        
        {/* --- NAVBAR --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-4 md:gap-0">
          <div className="flex items-center w-full md:w-auto">
            {view !== "menu" && (
              <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => { setView("menu"); resetAll(); }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm text-slate-600 hover:text-blue-600 hover:shadow-md transition-all font-semibold text-sm md:text-base group">
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> <span className="hidden sm:inline">Kembali</span>
              </motion.button>
            )}
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            {/* Tombol List Data Hanya muncul jika bukan Menu */}
            {view !== "menu" && (
                <button onClick={() => setShowParticipantModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm text-slate-600 hover:text-blue-600 hover:shadow-md transition-all font-semibold text-sm md:text-base">
                <List size={18} /> <span className="hidden sm:inline">List Data ({modalData.length})</span>
                </button>
            )}
            {/* Tombol Settings Dihapus */}
          </div>
        </div>

        <AnimatePresence mode="wait">
          
          {/* VIEW: MENU UTAMA */}
          {view === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-8 md:gap-10">
              <div className="text-center mt-4 md:mt-10">
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-blue-700 to-cyan-600 drop-shadow-sm leading-tight tracking-tight">GATHERING 2025</h1>
                    <p className="text-lg md:text-xl text-slate-500 mt-2 font-medium tracking-widest uppercase">Appreciation Night</p>
                </motion.div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-4xl">
                <button onClick={() => setView("royal")} className="h-48 md:h-64 rounded-3xl bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-xl border border-white shadow-xl hover:-translate-y-2 hover:shadow-2xl hover:border-blue-200 transition-all duration-300 p-6 md:p-8 text-left relative overflow-hidden group">
                   <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-blue-400/10 rounded-full blur-2xl group-hover:bg-blue-400/20 transition-all"></div>
                   <Trophy className="absolute -right-4 -top-4 text-blue-100 group-hover:text-blue-200 transition-colors w-28 h-28 md:w-36 md:h-36" />
                   <h2 className="text-2xl md:text-3xl font-bold text-slate-800 relative z-10 group-hover:text-blue-700 transition-colors">Royal Top 6</h2>
                   <p className="text-sm md:text-base text-slate-500 relative z-10 mt-1">Reveal Peringkat Tertinggi</p>
                </button>
                <button onClick={() => setView("doorprize")} className="h-48 md:h-64 rounded-3xl bg-gradient-to-br from-white/90 to-cyan-50/90 backdrop-blur-xl border border-white shadow-xl hover:-translate-y-2 hover:shadow-2xl hover:border-cyan-200 transition-all duration-300 p-6 md:p-8 text-left relative overflow-hidden group">
                   <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-cyan-400/10 rounded-full blur-2xl group-hover:bg-cyan-400/20 transition-all"></div>
                   <Gift className="absolute -right-4 -top-4 text-cyan-100 group-hover:text-cyan-200 transition-colors w-28 h-28 md:w-36 md:h-36" />
                   <h2 className="text-2xl md:text-3xl font-bold text-slate-800 relative z-10 group-hover:text-cyan-700 transition-colors">Doorprize</h2>
                   <p className="text-sm md:text-base text-slate-500 relative z-10 mt-1">Undian Berhadiah</p>
                </button>
              </div>
            </motion.div>
          )}

          {/* VIEW: ROYAL REVEAL */}
          {view === "royal" && (
            <motion.div key="royal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-5xl mx-auto">
              
              {/* --- COUNTDOWN ROYAL --- */}
              <CountdownTimer targetDate={config.royalStart} title="Sesi Royal Akan Dimulai Dalam" />

              {/* HANYA TAMPIL JIKA SUDAH MULAI */}
              {isRoyalOpen && (
                <>
                <div className="w-full min-h-[350px] md:min-h-[450px] mb-8 md:mb-12 flex flex-col items-center justify-center px-2 perspective-1000">
                    
                    {/* 1. STATE: BELUM REVEAL */}
                    {!isRoyalSpinning && !revealedRoyalWinner && royalStep < mergedRoyalWinners.length && (
                        <div className="bg-white/60 backdrop-blur-md rounded-3xl md:rounded-[3rem] p-8 md:p-12 border-4 border-dashed border-slate-300 text-center w-full max-w-2xl hover:border-blue-400 transition-all shadow-lg hover:shadow-blue-100">
                        <Search className="mx-auto text-slate-300 mb-4 w-12 h-12 md:w-16 md:h-16 animate-bounce" />
                        <h3 className="text-xl md:text-3xl font-bold text-slate-700 mb-2">Siapakah Rank #{mergedRoyalWinners[royalStep].rank}?</h3>
                        <p className="text-slate-500 mb-6">Klik tombol di bawah untuk mengungkap pemenang.</p>
                        
                        <TimeDependentButton targetDate={config.royalStart} onClick={handleRoyalReveal} text="REVEAL SEKARANG" icon={<Zap size={18} className="inline mr-2" fill="currentColor" />} />
                        </div>
                    )}

                    {/* 2. STATE: SPINNING */}
                    {isRoyalSpinning && (
                        <div className="bg-slate-900 rounded-3xl md:rounded-[3rem] p-8 md:p-12 text-center w-full max-w-2xl shadow-2xl relative overflow-hidden min-h-[250px] md:h-[300px] flex flex-col justify-center border border-cyan-500/30 ring-4 ring-cyan-500/20">
                        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1, repeat: Infinity }} className="absolute inset-0 bg-gradient-to-t from-cyan-900/20 to-transparent" />
                        <p className="text-cyan-400 font-bold tracking-[0.2em] md:tracking-[0.3em] mb-4 animate-pulse text-xs md:text-base relative z-10">MEMILIH KANDIDAT...</p>
                        <h2 className="text-3xl md:text-5xl font-mono font-bold text-white blur-[1px] animate-pulse break-words relative z-10">{rollingName}</h2>
                        </div>
                    )}

                    {/* 3. STATE: REVEALED */}
                    {revealedRoyalWinner && (
                        <div className="relative w-full max-w-3xl flex justify-center">
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-r from-transparent via-yellow-200/40 to-transparent z-0 pointer-events-none" />
                            <motion.div 
                            initial={{ scale: 0.8, y: 50, opacity: 0 }} 
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            whileInView={{ y: [0, -10, 0] }}
                            transition={{ scale: { type: "spring", bounce: 0.5 }, y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 } }}
                            className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-3xl md:rounded-[3rem] p-6 md:p-10 border-4 border-yellow-200 shadow-2xl relative overflow-hidden z-10 w-full"
                            >
                                <div className="absolute inset-0 pointer-events-none">{confettiParticles.map((p,i) => <div key={i} className={`absolute w-2 h-2 md:w-3 md:h-3 ${p.color}`} style={{left: p.x + (typeof window !== 'undefined' ? window.innerWidth/2 : 300), top: p.y + 200}} />)}</div>
                                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 relative z-10 text-center md:text-left">
                                <div className="relative shrink-0">
                                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}>
                                        <Medal className="text-yellow-500 w-32 h-32 md:w-40 md:h-40 drop-shadow-lg" />
                                    </motion.div>
                                    <span className="absolute inset-0 flex items-center justify-center text-4xl md:text-5xl font-black text-white pt-2 drop-shadow-md">#{revealedRoyalWinner.rank}</span>
                                </div>
                                <div className="w-full">
                                    <div className="px-4 py-1.5 bg-yellow-200 text-yellow-800 rounded-full text-xs md:text-sm font-bold inline-block mb-3 shadow-sm uppercase tracking-wide">{revealedRoyalWinner.title}</div>
                                    <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-2 leading-tight">{revealedRoyalWinner.name}</h1>
                                    <p className="text-lg md:text-2xl text-slate-500 font-medium mb-6">{revealedRoyalWinner.company}</p>
                                    <div className="h-px w-full bg-yellow-200 mb-6"></div>
                                    {royalStep < mergedRoyalWinners.length ? (
                                        <button onClick={handleRoyalReveal} className="w-full md:w-auto px-8 py-3 bg-slate-800 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-slate-900 hover:scale-105 transition-all shadow-lg">
                                        Lanjut Rank #{mergedRoyalWinners[royalStep].rank} <ChevronRight size={18}/>
                                        </button>
                                    ) : (
                                        <button onClick={() => setRevealedRoyalWinner(null)} className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
                                        <PartyPopper size={20} /> SELESAI & LIHAT SEMUA
                                        </button>
                                    )}
                                </div>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* 4. STATE: ALL COMPLETED */}
                    {!isRoyalSpinning && !revealedRoyalWinner && royalStep >= mergedRoyalWinners.length && (
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl md:rounded-[3rem] p-8 md:p-12 shadow-2xl text-center w-full max-w-3xl relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="relative z-10 text-white">
                            <Crown className="w-24 h-24 mx-auto mb-6 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)]" />
                            <h2 className="text-4xl md:text-6xl font-black mb-4">HALL OF FAME LENGKAP!</h2>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button onClick={triggerCelebration} className="px-8 py-4 bg-yellow-400 text-yellow-900 rounded-full font-black text-lg shadow-lg hover:bg-yellow-300 hover:scale-105 transition-transform flex items-center justify-center gap-2"><PartyPopper /> RAYAKAN LAGI</button>
                                <button onClick={resetAll} className="px-8 py-4 bg-white/20 backdrop-blur border border-white/30 rounded-full font-bold text-white hover:bg-white/30 transition-colors">RESET DATA</button>
                            </div>
                        </div>
                        </motion.div>
                    )}
                </div>

                {/* LIST GRID */}
                <div className="w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                    {mergedRoyalWinners.slice(0, royalStep).map((w) => (
                        <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/70 backdrop-blur border border-yellow-100 p-3 md:p-4 rounded-xl md:rounded-2xl flex items-center gap-3 md:gap-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-full flex items-center justify-center font-bold text-yellow-600 text-base md:text-lg shrink-0 border border-yellow-200">#{w.rank}</div>
                        <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{w.name}</div>
                            <div className="text-xs text-slate-500 truncate">{w.title}</div>
                        </div>
                        </motion.div>
                    ))}
                    </div>
                </div>
                </>
              )}
            </motion.div>
          )}

          {/* VIEW: DOORPRIZE */}
          {view === "doorprize" && (
            <motion.div key="doorprize" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col lg:flex-row gap-6 md:gap-8 w-full max-w-6xl mx-auto pb-10">
              
              <div className="w-full lg:w-2/3 order-1 flex flex-col gap-6">
                 
                 {/* --- COUNTDOWN DOORPRIZE --- */}
                 <CountdownTimer targetDate={config.doorprizeStart} title="Doorprize Dimulai Dalam" />

                 {/* HANYA TAMPIL JIKA SUDAH MULAI */}
                 {isDoorprizeOpen && (
                 <>
                 {/* --- 1. DAFTAR HADIAH --- */}
                 <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 p-4 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-wide">
                       <PackageOpen size={16} /> Daftar Hadiah Tersedia
                    </h3>
                    {prizes.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-sm">Tidak ada data hadiah.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                           {prizes.map((p) => (
                             <div key={p.id} className={`bg-white p-2 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center text-center transition-all ${p.stock === 0 ? 'opacity-40 grayscale' : 'hover:scale-105'}`}>
                                <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-50 mb-2 relative">
                                   {p.image_url ? (
                                       // eslint-disable-next-line @next/next/no-img-element
                                       <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                   ) : (
                                       <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100"><Gift size={24}/></div>
                                   )}
                                   {p.stock === 0 && (
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-[10px] text-white font-bold">HABIS</div>
                                   )}
                                </div>
                                <div className="text-[10px] sm:text-xs font-bold text-slate-700 line-clamp-1 w-full" title={p.name}>{p.name}</div>
                                <div className={`text-[10px] mt-1 font-mono px-2 py-0.5 rounded-full ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                   {p.stock} Unit
                                </div>
                             </div>
                           ))}
                        </div>
                    )}
                 </div>

                 {/* --- 2. SPIN MACHINE --- */}
                 {!isSpinning && !winner ? (
                   <div className="bg-white/50 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 border-4 border-white shadow-2xl flex flex-col items-center justify-center min-h-[300px]">
                      
                      <div className="w-full text-center mb-8">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-800">RANDOM DOORPRIZE</h2>
                        <p className="text-slate-500 mt-2">Sistem akan mengacak Peserta & Hadiah sekaligus.</p>
                      </div>

                      <motion.div 
                        animate={{ y: [0, -20, 0] }} 
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="mb-8 relative"
                      >
                         <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center shadow-2xl rotate-3">
                            <HelpCircle className="text-white w-16 h-16 md:w-20 md:h-20 opacity-80" />
                         </div>
                      </motion.div>
                      
                      {/* BUTTON SPIN with Time Check */}
                      <TimeDependentButton 
                        targetDate={config.doorprizeStart} 
                        onClick={handleDoorprizeSpin} 
                        disabled={totalItemsRemaining === 0 || participants.length === 0}
                        text="PUTAR ACAK SEKARANG"
                        icon={<Zap fill="currentColor" />}
                      />
                   </div>
                 ) : isSpinning ? (
                   <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border-4 border-blue-100 shadow-2xl min-h-[400px] flex flex-col items-center justify-center text-center">
                      <p className="text-blue-400 font-bold tracking-widest animate-pulse mb-4 md:mb-8 text-sm md:text-base">MENGACAK PESERTA & HADIAH...</p>
                      <h2 className="text-4xl md:text-6xl font-black text-slate-800 break-words w-full animate-pulse blur-[1px]">{rollingName}</h2>
                   </div>
                 ) : (
                   <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-white/90 backdrop-blur-xl rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border-4 border-yellow-200 shadow-2xl text-center relative overflow-hidden min-h-[400px] flex flex-col items-center justify-center">
                      <div className="absolute inset-0 pointer-events-none">{confettiParticles.map((p,i) => <div key={i} className={`absolute w-2 h-2 md:w-3 md:h-3 ${p.color}`} style={{left: p.x + (typeof window !== 'undefined' ? window.innerWidth/2 : 300), top: p.y + 200}} />)}</div>
                      
                      <div className="bg-blue-50 px-4 py-2 rounded-full text-blue-600 font-bold text-sm mb-6 inline-flex items-center gap-2">
                         <Gift size={16} /> Selamat Kepada
                      </div>
                      
                      <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-6">{winner?.name}</h1>
                      
                      <div className="relative group w-full max-w-sm mx-auto mb-8">
                         <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl rotate-2 opacity-50 blur-lg group-hover:opacity-75 transition-opacity"></div>
                         <div className="relative bg-white border border-slate-100 rounded-2xl p-4 shadow-lg flex items-center gap-4 text-left">
                            {winner?.prize.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={winner?.prize.image_url} alt="Prize" className="w-20 h-20 rounded-lg object-cover bg-slate-100" />
                            ) : (
                                <div className="w-20 h-20 rounded-lg bg-blue-50 flex items-center justify-center"><Gift className="text-blue-300"/></div>
                            )}
                            <div>
                               <div className="text-xs text-slate-400 font-bold uppercase mb-1">Mendapatkan Hadiah</div>
                               <div className="text-lg md:text-xl font-black text-slate-800 leading-tight">{winner?.prize.name}</div>
                            </div>
                         </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center relative z-10 w-full">
                        <button onClick={resetAll} className="px-6 py-3 bg-slate-100 rounded-full font-bold text-slate-600 w-full sm:w-auto hover:bg-slate-200 transition-colors">Tutup</button>
                        <button onClick={() => { resetAll(); handleDoorprizeSpin(); }} className="px-6 py-3 bg-blue-600 rounded-full font-bold text-white shadow-lg w-full sm:w-auto hover:bg-blue-700 transition-colors">Undi Lagi</button>
                      </div>
                   </motion.div>
                 )}
                 </>
                 )}
              </div>

              {/* Right Column: History */}
              {/* HANYA TAMPIL JIKA SUDAH MULAI */}
              {isDoorprizeOpen && (
              <div className="w-full lg:w-1/3 flex flex-col h-[500px] lg:h-[700px] order-2">
                <div className="bg-white/60 backdrop-blur-md rounded-[2rem] border border-white/50 shadow-xl flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 md:p-6 border-b border-white/50 bg-white/40 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm md:text-base"><History size={20} /> Riwayat Pemenang</h3>
                    <div className="text-xs text-slate-500 font-medium">Total: {doorprizeLog.length}</div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
                      {doorprizeLog.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                          <Box size={32} className="mb-2 opacity-50" />
                          <p>Belum ada pemenang</p>
                        </div>
                      ) : (
                        <div className="space-y-2 md:space-y-3">
                          {doorprizeLog.map((log) => (
                            <motion.div key={log.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 flex gap-3 items-center">
                              {log.prizeImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={log.prizeImage} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-50" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center"><Gift size={16} className="text-slate-300"/></div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-slate-800 text-sm truncate">{log.name}</span>
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{log.displayTime}</span>
                                </div>
                                <div className="text-xs text-blue-600 font-medium truncate">{log.prizeName}</div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </div>
              )}

            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}

// --- SUB COMPONENTS ---

// 1. Countdown Timer Component
function CountdownTimer({ targetDate, title }: { targetDate: string, title: string }) {
    const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);

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
                setTimeLeft(null); // Waktu habis
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [targetDate]);

    if (!timeLeft) return null; // Jangan tampilkan jika sudah mulai atau targetDate kosong

    return (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-2xl mx-auto mb-8 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 p-4 flex flex-col items-center justify-center text-center">
             <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest mb-3">
                 <Clock size={14} /> {title}
             </div>
             <div className="flex gap-4 md:gap-8">
                 <TimeBox val={timeLeft.days} label="Hari" />
                 <TimeBox val={timeLeft.hours} label="Jam" />
                 <TimeBox val={timeLeft.minutes} label="Menit" />
                 <TimeBox val={timeLeft.seconds} label="Detik" />
             </div>
        </motion.div>
    );
}

function TimeBox({ val, label }: { val: number, label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl shadow-lg flex items-center justify-center text-xl md:text-3xl font-black text-slate-800 border border-slate-100">
                {val < 10 ? `0${val}` : val}
            </div>
            <span className="text-[10px] md:text-xs text-slate-500 font-bold mt-1 uppercase">{label}</span>
        </div>
    )
}

// 2. Button Wrapper that checks Time
function TimeDependentButton({ targetDate, onClick, disabled, text, icon }: { targetDate: string, onClick: () => void, disabled?: boolean, text: string, icon: React.ReactNode }) {
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        const checkTime = () => {
            if(!targetDate) {
                setIsStarted(true); // Jika tidak ada jadwal, anggap mulai
                return;
            }
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            setIsStarted(now >= target);
        }
        
        checkTime();
        const interval = setInterval(checkTime, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    const isLocked = !isStarted;

    return (
        <button 
            onClick={onClick} 
            disabled={disabled || isLocked}
            className={`mt-2 mx-auto px-8 py-4 rounded-full font-bold text-lg shadow-xl transition-all w-full md:w-auto relative overflow-hidden group flex items-center justify-center gap-2
                ${isLocked 
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                    : (disabled ? "bg-slate-300 text-slate-500 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-cyan-200 hover:scale-105")
                }`}
        >
            {isLocked ? (
                <> <Calendar size={18} /> MENUNGGU JADWAL</>
            ) : (
                <>
                  {!disabled && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12"></div>}
                  {icon} {text}
                </>
            )}
        </button>
    )
}