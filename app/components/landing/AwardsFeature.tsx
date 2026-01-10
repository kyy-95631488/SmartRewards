/* eslint-disable react-hooks/exhaustive-deps */
// app/components/landing/AwardsFeature.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom"; // IMPORT PORTAL
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Trophy, ChevronRight, ChevronLeft,
  Medal, Award, PlayCircle, PauseCircle,
  Shuffle, Grid, List
} from "lucide-react";

// --- TYPES ---
interface MergedAwardWinner {
  id: string;
  rank: number;
  category: string;
  eventLabel: string;
  name: string;
  company: string;
}

interface AwardHistoryItem {
  name: string;
  category: string;
  rank: number;
  eventLabel: string;
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

// Update Type Sound Keys
type AwardSoundType = 'countdown' | 'suspense' | 'drumroll' | 'fanfare';

interface AwardsFeatureProps {
  config: { awardStart: string };
  awardStep: number;
  mergedAwardWinners: MergedAwardWinner[];
  confettiParticles: Particle[];
  carouselIndex: number;
  setCarouselIndex: React.Dispatch<React.SetStateAction<number>>;
  isCarouselPaused: boolean;
  setIsCarouselPaused: (val: boolean) => void;
  uniqueCategories: string[];
  triggerCelebration: () => void;
  setAwardStep: React.Dispatch<React.SetStateAction<number>>;
  onSaveCategoryBatch: (items: MergedAwardWinner[]) => void;
  awardHistory: AwardHistoryItem[];
  playSound: (type: AwardSoundType) => void;
  stopSound: (type: AwardSoundType) => void;
}

export default function AwardsFeature({
  awardStep, mergedAwardWinners, 
  confettiParticles, 
  carouselIndex, setCarouselIndex,
  isCarouselPaused, setIsCarouselPaused, uniqueCategories, triggerCelebration,
  setAwardStep, onSaveCategoryBatch, awardHistory,
  playSound, stopSound
}: AwardsFeatureProps) {

  // --- LOCAL STATE MANAGEMENT ---
    
  type StageMode = 
    | 'nominations'   // 1. Slide per kandidat
    | 'intro_grid'    // 2. Grid semua kandidat (Hold position)
    | 'countdown'     // 3. Hitung mundur 3-2-1
    | 'pre_roll'      // 4. Tampilan "SIAPAKAH DIA?"
    | 'rolling'       // 5. Efek acak nama
    | 'reveal_single' // 6. Tampilan satu pemenang
    | 'podium'        // 7. Tampilan akhir 3 pemenang
    | 'carousel';     // 8. Loop semua kategori (Selesai)

  const [visualMode, setVisualMode] = useState<StageMode>('nominations');
    
  // State Slide Nominasi
  const [nomineeIndex, setNomineeIndex] = useState(0);

  // State Ranking (Mulai dari 3, lalu 2, lalu 1)
  const [currentProcessRank, setCurrentProcessRank] = useState<number>(3); 
    
  // Countdown Value
  const [countdownVal, setCountdownVal] = useState<number | null>(null);

  // Efek Rolling
  const [rollingName, setRollingName] = useState<string>("---");
    
  // Menyimpan rank yang sudah terbuka
  const [revealedRanks, setRevealedRanks] = useState<number[]>([]);

  // Portal Mounted State
  const [mounted, setMounted] = useState(false);

  // Data Kategori Saat Ini
  const currentItem = mergedAwardWinners[awardStep];
  const currentCategory = currentItem ? currentItem.category : "";
  const categoryItems = mergedAwardWinners.filter(w => w.category === currentCategory);
  const currentNominee = categoryItems[nomineeIndex];

  // Cek History
  const isCategoryRevealed = awardHistory.some(h => h.category === currentCategory);
  const currentCategoryIndex = uniqueCategories.indexOf(currentCategory);
  const isLastCategory = currentCategoryIndex === uniqueCategories.length - 1;

  // --- EFFECT: HANDLE MOUNTED (Client Side Only for Portal) ---
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // --- RESET STATE SAAT KATEGORI BERUBAH ---
  useEffect(() => {
    if (awardStep < mergedAwardWinners.length) {
       if (isCategoryRevealed) {
         // Jika sudah ada di history, langsung tampilkan podium lengkap
         setVisualMode('podium');
         setRevealedRanks([3, 2, 1]); 
       } else {
         // Reset ke awal: Slide Nominasi
         setVisualMode('nominations');
         setNomineeIndex(0);
         setCurrentProcessRank(3); 
         setRevealedRanks([]);
         setCountdownVal(null);
       }
    } else {
       setVisualMode('carousel');
    }
  }, [awardStep, mergedAwardWinners.length, isCategoryRevealed, currentCategory]);

  // --- LOGIC SLIDE NOMINASI ---
  const nextNominee = () => {
    setNomineeIndex((prev) => (prev + 1) % categoryItems.length);
  };
  const prevNominee = () => {
    setNomineeIndex((prev) => (prev - 1 + categoryItems.length) % categoryItems.length);
  };
    
  const finishNominations = () => {
    setVisualMode('intro_grid'); // Masuk ke mode Grid untuk mulai pengundian
  };

  // --- LOGIC COUNTDOWN & ROLLING FLOW ---
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Start Countdown Sequence (3-2-1)
  const startCountdownSequence = () => {
    setVisualMode('countdown');
    setCountdownVal(3);
    playSound('countdown'); // Play sound 3-2-1
    
    let count = 3;
    const countInterval = setInterval(() => {
        count--;
        if (count > 0) {
           setCountdownVal(count);
        } else {
           clearInterval(countInterval);
           
           // Stop Sound Countdown
           stopSound('countdown'); 

           // Masuk ke Pre-Roll ("SIAPAKAH DIA?")
           setVisualMode('pre_roll');
        }
    }, 1000);
  };

  // 2. Transisi Pre-Roll ke Rolling
  useEffect(() => {
    if (visualMode === 'pre_roll') {
        // Play Suspense Sound
        playSound('suspense');

        // Tahan tulisan "SIAPAKAH DIA?" selama 2 detik agar terbaca
        const timer = setTimeout(() => {
            startRolling();
        }, 2000);
        return () => clearTimeout(timer);
    }
  }, [visualMode]);

  // 3. Start Rolling Effect
  const startRolling = () => {
    stopSound('countdown'); 
    stopSound('suspense');  
    
    setVisualMode('rolling');
    // Play Drumroll Loop
    playSound('drumroll'); 
    
    const names = categoryItems.map(c => c.company); 
    if(names.length === 0) return;

    intervalRef.current = setInterval(() => {
      const randomName = names[Math.floor(Math.random() * names.length)];
      setRollingName(randomName);
    }, 80); 

    // Durasi Rolling (3 detik)
    setTimeout(() => {
       stopRolling();
    }, 3000);
  };

  // 4. Stop Rolling & Reveal (MODIFIED LOGIC HERE)
  const stopRolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Stop Drumroll & Suspense
    stopSound('drumroll'); 
    stopSound('suspense');
    stopSound('countdown');
    
    setVisualMode('reveal_single');
    
    // LOGIC BARU:
    // Jika Juara 1, HANYA trigger celebration (Win Sound).
    // Jika Juara 2 & 3, mainkan Fanfare.
    if (currentProcessRank === 1) {
       triggerCelebration(); // Efek Confetti + Suara Win.mp3
    } else {
       playSound('fanfare');
    }
  };

