// app/components/landing/AwardsFeature.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Trophy, ChevronRight, ChevronLeft,
  Medal, Award, PlayCircle, PauseCircle,
  Shuffle, Grid
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
  // Callback sound
  playSound: (type: 'countdown' | 'suspense') => void;
  stopSound: (type: 'countdown' | 'suspense') => void; // NEW PROP
}

export default function AwardsFeature({
  awardStep, mergedAwardWinners, 
  confettiParticles, 
  carouselIndex, setCarouselIndex,
  isCarouselPaused, setIsCarouselPaused, uniqueCategories, triggerCelebration,
  setAwardStep, onSaveCategoryBatch, awardHistory,
  playSound, stopSound // Destructure
}: AwardsFeatureProps) {

  // --- LOCAL STATE ---
  type VisualMode = 'nominations' | 'countdown' | 'reveal' | 'podium' | 'carousel';
  const [visualMode, setVisualMode] = useState<VisualMode>('nominations');
  const [countdownVal, setCountdownVal] = useState<number | null>(null);

  // State untuk Slide Nominasi (satu per satu)
  const [nomineeIndex, setNomineeIndex] = useState(0);

  // Get Current Category Data
  const currentItem = mergedAwardWinners[awardStep];
  const currentCategory = currentItem ? currentItem.category : "";
    
  // Filter items untuk kategori saat ini
  const categoryItems = mergedAwardWinners.filter(w => w.category === currentCategory);
  
  // Data nominasi saat ini untuk slide
  const currentNominee = categoryItems[nomineeIndex];

  // Check apakah kategori ini sudah tersimpan di database
  const isCategoryRevealed = awardHistory.some(h => h.category === currentCategory);

  // Logic untuk mengecek apakah ini kategori terakhir
  const currentCategoryIndex = uniqueCategories.indexOf(currentCategory);
  const isLastCategory = currentCategoryIndex === uniqueCategories.length - 1;

  // Reset visual mode saat kategori berubah
  useEffect(() => {
    if (awardStep < mergedAwardWinners.length) {
       // Jika kategori sudah ada di history (sudah dibuka sebelumnya), langsung ke Podium
       if (isCategoryRevealed) {
          setVisualMode('podium');
       } else {
          // Jika belum, mulai dari Nominasi
          setVisualMode('nominations');
          setNomineeIndex(0); 
       }
       setCountdownVal(null);
    } else {
       // Jika semua kategori selesai
       setVisualMode('carousel');
    }
  }, [awardStep, mergedAwardWinners.length, isCategoryRevealed]);

  // Logic Navigasi Nominasi (Slide Kiri/Kanan)
  const nextNominee = () => {
    setNomineeIndex((prev) => (prev + 1) % categoryItems.length);
  };

  const prevNominee = () => {
    setNomineeIndex((prev) => (prev - 1 + categoryItems.length) % categoryItems.length);
  };

  // Logic Mulai Countdown -> Reveal -> Podium
  const startCountdown = () => {
    setVisualMode('countdown');
    setCountdownVal(3);
    
    // Play Initial Sound (3)
    playSound('countdown');

    let count = 3;
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdownVal(count);
        // Play Sound (2, 1)
        playSound('countdown');
      } else {
        clearInterval(interval);
        
        // --- FIX: PAKSA STOP SOUND COUNTDOWN DISINI ---
        stopSound('countdown'); 

        // Go to REVEAL
        setVisualMode('reveal'); 
      }
    }, 1000);
  };

  // --- REVEAL PHASE EFFECT ---
  // Menangani transisi dari "SIAPAKAH DIA" ke Podium
  useEffect(() => {
    if (visualMode === 'reveal') {
        // Play Reveal/Suspense Sound
        playSound('suspense');

        const timer = setTimeout(() => {
            setVisualMode('podium');
            triggerCelebration();
        }, 2500); // Tahan tulisan "SIAPAKAH DIA" selama 2.5 detik
        return () => clearTimeout(timer);
    }
  }, [visualMode, triggerCelebration, playSound]);

  // Logic Lanjut ke Kategori Berikutnya (Manual via Tombol di Podium)
  const goToNextCategory = () => {
    // Simpan data pemenang ke history SAAT user klik lanjut
    onSaveCategoryBatch(categoryItems);

    if (currentCategoryIndex !== -1 && currentCategoryIndex < uniqueCategories.length - 1) {
       const nextCategoryName = uniqueCategories[currentCategoryIndex + 1];
       const nextStepIndex = mergedAwardWinners.findIndex(w => w.category === nextCategoryName);
       if (nextStepIndex !== -1) {
         setAwardStep(nextStepIndex);
       }
    } else {
      // Jika ini kategori terakhir, set step ke length agar masuk ke mode Carousel
      setAwardStep(mergedAwardWinners.length); 
    }
  };

  return (
    <motion.div key="awards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-[1800px] mx-auto flex-1 h-full px-2 md:px-4 relative">

      {/* --- CONFETTI LAYER --- */}
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

      {/* --- 1. STATE: NOMINATIONS SLIDE (SINGLE VIEW) --- */}
      {visualMode === 'nominations' && currentItem && (
        <div className="w-full flex-1 flex flex-col items-center justify-center relative">
            {/* Header Kategori */}
            <div className="mb-4 md:mb-8 text-center shrink-0">
                 <div className="inline-block px-4 py-1 md:px-6 md:py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-400 font-bold uppercase tracking-[0.2em] mb-2 md:mb-4 text-xs md:text-base">
                    KATEGORI NOMINASI
                 </div>
                 <h2 className="text-2xl md:text-6xl font-black text-white drop-shadow-lg uppercase tracking-wide px-2">
                    {currentCategory}
                 </h2>
            </div>

            {/* AREA SLIDER NOMINASI */}
            <div className="flex items-center justify-center w-full max-w-6xl gap-2 md:gap-8 flex-1 min-h-0 h-full max-h-[60vh] md:max-h-[500px]">
                
                {/* Tombol Kiri */}
                <button 
                  onClick={prevNominee}
                  className="p-2 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm hover:scale-110 border border-white/10 shrink-0 z-20"
                >
                    <ChevronLeft size={24} className="md:w-8 md:h-8" />
                </button>

                {/* Kartu Nominasi Utama */}
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
                             {/* Decorative Background */}
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                             <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
                             <div className="absolute -top-20 -left-20 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl"></div>

                             <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                                 <div className="text-slate-400 font-medium tracking-widest uppercase mb-2 md:mb-6 text-xs md:text-lg shrink-0">
                                      NOMINASI {nomineeIndex + 1} DARI {categoryItems.length}
                                 </div>
                                 
                                 {/* NAMA NOMINASI DENGAN AUTO FIT HERO */}
                                 <div className="mt-2 md:mt-6 text-sm md:text-lg text-yellow-400/90 font-semibold shrink-0 w-full h-full max-h-[70%]">
                                      <AutoFitTextHero text={currentNominee.name} />
                                 </div>
                             </div>
                        </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tombol Kanan */}
                <button 
                  onClick={nextNominee}
                  className="p-2 md:p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-sm hover:scale-110 border border-white/10 shrink-0 z-20"
                >
                    <ChevronRight size={24} className="md:w-8 md:h-8" />
                </button>
            </div>

            {/* Pagination Dots */}
            <div className="flex gap-2 mt-6 md:mt-8 shrink-0">
                {categoryItems.map((_, idx) => (
                    <div 
                        key={idx}
                        className={`h-1.5 md:h-2 rounded-full transition-all duration-300 ${idx === nomineeIndex ? 'w-6 md:w-10 bg-yellow-500' : 'w-1.5 md:w-2 bg-slate-600'}`}
                    />
                ))}
            </div>

            {/* BUTTON ACTION - HANYA MUNCUL DI SLIDE TERAKHIR */}
            <div className="mt-6 md:mt-10 shrink-0 h-[60px] md:h-[80px] flex items-center justify-center">
                {nomineeIndex === categoryItems.length - 1 ? (
                    <motion.button 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={startCountdown}
                        className="px-6 py-3 md:px-10 md:py-5 bg-gradient-to-r from-yellow-600 to-yellow-500 text-slate-900 rounded-full font-black text-sm md:text-2xl hover:scale-105 hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] transition-all flex items-center gap-2 md:gap-3 uppercase tracking-wider"
                    >
                        <Shuffle size={20} className="md:w-8 md:h-8" /> ACAK & LIHAT PEMENANG
                    </motion.button>
                ) : (
                    <div className="text-slate-500 text-xs md:text-sm italic opacity-50">
                        Lanjut ke nominasi berikutnya...
                    </div>
                )}
            </div>
        </div>
      )}

      {/* --- 2. STATE: COUNTDOWN 3-2-1 --- */}
      {visualMode === 'countdown' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center overflow-hidden">
             <motion.div 
                key={countdownVal}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.5, type: "spring" }}
                className="text-[10rem] md:text-[25rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_0_100px_rgba(234,179,8,0.5)]"
             >
                {countdownVal}
             </motion.div>
        </div>
      )}

      {/* --- 3. STATE: REVEAL "SIAPAKAH DIA?" --- */}
      {visualMode === 'reveal' && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden">
             {/* Background Rays */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-[150vw] h-[150vw] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.1)_180deg,transparent_360deg)] rounded-full blur-3xl opacity-30"
                  />
             </div>

             <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="relative z-10 text-center"
             >
                <div className="text-yellow-500/80 font-bold tracking-[0.5em] uppercase text-sm md:text-xl mb-4 animate-pulse">
                    PEMENANGNYA ADALAH...
                </div>
                <h1 className="text-4xl md:text-8xl font-black text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                    SIAPAKAH DIA?
                </h1>
                <div className="mt-8 flex justify-center gap-2">
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-2 h-2 md:w-4 md:h-4 bg-yellow-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 md:w-4 md:h-4 bg-yellow-500 rounded-full" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 md:w-4 md:h-4 bg-yellow-500 rounded-full" />
                </div>
             </motion.div>
        </div>
      )}

      {/* --- 4. STATE: PODIUM REVEAL (SEPERTI KODE LAMA) --- */}
      {visualMode === 'podium' && currentItem && (
         <div className="w-full flex-1 flex flex-col items-center justify-center relative min-h-0 py-4">
             <div className="flex flex-col items-center w-full h-full max-w-7xl mx-auto justify-center">
                {/* PODIUM CONTENT */}
                <PodiumContent categoryName={currentCategory} mergedAwardWinners={categoryItems} />
                
                {/* NEXT BUTTON */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="mt-6 md:mt-12 shrink-0 pb-6 md:pb-10"
                >
                    <button
                        onClick={goToNextCategory}
                        className={`px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-xl flex items-center gap-2 md:gap-3 shadow-xl transition-transform hover:scale-105 ${
                            isLastCategory 
                            ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-cyan-500/50" 
                            : "bg-white text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                        {isLastCategory ? (
                             <>LIHAT HASIL <Grid size={20} className="md:w-7 md:h-7" /></>
                        ) : (
                             <>KATEGORI SELANJUTNYA <ChevronRight size={20} className="md:w-7 md:h-7" /></>
                        )}
                    </button>
                </motion.div>
             </div>
         </div>
      )}

      {/* --- 5. STATE: CAROUSEL (ALL FINISHED) --- */}
      {visualMode === 'carousel' && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center w-full flex-1 justify-center relative min-h-0">
            <div 
              className="w-full max-w-[1600px] mx-auto flex items-center justify-between px-1 md:px-4 mt-2 md:mt-4 relative z-20 flex-1"
              onMouseEnter={() => setIsCarouselPaused(true)}
              onMouseLeave={() => setIsCarouselPaused(false)}
            >
              <button 
                onClick={() => setCarouselIndex(prev => (prev - 1 + uniqueCategories.length) % uniqueCategories.length)}
                className="p-1 md:p-4 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
              >
                <ChevronLeft size={20} className="md:w-8 md:h-8" />
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
                        <PodiumContent categoryName={categoryName} mergedAwardWinners={catItems} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              <button 
                onClick={() => setCarouselIndex(prev => (prev + 1) % uniqueCategories.length)}
                className="p-1 md:p-4 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
              >
                <ChevronRight size={20} className="md:w-8 md:h-8" />
              </button>
            </div>
             <div className="flex items-center gap-4 mt-4 md:mt-6 shrink-0 pb-4">
              <button onClick={() => setIsCarouselPaused(!isCarouselPaused)} className="text-slate-400 hover:text-white">
                {isCarouselPaused ? <PlayCircle size={24} /> : <PauseCircle size={24} />}
              </button>
              <div className="flex gap-2">
                {uniqueCategories.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-2 rounded-full transition-all duration-300 ${idx === carouselIndex ? 'w-8 bg-yellow-500' : 'w-2 bg-slate-700'}`}
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

function PodiumContent({ categoryName, mergedAwardWinners }: { categoryName: string, mergedAwardWinners: MergedAwardWinner[] }) {
  const categoryWinners = mergedAwardWinners.filter(w => w.category === categoryName);
  const rank1 = categoryWinners.find(w => w.rank === 1);
  const rank2 = categoryWinners.find(w => w.rank === 2);
  const rank3 = categoryWinners.find(w => w.rank === 3);

  return (
    <>
      <div className="inline-block px-4 py-1 md:px-8 md:py-2 bg-slate-800/80 rounded-full border border-white/10 text-sm md:text-3xl font-bold text-white mb-4 md:mb-10 shadow-lg backdrop-blur-sm text-center tracking-widest uppercase shrink-0 max-w-full truncate">
        {categoryName}
      </div>

      <div className="flex flex-nowrap items-end justify-center gap-2 md:gap-4 w-full h-auto min-h-[30vh] flex-1 shrink-0 px-0 md:px-4 pb-12 md:pb-20">
        
        {/* RANK 2 */}
        {rank2 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-col items-center order-1 relative w-[30%] max-w-[300px]"
          >
            <div className="w-full h-[25vh] md:h-[30vh] bg-gradient-to-t from-slate-700/90 to-slate-600/30 border-t-2 border-x-2 border-slate-400/50 rounded-t-xl md:rounded-t-2xl relative flex flex-col items-center justify-between py-2 md:py-4 backdrop-blur-md shadow-lg">
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-10">
                   <div className="text-white font-bold leading-tight w-full drop-shadow-md text-center h-full flex items-center justify-center">
                     <AutoFitText text={rank2.name} />
                   </div>
               </div>
               <div className="text-3xl md:text-7xl font-black text-slate-300 opacity-60 pb-2">2</div>
            </div>
            <div className="w-8 h-8 md:w-20 md:h-20 rounded-full bg-slate-300 flex items-center justify-center text-slate-900 font-bold border-2 md:border-4 border-slate-600 shadow-xl z-10 -mt-4 md:-mt-10">
              <Medal className="text-slate-900 w-4 h-4 md:w-10 md:h-10" />
            </div>
          </motion.div>
        )}

        {/* RANK 1 */}
        {rank1 && (
          <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.5, type: 'spring', stiffness: 100 }}
              className="flex flex-col items-center order-2 z-10 relative w-[34%] max-w-[380px]"
          >
            <div className="w-full h-[32vh] md:h-[42vh] bg-gradient-to-t from-yellow-600/90 to-yellow-500/40 border-t-2 border-x-2 border-yellow-400/60 rounded-t-2xl md:rounded-t-3xl relative flex flex-col items-center justify-between py-4 backdrop-blur-md shadow-[0_0_80px_rgba(234,179,8,0.4)]">
               <div className="absolute -top-8 md:-top-16 left-1/2 -translate-x-1/2 animate-bounce z-30">
                   <Crown className="text-yellow-400 fill-yellow-400/20 w-12 h-12 md:w-20 md:h-20 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]" />
               </div>
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-20 pt-4">
                  <div className="text-white font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] w-full text-center h-full flex items-center justify-center">
                      <AutoFitText text={rank1.name} />
                  </div>
               </div>
               <div className="text-5xl md:text-9xl font-black text-yellow-300 opacity-60 pb-2">1</div>
            </div>
            <div className="w-12 h-12 md:w-28 md:h-28 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold border-2 md:border-4 border-yellow-600 shadow-2xl z-20 -mt-6 md:-mt-14 scale-110">
              <Trophy className="w-6 h-6 md:w-14 md:h-14" />
            </div>
          </motion.div>
        )}

        {/* RANK 3 */}
        {rank3 && (
          <motion.div 
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col items-center order-3 relative w-[30%] max-w-[300px]"
          >
            <div className="w-full h-[20vh] md:h-[25vh] bg-gradient-to-t from-orange-800/90 to-orange-700/30 border-t-2 border-x-2 border-orange-500/50 rounded-t-xl md:rounded-t-2xl relative flex flex-col items-center justify-between py-2 md:py-4 backdrop-blur-md shadow-lg">
               <div className="w-full flex-1 flex items-center justify-center px-1 mb-1 z-10">
                  <div className="text-white font-bold leading-tight w-full drop-shadow-md text-center h-full flex items-center justify-center">
                    <AutoFitText text={rank3.name} />
                  </div>
               </div>
               <div className="text-3xl md:text-7xl font-black text-orange-400 opacity-60 pb-2">3</div>
            </div>
            <div className="w-8 h-8 md:w-20 md:h-20 rounded-full bg-orange-700 flex items-center justify-center text-orange-100 font-bold border-2 md:border-4 border-orange-900 shadow-xl z-10 -mt-4 md:-mt-10">
              <Award className="text-orange-100 w-4 h-4 md:w-10 md:h-10" />
            </div>
          </motion.div>
        )}
      </div>
    </>
  )
}

