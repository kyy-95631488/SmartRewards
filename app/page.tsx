// app/page.tsx
"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gift, ArrowLeft, Medal, Zap, List, X, Sparkles, Lock, Save, RotateCcw,
  Volume2, VolumeX, Crown
} from "lucide-react";

// --- FIREBASE IMPORTS ---
import { db } from "./lib/firebase";
import {
  collection, onSnapshot, query, orderBy,
  doc, updateDoc, addDoc, serverTimestamp,
  Timestamp, writeBatch
} from "firebase/firestore";

// --- IMPORT FEATURES ---
import AwardsFeature from "./components/landing/AwardsFeature";
import DoorprizeFeature from "./components/landing/DoorprizeFeature";

// --- TIPE DATA ---
export interface Participant {
  id: string;
  name: string;
}

export interface Prize {
  id: string;
  name: string;
  stock: number;
  image_url?: string;
  price?: number;
  isGrandPrize?: boolean;
}

export interface WinnerLog {
  id: string;
  name: string;
  prizeName: string;
  prizeImage: string;
  timestamp: Timestamp | null;
  displayTime?: string;
}

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

interface AwardHistoryItem {
  name: string;
  category: string;
  rank: number;
  eventLabel: string;
  timestamp?: Timestamp;
}

interface AppConfig {
  doorprizeStart: string;
  awardStart: string;
  doorprizeStatus: "open" | "closed";
  awardStatus: "open" | "closed";
  doorprizePasscode: string;
  awardPasscode: string;
}

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

