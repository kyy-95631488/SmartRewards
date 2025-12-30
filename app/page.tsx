// app/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown, Gift, ArrowLeft, Trophy, ChevronRight, ChevronLeft,
  Medal, Zap, List, X, History, PartyPopper,
  Box, PackageOpen, Clock, Calendar, Sparkles, Lock, Save, RotateCcw,
  Volume2, VolumeX, BarChart3, PauseCircle, PlayCircle
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { db } from "./lib/firebase";
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, serverTimestamp,
  Timestamp
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
  timestamp: Timestamp | null;
  displayTime?: string;
}

// Data Structures for Awards
interface AwardNominee {
  id: string;
  name: string;
  company: string;
}

interface AwardWinnerSlot {
  id: string;
  rank: number;
  candidateId: string;
  category: string;
  eventLabel?: string;
}

interface MergedAwardWinner {
  id: string;
  rank: number;
  category: string;
  eventLabel: string;
  name: string;
  company: string;
}

interface AppConfig {
  doorprizeStart: string;
  awardStart: string;
  doorprizeStatus: "open" | "closed";
  awardStatus: "open" | "closed";
  doorprizePasscode: string;
  awardPasscode: string;
}

// Particle Type
type Particle = {
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
};

// Star Type
type Star = {
  id: number;
  top: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
};

// --- SECURITY UTILS ---
const sanitizeInput = (input: string) => {
  return input.replace(/[^a-zA-Z0-9]/g, "");
};

const getSecureRandomInt = (max: number) => {
  if (max <= 0) return 0;
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
};