  // --- BUTTON HANDLERS ---
  const handleNextStep = () => {
      setRevealedRanks(prev => [...prev, currentProcessRank]);

      if (currentProcessRank > 1) {
          setCurrentProcessRank(prev => prev - 1);
          setVisualMode('intro_grid'); 
      } else {
          setVisualMode('podium');
      }
  };

  const goToNextCategory = () => {
    onSaveCategoryBatch(categoryItems); 

    if (currentCategoryIndex !== -1 && currentCategoryIndex < uniqueCategories.length - 1) {
       const nextCategoryName = uniqueCategories[currentCategoryIndex + 1];
       const nextStepIndex = mergedAwardWinners.findIndex(w => w.category === nextCategoryName);
       if (nextStepIndex !== -1) {
         setAwardStep(nextStepIndex);
       }
    } else {
       setAwardStep(mergedAwardWinners.length); 
    }
  };

  const getCurrentWinner = () => {
      return categoryItems.find(w => w.rank === currentProcessRank);
  };

  // --- TEXT SIZING HELPERS ---
const getRevealTitleSize = (text: string) => {
  const len = text.length;

  if (len > 50) return "text-xl md:text-4xl leading-tight";
  if (len > 30) return "text-2xl md:text-5xl leading-tight";
  if (len > 15) return "text-3xl md:text-6xl leading-tight";
  return "text-4xl md:text-7xl leading-none";
};