// --- WEIGHTED RANDOM HELPER ---
const getWeightedPrize = (availablePrizes: Prize[]): Prize | null => {
  if (availablePrizes.length === 0) return null;

  const weights = availablePrizes.map(p => {
    const priceVal = p.price && p.price > 0 ? p.price : 100000;
    return { 
        prize: p, 
        weight: 100000000 / priceVal 
    };
  });

  const totalWeight = weights.reduce((acc, curr) => acc + curr.weight, 0);
  let randomVal = Math.random() * totalWeight;

  for (const item of weights) {
    if (randomVal < item.weight) {
        return item.prize;
    }
    randomVal -= item.weight;
  }

  return availablePrizes[0];
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
  const [awardHistory, setAwardHistory] = useState<AwardHistoryItem[]>([]); 

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
    
  // Award States
  const [winner, setWinner] = useState<{ name: string; prize: Prize } | null>(null);
    
  const [awardStep, setAwardStep] = useState(0);
  const [confettiParticles, setConfettiParticles] = useState<Particle[]>([]);

  // --- CAROUSEL STATE ---
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Memoized Stars
  const [stars] = useState(() => Array.from({ length: 50 }).map((_, i) => ({
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
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const suspenseAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const bgmFadeInterval = useRef<NodeJS.Timeout | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  
  const [isAwardSoundPlaying, setIsAwardSoundPlaying] = useState(false);

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
      if (!countdownAudioRef.current) {
        countdownAudioRef.current = new Audio("/sounds/countdown.mp3");
        countdownAudioRef.current.volume = 0.5;
      }
      if (!suspenseAudioRef.current) {
        suspenseAudioRef.current = new Audio("/sounds/suspense.mp3");
        suspenseAudioRef.current.volume = 0.7;
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
        
      [spinAudioRef, clapAudioRef, winAudioRef, bgmAudioRef, countdownAudioRef, suspenseAudioRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
    }
  }, []);

  const stopAllSounds = () => {
    [spinAudioRef, clapAudioRef, winAudioRef, bgmAudioRef, countdownAudioRef, suspenseAudioRef].forEach(ref => {
        if (ref.current) {
            ref.current.pause();
            ref.current.currentTime = 0;
        }
    });
    setIsAwardSoundPlaying(false);
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

  const handleAwardPlaySound = (type: 'countdown' | 'suspense') => {
    if (isMutedRef.current) return;

    if (type === 'countdown') {
        setIsAwardSoundPlaying(true);
        smartPlay(countdownAudioRef);
        setTimeout(() => {
           setIsAwardSoundPlaying(false);
        }, 800);
    } else if (type === 'suspense') {
        setIsAwardSoundPlaying(true);
        smartPlay(suspenseAudioRef);
        setTimeout(() => {
            setIsAwardSoundPlaying(false);
        }, 3000);
    }
  };

  const handleStopAwardSound = (type: 'countdown' | 'suspense') => {
    if (type === 'countdown') {
        smartStop(countdownAudioRef);
        setIsAwardSoundPlaying(false); 
    }
    if (type === 'suspense') {
        smartStop(suspenseAudioRef);
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

  useEffect(() => {
    const isEffectPlaying = isSpinning || isAwardSoundPlaying;
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
              
            if (Math.abs(currentVol - targetVolume) < 0.02) {
                bgmAudioRef.current.volume = targetVolume;
                if (bgmFadeInterval.current) clearInterval(bgmFadeInterval.current);
            } else if (currentVol > targetVolume) {
                bgmAudioRef.current.volume = Math.max(0, currentVol - 0.05);
            } else {
                bgmAudioRef.current.volume = Math.min(1, currentVol + 0.02);
            }
        }, 50);
    }
      
    return () => {
        if (bgmFadeInterval.current) clearInterval(bgmFadeInterval.current);
    }
  }, [isSpinning, isAwardSoundPlaying, isMuted]); 

  const resetAll = () => {
    setWinner(null);
    setRollingName("Ready?");
    setPendingDoorprize(null);
    setConfettiParticles([]);
    setShowFlash(false);
    if (spinIntervalRef.current) clearInterval(spinIntervalRef.current);

    smartStop(spinAudioRef);
    smartStop(clapAudioRef);
    smartStop(winAudioRef);
    smartStop(countdownAudioRef);
    smartStop(suspenseAudioRef);
    setIsAwardSoundPlaying(false);
  };

  const generateConfetti = (amount = 150) => {
    const colors = ['bg-pink-500', 'bg-cyan-400', 'bg-yellow-400', 'bg-purple-500', 'bg-white', 'bg-green-400', 'bg-red-500'];
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
      const history = snapshot.docs.map(d => d.data() as AwardHistoryItem);
      setAwardHistory(history);
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
        return b.rank - a.rank;
    });
  }, [awardSlots, awardNominees]);

  useEffect(() => {
      if (mergedAwardWinners.length > 0) {
          const uniqueCats = Array.from(new Set(mergedAwardWinners.map(w => w.category)));
          const historyCats = new Set(awardHistory.map(h => h.category));

          const firstUnsavedCategory = uniqueCats.find(c => !historyCats.has(c));

          if (firstUnsavedCategory) {
              const idx = mergedAwardWinners.findIndex(w => w.category === firstUnsavedCategory);
              // eslint-disable-next-line react-hooks/set-state-in-effect
              if (idx !== -1) setAwardStep(idx);
          } else {
              if (awardHistory.length > 0) {
                  setAwardStep(mergedAwardWinners.length);
              }
          }
      }
  }, [mergedAwardWinners, awardHistory]);

  const uniqueCategories = useMemo(() => Array.from(new Set(mergedAwardWinners.map(w => w.category))), [mergedAwardWinners]);

  useEffect(() => {
      if (view === "awards" && awardStep >= mergedAwardWinners.length && !isCarouselPaused && uniqueCategories.length > 1) {
          const interval = setInterval(() => {
              setCarouselIndex(prev => (prev + 1) % uniqueCategories.length);
          }, 8000);
          return () => clearInterval(interval);
      }
  }, [view, awardStep, mergedAwardWinners.length, isCarouselPaused, uniqueCategories.length]);

  const totalItemsRemaining = useMemo(() => prizes.reduce((acc, curr) => acc + curr.stock, 0), [prizes]);
    
  const isAwardCompleted = useMemo(() => {
      if (mergedAwardWinners.length === 0) return false;
      const uniqueCats = new Set(mergedAwardWinners.map(w => w.category));
      const historyCats = new Set(awardHistory.map(h => h.category));
      return uniqueCats.size === historyCats.size && uniqueCats.size > 0;
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

  const handleSaveCategoryBatch = async (categoryItems: MergedAwardWinner[]) => {
    const newItems = categoryItems.filter(item => 
        !awardHistory.some(h => h.category === item.category && h.rank === item.rank)
    );

    if (newItems.length === 0) return;

    try {
        const batch = writeBatch(db);
        newItems.forEach(item => {
            const ref = doc(collection(db, "award_history"));
            batch.set(ref, {
                name: item.name,
                company: item.company,
                category: item.category,
                rank: item.rank,
                eventLabel: item.eventLabel,
                timestamp: serverTimestamp()
            });
        });
        await batch.commit();
        console.log("Batch save success for category:", categoryItems[0]?.category);
    } catch (error) {
        console.error("Batch save failed:", error);
    }
  };

  // --- LOGIKA DOORPRIZE UTAMA ---
  const handleDoorprizeSpin = async () => {
    // 1. Ambil semua yang stok > 0
    const availablePrizes = prizes.filter(p => p.stock > 0);
    const previousWinnerNames = doorprizeLog.map(log => log.name);
    const eligibleParticipants = participants.filter(p => !previousWinnerNames.includes(p.name));

    if (isSpinning || availablePrizes.length === 0 || eligibleParticipants.length === 0) {
      if (participants.length === 0) alert("Data peserta kosong!");
      else if (eligibleParticipants.length === 0) alert("Semua peserta sudah mendapatkan hadiah!");
      else if (availablePrizes.length === 0) alert("Stok hadiah habis!");
      return;
    }

    // 2. LOGIKA GRAND PRIZE GUARD
    const regularPrizes = availablePrizes.filter(p => !p.isGrandPrize);
    const grandPrizes = availablePrizes.filter(p => p.isGrandPrize);

    // Jika masih ada hadiah regular, PAKSA ambil dari regular dulu
    let targetPool: Prize[] = [];

    if (regularPrizes.length > 0) {
        targetPool = regularPrizes;
    } else {
        // Jika regular habis, baru boleh ambil Grand Prize
        targetPool = grandPrizes;
    }

    if (targetPool.length === 0) {
        alert("Terjadi kesalahan alokasi hadiah.");
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

      // 3. PILIH HADIAH DARI TARGET POOL
      const selectedPrize = getWeightedPrize(targetPool);
        
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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-950 to-slate-950"></div>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-blue-200/70 font-mono tracking-widest text-sm animate-pulse">SYSTEM INITIALIZING...</p>
        </div>
      </div>
    );
  }

  return (
    // FIX: main wrapper menggunakan h-screen, flex-col, dan overflow-hidden agar child bisa 100% height
    <main className="h-screen w-full relative flex flex-col items-center py-2 md:py-4 overflow-hidden font-sans text-slate-100 bg-slate-950 selection:bg-blue-500 selection:text-white">

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

      {/* --- BACKGROUND SYSTEM (Tidak berubah) --- */}
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

      {/* --- MODAL KONFIRMASI (DOORPRIZE ONLY) --- */}
      <AnimatePresence>
        {pendingDoorprize && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-hidden">
            
            {/* GOD RAYS BACKDROP */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className={`w-[150vw] h-[150vw] md:w-[800px] md:h-[800px] ${pendingDoorprize.prize.isGrandPrize ? 'bg-[conic-gradient(from_0deg,transparent_0deg,rgba(234,179,8,0.3)_180deg,transparent_360deg)]' : 'bg-[conic-gradient(from_0deg,transparent_0deg,rgba(6,182,212,0.2)_180deg,transparent_360deg)]'} rounded-full blur-3xl opacity-50 transform-gpu will-change-transform`}
                  />
              </div>
            
            {/* MODAL CONTAINER */}
            <motion.div 
              initial={{ scale: 0.5, y: 100 }} 
              animate={{ scale: 1, y: 0 }} 
              className={`bg-slate-900 border-2 ${pendingDoorprize.prize.isGrandPrize ? 'border-yellow-500/50 shadow-[0_0_80px_rgba(234,179,8,0.3)]' : 'border-cyan-500/50 shadow-[0_0_80px_rgba(6,182,212,0.3)]'} p-4 md:p-10 rounded-[2rem] max-w-3xl w-full text-center relative overflow-hidden z-10 m-auto flex flex-col items-center justify-center max-h-[90vh] overflow-y-auto`}
            >
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
              <div className="relative z-10 w-full flex flex-col items-center">
                <div className={`${pendingDoorprize.prize.isGrandPrize ? 'text-yellow-400' : 'text-cyan-400'} font-bold tracking-widest uppercase mb-4 md:mb-6 animate-pulse text-xs md:text-sm`}>
                    {pendingDoorprize.prize.isGrandPrize ? "KONFIRMASI GRAND PRIZE" : "KONFIRMASI HASIL"}
                </div>

                {/* --- DOORPRIZE CONFIRMATION --- */}
                {pendingDoorprize && (
                  <div className="flex flex-col items-center justify-center w-full">
                    <h2 className="text-2xl md:text-4xl font-black text-white mb-2 drop-shadow-md break-words w-full leading-tight text-center px-2">
                        {pendingDoorprize.winner.name}
                    </h2>
                    <div className={`h-1 w-24 bg-gradient-to-r from-transparent ${pendingDoorprize.prize.isGrandPrize ? 'via-yellow-500' : 'via-cyan-500'} to-transparent my-4`}></div>

                    <div className="w-full bg-slate-950/50 rounded-2xl p-4 md:p-6 border border-white/5 mb-6 md:mb-8 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                        <div className="flex justify-center shrink-0">
                            {pendingDoorprize.prize.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={pendingDoorprize.prize.image_url} alt="" className={`h-24 md:h-40 w-auto rounded-lg object-contain drop-shadow-lg ${pendingDoorprize.prize.isGrandPrize ? 'border border-yellow-500/30' : ''}`} />
                            ) : (
                                <Gift className="text-slate-600" size={60} />
                            )}
                        </div>
                        
                        <div className="text-center md:text-left flex flex-col items-center md:items-start">
                           <p className="text-slate-400 text-xs md:text-sm mb-1 uppercase tracking-wider">Mendapatkan Hadiah:</p>
                           <h3 className={`text-lg md:text-3xl font-bold ${pendingDoorprize.prize.isGrandPrize ? 'text-yellow-400' : 'text-cyan-400'} leading-tight`}>
                                {pendingDoorprize.prize.name}
                           </h3>
                           {pendingDoorprize.prize.isGrandPrize && (
                               <div className="mt-2 inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-300 text-[10px] px-2 py-1 rounded font-bold border border-yellow-500/30">
                                   <Crown size={12}/> HADIAH UTAMA
                               </div>
                           )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full mx-auto">
                      <button onClick={retryDoorprize} className="flex-1 py-3 md:py-4 rounded-xl bg-slate-800 text-white hover:bg-slate-700 font-bold flex items-center justify-center gap-2 text-sm md:text-base transition-all"><RotateCcw size={18} /> Spin Ulang</button>
                      <button onClick={confirmDoorprizeWinner} className={`flex-1 py-3 md:py-4 rounded-xl ${pendingDoorprize.prize.isGrandPrize ? 'bg-gradient-to-r from-amber-500 to-yellow-500 shadow-yellow-500/30' : 'bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-cyan-500/30'} text-white hover:scale-105 font-bold flex items-center justify-center gap-2 shadow-lg text-sm md:text-base transition-all`}><Save size={18} /> SAH & SIMPAN</button>
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

      {/* FIX: Container konten utama diberikan h-full dan flex flex-col flex-1 */}
      <div className="w-full max-w-[1400px] px-4 md:px-8 z-10 relative flex flex-col flex-1 h-full min-h-0">

        {/* --- NAVIGATION --- */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-2 md:mb-4 gap-2 md:gap-4 shrink-0">
          <div className="flex items-center w-full md:w-auto">
            {view !== "menu" && (
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => { setView("menu"); resetAll(); }}
                className="flex items-center gap-2 px-4 py-2 md:px-5 md:py-2 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all group backdrop-blur-sm w-full md:w-auto justify-center md:justify-start"
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
                className="flex items-center justify-center gap-2 px-4 py-2 md:px-5 md:py-2 rounded-full bg-slate-800/50 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white transition-all backdrop-blur-sm font-medium text-sm w-full md:w-auto"
              >
                <List size={18} /> <span>Database ({modalData.length})</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* VIEW: MAIN MENU */}
          {view === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-6 md:gap-10 mt-4 md:mt-10 flex-1 justify-center pb-10">

              <div className="text-center relative px-2">
                <div className="absolute -inset-10 bg-blue-500/20 blur-3xl rounded-full transform-gpu"></div>
                <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="relative">
                  <h1 className="text-4xl sm:text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-200 to-slate-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.3)] tracking-tighter">GATHERING 2025</h1>
                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="h-px w-8 md:w-12 bg-blue-500/50"></div>
                    <p className="text-sm sm:text-lg md:text-2xl text-blue-300 font-light tracking-[0.3em] uppercase">Annual Celebration</p>
                    <div className="h-px w-8 md:w-12 bg-blue-500/50"></div>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-7xl px-4">
                {/* CARD 1: AWARDS */}
                <button onClick={() => handleAccessRequest("awards")} className="group relative h-40 md:h-64 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(234,179,8,0.2)] text-left">
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 h-full p-6 md:p-8 flex flex-col justify-end">
                    <Medal className="absolute top-6 right-6 md:top-8 md:right-8 text-yellow-500/20 w-16 h-16 md:w-32 md:h-32 group-hover:text-yellow-500/40 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 transform-gpu" />
                    <div className="space-y-2 relative z-20 max-w-[75%]">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isAwardCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'}`}>
                        {isAwardCompleted ? <><Sparkles size={12} /> COMPLETED</> : (config.awardStatus === 'closed' ? <><Lock size={12} /> Locked</> : <><Sparkles size={12} /> Awards</>)}
                      </div>
                      <h2 className="text-2xl md:text-4xl font-bold text-white group-hover:text-yellow-200 transition-colors">Awards</h2>
                      <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-xs md:text-base">Pengungkapan penghargaan kategori terbaik tahun ini.</p>
                    </div>
                  </div>
                </button>

                {/* CARD 2: DOORPRIZE */}
                <button onClick={() => handleAccessRequest("doorprize")} className="group relative h-40 md:h-64 rounded-[2rem] overflow-hidden border border-white/10 bg-slate-900/40 backdrop-blur-sm transition-all duration-500 hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(6,182,212,0.2)] text-left">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
                  <div className="relative z-10 h-full p-6 md:p-8 flex flex-col justify-end">
                    <Gift className="absolute top-6 right-6 md:top-8 md:right-8 text-cyan-500/20 w-16 h-16 md:w-32 md:h-32 group-hover:text-cyan-500/40 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 transform-gpu" />
                    <div className="space-y-2 relative z-20 max-w-[75%]">
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider mb-2 ${isDoorprizeCompleted ? 'bg-green-500/20 border-green-500/30 text-green-300' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'}`}>
                        {isDoorprizeCompleted ? <><Zap size={12} /> SOLD OUT</> : (config.doorprizeStatus === 'closed' ? <><Lock size={12} /> Locked</> : <><Zap size={12} /> Lucky Draw</>)}
                      </div>
                      <h2 className="text-2xl md:text-4xl font-bold text-white group-hover:text-cyan-200 transition-colors">Doorprize</h2>
                      <p className="text-slate-400 group-hover:text-slate-200 transition-colors text-xs md:text-base">Putaran keberuntungan berhadiah menarik untuk semua.</p>
                    </div>
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* VIEW: AWARDS REVEAL */}
          {view === "awards" && (
            <AwardsFeature
                config={config}
                awardStep={awardStep}
                mergedAwardWinners={mergedAwardWinners}
                confettiParticles={confettiParticles}
                carouselIndex={carouselIndex}
                setCarouselIndex={setCarouselIndex}
                isCarouselPaused={isCarouselPaused}
                setIsCarouselPaused={setIsCarouselPaused}
                uniqueCategories={uniqueCategories}
                triggerCelebration={triggerCelebration}
                setAwardStep={setAwardStep}
                onSaveCategoryBatch={handleSaveCategoryBatch}
                awardHistory={awardHistory}
                playSound={handleAwardPlaySound}
                stopSound={handleStopAwardSound}
            />
          )}

          {/* VIEW: DOORPRIZE */}
          {view === "doorprize" && (
            <DoorprizeFeature
                config={config}
                prizes={prizes}
                participants={participants}
                doorprizeLog={doorprizeLog}
                totalItemsRemaining={totalItemsRemaining}
                isSpinning={isSpinning}
                winner={winner}
                pendingDoorprize={pendingDoorprize}
                rollingName={rollingName}
                handleDoorprizeSpin={handleDoorprizeSpin}
                resetAll={resetAll}
                confettiParticles={confettiParticles}
            />
          )}

        </AnimatePresence>
      </div>
    </main>
  );
}