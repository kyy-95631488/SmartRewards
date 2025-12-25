"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Crown, Gift, ArrowLeft, Trophy, ChevronRight, 
  Medal, Search, Zap, List, X, History, PartyPopper, 
  Box, PackageOpen, Clock, Calendar, Sparkles, Lock, Save, RotateCcw
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
  doorprizeStatus: "open" | "closed";
  royalStatus: "open" | "closed";
  doorprizePasscode: string;
  royalPasscode: string;
}

type Particle = { id: number; x: number; y: number; color: string; size: number; offsetX: number; duration: number; randomX: number; randomDuration: number };

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
  // State baru untuk menyimpan data pemenang Royal dari DB
  const [royalWinnersDb, setRoyalWinnersDb] = useState<MergedRoyalWinner[]>([]); 
  
  // Config & Schedule & Auth
  const [config, setConfig] = useState<AppConfig>({ 
    doorprizeStart: "", royalStart: "", 
    doorprizeStatus: "closed", royalStatus: "closed",
    doorprizePasscode: "", royalPasscode: ""
  });
  
  // Passcode States
  const [passcodeModal, setPasscodeModal] = useState<"doorprize" | "royal" | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authorized, setAuthorized] = useState<{ doorprize: boolean; royal: boolean }>({ doorprize: false, royal: false });

  // --- STATE INTERACTIVE ---
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingName, setRollingName] = useState("Ready?");
  
  // Confirmation States
  const [pendingDoorprize, setPendingDoorprize] = useState<{ winner: Participant; prize: Prize } | null>(null);
  const [pendingRoyal, setPendingRoyal] = useState<{ winner: MergedRoyalWinner } | null>(null);

  const [winner, setWinner] = useState<{ name: string; prize: Prize } | null>(null);

  const [royalStep, setRoyalStep] = useState(0); 
  const [isRoyalSpinning, setIsRoyalSpinning] = useState(false);
  const [revealedRoyalWinner, setRevealedRoyalWinner] = useState<MergedRoyalWinner | null>(null);

  const [confettiParticles, setConfettiParticles] = useState<Particle[]>([]);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- HELPER FUNCTIONS ---
  
  const resetAll = () => {
    setWinner(null);
    setRevealedRoyalWinner(null);
    setRollingName("Ready?");
    setPendingDoorprize(null);
    setPendingRoyal(null);
    setConfettiParticles([]);
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    // Note: royalStep tidak di-reset di sini agar sinkron dengan DB
  };

  const generateConfetti = (amount = 50) => {
    const colors = ['bg-pink-500', 'bg-cyan-400', 'bg-yellow-400', 'bg-purple-500', 'bg-white'];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Array.from({ length: amount }).map((_) => ({
      id: Math.random(),
      x: (Math.random() - 0.5) * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
      y: -100 - Math.random() * 500,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      offsetX: (Math.random() - 0.5) * 200,
      duration: 2 + Math.random(),
      randomX: (Math.random() - 0.5) * 200,
      randomDuration: 2 + Math.random()
    }));
  };

  const triggerCelebration = () => {
      setConfettiParticles([]);
      setTimeout(() => {
        setConfettiParticles(generateConfetti(100));
      }, 50);
  };

  // --- FETCH DATA ---
  useEffect(() => {
    // 1. Fetch Config
    const unsubConfig = onSnapshot(
      doc(db, "settings", "config"),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as AppConfig;
          setConfig(data);
          
          const savedDoorprizeCode = localStorage.getItem("doorprize_passcode");
          const savedRoyalCode = localStorage.getItem("royal_passcode");
          
          setAuthorized({
            doorprize: savedDoorprizeCode === data.doorprizePasscode,
            royal: savedRoyalCode === data.royalPasscode
          });

          // Kickback logic handled in handleAccessRequest mostly, but aggressive check here:
          if(view === 'doorprize' && data.doorprizeStatus === 'closed') {
             // Exception: Don't kick if completed (logic handled below)
          }
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

    // 4. Log Pemenang Doorprize
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

    // 5. Royal Data Slots & Candidates
    const unsubRoyalSlots = onSnapshot(query(collection(db, "royal_participants"), orderBy("rank", "asc")), (snapshot) => {
      setRoyalSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoyalParticipant)));
    });

    const unsubCandidates = onSnapshot(collection(db, "royal_candidates"), (snapshot) => {
      setRoyalCandidates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoyalCandidate)));
      setLoading(false);
    });

    // 6. Royal Winners (Already Revealed)
    // Penting: Mengambil data pemenang yang sudah disimpan di DB untuk menentukan step
    const unsubRoyalWinners = onSnapshot(collection(db, "royal_winners"), (snapshot) => {
        const winners = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MergedRoyalWinner));
        setRoyalWinnersDb(winners);
        // Sinkronisasi Step: Step saat ini = jumlah pemenang yang sudah ada di DB
        setRoyalStep(winners.length);
    });

    return () => {
      unsubConfig();
      unsubParticipants();
      unsubPrizes();
      unsubHistory();
      unsubRoyalSlots();
      unsubCandidates();
      unsubRoyalWinners();
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [view]);

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

  // --- COMPLETION CHECK (BYPASS LOGIC) ---
  const isRoyalCompleted = royalSlots.length > 0 && royalWinnersDb.length >= royalSlots.length;
  const isDoorprizeCompleted = prizes.length > 0 && totalItemsRemaining === 0;

  // --- AUTH & NAVIGATION LOGIC ---
  const handleAccessRequest = (targetView: "royal" | "doorprize") => {
    const status = targetView === "doorprize" ? config.doorprizeStatus : config.royalStatus;
    
    // 1. Cek Apakah Event Sudah Selesai (Bypass Password)
    // Jika target Royal DAN data di DB sudah lengkap = Boleh masuk tanpa password
    if (targetView === "royal" && isRoyalCompleted) {
        setView(targetView);
        return;
    }
    // Jika target Doorprize DAN stok hadiah habis = Boleh masuk tanpa password
    if (targetView === "doorprize" && isDoorprizeCompleted) {
        setView(targetView);
        return;
    }

    // 2. Cek Status Open/Closed (Hanya jika belum selesai)
    if (status === "closed") {
        alert("Sesi ini belum dibuka oleh Admin.");
        return;
    }

    // 3. Cek Passcode (Jika belum selesai & status open)
    if (authorized[targetView]) {
        setView(targetView);
    } else {
        setPasscodeModal(targetView);
        setPasscodeInput("");
    }
  };

  const submitPasscode = () => {
    if (!passcodeModal) return;
    
    const correctCode = passcodeModal === "doorprize" ? config.doorprizePasscode : config.royalPasscode;

    if (passcodeInput === correctCode) {
        localStorage.setItem(`${passcodeModal}_passcode`, correctCode);
        setAuthorized(prev => ({ ...prev, [passcodeModal]: true }));
        setView(passcodeModal);
        setPasscodeModal(null);
    } else {
        alert("Passcode Salah!");
    }
  };

  // --- LOGIC ACTIONS: ROYAL ---
  const handleRoyalReveal = () => {
    const currentWinnerData = mergedRoyalWinners[royalStep];
    if (isRoyalSpinning || !currentWinnerData) return;
    
    setIsRoyalSpinning(true);
    setRevealedRoyalWinner(null);
    setConfettiParticles([]);

    // Animasi Rolling Nama
    spinIntervalRef.current = setInterval(() => {
      const randomName = royalCandidates.length > 0 
        ? royalCandidates[Math.floor(Math.random() * royalCandidates.length)].name 
        : "Loading...";
      setRollingName(randomName);
    }, 50);

    // Stop & Show Confirmation
    setTimeout(() => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      setRollingName(currentWinnerData.name);
      setIsRoyalSpinning(false);
      setPendingRoyal({ winner: currentWinnerData }); // Masuk mode konfirmasi
    }, 3000);
  };

  const confirmRoyalWinner = async () => {
      if(!pendingRoyal) return;
      
      // 1. Simpan ke Database (Royal Winners History)
      try {
        await addDoc(collection(db, "royal_winners"), {
          rank: pendingRoyal.winner.rank,
          title: pendingRoyal.winner.title,
          name: pendingRoyal.winner.name,
          company: pendingRoyal.winner.company,
          timestamp: serverTimestamp()
        });
        // Note: setRoyalStep tidak perlu manual update di sini, 
        // karena onSnapshot akan mendeteksi penambahan data dan mengupdate royalStep otomatis.
      } catch (error) {
        console.error("Error saving royal winner:", error);
        alert("Gagal menyimpan data Royal ke database. Periksa koneksi internet.");
        return;
      }

      // 2. Update UI
      setRevealedRoyalWinner(pendingRoyal.winner);
      setConfettiParticles(generateConfetti(100));
      setPendingRoyal(null); // Clear pending
  };

  const retryRoyal = () => {
      setPendingRoyal(null);
      setRollingName("Ready?");
  };

  // --- LOGIC ACTIONS: DOORPRIZE ---
  const handleDoorprizeSpin = async () => {
    // 1. Validasi
    const availablePrizes = prizes.filter(p => p.stock > 0);
    if (isSpinning || availablePrizes.length === 0 || participants.length === 0) {
      if(participants.length === 0) alert("Data peserta kosong!");
      return;
    }
    
    setIsSpinning(true);
    setWinner(null);
    setPendingDoorprize(null);
    setConfettiParticles([]); 

    // 2. Animasi Rolling
    spinIntervalRef.current = setInterval(() => {
      setRollingName(participants[Math.floor(Math.random() * participants.length)].name);
    }, 50); 

    // 3. Tentukan Pemenang & Hadiah SECARA ACAK
    setTimeout(async () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      
      const finalWinner = participants[Math.floor(Math.random() * participants.length)];
      const randomPrizeIndex = Math.floor(Math.random() * availablePrizes.length);
      const selectedPrize = availablePrizes[randomPrizeIndex];

      setRollingName(finalWinner.name);
      setIsSpinning(false);

      // 4. Masuk Mode Konfirmasi
      setPendingDoorprize({ winner: finalWinner, prize: selectedPrize });
    }, 4000); 
  };

  const confirmDoorprizeWinner = async () => {
      if (!pendingDoorprize) return;

      const { winner: winParticipant, prize } = pendingDoorprize;

      // 1. Simpan ke State Utama (Tampil Pemenang)
      setWinner({ name: winParticipant.name, prize: prize });
      setConfettiParticles(generateConfetti(100));
      
      // 2. Update Database
      try {
          const prizeRef = doc(db, "prizes", prize.id);
          // Update stok hadiah
          await updateDoc(prizeRef, {
            stock: prize.stock - 1
          });

          // Simpan riwayat pemenang
          await addDoc(collection(db, "doorprize_winners"), {
            name: winParticipant.name,
            prizeName: prize.name,
            prizeImage: prize.image_url || "",
            timestamp: serverTimestamp()
          });
      } catch (error) {
          console.error("Error saving winner:", error);
          alert("Gagal menyimpan ke database, cek koneksi internet.");
      }

      setPendingDoorprize(null); // Clear pending
  };

  const retryDoorprize = () => {
      setPendingDoorprize(null);
      setRollingName("Ready?");
      setWinner(null);
  };

  const modalData = view === "royal" ? royalCandidates : participants;
  const modalTitle = view === "royal" ? "Kandidat Royal Top 6" : "Peserta Doorprize";

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950"></div>
        <div className="relative z-10 flex flex-col items-center gap-6">
           <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
           <p className="text-blue-200/70 font-mono tracking-widest text-sm animate-pulse">SYSTEM INITIALIZING...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen relative flex flex-col items-center py-6 md:py-10 overflow-hidden font-sans text-slate-100 bg-slate-950 selection:bg-blue-500 selection:text-white">
      
      {/* --- DYNAMIC BACKGROUND SYSTEM --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-slate-950"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
        <motion.div animate={{ x: [-100, 100, -100], y: [-50, 50, -50], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-900/40 rounded-full blur-[120px]" />
        <motion.div animate={{ x: [100, -100, 100], y: [50, -50, 50], opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-blue-900/30 rounded-full blur-[140px]" />
      </div>

      {/* --- MODAL PASSCODE --- */}
      <AnimatePresence>
        {passcodeModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-8 rounded-3xl max-w-md w-full text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                            <Lock className="text-white" size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Restricted Access</h3>
                        <p className="text-slate-400 mb-6 text-sm">Masukkan passcode untuk mengakses halaman {passcodeModal}.</p>
                        
                        <input 
                            type="password" 
                            value={passcodeInput}
                            onChange={(e) => setPasscodeInput(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-center text-white text-lg tracking-[0.5em] mb-4 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            placeholder="••••••"
                            autoFocus
                        />
                        
                        <div className="flex gap-3">
                            <button onClick={() => setPasscodeModal(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold transition-colors">Batal</button>
                            <button onClick={submitPasscode} className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors shadow-lg shadow-blue-500/20">Buka</button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL KONFIRMASI (DOORPRIZE & ROYAL) --- */}
      <AnimatePresence>
        {(pendingDoorprize || pendingRoyal) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-slate-900 border-2 border-yellow-500/50 p-8 rounded-[2rem] max-w-lg w-full text-center relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
                    <div className="relative z-10">
                        <div className="text-yellow-400 font-bold tracking-widest uppercase mb-4 animate-pulse">Konfirmasi Hasil</div>
                        
                        {pendingDoorprize && (
                            <>
                                <h2 className="text-4xl font-black text-white mb-2">{pendingDoorprize.winner.name}</h2>
                                <p className="text-slate-400 mb-6">Mendapatkan: <span className="text-cyan-400 font-bold">{pendingDoorprize.prize.name}</span></p>
                                <div className="p-4 bg-slate-950/50 rounded-xl mb-8 border border-white/5">
                                    <p className="text-xs text-slate-500 mb-2">Preview Hadiah</p>
                                    {pendingDoorprize.prize.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={pendingDoorprize.prize.image_url} alt="" className="h-32 mx-auto rounded-lg object-contain" />
                                    ) : (
                                        <Gift className="mx-auto text-slate-600" size={48} />
                                    )}
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={retryDoorprize} className="flex-1 py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2"><RotateCcw size={18}/> Spin Ulang</button>
                                    <button onClick={confirmDoorprizeWinner} className="flex-1 py-4 rounded-xl bg-yellow-500 text-slate-900 hover:bg-yellow-400 font-bold flex items-center justify-center gap-2 shadow-lg"><Save size={18}/> SAH & SIMPAN</button>
                                </div>
                            </>
                        )}

                        {pendingRoyal && (
                            <>
                                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/50">
                                    <Crown className="text-yellow-400" size={32} />
                                </div>
                                <h3 className="text-xl text-yellow-200 mb-2">Rank #{pendingRoyal.winner.rank}</h3>
                                <h2 className="text-4xl font-black text-white mb-2">{pendingRoyal.winner.name}</h2>
                                <p className="text-slate-400 mb-8">{pendingRoyal.winner.company}</p>
                                
                                <div className="flex gap-4">
                                    <button onClick={retryRoyal} className="flex-1 py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2"><RotateCcw size={18}/> Batal</button>
                                    <button onClick={confirmRoyalWinner} className="flex-1 py-4 rounded-xl bg-yellow-500 text-slate-900 hover:bg-yellow-400 font-bold flex items-center justify-center gap-2 shadow-lg"><Save size={18}/> SAH & REVEAL</button>
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL DAFTAR PESERTA (GLASS UI) --- */}
      <AnimatePresence>
        {showParticipantModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="bg-slate-900/80 rounded-3xl w-full max-w-3xl h-[85vh] flex flex-col border border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.3)] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>
              
              <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                <h3 className="text-xl font-bold text-white flex items-center gap-3"><List className="text-blue-400" /> {modalTitle}</h3>
                <button onClick={() => setShowParticipantModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative z-10">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-white/10">
                      <th className="py-4 px-4 font-semibold">No</th>
                      <th className="py-4 px-4 font-semibold">Nama Kandidat</th>
                      {view === "royal" && <th className="py-4 px-4 font-semibold">Instansi/Perusahaan</th>}
                      <th className="py-4 px-4 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {modalData.map((p, i) => (
                      <tr key={p.id} className="hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group">
                        <td className="py-3 px-4 text-slate-500 font-mono group-hover:text-blue-400 transition-colors">{i + 1}</td>
                        <td className="py-3 px-4 font-medium text-slate-200 group-hover:text-white">{p.name}</td>
                        {view === "royal" && (
                            <td className="py-3 px-4 text-slate-400">{(p as RoyalCandidate).company}</td>
                        )}
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block px-2 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">ACTIVE</span>
                        </td>
                      </tr>
                    ))}
                    {modalData.length === 0 && (
                        <tr><td colSpan={view === "royal" ? 4 : 3} className="text-center py-12 text-slate-500">Database Kosong</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[1400px] px-4 md:px-8 z-10 relative">
        
        {/* --- NAVIGATION --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center w-full md:w-auto">
            {view !== "menu" && (
              <motion.button 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                onClick={() => { setView("menu"); resetAll(); }} 
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all group backdrop-blur-sm"
              >
                <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 
                <span className="font-medium text-sm">Kembali ke Menu</span>
              </motion.button>
            )}
          </div>
          <div className="flex gap-3 w-full md:w-auto justify-end">
            {view !== "menu" && (
                <button 
                  onClick={() => setShowParticipantModal(true)} 
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm font-medium text-sm"
                >
                  <List size={18} /> <span>Database ({modalData.length})</span>
                </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          
          {/* VIEW: MAIN MENU */}
          {view === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-12 mt-4 md:mt-10">
              
              <div className="text-center relative">
                <div className="absolute -inset-10 bg-blue-500/20 blur-3xl rounded-full"></div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="relative">
                    <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-slate-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] tracking-tighter">GATHERING 2025</h1>
                    <div className="flex items-center justify-center gap-4 mt-4">
                      <div className="h-px w-12 bg-blue-500/50"></div>
                      <p className="text-lg md:text-2xl text-blue-300 font-light tracking-[0.3em] uppercase">Appreciation Night</p>
                      <div className="h-px w-12 bg-blue-500/50"></div>
                    </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-5xl px-4">
                
                {/* CARD 1: ROYAL */}
                <button onClick={() => handleAccessRequest("royal")} className="group relative h-64 md:h-80 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(234,179,8,0.2)] text-left">
                   <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                   <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                   
                   <div className="relative z-10 h-full p-8 md:p-10 flex flex-col justify-end">
                      <Trophy className="absolute top-8 right-8 text-yellow-500/20 w-32 h-32 md:w-48 md:h-48 group-hover:text-yellow-500/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500" />
                      <div className="space-y-2">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isRoyalCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'}`}>
                             {isRoyalCompleted ? <><Sparkles size={12}/> COMPLETED</> : (config.royalStatus === 'closed' ? <><Lock size={12}/> Locked</> : <><Sparkles size={12}/> Awards</>)}
                          </div>
                          <h2 className="text-3xl md:text-5xl font-bold text-white group-hover:text-yellow-200 transition-colors">Royal Top 6</h2>
                          <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-base md:text-lg max-w-sm">Pengungkapan eksklusif peringkat tertinggi tahun ini.</p>
                      </div>
                   </div>
                </button>

                {/* CARD 2: DOORPRIZE */}
                <button onClick={() => handleAccessRequest("doorprize")} className="group relative h-64 md:h-80 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(6,182,212,0.2)] text-left">
                   <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                   <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>

                   <div className="relative z-10 h-full p-8 md:p-10 flex flex-col justify-end">
                      <Gift className="absolute top-8 right-8 text-cyan-500/20 w-32 h-32 md:w-48 md:h-48 group-hover:text-cyan-500/40 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500" />
                      <div className="space-y-2">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isDoorprizeCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
                             {isDoorprizeCompleted ? <><Zap size={12}/> SOLD OUT</> : (config.doorprizeStatus === 'closed' ? <><Lock size={12}/> Locked</> : <><Zap size={12}/> Lucky Draw</>)}
                          </div>
                          <h2 className="text-3xl md:text-5xl font-bold text-white group-hover:text-cyan-200 transition-colors">Doorprize</h2>
                          <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-base md:text-lg max-w-sm">Putaran keberuntungan berhadiah menarik untuk semua.</p>
                      </div>
                   </div>
                </button>

              </div>
            </motion.div>
          )}

          {/* VIEW: ROYAL REVEAL */}
          {view === "royal" && (
            <motion.div key="royal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-6xl mx-auto">
              
              <CountdownTimer targetDate={config.royalStart} title="Waktu Menuju Royal Reveal" theme="gold" />

              <div className="w-full min-h-[400px] mb-12 flex flex-col items-center justify-center relative perspective-1000">
                  
                  {/* 1. STATE: BELUM REVEAL */}
                  {!isRoyalSpinning && !revealedRoyalWinner && !pendingRoyal && royalStep < mergedRoyalWinners.length && (
                      <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-10 md:p-16 border border-white/10 text-center w-full max-w-3xl hover:border-yellow-500/50 transition-all shadow-2xl relative overflow-hidden group">
                          <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="relative z-10">
                           <div className="w-24 h-24 mx-auto mb-8 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                               <Search className="text-yellow-500 w-10 h-10 animate-pulse" />
                           </div>
                           <h3 className="text-2xl md:text-5xl font-bold text-white mb-4">Siapakah Rank <span className="text-yellow-400">#{mergedRoyalWinners[royalStep].rank}</span>?</h3>
                           <p className="text-slate-400 text-lg mb-8 max-w-lg mx-auto">Sistem telah mengunci data kandidat. Klik tombol di bawah untuk mengungkap identitas pemenang.</p>
                           
                           <TimeDependentButton 
                             targetDate={config.royalStart} 
                             onClick={handleRoyalReveal} 
                             text="UNGKAP PEMENANG" 
                             icon={<Sparkles size={20} className="inline mr-2" />} 
                             theme="gold"
                           />
                          </div>
                      </div>
                  )}

                  {/* 2. STATE: SPINNING / PENDING */}
                  {(isRoyalSpinning || pendingRoyal) && (
                      <div className="w-full max-w-4xl h-[400px] flex flex-col items-center justify-center relative">
                          <div className="absolute inset-0 bg-yellow-500/5 blur-[100px] rounded-full animate-pulse"></div>
                          {isRoyalSpinning ? (
                                <div className="text-yellow-500 font-mono text-sm tracking-[0.5em] mb-6 animate-pulse uppercase">Searching Database...</div>
                          ) : (
                                <div className="text-green-400 font-mono text-sm tracking-[0.5em] mb-6 uppercase">Winner Found!</div>
                          )}
                          <h2 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 blur-[2px] animate-pulse text-center leading-tight">
                              {rollingName}
                          </h2>
                      </div>
                  )}

                  {/* 3. STATE: REVEALED */}
                  {revealedRoyalWinner && (
                      <div className="relative w-full max-w-4xl">
                          <div className="absolute inset-0 pointer-events-none z-50">
                              {confettiParticles.map((p,i) => (
                                  <motion.div 
                                      key={i} 
                                      initial={{ y: p.y, x: p.x, opacity: 1 }}
                                      animate={{ y: p.y + 800, x: p.x + p.offsetX, rotate: 360 }}
                                      transition={{ duration: p.duration, ease: "easeOut" }}
                                      className={`absolute rounded-full ${p.color}`} 
                                      style={{ width: p.size, height: p.size, left: '50%' }} 
                                  />
                              ))}
                          </div>

                          <motion.div 
                          initial={{ scale: 0.5, opacity: 0, rotateX: 90 }} 
                          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                          transition={{ type: "spring", bounce: 0.4, duration: 1.5 }}
                          className="bg-gradient-to-br from-slate-900 to-black rounded-[3rem] p-1 border border-yellow-500/50 shadow-[0_0_100px_rgba(234,179,8,0.3)] relative overflow-hidden"
                          >
                              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay"></div>
                              <div className="absolute -top-40 -right-40 w-96 h-96 bg-yellow-600/30 rounded-full blur-[80px]"></div>
                              
                              <div className="bg-slate-950/80 backdrop-blur-3xl rounded-[2.8rem] p-8 md:p-12 text-center md:text-left flex flex-col md:flex-row items-center gap-10 relative z-10">
                                  <div className="relative shrink-0">
                                      <div className="absolute inset-0 bg-yellow-500 blur-[60px] opacity-40 animate-pulse"></div>
                                      <Medal className="text-yellow-400 w-40 h-40 md:w-56 md:h-56 drop-shadow-2xl relative z-10" strokeWidth={1} />
                                      <div className="absolute inset-0 flex items-center justify-center z-20 pt-4">
                                          <span className="text-6xl md:text-8xl font-black text-white drop-shadow-md">#{revealedRoyalWinner.rank}</span>
                                      </div>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                                          <div className="inline-block px-4 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-full text-sm font-bold uppercase tracking-wider mb-4">
                                              {revealedRoyalWinner.title}
                                          </div>
                                          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.9] mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-100 to-yellow-500">
                                              {revealedRoyalWinner.name}
                                          </h1>
                                          <p className="text-xl md:text-3xl text-slate-400 font-light tracking-wide mb-8">{revealedRoyalWinner.company}</p>
                                          
                                          <div className="h-px w-full bg-gradient-to-r from-yellow-500/50 to-transparent mb-8"></div>
                                          
                                          {royalStep < mergedRoyalWinners.length ? (
                                              <button onClick={handleRoyalReveal} className="w-full md:w-auto px-10 py-4 bg-white text-slate-900 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                                  Lanjut ke Rank #{mergedRoyalWinners[royalStep].rank} <ChevronRight size={20}/>
                                              </button>
                                          ) : (
                                              <button onClick={() => setRevealedRoyalWinner(null)} className="w-full md:w-auto px-10 py-4 bg-green-500 text-white rounded-full font-bold shadow-lg hover:scale-105 transition-transform flex items-center justify-center gap-2">
                                                  <PartyPopper size={20} /> SELESAI & REKAP
                                              </button>
                                          )}
                                      </motion.div>
                                  </div>
                              </div>
                          </motion.div>
                      </div>
                  )}

                  {/* 4. STATE: ALL COMPLETED */}
                  {!isRoyalSpinning && !revealedRoyalWinner && !pendingRoyal && royalStep >= mergedRoyalWinners.length && (
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-b from-purple-900/50 to-slate-900/80 backdrop-blur-xl border border-purple-500/30 rounded-[3rem] p-10 md:p-16 shadow-2xl text-center w-full max-w-4xl relative overflow-hidden">
                          <div className="absolute inset-0 pointer-events-none z-0">
                              {confettiParticles.map((p,i) => (
                                  <motion.div 
                                      key={i} 
                                      initial={{ y: p.y, x: p.x, opacity: 1 }}
                                      animate={{ y: p.y + 800, x: p.x + p.randomX, rotate: 360 }}
                                      transition={{ duration: p.randomDuration, ease: "easeOut" }}
                                      className={`absolute rounded-full ${p.color}`} 
                                      style={{ width: p.size, height: p.size, left: '50%' }} 
                                  />
                              ))}
                          </div>
                          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                          <div className="relative z-10">
                              <Crown className="w-24 h-24 mx-auto mb-6 text-yellow-400 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-bounce" />
                              <h2 className="text-4xl md:text-6xl font-black text-white mb-6">HALL OF FAME LENGKAP!</h2>
                              <p className="text-slate-300 text-lg mb-10 max-w-2xl mx-auto">Selamat kepada seluruh pemenang Royal Top 6. Prestasi luar biasa untuk pencapaian yang gemilang.</p>
                              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                  <button onClick={triggerCelebration} className="px-8 py-4 bg-purple-600 text-white rounded-full font-bold text-lg shadow-lg hover:bg-purple-500 hover:scale-105 transition-transform flex items-center justify-center gap-2 relative z-20"><PartyPopper /> RAYAKAN</button>
                              </div>
                          </div>
                      </motion.div>
                  )}
              </div>

              {/* LIST GRID */}
              <div className="w-full mt-8">
                  <h3 className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-6 text-center md:text-left">Daftar Pemenang Royal</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mergedRoyalWinners.slice(0, royalStep).map((w) => (
                      <motion.div key={w.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-800/40 backdrop-blur border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-800/60 hover:border-yellow-500/30 transition-all group">
                      <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center font-black text-yellow-500 text-lg shrink-0 border border-yellow-500/20 group-hover:bg-yellow-500 group-hover:text-slate-900 transition-colors">#{w.rank}</div>
                      <div className="min-w-0">
                          <div className="font-bold text-slate-100 truncate group-hover:text-yellow-200">{w.name}</div>
                          <div className="text-xs text-slate-400 truncate">{w.company}</div>
                      </div>
                      </motion.div>
                  ))}
                  </div>
              </div>
            </motion.div>
          )}

          {/* VIEW: DOORPRIZE */}
          {view === "doorprize" && (
            <motion.div key="doorprize" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col xl:flex-row gap-8 w-full max-w-[1600px] mx-auto pb-10">
              
              <div className="w-full xl:w-2/3 order-1 flex flex-col gap-8">
                 
                 <CountdownTimer targetDate={config.doorprizeStart} title="Waktu Menuju Doorprize" theme="cyan" />

                 {/* --- 1. DAFTAR HADIAH (Modern Grid) --- */}
                 <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-cyan-400 mb-6 flex items-center gap-2 uppercase tracking-wide">
                       <PackageOpen size={18} /> Hadiah
                       <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-xs ml-auto">{totalItemsRemaining} Item Tersedia</span>
                    </h3>
                    {prizes.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 font-mono text-sm">DATABASE HADIAH KOSONG</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                           {prizes.map((p) => (
                             <div key={p.id} className={`group bg-slate-800/40 p-3 rounded-2xl border border-white/5 flex flex-col transition-all relative overflow-hidden ${p.stock === 0 ? 'opacity-30 grayscale' : 'hover:scale-105 hover:bg-slate-800/80 hover:border-cyan-500/30'}`}>
                                <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 mb-3 relative">
                                   {p.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                   ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900"><Gift size={32}/></div>
                                   )}
                                   {p.stock === 0 && (
                                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-[10px] text-white font-bold tracking-widest border-2 border-red-500/50 m-2 rounded">HABIS</div>
                                   )}
                                </div>
                                <div className="text-xs font-bold text-slate-300 line-clamp-1 group-hover:text-cyan-300 transition-colors" title={p.name}>{p.name}</div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className={`text-[10px] font-mono px-2 py-0.5 rounded ${p.stock > 0 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
                                        Qty: {p.stock}
                                    </div>
                                </div>
                             </div>
                           ))}
                        </div>
                    )}
                 </div>

                 {/* --- 2. SPIN MACHINE --- */}
                 {!isSpinning && !winner ? (
                    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[3rem] p-10 border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.1)] flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden">
                       <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                       <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,cyan_360deg)] opacity-5 blur-[100px]"></motion.div>
                       
                       <div className="relative z-10 text-center w-full max-w-lg">
                          <motion.div 
                            animate={{ y: [0, -15, 0] }} 
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-32 h-32 mx-auto mb-8 bg-cyan-950 rounded-full flex items-center justify-center border-4 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                          >
                             <Zap className="text-cyan-400 w-16 h-16 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                          </motion.div>
                          
                          <h2 className="text-4xl md:text-5xl font-black text-white mb-2">RANDOMIZER</h2>
                          <p className="text-cyan-200/60 mb-8">Algoritma pengacakan peserta dan hadiah siap dijalankan.</p>

                          <TimeDependentButton 
                            targetDate={config.doorprizeStart} 
                            onClick={handleDoorprizeSpin} 
                            disabled={totalItemsRemaining === 0 || participants.length === 0}
                            text="PUTAR ACAK SEKARANG"
                            icon={<Zap fill="currentColor" size={20} />}
                            theme="cyan"
                          />
                       </div>
                    </div>
                 ) : (isSpinning || pendingDoorprize) ? (
                    <div className="bg-black/40 backdrop-blur-xl rounded-[3rem] p-12 border border-cyan-500/50 shadow-[0_0_100px_rgba(6,182,212,0.2)] min-h-[450px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                       <div className="absolute inset-0 bg-cyan-500/5 animate-pulse"></div>
                       {/* Scanning Line */}
                       <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="absolute left-0 w-full h-1 bg-cyan-500/50 blur-sm shadow-[0_0_20px_cyan]"></motion.div>
                       
                       <p className="text-cyan-400 font-mono tracking-[0.5em] text-sm mb-8 animate-pulse">SYSTEM PROCESSING...</p>
                       <h2 className="text-5xl md:text-7xl font-black text-white break-words w-full blur-[1px] animate-pulse">{rollingName}</h2>
                    </div>
                 ) : (
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-gradient-to-b from-slate-900 to-black rounded-[3rem] p-12 border-2 border-cyan-400 shadow-[0_0_100px_rgba(6,182,212,0.4)] text-center relative overflow-hidden min-h-[450px] flex flex-col items-center justify-center">
                       {/* Confetti */}
                       <div className="absolute inset-0 pointer-events-none z-0">
                           {confettiParticles.map((p,i) => (
                             <motion.div 
                               key={i} 
                               initial={{ y: p.y, x: p.x, opacity: 1 }}
                               animate={{ y: p.y + 600, x: p.x + p.randomX * 0.5, rotate: 360 }}
                               transition={{ duration: p.randomDuration * 1.5, ease: "easeOut" }}
                               className={`absolute rounded-full ${p.color}`} 
                               style={{ width: p.size, height: p.size, left: '50%' }} 
                             />
                           ))}
                       </div>
                       
                       <div className="relative z-10 w-full max-w-2xl">
                          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-bold mb-8 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                              <Gift size={18} /> SELAMAT KEPADA
                          </motion.div>
                          
                          <motion.h1 initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-5xl md:text-7xl font-black text-white mb-10 drop-shadow-lg">{winner?.name}</motion.h1>
                          
                          <div className="relative group w-full max-w-md mx-auto mb-10">
                              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl rotate-2 opacity-60 blur-xl group-hover:opacity-100 transition-opacity"></div>
                              <div className="relative bg-slate-900 border border-white/20 rounded-2xl p-6 flex items-center gap-6 text-left">
                                 {winner?.prize.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={winner?.prize.image_url} alt="Prize" className="w-80 h-62 rounded-xl object-cover bg-slate-800 border border-white/10" />
                                 ) : (
                                        <div className="w-80 h-62 rounded-xl bg-cyan-900/50 flex items-center justify-center"><Gift className="text-cyan-400 w-10 h-10"/></div>
                                 )}
                                 <div>
                                    <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">Hadiah Utama</div>
                                    <div className="text-2xl font-bold text-white leading-tight">{winner?.prize.name}</div>
                                 </div>
                              </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 justify-center">
                             <button onClick={resetAll} className="px-8 py-3 bg-slate-800 rounded-full font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">Tutup</button>
                             <button onClick={() => { resetAll(); handleDoorprizeSpin(); }} className="px-8 py-3 bg-cyan-600 rounded-full font-bold text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-500 hover:scale-105 transition-all">Undi Lagi</button>
                          </div>
                       </div>
                    </motion.div>
                 )}
              </div>

              {/* Right Column: History */}
              <div className="w-full xl:w-1/3 order-2">
                <div className="bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-xl overflow-hidden h-[600px] xl:h-[800px] flex flex-col relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none"></div>
                  
                  <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                    <h3 className="font-bold text-white flex items-center gap-2 text-base"><History className="text-cyan-400" size={20} /> Live Feed Winner</h3>
                    <div className="bg-cyan-500/20 text-cyan-300 text-xs px-2 py-1 rounded font-mono">TOTAL: {doorprizeLog.length}</div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-10">
                      {doorprizeLog.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm">
                          <Box size={40} className="mb-3 opacity-30" />
                          <p>Menunggu Pemenang...</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <AnimatePresence>
                          {doorprizeLog.map((log) => (
                            <motion.div key={log.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 flex gap-3 items-center hover:bg-slate-800 transition-colors group">
                              {log.prizeImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={log.prizeImage} alt="" className="w-16 h-12 rounded-xl object-cover bg-slate-950 border border-white/5" />
                              ) : (
                                <div className="w-16 h-12 rounded-xl bg-slate-950 flex items-center justify-center"><Gift size={18} className="text-slate-600"/></div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-slate-200 text-sm truncate group-hover:text-white transition-colors">{log.name}</span>
                                  <span className="text-[10px] text-slate-500 font-mono ml-2">{log.displayTime}</span>
                                </div>
                                <div className="text-xs text-cyan-400 font-medium truncate">{log.prizeName}</div>
                              </div>
                            </motion.div>
                          ))}
                          </AnimatePresence>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}

// --- SUB COMPONENTS ---

// 1. Countdown Timer Component
function CountdownTimer({ targetDate, title, theme = "gold" }: { targetDate: string, title: string, theme?: "gold" | "cyan" }) {
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

    if (!timeLeft) return null; 

    const boxBorder = theme === "gold" ? "border-yellow-500/20" : "border-cyan-500/20";

    return (
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`w-full max-w-2xl mx-auto mb-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border ${boxBorder} p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden`}>
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-20"></div>
             <div className={`flex items-center gap-2 ${theme === "gold" ? "text-yellow-200" : "text-cyan-200"} text-xs font-bold uppercase tracking-[0.2em] mb-4`}>
                 <Clock size={14} /> {title}
             </div>
             <div className="flex gap-4 md:gap-8 relative z-10">
                 <TimeBox val={timeLeft.days} label="Hari" theme={theme} />
                 <TimeBox val={timeLeft.hours} label="Jam" theme={theme} />
                 <TimeBox val={timeLeft.minutes} label="Menit" theme={theme} />
                 <TimeBox val={timeLeft.seconds} label="Detik" theme={theme} />
             </div>
        </motion.div>
    );
}

function TimeBox({ val, label, theme }: { val: number, label: string, theme: string }) {
    const textColor = theme === "gold" ? "text-yellow-500" : "text-cyan-400";
    return (
        <div className="flex flex-col items-center">
            <div className={`w-14 h-14 md:w-20 md:h-20 bg-slate-950 rounded-2xl flex items-center justify-center text-2xl md:text-4xl font-black ${textColor} border border-white/10 shadow-inner`}>
                {val < 10 ? `0${val}` : val}
            </div>
            <span className="text-[10px] md:text-xs text-slate-500 font-bold mt-2 uppercase tracking-wider">{label}</span>
        </div>
    )
}

// 2. Button Wrapper that checks Time
function TimeDependentButton({ targetDate, onClick, disabled, text, icon, theme = "gold" }: { targetDate: string, onClick: () => void, disabled?: boolean, text: string, icon: React.ReactNode, theme?: "gold" | "cyan" }) {
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        const checkTime = () => {
            if(!targetDate) {
                setIsStarted(true); 
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
    
    // Style logic
    let btnClass = "";
    if (isLocked || disabled) {
        btnClass = "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed";
    } else {
        if (theme === "gold") {
            btnClass = "bg-gradient-to-r from-yellow-600 to-yellow-400 text-slate-900 border-yellow-300 hover:shadow-[0_0_20px_rgba(234,179,8,0.5)]";
        } else {
            btnClass = "bg-gradient-to-r from-cyan-600 to-cyan-400 text-white border-cyan-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.5)]";
        }
    }

    return (
        <button 
            onClick={onClick} 
            disabled={disabled || isLocked}
            className={`mt-4 mx-auto px-8 py-4 rounded-full font-bold text-lg transition-all w-full md:w-auto relative overflow-hidden group flex items-center justify-center gap-2 border-t border-white/20 shadow-lg active:scale-95 ${btnClass}`}
        >
            {isLocked ? (
                <> <Calendar size={18} /> EVENT BELUM DIMULAI</>
            ) : (
                <>
                  {!disabled && <div className="absolute inset-0 bg-white/30 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>}
                  {icon} {text}
                </>
            )}
        </button>
    )
}