  const getRollingTitleSize = (text: string) => {
    const len = text.length;

    if (len > 50) return "text-lg md:text-2xl leading-tight";
    if (len > 30) return "text-xl md:text-3xl leading-tight"; 
    if (len > 15) return "text-2xl md:text-4xl leading-tight";
    return "text-3xl md:text-5xl leading-none";
  };

  // --- RENDER ACTION BUTTONS (ISI PORTAL) ---
  const renderActionButtons = () => {
    // 1. Nominasi Mode: Tombol "Lihat Semua Nominasi"
    if (visualMode === 'nominations') {
       if (nomineeIndex === categoryItems.length - 1) {
         return (
            <motion.button 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                onClick={finishNominations}
                className="w-full md:w-auto px-5 py-2 md:px-6 md:py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-full font-bold text-xs md:text-sm hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)] transition-all flex items-center justify-center gap-2 uppercase tracking-wider border border-white/20"
            >
                <List size={16} /> LIHAT SEMUA NOMINASI
            </motion.button>
         );
       }
       return null;
    }

    // 2. Intro Grid: Tombol "Acak Juara"
    if (visualMode === 'intro_grid') {
        return (
            <motion.button
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileHover={{ scale: 1.05 }}
                onClick={startCountdownSequence}
                className={`w-full md:w-auto px-5 py-2 md:px-6 md:py-2 rounded-full font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-lg border transition-all ${
                    currentProcessRank === 1 
                    ? "bg-gradient-to-r from-yellow-600 to-yellow-400 text-slate-900 border-yellow-300 shadow-yellow-500/20"
                    : currentProcessRank === 2
                    ? "bg-gradient-to-r from-slate-600 to-slate-400 text-white border-slate-300"
                    : "bg-gradient-to-r from-orange-700 to-orange-500 text-white border-orange-300"
                }`}
            >
                <Shuffle size={16} className={`${currentProcessRank === 1 ? "animate-spin-slow" : ""}`} />
                ACAK JUARA {currentProcessRank}
            </motion.button>
        );
    }

    // CATATAN: Tombol untuk 'reveal_single' DIHAPUS dari sini dan dipindah langsung ke JSX utama 
    // agar Z-Index nya berada di atas overlay hitam pekat.

    // 3. Podium: Tombol "Next Category"
    if (visualMode === 'podium') {
        return (
            <motion.button 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 }}
                onClick={goToNextCategory}
                className={`w-full md:w-auto px-5 py-2 md:px-6 md:py-2 rounded-full font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-xl transition-transform hover:scale-105 border border-white/20 ${
                    isLastCategory 
                    ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-cyan-500/50" 
                    : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
            >
                {isLastCategory ? (
                    <>LIHAT HASIL AKHIR <Grid size={16} /></>
                ) : (
                    <>KATEGORI SELANJUTNYA <ChevronRight size={16} /></>
                )}
            </motion.button>
        );
    }

    return null;
  };

  return (
    <motion.div key="awards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-[1800px] mx-auto flex-1 h-full px-2 md:px-4 relative font-sans">

      {/* --- PORTAL KE HEADER (SOLUSI POSISI SEJAJAR) --- */}
      {/* Tombol akan di-render di dalam div id="header-actions" pada page.tsx */}
      {mounted && document.getElementById('header-actions') && createPortal(
          renderActionButtons(),
          document.getElementById('header-actions')!
      )}

      {/* CONFETTI */}
      <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden h-full w-full">
        {confettiParticles.map((p, i) => (
          <motion.div
            key={i}
            initial={{ y: -50, x: 0, opacity: 1, rotate: 0 }}
            animate={{
              y: '100vh', x: p.sway, rotateX: p.rotation * 2, rotateY: p.rotation * 2, rotateZ: p.rotation
            }}
            transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
            className={`absolute ${p.color} will-change-transform`}
            style={{ left: `${p.x}%`, width: p.width, height: p.height }}
          />
        ))}
      </div>

      {/* HEADER KATEGORI */}
      {visualMode !== 'carousel' && visualMode !== 'reveal_single' && visualMode !== 'pre_roll' && currentItem && (
        <div className="mt-4 mb-4 md:mb-8 text-center shrink-0 z-10">
             <div className="inline-block px-3 py-1 md:px-4 md:py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 font-bold uppercase tracking-[0.2em] mb-2 md:mb-4 text-[10px] md:text-xs shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                KATEGORI NOMINASI
             </div>
             <h2 className="text-xl md:text-5xl font-black text-white drop-shadow-lg uppercase tracking-wide px-2">
                {currentCategory}
             </h2>
        </div>
      )}

      {/* 1. SLIDE NOMINASI (CAROUSEL AWAL) */}
      {visualMode === 'nominations' && currentItem && (
        <div className="w-full flex-1 flex flex-col items-center justify-center relative">
            <div className="flex items-center justify-center w-full max-w-6xl gap-2 md:gap-8 flex-1 min-h-0 h-full max-h-[60vh] md:max-h-[500px]">
                <button onClick={prevNominee} className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm hover:scale-110 border border-white/10 shrink-0 z-20">
                    <ChevronLeft size={20} className="md:w-6 md:h-6" />
                </button>

                <div className="relative w-full flex-1 h-full flex items-center justify-center overflow-visible">
                  <AnimatePresence mode="wait">
                    {currentNominee && (
                        <motion.div 
                            key={currentNominee.id}
                            initial={{ opacity: 0, x: 50, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -50, scale: 0.95 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="w-full h-full bg-gradient-to-br from-slate-900/90 to-slate-800/90 backdrop-blur-xl border border-white/20 rounded-3xl p-4 md:p-12 flex flex-col items-center justify-center text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
                        >
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                             <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                             <div className="absolute -top-20 -left-20 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl"></div>

                             <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                                 <div className="text-slate-400 font-medium tracking-widest uppercase mb-2 md:mb-6 text-[10px] md:text-sm shrink-0">
                                     NOMINASI {nomineeIndex + 1} DARI {categoryItems.length}
                                 </div>
                                 
                                 {/* CONTAINER TEKS NOMINASI */}
                                 <div className="mt-2 md:mt-6 w-full flex-1 flex items-center justify-center px-4 overflow-hidden">
                                      <AutoFitTextHero text={currentNominee.company} /> 
                                 </div>
                             </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button onClick={nextNominee} className="p-2 md:p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm hover:scale-110 border border-white/10 shrink-0 z-20">
                    <ChevronRight size={20} className="md:w-6 md:h-6" />
                </button>
            </div>

            <div className="flex gap-2 mt-4 md:mt-8 shrink-0">
                {categoryItems.map((_, idx) => (
                    <div key={idx} className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${idx === nomineeIndex ? 'w-6 md:w-10 bg-yellow-500' : 'w-1.5 md:w-2 bg-slate-600'}`} />
                ))}
            </div>

            <div className="mt-4 md:mt-8 shrink-0 h-[30px] flex items-center justify-center">
                {nomineeIndex !== categoryItems.length - 1 && (
                    <div className="text-slate-500 text-[10px] md:text-sm italic opacity-50">Lanjut ke nominasi berikutnya...</div>
                )}
            </div>
        </div>
      )}

      {/* 2. INTRO GRID (GRID NOMINASI) */}
      {visualMode === 'intro_grid' && (
         <div className="flex-1 w-full flex flex-col items-center justify-center relative">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 w-full max-w-6xl px-4 auto-rows-fr">
                {categoryItems.map((nominee, idx) => {
                    const isAlreadyWinner = revealedRanks.some(r => categoryItems.find(w => w.rank === r)?.id === nominee.id);
                    return (
                        <motion.div 
                            key={nominee.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            className={`relative aspect-[3/1.8] md:aspect-[3/1.5] rounded-xl border ${isAlreadyWinner ? 'bg-yellow-500/20 border-yellow-400/50' : 'bg-slate-900/60 border-white/10'} backdrop-blur-md flex flex-col items-center justify-center p-2 md:p-3 shadow-xl overflow-hidden group hover:border-white/30 transition-all`}
                        >
                            {isAlreadyWinner && (
                                <div className="absolute top-1 right-1 md:top-2 md:right-2 bg-yellow-500 text-black text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded z-20">
                                    WINNER
                                </div>
                            )}
                            <div className="text-slate-400 text-[8px] md:text-[10px] font-bold uppercase tracking-widest mb-1 md:mb-2 shrink-0">
                                NOMINEE {idx + 1}
                            </div>
                            <div className="w-full flex-1 flex items-center justify-center overflow-hidden min-h-0 px-1 py-1">
                                <AutoFitTextGrid text={nominee.company} /> 
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <div className="mt-6 md:mt-12 flex flex-col items-center gap-2 z-20">
                <div className="text-slate-400 text-xs md:text-sm mb-2 font-mono animate-pulse">
                    Menunggu pengumuman untuk
                </div>
            </div>
         </div>
      )}

      {/* 3. COUNTDOWN 3-2-1 */}
      {visualMode === 'countdown' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center overflow-hidden">
             <motion.div 
                key={countdownVal}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="text-8xl md:text-[20rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_100px_rgba(234,179,8,0.5)]"
             >
                {countdownVal}
             </motion.div>
        </div>
      )}

      {/* 4. PRE-ROLL "SIAPAKAH DIA?" */}
      {visualMode === 'pre_roll' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-[150vw] h-[150vw] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.1)_180deg,transparent_360deg)] rounded-full blur-3xl opacity-30"
                />
            </div>
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="relative z-10 text-center px-4"
            >
                <div className="text-yellow-500/80 font-bold tracking-[0.3em] md:tracking-[0.5em] uppercase text-sm md:text-2xl mb-4 md:mb-8 animate-pulse">
                    PEMENANGNYA ADALAH...
                </div>
                <h1 className="text-4xl md:text-8xl font-black text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.5)]">
                    SIAPAKAH DIA?
                </h1>
            </motion.div>
        </div>
      )}

      {visualMode === 'rolling' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-slate-950">
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-slate-950/60 to-slate-950 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

          <div className="relative z-10 mb-8 md:mb-12 animate-pulse">
            <div className="flex items-center gap-3 rounded-full border border-yellow-500/30 bg-yellow-500/5 px-6 py-2 backdrop-blur-md shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </span>
              <span className="text-yellow-500 text-sm md:text-base font-bold uppercase tracking-[0.2em]">
                MENCARI JUARA {currentProcessRank}...
              </span>
            </div>
          </div>

          <div className="relative z-10 w-full max-w-[95vw] md:max-w-4xl h-[40vh] md:h-[50vh] flex items-center justify-center">
            
            <div className="w-full h-full flex items-center justify-center relative [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]">
              <span 
                className={`
                  ${getRollingTitleSize(rollingName)} 
                  font-black text-center break-words leading-tight tracking-tight
                  text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-500
                  drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]
                  scale-100 transition-transform duration-75
                `}
                style={{ textShadow: '0 0 30px rgba(255,255,255,0.1)' }}
              >
                {rollingName}
              </span>
            </div>

            <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-4 md:px-12 opacity-50">
              <div className="h-16 md:h-32 w-1 md:w-1.5 bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent rounded-full blur-[1px]"></div>
              <div className="h-16 md:h-32 w-1 md:w-1.5 bg-gradient-to-b from-transparent via-yellow-500/50 to-transparent rounded-full blur-[1px]"></div>
            </div>

            <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-yellow-500/20 to-transparent top-1/2 -translate-y-1/2"></div>
          </div>
        </div>
      )}

      {/* 6. REVEAL SINGLE - PERBAIKAN: Tombol ditempatkan DISINI, bukan di portal header */}
      {visualMode === 'reveal_single' && getCurrentWinner() && (
          <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4">
              <div className={`absolute inset-0 opacity-30 blur-[100px] ${
                  currentProcessRank === 1 ? 'bg-yellow-500/40' : 
                  currentProcessRank === 2 ? 'bg-slate-400/40' : 'bg-orange-500/40'
              }`}></div>
              
              <motion.div 
                 initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                 transition={{ type: "spring", bounce: 0.5 }}
                 className="relative z-10 flex flex-col items-center w-full max-w-[95vw]"
              >
                  <div className="text-white/80 text-lg md:text-xl font-bold uppercase tracking-[0.3em] mb-4 text-center">
                      SELAMAT KEPADA
                  </div>
                  
                  <div className={`mb-6 md:mb-8 w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center text-2xl md:text-5xl font-black border-4 shadow-2xl ${
                      currentProcessRank === 1 ? 'bg-yellow-400 border-yellow-200 text-yellow-900' :
                      currentProcessRank === 2 ? 'bg-slate-300 border-slate-100 text-slate-800' :
                      'bg-orange-400 border-orange-200 text-orange-900'
                  }`}>
                      {currentProcessRank}
                  </div>

                  <div className="text-center w-full max-w-7xl px-2 md:px-4">
                    <div className="w-full h-full flex items-center justify-center">
                      <span
                        className={`${getRevealTitleSize(getCurrentWinner()?.company || "")}
                        font-bold text-white
                        drop-shadow-[0_0_20px_rgba(255,255,255,0.45)]
                        mb-2 break-words leading-none`}
                      >
                        {getCurrentWinner()?.company}
                      </span>
                    </div>
                  </div>

                  {/* TOMBOL LANJUT - DIPINDAHKAN KESINI AGAR MUNCUL DIATAS OVERLAY */}
                  <motion.button
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }}
                      onClick={handleNextStep}
                      className="mt-8 px-8 py-3 bg-white text-slate-900 rounded-full font-bold text-sm md:text-base hover:scale-105 hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 z-50 border border-transparent hover:border-white/50"
                  >
                      {currentProcessRank === 1 ? "LIHAT PODIUM LENGKAP" : "POSISI BERIKUTNYA"} <ChevronRight size={20} />
                  </motion.button>
              </motion.div>
          </div>
      )}

      {/* 7. PODIUM FINAL */}
      {visualMode === 'podium' && (
         <div className="w-full flex-1 flex flex-col items-center justify-center relative min-h-0 py-4">
             <div className="flex flex-col items-center w-full h-full max-w-7xl mx-auto justify-center">
                <PodiumContent categoryName={currentCategory} mergedAwardWinners={categoryItems} />
             </div>
         </div>
      )}

      {/* 8. CAROUSEL */}
      {visualMode === 'carousel' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center w-full flex-1 justify-center relative min-h-0">
            <div 
              className="w-full max-w-[1600px] mx-auto flex items-center justify-between px-1 md:px-4 mt-2 md:mt-4 relative z-20 flex-1"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
            >
              <button 
                onClick={() => setCarouselIndex(prev => (prev - 1 + uniqueCategories.length) % uniqueCategories.length)}
                className="p-1 md:p-3 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
              >
                <ChevronLeft size={20} className="md:w-6 md:h-6" />
              </button>

              <div className="flex-1 flex justify-center items-center h-full px-2 md:px-4 overflow-hidden">
                <AnimatePresence mode="wait">
                  {uniqueCategories.map((categoryName, index) => {
                    if (index !== carouselIndex) return null;
                    const catItems = mergedAwardWinners.filter(w => w.category === categoryName);
                    return (
                      <motion.div
                        key={categoryName}
                        initial={{ opacity: 0, x: 100 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                        className="flex flex-col items-center w-full max-w-6xl bg-slate-900/40 border border-white/5 rounded-[1.5rem] md:rounded-[3rem] p-2 md:p-12 shadow-2xl backdrop-blur-md h-full justify-center max-h-[85vh]"
                      >
                        <PodiumContent categoryName={categoryName} mergedAwardWinners={catItems} isCarousel={true} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setCarouselIndex(prev => (prev + 1) % uniqueCategories.length)}
                className="p-1 md:p-3 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
              >
                <ChevronRight size={20} className="md:w-6 md:h-6" />
              </button>
            </div>
             <div className="flex items-center gap-4 mt-4 md:mt-6 shrink-0 pb-4">
              <button onClick={() => setIsCarouselPaused(!isCarouselPaused)} className="text-slate-400 hover:text-white">
                {isCarouselPaused ? <PlayCircle size={20} /> : <PauseCircle size={20} />}
              </button>
              <div className="flex gap-2">
                {uniqueCategories.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === carouselIndex ? 'w-6 bg-yellow-500' : 'w-1.5 bg-slate-700'}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
      )}

    </motion.div>
  );
}

// --- SUB COMPONENTS FOR AWARDS ---

function PodiumContent({ 
  categoryName, 
  mergedAwardWinners, 
  isCarousel = false,
}: { 
  categoryName: string
  mergedAwardWinners: MergedAwardWinner[] 
  isCarousel?: boolean
}) {
  const categoryWinners = mergedAwardWinners.filter(
    (w) => w.category === categoryName
  )

  const rank1 = categoryWinners.find((w) => w.rank === 1)
  const rank2 = categoryWinners.find((w) => w.rank === 2)
  const rank3 = categoryWinners.find((w) => w.rank === 3)

  return (
    <>

      <div className="flex flex-nowrap items-end justify-center gap-1.5 sm:gap-3 md:gap-4 w-full h-auto min-h-[30vh] flex-1 shrink-0 px-0 md:px-4 pb-12 md:pb-20">
        
        {/* RANK 2 */}
        {rank2 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-col items-center order-1 relative w-[30%] max-w-[300px]"
          >
            <div className="w-full h-[20vh] md:h-[30vh] bg-gradient-to-t from-slate-700/90 to-slate-600/30 border-t-2 border-x-2 border-slate-400/50 rounded-t-lg md:rounded-t-2xl relative flex flex-col items-center justify-between py-2 md:py-4 backdrop-blur-md shadow-lg">
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-10 min-h-0 overflow-hidden">
                   <div className="text-white font-bold leading-tight w-full drop-shadow-md text-center h-full flex items-center justify-center px-1">
                     {isCarousel 
                       ? <AutoFitTextCarousel text={rank2.company} /> 
                       : <AutoFitText text={rank2.company} />}
                   </div>
               </div>
               <div className="text-2xl md:text-6xl font-black text-slate-300 opacity-60 pb-1 shrink-0">2</div>
            </div>
            <div className="w-6 h-6 md:w-16 md:h-16 rounded-full bg-slate-300 flex items-center justify-center text-slate-900 font-bold border-2 md:border-4 border-slate-600 shadow-xl z-10 -mt-3 md:-mt-8">
              <Medal className="text-slate-900 w-3 h-3 md:w-8 md:h-8" />
            </div>
          </motion.div>
        )}

        {/* RANK 1 */}
        {rank1 && (
          <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
              className="flex flex-col items-center order-2 z-10 relative w-[34%] max-w-[380px]"
          >
            <div className="w-full h-[26vh] md:h-[42vh] bg-gradient-to-t from-yellow-600/90 to-yellow-500/40 border-t-2 border-x-2 border-yellow-400/60 rounded-t-xl md:rounded-t-3xl relative flex flex-col items-center justify-between py-3 md:py-4 backdrop-blur-md shadow-[0_0_80px_rgba(234,179,8,0.4)]">
               <div className="
                  absolute 
                  -top-8 sm:-top-12 md:-top-20
                  left-1/2 -translate-x-1/2
                  animate-bounce
                  z-30
               ">
                   <Crown className="text-yellow-400 fill-yellow-400/20 w-8 h-8 md:w-16 md:h-16 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
               </div>
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-20 pt-2 md:pt-4 min-h-0 overflow-hidden">
                  <div className="text-white font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] w-full text-center h-full flex items-center justify-center px-1">
                      {isCarousel 
                        ? <AutoFitTextCarousel text={rank1.company} /> 
                        : <AutoFitText text={rank1.company} />}
                  </div>
               </div>
               <div className="text-4xl md:text-8xl font-black text-yellow-300 opacity-60 pb-1 shrink-0">1</div>
            </div>
            <div className="w-10 h-10 md:w-24 md:h-24 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold border-2 md:border-4 border-yellow-600 shadow-2xl z-20 -mt-5 md:-mt-12 scale-110">
              <Trophy className="w-5 h-5 md:w-12 md:h-12" />
            </div>
          </motion.div>
        )}

        {/* RANK 3 */}
        {rank3 && (
          <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col items-center order-3 relative w-[30%] max-w-[300px]"
          >
            <div className="w-full h-[16vh] md:h-[25vh] bg-gradient-to-t from-orange-800/90 to-orange-700/30 border-t-2 border-x-2 border-orange-500/50 rounded-t-lg md:rounded-t-2xl relative flex flex-col items-center justify-between py-2 md:py-4 backdrop-blur-md shadow-lg">
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-10 min-h-0 overflow-hidden">
                  <div className="text-white font-bold leading-tight w-full drop-shadow-md text-center h-full flex items-center justify-center px-1">
                    {isCarousel 
                      ? <AutoFitTextCarousel text={rank3.company} /> 
                      : <AutoFitText text={rank3.company} />}
                  </div>
               </div>
               <div className="text-2xl md:text-6xl font-black text-orange-400 opacity-60 pb-1 shrink-0">3</div>
            </div>
            <div className="w-6 h-6 md:w-16 md:h-16 rounded-full bg-orange-700 flex items-center justify-center text-orange-100 font-bold border-2 md:border-4 border-orange-900 shadow-xl z-10 -mt-3 md:-mt-8">
              <Award className="text-orange-100 w-3 h-3 md:w-8 md:h-8" />
            </div>
          </motion.div>
        )}
      </div>
    </>
  )
}

// --- UTILS ---

const AutoFitText = ({ text }: { text: string }) => {
  const len = text.length;
  let sizeClass = "text-[10px] md:text-base leading-tight font-bold"; 
    
  if (len > 15) sizeClass = "text-[9px] md:text-sm leading-tight font-bold"; 
  if (len > 25) sizeClass = "text-[8px] md:text-xs leading-none font-bold"; 
  if (len > 35) sizeClass = "text-[7px] md:text-[11px] leading-none font-semibold"; 
  if (len > 50) sizeClass = "text-[6px] md:text-[10px] leading-none font-semibold tracking-tight"; 
  if (len > 70) sizeClass = "text-[5px] md:text-[9px] leading-none font-medium tracking-tighter"; 

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden p-1">
        <span 
            className={`text-center break-words whitespace-normal w-full ${sizeClass}`} 
            style={{ wordBreak: 'break-word', hyphens: 'auto' }} 
            title={text}
        >
            {text}
        </span>
    </div>
  );
};