export default function Home() {
  const [view, setView] = useState<"menu" | "awards" | "doorprize">("menu");
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- STATE DATA ---
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [doorprizeLog, setDoorprizeLog] = useState<WinnerLog[]>([]);

  // Awards Data
  const [awardNominees, setAwardNominees] = useState<AwardNominee[]>([]);
  const [awardSlots, setAwardSlots] = useState<AwardWinnerSlot[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [awardHistory, setAwardHistory] = useState<any[]>([]); 

  // Config
  const [config, setConfig] = useState<AppConfig>({
    doorprizeStart: "", awardStart: "",
    doorprizeStatus: "closed", awardStatus: "closed",
    doorprizePasscode: "", awardPasscode: ""
  });

  // Auth & Rate Limit
  const [passcodeModal, setPasscodeModal] = useState<"doorprize" | "awards" | null>(null);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [authorized, setAuthorized] = useState<{ doorprize: boolean; awards: boolean }>({ doorprize: false, awards: false });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // --- STATE INTERACTIVE ---
  const [isSpinning, setIsSpinning] = useState(false);
  const [rollingName, setRollingName] = useState("Ready?");
  const [showFlash, setShowFlash] = useState(false);

  // Confirmation States
  const [pendingDoorprize, setPendingDoorprize] = useState<{ winner: Participant; prize: Prize } | null>(null);
    
  // Award Reveal States
  const [pendingAward, setPendingAward] = useState<{ winner: MergedAwardWinner } | null>(null);
  const [winner, setWinner] = useState<{ name: string; prize: Prize } | null>(null);
    
  const [awardStep, setAwardStep] = useState(0);
  const [isAwardSpinning, setIsAwardSpinning] = useState(false);
  const [revealedAwardWinner, setRevealedAwardWinner] = useState<MergedAwardWinner | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<Particle[]>([]);

  // --- STATE BARU UNTUK PODIUM KATEGORI ---
  const [showCategoryPodium, setShowCategoryPodium] = useState(false);
  const [categoryPodiumName, setCategoryPodiumName] = useState<string | null>(null);

  // --- CAROUSEL STATE ---
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Memoized Stars
  const [stars] = useState<Star[]>(() => Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    size: Math.random() * 3,
    duration: Math.random() * 5 + 3,
    delay: Math.random() * 5
  })));

  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lockoutIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- AUDIO REFS & LOGIC ---
  const spinAudioRef = useRef<HTMLAudioElement | null>(null);
  const clapAudioRef = useRef<HTMLAudioElement | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgmFadeInterval = useRef<NodeJS.Timeout | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  // --- INITIALIZE VISUALS & AUDIO ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!spinAudioRef.current) {
        spinAudioRef.current = new Audio("/sounds/drumroll.mp3");
        spinAudioRef.current.loop = true;
        spinAudioRef.current.volume = 0.8;
      }
      if (!clapAudioRef.current) {
        clapAudioRef.current = new Audio("/sounds/applause.mp3");
        clapAudioRef.current.volume = 0.8;
      }
      if (!winAudioRef.current) {
        winAudioRef.current = new Audio("/sounds/win.mp3");
        winAudioRef.current.volume = 0.6;
      }
      if (!bgmAudioRef.current) {
        bgmAudioRef.current = new Audio("/sounds/backsound.mp3");
        bgmAudioRef.current.loop = true;
        bgmAudioRef.current.volume = 0.4;
      }
    }

    const startAudioOnInteraction = () => {
      if (bgmAudioRef.current && bgmAudioRef.current.paused && !isMutedRef.current) {
        bgmAudioRef.current.play().catch(e => console.log("Autoplay blocked:", e));
      }
    };

    window.addEventListener('click', startAudioOnInteraction, { once: true });
    window.addEventListener('keydown', startAudioOnInteraction, { once: true });

    return () => {
      window.removeEventListener('click', startAudioOnInteraction);
      window.removeEventListener('keydown', startAudioOnInteraction);
        
      [spinAudioRef, clapAudioRef, winAudioRef, bgmAudioRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
    }
  }, []);

  // --- IMPROVED AUDIO HELPERS ---
  const stopAllSounds = () => {
    [spinAudioRef, clapAudioRef, winAudioRef, bgmAudioRef].forEach(ref => {
        if (ref.current) {
            ref.current.pause();
            ref.current.currentTime = 0;
        }
    });
  };

  const smartPlay = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (isMutedRef.current) return; 

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  const smartStop = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => {
        const newState = !prev;
        isMutedRef.current = newState;

        if (newState) {
            stopAllSounds();
        } else {
            if (bgmAudioRef.current) {
                bgmAudioRef.current.volume = 0.4;
                bgmAudioRef.current.play().catch(() => {});
            }
        }
        return newState;
    });
  };

  // --- DUCKING SYSTEM ---
  useEffect(() => {
    const isEffectPlaying = isSpinning || isAwardSpinning;
    const targetVolume = isEffectPlaying ? 0.05 : 0.4;

    if (bgmFadeInterval.current) clearInterval(bgmFadeInterval.current);
    if (isMuted) return;

    if (bgmAudioRef.current) {
        if (bgmAudioRef.current.paused && !isMuted) {
            bgmAudioRef.current.play().catch(() => {});
        }

        bgmFadeInterval.current = setInterval(() => {
            if (!bgmAudioRef.current) return;
            const currentVol = bgmAudioRef.current.volume;
              
            // Smooth Fade Transition
            if (Math.abs(currentVol - targetVolume) < 0.02) {
                bgmAudioRef.current.volume = targetVolume;
                if (bgmFadeInterval.current) clearInterval(bgmFadeInterval.current);
            } else if (currentVol > targetVolume) {
                bgmAudioRef.current.volume = Math.max(0, currentVol - 0.05); // Fade out cepat
            } else {
                bgmAudioRef.current.volume = Math.min(1, currentVol + 0.02); // Fade in halus
            }
        }, 50);
    }
      
    return () => {
        if (bgmFadeInterval.current) clearInterval(bgmFadeInterval.current);
    }
  }, [isSpinning, isAwardSpinning, isMuted]);

  const resetAll = () => {
    setWinner(null);
    setRevealedAwardWinner(null);
    setRollingName("Ready?");
    setPendingDoorprize(null);
    setPendingAward(null);
    setConfettiParticles([]);
    setShowFlash(false);
    setShowCategoryPodium(false);
    setCategoryPodiumName(null);
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    smartStop(spinAudioRef);
    smartStop(clapAudioRef);
    smartStop(winAudioRef);
  };

  const generateConfetti = (amount = 150) => {
    const colors = ['bg-pink-500', 'bg-cyan-400', 'bg-yellow-400', 'bg-purple-500', 'bg-white', 'bg-green-400', 'bg-red-500'];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return Array.from({ length: amount }).map((_) => ({
      id: Math.random(),
      x: Math.random() * 100,
      y: -20 - Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      width: Math.random() * 10 + 5,
      height: Math.random() * 20 + 10,
      rotation: Math.random() * 360,
      sway: (Math.random() - 0.5) * 50,
      duration: 2 + Math.random() * 3,
      delay: Math.random() * 0.5
    }));
  };

  const triggerCelebration = () => {
    setConfettiParticles([]);
    smartStop(clapAudioRef);
    smartPlay(winAudioRef);
    setTimeout(() => {
      setConfettiParticles(generateConfetti(200));
    }, 50);
  };

  const triggerFlashEffect = () => {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 300);
  }

  // --- FETCH DATA ---
  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "settings", "config"), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as AppConfig;
        setConfig(data);
        const savedDoorprizeCode = localStorage.getItem("doorprize_passcode");
        const savedAwardCode = localStorage.getItem("awards_passcode");
        setAuthorized({
          doorprize: savedDoorprizeCode === data.doorprizePasscode,
          awards: savedAwardCode === data.awardPasscode
        });
      }
    });

    const unsubParticipants = onSnapshot(collection(db, "doorprize_participants"), (snapshot) => {
      setParticipants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Participant)));
    });

    const unsubPrizes = onSnapshot(collection(db, "prizes"), (snapshot) => {
      setPrizes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prize)));
    });

    const qHistory = query(collection(db, "doorprize_winners"), orderBy("timestamp", "desc"));
    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id, ...data,
          displayTime: data.timestamp ? new Date(data.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"
        } as WinnerLog;
      });
      setDoorprizeLog(logs);
    });

    const unsubAwardSlots = onSnapshot(collection(db, "award_winners"), (snapshot) => {
      setAwardSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AwardWinnerSlot)));
    });

    const unsubAwardNominees = onSnapshot(collection(db, "award_nominees"), (snapshot) => {
      setAwardNominees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AwardNominee)));
      setLoading(false);
    });

    const unsubAwardHistory = onSnapshot(collection(db, "award_history"), (snapshot) => {
      const history = snapshot.docs.map(d => d.data());
      setAwardHistory(history);
      if (history.length > 0) {
          setAwardStep(history.length);
      } else {
          setAwardStep(0);
      }
    });

    return () => {
      unsubConfig(); unsubParticipants(); unsubPrizes(); unsubHistory();
      unsubAwardSlots(); unsubAwardNominees(); unsubAwardHistory();
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
    };
  }, [view]);

  // --- CHECK LOCKOUT ---
  useEffect(() => {
    const checkLock = () => {
      const lockoutTimestamp = localStorage.getItem("lockout_timestamp");
      if (lockoutTimestamp) {
        const timeRemaining = Math.ceil((parseInt(lockoutTimestamp) - Date.now()) / 1000);
        if (timeRemaining > 0) {
          setIsLockedOut(true);
          setLockoutTimer(timeRemaining);
            
          if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
          lockoutIntervalRef.current = setInterval(() => {
            setLockoutTimer((prev) => {
              if (prev <= 1) {
                if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
                setIsLockedOut(false);
                setFailedAttempts(0);
                localStorage.removeItem("lockout_timestamp");
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          localStorage.removeItem("lockout_timestamp");
          setIsLockedOut(false);
          setFailedAttempts(0);
        }
      }
    };
    checkLock();
    return () => { if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current); }
  }, []);

  // --- MERGE AWARDS DATA ---
  const mergedAwardWinners = useMemo<MergedAwardWinner[]>(() => {
    const filledSlots = awardSlots.filter(s => s.candidateId && s.candidateId !== "");
      
    return filledSlots.map(slot => {
      const nominee = awardNominees.find(c => c.id === slot.candidateId);
      return {
        id: slot.id,
        rank: slot.rank,
        category: slot.category,
        eventLabel: slot.eventLabel || "Main Event",
        name: nominee ? nominee.name : "Unknown",
        company: nominee ? nominee.company : "-"
      };
    }).sort((a, b) => {
        if (a.eventLabel < b.eventLabel) return -1;
        if (a.eventLabel > b.eventLabel) return 1;
        if (a.category < b.category) return -1;
        if (a.category > b.category) return 1;
        return b.rank - a.rank; // Descending (3, 2, 1)
    });
  }, [awardSlots, awardNominees]);

  // --- CAROUSEL LOGIC ---
  const uniqueCategories = useMemo(() => Array.from(new Set(mergedAwardWinners.map(w => w.category))), [mergedAwardWinners]);

  useEffect(() => {
      // Auto-slide logic
      if (view === "awards" && awardStep >= mergedAwardWinners.length && !isCarouselPaused && uniqueCategories.length > 1) {
          const interval = setInterval(() => {
              setCarouselIndex(prev => (prev + 1) % uniqueCategories.length);
          }, 8000); // Ganti slide tiap 8 detik
          return () => clearInterval(interval);
      }
  }, [view, awardStep, mergedAwardWinners.length, isCarouselPaused, uniqueCategories.length]);

  const totalItemsRemaining = useMemo(() => prizes.reduce((acc, curr) => acc + curr.stock, 0), [prizes]);
    
  const isAwardCompleted = useMemo(() => {
      return mergedAwardWinners.length > 0 && awardHistory.length >= mergedAwardWinners.length;
  }, [mergedAwardWinners, awardHistory]);

  const isDoorprizeCompleted = useMemo(() => {
      return prizes.length > 0 && totalItemsRemaining === 0;
  }, [prizes, totalItemsRemaining]);

  // --- AUTH NAVIGATION ---
  const handleAccessRequest = (targetView: "awards" | "doorprize") => {
    if (targetView === "awards" && isAwardCompleted) { 
        setView(targetView); 
        return; 
    }
    if (targetView === "doorprize" && isDoorprizeCompleted) { 
        setView(targetView); 
        return; 
    }
    
    const status = targetView === "doorprize" ? config.doorprizeStatus : config.awardStatus;
    if (status === "closed") { alert("Sesi ini belum dibuka oleh Admin."); return; }
    
    if (authorized[targetView]) { setView(targetView); }
    else { 
        setPasscodeModal(targetView); 
        setPasscodeInput("");
    }
  };

  const submitPasscode = () => {
    if (!passcodeModal) return;
    if (isLockedOut) return;

    const correctCode = passcodeModal === "doorprize" ? config.doorprizePasscode : config.awardPasscode;
    const sanitizedInput = sanitizeInput(passcodeInput);

    if (sanitizedInput === correctCode) {
      localStorage.setItem(`${passcodeModal}_passcode`, correctCode);
      setAuthorized(prev => ({ ...prev, [passcodeModal]: true }));
      setView(passcodeModal);
      setPasscodeModal(null);
      setFailedAttempts(0);
      localStorage.removeItem("lockout_timestamp");
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      setPasscodeInput("");
        
      if (newAttempts >= 5) {
          const lockoutDuration = 30;
          const unlockTime = Date.now() + (lockoutDuration * 1000);
          localStorage.setItem("lockout_timestamp", unlockTime.toString());
          setIsLockedOut(true);
          setLockoutTimer(lockoutDuration);
          alert("Terlalu banyak percobaan salah. Sistem dikunci selama 30 detik.");
      } else {
          alert(`Passcode Salah! Percobaan ${newAttempts}/5`);
      }
    }
  };

  // --- AWARDS LOGIC ---
  const handleAwardReveal = () => {
    const currentWinnerData = mergedAwardWinners[awardStep];
    if (isAwardSpinning || !currentWinnerData) return;

    setIsAwardSpinning(true);
    setRevealedAwardWinner(null);
    setConfettiParticles([]);
    smartPlay(spinAudioRef);

    spinIntervalRef.current = setInterval(() => {
      const randomName = awardNominees.length > 0
        ? awardNominees[Math.floor(Math.random() * awardNominees.length)].name
        : "Calculating...";
      setRollingName(randomName);
    }, 50);

    setTimeout(() => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      smartStop(spinAudioRef);
      smartPlay(clapAudioRef);

      triggerFlashEffect();
      setRollingName(currentWinnerData.name);
      setIsAwardSpinning(false);
      setPendingAward({ winner: currentWinnerData });
    }, 3000);
  };

  const confirmAwardWinner = async () => {
    if (!pendingAward) return;
    smartPlay(winAudioRef);
      
    setRevealedAwardWinner(pendingAward.winner);
    setConfettiParticles(generateConfetti(300));
    triggerFlashEffect();
    setPendingAward(null);

    try {
        await addDoc(collection(db, "award_history"), {
            name: pendingAward.winner.name,
            company: pendingAward.winner.company,
            category: pendingAward.winner.category,
            rank: pendingAward.winner.rank,
            eventLabel: pendingAward.winner.eventLabel,
            timestamp: serverTimestamp()
        });
        console.log("Award saved to history DB");
    } catch (error) {
        console.error("Failed to save award history:", error);
    }
    setAwardStep(prev => prev + 1);
  };

  const retryAward = () => {
    setPendingAward(null);
    setRollingName("Ready?");
    smartStop(clapAudioRef);
    smartStop(winAudioRef);
  };

  // --- DOORPRIZE LOGIC ---
  const handleDoorprizeSpin = async () => {
    const availablePrizes = prizes.filter(p => p.stock > 0);
    const previousWinnerNames = doorprizeLog.map(log => log.name);
    const eligibleParticipants = participants.filter(p => !previousWinnerNames.includes(p.name));

    if (isSpinning || availablePrizes.length === 0 || eligibleParticipants.length === 0) {
      if (participants.length === 0) alert("Data peserta kosong!");
      else if (eligibleParticipants.length === 0) alert("Semua peserta sudah mendapatkan hadiah!");
      else if (availablePrizes.length === 0) alert("Stok hadiah habis!");
      return;
    }

    setIsSpinning(true);
    setWinner(null);
    setPendingDoorprize(null);
    setConfettiParticles([]);
    smartPlay(spinAudioRef);

    spinIntervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * participants.length);
      setRollingName(participants[randomIndex].name);
    }, 50);

    setTimeout(async () => {
      if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);
      smartStop(spinAudioRef);
      smartPlay(clapAudioRef);

      const randomWinnerIndex = getSecureRandomInt(eligibleParticipants.length);
      const finalWinner = eligibleParticipants[randomWinnerIndex];

      const prizePool: Prize[] = [];
      availablePrizes.forEach(prize => {
        for (let i = 0; i < prize.stock; i++) { prizePool.push(prize); }
      });
      const randomPrizeIndex = getSecureRandomInt(prizePool.length);
      const selectedPrize = prizePool[randomPrizeIndex];
        
      if(!finalWinner || !selectedPrize) {
          alert("Terjadi kesalahan kalkulasi. Silakan coba lagi.");
          setIsSpinning(false);
          setRollingName("Error");
          return;
      }

      triggerFlashEffect();
      setRollingName(finalWinner.name);
      setIsSpinning(false);
      setPendingDoorprize({ winner: finalWinner, prize: selectedPrize });
    }, 4000);
  };

  const confirmDoorprizeWinner = async () => {
    if (!pendingDoorprize) return;
    const { winner: winParticipant, prize } = pendingDoorprize;
    
    smartPlay(winAudioRef);
    triggerFlashEffect();

    setWinner({ name: winParticipant.name, prize: prize });
    setConfettiParticles(generateConfetti(200));

    try {
      const prizeRef = doc(db, "prizes", prize.id);
      await updateDoc(prizeRef, { stock: prize.stock - 1 });
      await addDoc(collection(db, "doorprize_winners"), {
        name: winParticipant.name,
        prizeName: prize.name,
        prizeImage: prize.image_url || "",
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving winner:", error);
      alert("Gagal menyimpan data ke server. Cek koneksi.");
    }
    setPendingDoorprize(null);
  };

  const retryDoorprize = () => {
    setPendingDoorprize(null);
    setRollingName("Ready?");
    setWinner(null);
    smartStop(clapAudioRef);
    smartStop(winAudioRef);
  };

  const modalData = useMemo(() => view === "awards" ? awardNominees : participants, [view, awardNominees, participants]);
  const modalTitle = view === "awards" ? "Daftar Nominee Awards" : "Peserta Doorprize";

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
    <main className="min-h-screen relative flex flex-col items-center py-4 md:py-10 overflow-y-auto overflow-x-hidden font-sans text-slate-100 bg-slate-950 selection:bg-blue-500 selection:text-white">

      {/* --- FLASH EFFECT --- */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[100] bg-white pointer-events-none mix-blend-overlay will-change-[opacity]"
          />
        )}
      </AnimatePresence>

      {/* --- BACKGROUND SYSTEM --- */}
      <div className="fixed inset-0 pointer-events-none z-0 transform-gpu">
        <div className="absolute inset-0 bg-slate-950"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-900/20 rounded-full blur-[150px] animate-pulse transform-gpu will-change-transform"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-purple-900/20 rounded-full blur-[150px] animate-pulse transform-gpu will-change-transform" style={{ animationDelay: '2s' }}></div>

        <div className="absolute inset-0 w-full h-full">
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute bg-white rounded-full opacity-20 animate-pulse will-change-[opacity]"
              style={{
                top: `${star.top}%`,
                left: `${star.left}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDuration: `${star.duration}s`,
                animationDelay: `${star.delay}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* --- AUDIO TOGGLE --- */}
      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100]">
        <button
          onClick={toggleMute}
          className="w-10 h-10 md:w-12 md:h-12 bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-slate-700 hover:scale-110 transition-all shadow-lg group"
        >
          {isMuted ? <VolumeX size={18} className="text-red-400 md:w-5 md:h-5" /> : <Volume2 size={18} className="text-green-400 animate-pulse md:w-5 md:h-5" />}
        </button>
      </div>

      {/* --- MODAL PASSCODE --- */}
      <AnimatePresence>
        {passcodeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-slate-900 border border-white/10 p-6 md:p-8 rounded-3xl max-w-md w-full text-center relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10"></div>
              <div className="relative z-10">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 border border-white/10">
                  <Lock className="text-white" size={24} />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Restricted Access</h3>
                <p className="text-slate-400 mb-6 text-xs md:text-sm">Masukkan passcode untuk halaman {passcodeModal}.</p>

                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(sanitizeInput(e.target.value))}
                  disabled={isLockedOut}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 md:p-4 text-center text-white text-lg tracking-[0.2em] md:tracking-[0.5em] mb-4 focus:ring-2 focus:ring-blue-500 outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={isLockedOut ? `LOCKED (${lockoutTimer}s)` : "••••••"}
                  autoFocus
                />

                <div className="flex gap-3">
                  <button onClick={() => { setPasscodeModal(null); }} className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold transition-colors text-sm md:text-base">Batal</button>
                  <button onClick={submitPasscode} disabled={isLockedOut} className="flex-1 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-bold transition-colors shadow-lg shadow-blue-500/20 disabled:bg-slate-700 disabled:shadow-none text-sm md:text-base">Buka</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL KONFIRMASI (DOORPRIZE & AWARDS) --- */}
      <AnimatePresence>
        {(pendingDoorprize || pendingAward) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
            
            {/* GOD RAYS BACKDROP */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute z-0 w-[800px] h-[800px] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.2)_180deg,transparent_360deg)] rounded-full blur-3xl opacity-50 pointer-events-none transform-gpu will-change-transform"
            />
            
            {/* MODAL CONTAINER */}
            <motion.div 
              initial={{ scale: 0.5, y: 100 }} 
              animate={{ scale: 1, y: 0 }} 
              className="bg-slate-900 border-2 border-yellow-500/50 p-6 md:p-10 rounded-[2rem] max-w-3xl w-full text-center relative overflow-hidden shadow-[0_0_80px_rgba(234,179,8,0.3)] z-10 m-auto flex flex-col items-center justify-center"
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
              <div className="relative z-10 w-full flex flex-col items-center">
                <div className="text-yellow-400 font-bold tracking-widest uppercase mb-6 animate-pulse text-xs md:text-sm">Konfirmasi Hasil</div>

                {/* --- DOORPRIZE CONFIRMATION --- */}
                {pendingDoorprize && (
                  <div className="flex flex-col items-center justify-center w-full">
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-md break-words w-full leading-tight text-center">
                        {pendingDoorprize.winner.name}
                    </h2>
                    <div className="h-1 w-24 bg-gradient-to-r from-transparent via-cyan-500 to-transparent my-4"></div>

                    <div className="w-full bg-slate-950/50 rounded-2xl p-6 border border-white/5 mb-8 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8">
                        <div className="flex justify-center shrink-0">
                            {pendingDoorprize.prize.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={pendingDoorprize.prize.image_url} alt="" className="h-32 md:h-40 w-auto rounded-lg object-contain drop-shadow-lg" />
                            ) : (
                                <Gift className="text-slate-600" size={80} />
                            )}
                        </div>
                        
                        <div className="text-center md:text-left flex flex-col items-center md:items-start">
                           <p className="text-slate-400 text-sm mb-1 uppercase tracking-wider">Mendapatkan Hadiah:</p>
                           <h3 className="text-xl md:text-3xl font-bold text-cyan-400 leading-tight">
                                {pendingDoorprize.prize.name}
                           </h3>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full mx-auto">
                      <button onClick={retryDoorprize} className="flex-1 py-3 md:py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2 text-sm md:text-base transition-all"><RotateCcw size={18} /> Spin Ulang</button>
                      <button onClick={confirmDoorprizeWinner} className="flex-1 py-3 md:py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-slate-900 hover:scale-105 font-bold flex items-center justify-center gap-2 shadow-lg text-sm md:text-base transition-all"><Save size={18} /> SAH & SIMPAN</button>
                    </div>
                  </div>
                )}

                {/* --- AWARDS CONFIRMATION --- */}
                {pendingAward && (
                  <div className="flex flex-col items-center w-full">
                    <div className="flex items-center justify-center gap-3 mb-4">
                        <Crown className="text-yellow-400" size={32} />
                        <h3 className="text-xl md:text-2xl text-yellow-200">{pendingAward.winner.category}</h3>
                    </div>
                    
                    <div className="inline-block px-4 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full text-xs md:text-sm text-yellow-400 font-bold uppercase tracking-wider mb-6">
                        JUARA {pendingAward.winner.rank}
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-black text-white mb-3 drop-shadow-lg break-words w-full leading-tight text-center">
                      {pendingAward.winner.name}
                    </h2>

                    <div className="mb-10"></div> 

                    <div className="flex flex-col sm:flex-row gap-4 w-full mx-auto">
                      <button onClick={retryAward} className="flex-1 py-3 md:py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2 text-sm md:text-base transition-all"><RotateCcw size={18} /> Batal</button>
                      <button onClick={confirmAwardWinner} className="flex-1 py-3 md:py-4 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 text-slate-900 hover:scale-105 font-bold flex items-center justify-center gap-2 shadow-lg text-sm md:text-base transition-all"><Save size={18} /> SAH & REVEAL</button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MODAL DAFTAR PESERTA --- */}
      <AnimatePresence>
        {showParticipantModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="bg-slate-900/80 rounded-3xl w-full max-w-3xl h-[85vh] flex flex-col border border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.3)] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 pointer-events-none"></div>

              <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                <h3 className="text-lg md:text-xl font-bold text-white flex items-center gap-3"><List className="text-blue-400" /> {modalTitle}</h3>
                <button onClick={() => setShowParticipantModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar relative z-10">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[300px]">
                    <thead>
                        <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-white/10">
                        <th className="py-4 px-2 md:px-4 font-semibold w-12 md:w-16">No</th>
                        <th className="py-4 px-2 md:px-4 font-semibold">Nama Kandidat</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {modalData.map((p, i) => (
                        <tr key={p.id} className="hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group">
                            <td className="py-3 px-2 md:px-4 text-slate-500 font-mono group-hover:text-blue-400 transition-colors">{i + 1}</td>
                            <td className="py-3 px-2 md:px-4 font-medium text-slate-200 group-hover:text-white">{p.name}</td>
                        </tr>
                        ))}
                        {modalData.length === 0 && (
                        <tr><td colSpan={2} className="text-center py-12 text-slate-500">Database Kosong</td></tr>
                        )}
                    </tbody>
                    </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[1400px] px-4 md:px-8 z-10 relative">

        {/* --- NAVIGATION --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 gap-3 md:gap-4">
          <div className="flex items-center w-full md:w-auto">
            {view !== "menu" && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => { setView("menu"); resetAll(); }}
                className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all group backdrop-blur-sm w-full md:w-auto justify-center md:justify-start"
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
                className="flex items-center justify-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm font-medium text-sm w-full md:w-auto"
              >
                <List size={18} /> <span>Database ({modalData.length})</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* VIEW: MAIN MENU */}
          {view === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-8 md:gap-12 mt-4 md:mt-10">

              <div className="text-center relative px-2">
                <div className="absolute -inset-10 bg-blue-500/20 blur-3xl rounded-full transform-gpu"></div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="relative">
                  <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-slate-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] tracking-tighter">GATHERING 2025</h1>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="h-px w-8 md:w-12 bg-blue-500/50"></div>
                    <p className="text-base sm:text-lg md:text-2xl text-blue-300 font-light tracking-[0.3em] uppercase">Annual Celebration</p>
                    <div className="h-px w-8 md:w-12 bg-blue-500/50"></div>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 w-full max-w-7xl px-4">
                {/* CARD 1: AWARDS */}
                <button onClick={() => handleAccessRequest("awards")} className="group relative h-64 md:h-80 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(234,179,8,0.2)] text-left">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 h-full p-6 md:p-10 flex flex-col justify-end">
                    <Medal className="absolute top-6 right-6 md:top-8 md:right-8 text-yellow-500/20 w-24 h-24 md:w-48 md:h-48 group-hover:text-yellow-500/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 transform-gpu" />
                    <div className="space-y-2 relative z-20 max-w-[75%]">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isAwardCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'}`}>
                        {isAwardCompleted ? <><Sparkles size={12} /> COMPLETED</> : (config.awardStatus === 'closed' ? <><Lock size={12} /> Locked</> : <><Sparkles size={12} /> Awards</>)}
                      </div>
                      <h2 className="text-2xl md:text-5xl font-bold text-white group-hover:text-yellow-200 transition-colors">Awards</h2>
                      <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-sm md:text-lg">Pengungkapan penghargaan kategori terbaik tahun ini.</p>
                    </div>
                  </div>
                </button>

                {/* CARD 2: DOORPRIZE */}
                <button onClick={() => handleAccessRequest("doorprize")} className="group relative h-64 md:h-80 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(6,182,212,0.2)] text-left">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 h-full p-6 md:p-10 flex flex-col justify-end">
                    <Gift className="absolute top-6 right-6 md:top-8 md:right-8 text-cyan-500/20 w-24 h-24 md:w-48 md:h-48 group-hover:text-cyan-500/40 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 transform-gpu" />
                    <div className="space-y-2 relative z-20 max-w-[75%]">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isDoorprizeCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
                        {isDoorprizeCompleted ? <><Zap size={12} /> SOLD OUT</> : (config.doorprizeStatus === 'closed' ? <><Lock size={12} /> Locked</> : <><Zap size={12} /> Lucky Draw</>)}
                      </div>
                      <h2 className="text-2xl md:text-5xl font-bold text-white group-hover:text-cyan-200 transition-colors">Doorprize</h2>
                      <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-sm md:text-lg">Putaran keberuntungan berhadiah menarik untuk semua.</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* VIEW: AWARDS REVEAL */}
          {view === "awards" && (
            <motion.div key="awards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center w-full max-w-6xl mx-auto">

              <CountdownTimer targetDate={config.awardStart} title="Waktu Menuju Awards" theme="gold" />

              <div className="w-full min-h-[400px] mb-8 md:mb-12 flex flex-col items-center justify-center relative perspective-1000">

                {/* 1. STATE: BELUM REVEAL */}
                {!isAwardSpinning && !revealedAwardWinner && !pendingAward && !showCategoryPodium && awardStep < mergedAwardWinners.length && (
                  <div className="bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-16 border border-white/10 text-center w-full max-w-3xl hover:border-yellow-500/50 transition-all shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                      <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-6 md:mb-8 bg-slate-800 rounded-full flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                        <Trophy className="text-yellow-500 w-8 h-8 md:w-10 md:h-10 animate-pulse" />
                      </div>
                      <h3 className="text-xl md:text-3xl font-bold text-white mb-2">{mergedAwardWinners[awardStep].category}</h3>
                      <h2 className="text-2xl md:text-5xl font-black text-yellow-400 mb-6 uppercase tracking-wider">
                          JUARA {mergedAwardWinners[awardStep].rank}
                      </h2>
                      <p className="text-slate-400 text-sm md:text-lg mb-8 max-w-lg mx-auto">
                          Sistem telah menerima data pemenang dari Panel. Klik tombol di bawah untuk mengungkap identitas pemenang.
                      </p>
                      <TimeDependentButton
                        targetDate={config.awardStart}
                        onClick={handleAwardReveal}
                        text="UNGKAP PEMENANG"
                        icon={<Sparkles size={20} className="inline mr-2" />}
                        theme="gold"
                      />
                    </div>
                  </div>
                )}

                {/* 2. STATE: SPINNING / PENDING */}
                {(isAwardSpinning || pendingAward) && (
                  <div className="w-full max-w-4xl min-h-[400px] py-10 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 bg-yellow-500/5 blur-[100px] rounded-full animate-pulse transform-gpu"></div>
                    {isAwardSpinning ? (
                      <div className="text-yellow-500 font-mono text-xs md:text-sm tracking-[0.5em] mb-6 animate-pulse uppercase relative z-10">Mengungkap Data...</div>
                    ) : (
                      <div className="text-green-400 font-mono text-xs md:text-sm tracking-[0.5em] mb-6 uppercase relative z-10">Winner Found!</div>
                    )}
                    <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 blur-[1px] animate-pulse text-center leading-snug break-words will-change-[opacity,transform] relative z-10 p-2">
                      {rollingName}
                    </h2>

                  </div>
                )}

                {/* 3. STATE: REVEALED (SINGLE WINNER) */}
                {revealedAwardWinner && !showCategoryPodium && (
                  <div className="relative w-full max-w-4xl px-4">
                    {/* GOD RAYS & CONFETTI */}
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }} className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.1)_90deg,transparent_180deg)] rounded-full z-0 pointer-events-none transform-gpu will-change-transform" />
                    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden h-[200%] -top-[50%]">
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

                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, rotateX: 90 }}
                      animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                      transition={{ type: "spring", bounce: 0.4, duration: 1.5 }}
                      className="bg-gradient-to-br from-slate-900 to-black rounded-[2rem] md:rounded-[3rem] p-1 border border-yellow-500/50 shadow-[0_0_100px_rgba(234,179,8,0.3)] relative overflow-hidden z-10 w-full"
                    >
                      <div className="bg-slate-950/80 backdrop-blur-3xl rounded-[1.8rem] md:rounded-[2.8rem] p-6 md:p-12 text-center flex flex-col items-center gap-6 md:gap-10 relative z-10">
                        <div className="relative shrink-0">
                          <div className="absolute inset-0 bg-yellow-500 blur-[60px] opacity-40 animate-pulse transform-gpu"></div>
                          <Medal className="text-yellow-400 w-32 h-32 md:w-48 md:h-48 drop-shadow-2xl relative z-10" strokeWidth={1} />
                          <div className="absolute inset-0 flex items-center justify-center z-20 pt-4">
                            <span className="text-5xl md:text-8xl font-black text-white drop-shadow-md">#{revealedAwardWinner.rank}</span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 w-full flex flex-col items-center justify-center">
                          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="w-full flex flex-col items-center">
                            
                            <div className="inline-block px-4 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-full text-xs md:text-sm font-bold uppercase tracking-wider mb-4">
                              {revealedAwardWinner.category}
                            </div>
                            
                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-tight mb-2 md:mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-100 to-yellow-500 drop-shadow-lg break-words w-full px-2 hyphens-auto">
                              {revealedAwardWinner.name}
                            </h1>
    
                            <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent mb-8"></div>

                            {/* LOGIC BUTTON: Check Category Transition */}
                            {(() => {
                                const isNextAvailable = awardStep < mergedAwardWinners.length;
                                // Jika kategori berubah ATAU ini adalah pemenang terakhir (semua award selesai)
                                const isCategoryFinished = (isNextAvailable && mergedAwardWinners[awardStep].category !== revealedAwardWinner.category) || !isNextAvailable;

                                if (isCategoryFinished) {
                                    // TOMBOL LIHAT PODIUM (Jika kategori berubah ATAU ini terakhir)
                                    return (
                                        <button 
                                            onClick={() => {
                                                setCategoryPodiumName(revealedAwardWinner.category);
                                                setShowCategoryPodium(true);
                                            }} 
                                            className="w-full md:w-auto px-8 md:px-10 py-3 md:py-4 bg-purple-600 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-purple-500 hover:scale-105 transition-all shadow-lg text-sm md:text-base animate-pulse"
                                        >
                                            <BarChart3 size={20} /> LIHAT PODIUM KATEGORI
                                        </button>
                                    );
                                } else {
                                    // TOMBOL LANJUT BIASA (Jika kategori masih sama dan belum habis)
                                    return (
                                        <button onClick={handleAwardReveal} className="w-full md:w-auto px-8 md:px-10 py-3 md:py-4 bg-white text-slate-900 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-yellow-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] text-sm md:text-base">
                                            Lanjut: {mergedAwardWinners[awardStep].category} (Rank #{mergedAwardWinners[awardStep].rank}) <ChevronRight size={20} />
                                        </button>
                                    );
                                }
                            })()}
                          </motion.div>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
                
                {/* 4. STATE: CATEGORY PODIUM (INTERMEDIATE) */}
                {showCategoryPodium && categoryPodiumName && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center w-full">
                      <div className="w-full flex flex-col gap-10 pb-10">
                        {/* Only Render Specific Category */}
                        {(() => {
                           const categoryWinners = mergedAwardWinners.filter(w => w.category === categoryPodiumName);
                           const rank1 = categoryWinners.find(w => w.rank === 1);
                           const rank2 = categoryWinners.find(w => w.rank === 2);
                           const rank3 = categoryWinners.find(w => w.rank === 3);
                           
                           return (
                             <div className="flex flex-col items-center">
                                <div className="inline-block px-6 py-2 bg-gradient-to-r from-purple-900 to-slate-900 rounded-full border border-purple-500/50 text-xl md:text-2xl font-bold text-white mb-8 shadow-[0_0_30px_rgba(168,85,247,0.4)] backdrop-blur-sm uppercase tracking-widest">
                                    PODIUM: {categoryPodiumName}
                                </div>
                                 
                                <div className="flex flex-wrap items-end justify-center gap-4 md:gap-8 min-h-[350px]">
                                    {/* RANK 2 */}
                                    {rank2 && (
                                      <div className="flex flex-col items-center order-2 md:order-1">
                                          <div className="text-center mb-3">
                                            <div className="text-white font-bold text-sm md:text-base">{rank2.name}</div>
                                          </div>
                                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="w-24 md:w-32 h-32 md:h-48 bg-gradient-to-t from-slate-700/80 to-slate-500/20 border-t border-x border-slate-500/50 rounded-t-xl relative flex items-end justify-center pb-4 backdrop-blur-md shadow-[0_0_30px_rgba(148,163,184,0.1)]">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"></div>
                                            <div className="text-4xl md:text-5xl font-black text-slate-300 opacity-50">2</div>
                                          </motion.div>
                                          <div className="mt-4 w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-300 flex items-center justify-center text-slate-900 font-bold border-4 border-slate-700 shadow-lg z-10 -mt-10">
                                              <span className="text-xl">#2</span>
                                          </div>
                                      </div>
                                    )}

                                    {/* RANK 1 */}
                                    {rank1 && (
                                      <div className="flex flex-col items-center order-1 md:order-2 z-10">
                                          <div className="text-center mb-16 relative z-20">
                                            <div className="text-yellow-300 font-bold text-lg md:text-xl drop-shadow-md">{rank1.name}</div>
                                          </div>
                                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="w-28 md:w-40 h-40 md:h-64 bg-gradient-to-t from-yellow-700/80 to-yellow-500/20 border-t border-x border-yellow-500/50 rounded-t-xl relative flex items-end justify-center pb-4 backdrop-blur-md shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-yellow-200/40"></div>
                                            <div className="absolute -top-10 animate-bounce">
                                                <Crown className="text-yellow-400 fill-yellow-400/20" size={40} />
                                            </div>
                                            <div className="text-5xl md:text-7xl font-black text-yellow-500 opacity-50">1</div>
                                          </motion.div>
                                          <div className="mt-4 w-16 h-16 md:w-20 md:h-20 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold border-4 border-yellow-600 shadow-xl z-10 -mt-12 scale-110">
                                              <Trophy size={28} />
                                          </div>
                                      </div>
                                    )}

                                    {/* RANK 3 */}
                                    {rank3 && (
                                      <div className="flex flex-col items-center order-3">
                                          <div className="text-center mb-3">
                                            <div className="text-white font-bold text-sm md:text-base">{rank3.name}</div>
                                          </div>
                                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="w-24 md:w-32 h-24 md:h-36 bg-gradient-to-t from-orange-800/80 to-orange-600/20 border-t border-x border-orange-500/50 rounded-t-xl relative flex items-end justify-center pb-4 backdrop-blur-md shadow-[0_0_30px_rgba(194,65,12,0.1)]">
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20"></div>
                                            <div className="text-4xl md:text-5xl font-black text-orange-400 opacity-50">3</div>
                                          </motion.div>
                                          <div className="mt-4 w-12 h-12 md:w-16 md:h-16 rounded-full bg-orange-400 flex items-center justify-center text-orange-900 font-bold border-4 border-orange-700 shadow-lg z-10 -mt-10">
                                              <span className="text-xl">#3</span>
                                          </div>
                                      </div>
                                    )}
                                </div>
                             </div>
                            )
                        })()}
                        
                        <div className="flex justify-center mt-10">
                            <button 
                                onClick={() => {
                                    // PERBAIKAN DI SINI:
                                    // Selalu reset revealedAwardWinner agar tampilan tidak loop ke pemenang sebelumnya
                                    setShowCategoryPodium(false);
                                    setCategoryPodiumName(null);
                                    setRevealedAwardWinner(null); 
                                }} 
                                className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold flex items-center gap-2 hover:bg-slate-200 shadow-lg transition-transform hover:scale-105"
                            >
                                {awardStep >= mergedAwardWinners.length ? (
                                  <> <PartyPopper size={20} /> SELESAI & REKAP </>
                                ) : (
                                  <> LANJUT KE KATEGORI BERIKUTNYA <ArrowLeft className="rotate-180" size={20} /> </>
                                )}
                            </button>
                        </div>
                      </div>
                  </motion.div>
                )}

                {/* 5. STATE: ALL COMPLETED - GLOBAL PODIUM (CAROUSEL MODE) */}
                {!isAwardSpinning && !revealedAwardWinner && !pendingAward && !showCategoryPodium && awardStep >= mergedAwardWinners.length && (
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center w-full min-h-[70vh] justify-center relative">
                    
                    {/* Confetti Background for Celebration */}
                    <div className="absolute inset-0 pointer-events-none z-[60]">
                        {confettiParticles.map((p, i) => (
                        <motion.div
                            key={i}
                            initial={{ y: -50, x: 0, opacity: 1, rotate: 0 }}
                            animate={{ y: '100vh', x: p.sway, rotateX: p.rotation * 2, rotateY: p.rotation * 2, rotateZ: p.rotation }}
                            transition={{ duration: p.duration, delay: p.delay, ease: "linear" }}
                            className={`absolute ${p.color} will-change-transform`}
                            style={{ left: `${p.x}%`, width: p.width, height: p.height }}
                        />
                        ))}
                    </div>

                    {/* CAROUSEL CONTAINER - FULL WIDTH */}
                    <div 
                      className="w-full max-w-[1600px] mx-auto flex items-center justify-between px-2 md:px-10 mt-8 relative z-20"
                      onMouseEnter={() => setIsCarouselPaused(true)}
                      onMouseLeave={() => setIsCarouselPaused(false)}
                    >
                      {/* Nav Button Left */}
                      <button 
                         onClick={() => setCarouselIndex(prev => (prev - 1 + uniqueCategories.length) % uniqueCategories.length)}
                         className="p-4 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
                      >
                          <ChevronLeft size={32} />
                      </button>

                      {/* Content Area */}
                      <div className="flex-1 flex justify-center items-center min-h-[60vh] px-4">
                        <AnimatePresence mode="wait">
                            {uniqueCategories.map((categoryName, index) => {
                              if (index !== carouselIndex) return null;

                              const categoryWinners = mergedAwardWinners.filter(w => w.category === categoryName);
                              const rank1 = categoryWinners.find(w => w.rank === 1);
                              const rank2 = categoryWinners.find(w => w.rank === 2);
                              const rank3 = categoryWinners.find(w => w.rank === 3);
                              const others = categoryWinners.filter(w => w.rank > 3);

                              return (
                                <motion.div
                                  key={categoryName}
                                  initial={{ opacity: 0, x: 100 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -100 }}
                                  transition={{ duration: 0.5, ease: "easeInOut" }}
                                  className="flex flex-col items-center w-full max-w-6xl bg-slate-900/40 border border-white/5 rounded-[3rem] p-6 md:p-12 shadow-2xl backdrop-blur-md"
                                >
                                  <div className="inline-block px-8 py-2 bg-slate-800/80 rounded-full border border-white/10 text-xl md:text-3xl font-bold text-white mb-10 shadow-lg backdrop-blur-sm text-center tracking-widest uppercase">
                                    {categoryName}
                                  </div>

                                  <div className="flex items-end justify-center gap-4 md:gap-8 w-full h-full min-h-[400px]">
                                    {/* RANK 2 */}
                                    {rank2 && (
                                      <div className="flex flex-col items-center order-2 w-1/3 max-w-[250px]">
                                        <div className="text-center mb-4 w-full px-1">
                                          <div className="text-white font-bold text-sm md:text-lg leading-tight line-clamp-2 min-h-[2.5em] flex items-end justify-center w-full">
                                            {rank2.name}
                                          </div>
                                        </div>
                                        <div className="w-full h-32 md:h-48 bg-gradient-to-t from-slate-700/80 to-slate-500/20 border-t border-x border-slate-500/50 rounded-t-2xl relative flex items-end justify-center pb-4">
                                          <div className="text-5xl font-black text-slate-300 opacity-50">2</div>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-slate-300 flex items-center justify-center text-slate-900 font-bold border-4 border-slate-700 shadow-lg z-10 -mt-5 md:-mt-6 text-base md:text-lg">
                                          #2
                                        </div>
                                      </div>
                                    )}

                                    {/* RANK 1 - MODIFIED FOR BETTER LAYOUT */}
                                    {rank1 && (
                                      <div className="flex flex-col items-center order-1 w-1/3 max-w-[300px] z-10 relative">
                                        {/* NAMA JUARA 1 */}
                                        {/* mb-16 memberikan ruang agar teks tidak menabrak mahkota */}
                                        <div className="text-center mb-16 relative z-20 w-full">
                                          {/* Font size disesuaikan agar tidak pecah vertikal terlalu parah */}
                                          <div className="text-yellow-300 w-full">
                                              <AutoFitText text={rank1.name} />
                                          </div>
                                        </div>

                                        {/* PODIUM JUARA 1 */}
                                        <div className="w-full h-48 md:h-80 bg-gradient-to-t from-yellow-700/80 to-yellow-500/20 border-t border-x border-yellow-500/50 rounded-t-2xl relative flex items-end justify-center pb-4 shadow-[0_0_50px_rgba(234,179,8,0.3)]">
                                          {/* MAHKOTA - Posisi absolute ke atas podium */}
                                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 animate-bounce z-30">
                                            <Crown className="text-yellow-400 fill-yellow-400/20 drop-shadow-lg" size={56} />
                                          </div>
                                          <div className="text-7xl md:text-8xl font-black text-yellow-500 opacity-50">1</div>
                                        </div>
                                        
                                        <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold border-4 border-yellow-600 shadow-xl z-10 -mt-7 md:-mt-10 scale-110">
                                          <Trophy size={32} />
                                        </div>
                                      </div>
                                    )}

                                    {/* RANK 3 */}
                                    {rank3 && (
                                      <div className="flex flex-col items-center order-3 w-1/3 max-w-[250px]">
                                        <div className="text-center mb-4 w-full px-1">
                                          <div className="text-white w-full">
                                            <AutoFitText text={rank3.name}/>

                                          </div>
                                        </div>
                                        <div className="w-full h-24 md:h-36 bg-gradient-to-t from-orange-800/80 to-orange-600/20 border-t border-x border-orange-500/50 rounded-t-2xl relative flex items-end justify-center pb-4">
                                          <div className="text-5xl font-black text-orange-400 opacity-50">3</div>
                                        </div>
                                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-400 flex items-center justify-center text-orange-900 font-bold border-4 border-orange-700 shadow-lg z-10 -mt-5 md:-mt-6 text-base md:text-lg">
                                          #3
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* WINNERS LIST (RANK 4+) */}
                                  {others.length > 0 && (
                                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                                      {others.map(other => (
                                        <div key={other.id} className="bg-slate-800/40 border border-white/5 p-3 rounded-xl flex items-center gap-3">
                                          <div className="w-8 h-8 min-w-[2rem] rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">#{other.rank}</div>
                                          <div className="text-sm font-bold text-slate-200 truncate">{other.name}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                      </div>

                      {/* Nav Button Right */}
                      <button 
                         onClick={() => setCarouselIndex(prev => (prev + 1) % uniqueCategories.length)}
                         className="p-4 bg-slate-800/50 hover:bg-slate-700/80 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-30"
                      >
                          <ChevronRight size={32} />
                      </button>
                    </div>

                    {/* Controls & Indicators */}
                    <div className="flex items-center gap-4 mt-6">
                        <button onClick={() => setIsCarouselPaused(prev => !prev)} className="text-slate-400 hover:text-white">
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
                    
                    {/* Tombol Confetti - SEJAJAR DENGAN ICON SOUND */}
                    <div className="fixed bottom-4 right-16 md:bottom-6 md:right-20 z-[100]">
                        <button 
                          onClick={triggerCelebration} 
                          className="w-10 h-10 md:w-12 md:h-12 bg-slate-800/80 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-white hover:bg-slate-700 hover:scale-110 transition-all shadow-lg group"
                        >
                            <PartyPopper size={18} className="md:w-5 md:h-5 text-purple-400" />
                        </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* VIEW: DOORPRIZE */}
          {view === "doorprize" && (
            <motion.div key="doorprize" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col xl:flex-row gap-8 w-full max-w-[1600px] mx-auto pb-10">
              
              <div className="w-full xl:w-2/3 order-1 flex flex-col gap-8">
                <CountdownTimer targetDate={config.doorprizeStart} title="Waktu Menuju Doorprize" theme="cyan" />

                {/* --- GRID HADIAH --- */}
                <div className="bg-slate-900/50 backdrop-blur-md rounded-3xl border border-white/10 p-4 md:p-6">
                  <h3 className="text-sm font-bold text-cyan-400 mb-6 flex items-center gap-2 uppercase tracking-wide">
                    <PackageOpen size={18} /> Hadiah
                    <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] md:text-xs ml-auto">{totalItemsRemaining} Item Tersedia</span>
                  </h3>
                  {prizes.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 font-mono text-sm">DATABASE HADIAH KOSONG</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
                      {prizes.map((p) => (
                        <div key={p.id} className={`group bg-slate-800/40 p-2 md:p-3 rounded-2xl border border-white/5 flex flex-col transition-all relative overflow-hidden ${p.stock === 0 ? 'opacity-30 grayscale' : 'hover:scale-105 hover:bg-slate-800/80 hover:border-cyan-500/30'}`}>
                          <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 mb-3 relative">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-700 bg-slate-900"><Gift size={32} /></div>
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

                {/* --- SPIN AREA --- */}
                {!isSpinning && !winner ? (
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[3rem] p-6 md:p-10 border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.1)] flex flex-col items-center justify-center min-h-[300px] md:min-h-[350px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2032%2032%27%20width=%2732%27%20height=%2732%27%20fill=%27none%27%20stroke=%27rgb(6%20182%20212%20/%200.2)%27%3e%3cpath%20d=%27M0%20.5H31.5V32%27/%3e%3c/svg%3e')] opacity-10"></div>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,cyan_360deg)] opacity-5 blur-[100px] transform-gpu will-change-transform"></motion.div>

                    <div className="relative z-10 text-center w-full max-w-lg">
                      <motion.div animate={{ y: [0, -15, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 md:mb-8 bg-cyan-950 rounded-full flex items-center justify-center border-4 border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.4)]">
                        <Zap className="text-cyan-400 w-12 h-12 md:w-16 md:h-16 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                      </motion.div>

                      <h2 className="text-3xl md:text-5xl font-black text-white mb-2">RANDOMIZER</h2>
                      <p className="text-cyan-200/60 mb-6 md:mb-8 text-sm md:text-base">Algoritma pengacakan peserta dan hadiah siap dijalankan.</p>
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
                  <div className="bg-black/40 backdrop-blur-xl rounded-[3rem] p-8 md:p-12 border border-cyan-500/50 shadow-[0_0_100px_rgba(6,182,212,0.2)] min-h-[300px] md:min-h-[450px] flex flex-col items-center justify-center text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-cyan-500/5 animate-pulse transform-gpu"></div>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <motion.div animate={{ scale: [1, 2], opacity: [0, 1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} className="w-64 h-64 md:w-96 md:h-96 border-4 border-cyan-500 rounded-full will-change-transform" />
                      <motion.div animate={{ scale: [0.5, 2], opacity: [0, 1, 0] }} transition={{ duration: 0.5, delay: 0.2, repeat: Infinity }} className="absolute w-64 h-64 md:w-96 md:h-96 border-2 border-white rounded-full will-change-transform" />
                    </div>

                    <p className="text-cyan-400 font-mono tracking-[0.2em] md:tracking-[0.5em] text-xs md:text-sm mb-6 md:mb-8 animate-pulse relative z-10">MENGACAK PESERTA...</p>
                    <h2 className="text-4xl sm:text-5xl md:text-8xl font-black text-white break-all w-full blur-[1px] relative z-10 leading-tight will-change-[opacity]">
                      <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.1, repeat: Infinity }}>
                        {rollingName}
                      </motion.span>
                    </h2>
                  </div>
                ) : (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-gradient-to-b from-slate-900 to-black rounded-[3rem] p-6 md:p-12 border-2 border-cyan-400 shadow-[0_0_100px_rgba(6,182,212,0.4)] text-center relative overflow-hidden min-h-[400px] md:min-h-[450px] flex flex-col items-center justify-center max-w-4xl w-full">
                    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
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
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute z-0 -top-[50%] -left-[50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(6,182,212,0.15)_90deg,transparent_180deg)] rounded-full transform-gpu will-change-transform" />
                    <div className="relative z-10 w-full max-w-2xl">
                      <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="inline-flex items-center gap-2 px-4 py-1.5 md:px-6 md:py-2 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-bold mb-6 md:mb-8 shadow-[0_0_20px_rgba(6,182,212,0.3)] text-xs md:text-base">
                        <Gift size={18} /> SELAMAT KEPADA
                      </motion.div>

                      <motion.h1 initial={{ scale: 0.5 }} animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5 }} className="text-4xl sm:text-5xl md:text-6xl font-black text-white mb-8 md:mb-10 drop-shadow-lg break-words">
                        {winner?.name}
                      </motion.h1>

                      <div className="relative group w-full max-w-md mx-auto mb-8 md:mb-10">
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl rotate-2 opacity-60 blur-xl group-hover:opacity-100 transition-opacity transform-gpu"></div>
                        <div className="relative bg-slate-900 border border-white/20 rounded-2xl p-4 md:p-6 flex flex-col sm:flex-row items-center gap-6 text-left">
                          {winner?.prize.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={winner?.prize.image_url} alt="Prize" className="w-full sm:w-1/2 h-40 md:h-32 rounded-xl object-cover bg-slate-800 border border-white/10" />
                          ) : (
                            <div className="w-full sm:w-1/2 h-32 rounded-xl bg-cyan-900/50 flex items-center justify-center"><Gift className="text-cyan-400 w-10 h-10" /></div>
                          )}
                          <div className="w-full sm:w-1/2">
                            <div className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1 text-center sm:text-left">Hadiah Utama</div>
                            <div className="text-xl md:text-2xl font-bold text-white leading-tight text-center sm:text-left">{winner?.prize.name}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
                        <button onClick={resetAll} className="px-6 py-3 md:px-8 md:py-3 bg-slate-800 rounded-full font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm md:text-base">Tutup</button>
                        <button onClick={() => { resetAll(); handleDoorprizeSpin(); }} className="px-6 py-3 md:px-8 md:py-3 bg-cyan-600 rounded-full font-bold text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-500 hover:scale-105 transition-all text-sm md:text-base">Undi Lagi</button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* RIGHT: HISTORY */}
              <div className="w-full xl:w-1/3 order-2">
                <div className="bg-slate-900/60 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-xl overflow-hidden h-[400px] xl:h-[800px] flex flex-col relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none"></div>

                  <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm md:text-base"><History className="text-cyan-400" size={20} /> Live Feed Winner</h3>
                    <div className="bg-cyan-500/20 text-cyan-300 text-[10px] md:text-xs px-2 py-1 rounded font-mono">TOTAL: {doorprizeLog.length}</div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar relative z-10">
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
                                <div className="w-16 h-12 rounded-xl bg-slate-950 flex items-center justify-center"><Gift size={18} className="text-slate-600" /></div>
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
        setTimeLeft(null); // Waktu habis
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  const boxBorder = theme === "gold" ? "border-yellow-500/20" : "border-cyan-500/20";

  return (
    <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`w-full max-w-2xl mx-auto mb-8 bg-slate-900/60 backdrop-blur-md rounded-2xl border ${boxBorder} p-4 md:p-6 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 opacity-20"></div>
      <div className={`flex items-center gap-2 ${theme === "gold" ? "text-yellow-200" : "text-cyan-200"} text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] mb-4`}>
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
      <div className={`w-12 h-12 md:w-20 md:h-20 bg-slate-950 rounded-2xl flex items-center justify-center text-xl md:text-4xl font-black ${textColor} border border-white/10 shadow-inner`}>
        {val < 10 ? `0${val}` : val}
      </div>
      <span className="text-[9px] md:text-xs text-slate-500 font-bold mt-2 uppercase tracking-wider">{label}</span>
    </div>
  )
}

// 2. Button Wrapper that checks Time
function TimeDependentButton({ targetDate, onClick, disabled, text, icon, theme = "gold" }: { targetDate: string, onClick: () => void, disabled?: boolean, text: string, icon: React.ReactNode, theme?: "gold" | "cyan" }) {
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const checkTime = () => {
      if (!targetDate) {
        setIsStarted(true);
        return;
      }
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const setIsStartedState = now >= target;
      setIsStarted(setIsStartedState);
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
      className={`mt-4 mx-auto px-6 py-3 md:px-8 md:py-4 rounded-full font-bold text-sm md:text-lg transition-all w-full md:w-auto relative overflow-hidden group flex items-center justify-center gap-2 border-t border-white/20 shadow-lg active:scale-95 ${btnClass}`}
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

// 3. Auto Fit Text Component (Dipindahkan ke luar JSX)
interface AutoFitTextProps {
  text: string;
}

const AutoFitText: React.FC<AutoFitTextProps> = ({ text }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<"lg" | "md" | "sm" | "xs">("lg");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fits = () => el.scrollWidth <= el.clientWidth;

    let nextSize: "lg" | "md" | "sm" | "xs" = "lg";

    // paksa mulai dari terbesar
    el.className = el.className.replace(/text-\S+/g, "");

    if (!fits()) nextSize = "md";
    if (!fits()) nextSize = "sm";
    if (!fits()) nextSize = "xs";

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSize(nextSize);
  }, [text]);

  const sizeClass = {
    lg: "text-sm md:text-base lg:text-lg",
    md: "text-xs md:text-sm",
    sm: "text-[13px] md:text-xs",
    xs: "text-[10px] md:text-[13px]",
  }[size];

  return (
    <div
      ref={ref}
      className={`
        w-full text-center font-semibold
        drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]
        leading-tight
        whitespace-nowrap
        overflow-hidden
        ${sizeClass}
      `}
      title={text}
    >
      {text}
    </div>
  );
};