// --- UTILS ---

// 1. AutoFitText (Untuk Podium - SEPERTI KODE LAMA AGAR TIDAK KEPOTONG)
const AutoFitText = ({ text }: { text: string }) => {
  const len = text.length;
  // Setting ukuran font yang sangat aman sesuai kode lama
  let sizeClass = "text-[10px] md:text-base leading-normal font-semibold"; 
  if (len > 20) sizeClass = "text-[9px] md:text-sm leading-snug font-medium"; 
  if (len > 35) sizeClass = "text-[8px] md:text-xs leading-tight font-medium"; 
  if (len > 50) sizeClass = "text-[7px] md:text-[11px] leading-[1.1] tracking-tight font-medium"; 
  if (len > 70) sizeClass = "text-[6px] md:text-[9px] leading-[1] tracking-tighter font-medium"; 
  if (len > 90) sizeClass = "text-[5px] md:text-[8px] leading-[.9] tracking-tighter"; 

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

// 2. AutoFitTextHero (Untuk Slide Nominasi - Ukuran Besar)
const AutoFitTextHero = ({ text }: { text: string }) => {
  const len = text.length;
  // Logika "Rata Otomatis" untuk Hero
  let sizeClass = "text-2xl md:text-5xl leading-tight font-black"; 
  
  if (len > 15) sizeClass = "text-xl md:text-4xl leading-tight font-extrabold"; 
  if (len > 30) sizeClass = "text-lg md:text-3xl leading-snug font-bold"; 
  if (len > 50) sizeClass = "text-base md:text-2xl leading-snug font-bold"; 
  if (len > 80) sizeClass = "text-sm md:text-xl leading-normal font-bold"; 
  if (len > 120) sizeClass = "text-xs md:text-lg leading-normal font-semibold";

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden px-4">
        <span 
            className={`text-center break-words whitespace-normal w-full text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 drop-shadow-sm ${sizeClass}`} 
            style={{ wordBreak: 'break-word', hyphens: 'auto' }} 
            title={text}
        >
            {text}
        </span>
    </div>
  );
};