const AutoFitTextCarousel = ({ text }: { text: string }) => {
  const len = text.length;
  let sizeClass = "text-[8px] md:text-base leading-tight font-semibold"; 
      
  if (len > 15)
    sizeClass = "text-[7px] md:text-sm leading-none font-semibold"; 

  if (len > 25)
    sizeClass = "text-[6px] md:text-xs leading-none font-medium tracking-tight"; 

  if (len > 35)
    sizeClass = "text-[5px] md:text-[10px] leading-[1] font-medium tracking-tighter"; 

  if (len > 50)
    sizeClass = "text-[4px] md:text-[9px] leading-[0.95] font-normal tracking-tighter"; 
      
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden p-0.5">
      <span 
        className={`text-center break-words whitespace-normal w-full ${sizeClass}`} 
        style={{ wordBreak: 'break-word', hyphens: 'auto' }} 
        title={text}
      >
        {text}
      </span>
    </div>
  );
};

const AutoFitTextGrid = ({ text }: { text: string }) => {
  const len = text.length;
  let sizeClass = "text-[8px] md:text-base leading-tight font-semibold";

  if (len > 15) sizeClass = "text-[7px] md:text-sm leading-tight font-semibold";
  if (len > 25) sizeClass = "text-[6px] md:text-xs leading-none font-medium";
  if (len > 35) sizeClass = "text-[5px] md:text-[11px] leading-none font-medium";
  if (len > 50) sizeClass = "text-[4px] md:text-[10px] leading-none font-normal tracking-tight";

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden p-1">
      <span
        className={`text-center break-words whitespace-normal w-full ${sizeClass}`}
        style={{ wordBreak: "break-word", hyphens: "auto" }}
        title={text}
      >
        {text}
      </span>
    </div>
  );
};

const AutoFitTextHero = ({ text }: { text: string }) => {
  const len = text.length;
  let sizeClass = "text-lg md:text-4xl leading-tight font-extrabold";

  if (len > 60) {
    sizeClass = "text-sm md:text-lg leading-tight font-semibold";
  } else if (len > 45) {
    sizeClass = "text-base md:text-xl leading-snug font-semibold";
  } else if (len > 30) {
    sizeClass = "text-lg md:text-2xl leading-snug font-bold";
  } else if (len > 18) {
    sizeClass = "text-xl md:text-3xl leading-tight font-extrabold";
  }

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden px-4">
      <span
        className={`w-full text-center break-words whitespace-normal line-clamp-4
          text-transparent bg-clip-text bg-gradient-to-r 
          from-white via-slate-100 to-slate-300
          drop-shadow-lg ${sizeClass}`}
        style={{ wordBreak: "break-word", hyphens: "auto" }}
        title={text}
      >
        {text}
      </span>
    </div>
  );
};