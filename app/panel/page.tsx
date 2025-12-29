/* eslint-disable @next/next/no-img-element */
// app/panel/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "../lib/firebase"; 
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, writeBatch, serverTimestamp, orderBy, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, User, LayoutDashboard, Users, Trophy, Gift, 
  Save, Plus, Trash2, Search, Edit3, 
  ChevronRight, Package, RefreshCw, Upload, 
  AlertCircle, Image as ImageIcon, Menu, ArrowRight, Loader2,
  Clock, X, Key, Shuffle, Lock, Unlock, Power, Archive,
  FileText, Download, FileSpreadsheet, Calendar, Star, Medal, Layers, ScanLine
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { supabase } from "../lib/supabase"; 

// --- GANTI TESSERACT DENGAN GEMINI ---
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- IMPORT UNTUK EXPORT DATA ---
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- TIPE DATA ---
interface UserData {
  email: string;
  role: string;
  uid?: string;
}

interface DoorprizeParticipant {
  id: string;
  name: string;
}

interface DoorprizeWinner {
    id: string;
    name: string;
    wonAt?: Timestamp;
    prizeName?: string;
}

// AwardNominee (Single Input Logic)
interface AwardNominee {
  id: string;
  name: string;    // Disamakan dengan company
  company: string; // Input Utama (Nama PT/Costumer)
}

// AwardWinnerSlot
interface AwardWinnerSlot {
  id: string;
  rank: number;
  candidateId: string; 
  category: string; 
  eventLabel?: string; // New: Untuk membedakan tanggal/sesi event
}

interface Prize {
  id: string;
  name: string;
  stock: number;
  image_url?: string; 
}

interface ArchivedSession {
    id: string;
    archivedAt: Timestamp; 
    label: string;
}

interface AwardWinnerHistory {
    id?: string;
    name: string;
    company: string;
    rank: number;
    category: string;
    eventLabel?: string;
    title?: string;
}

type TabType = "dashboard" | "doorprize" | "award-nominees" | "awards" | "prizes" | "recap";

// --- HELPER UNTUK GEMINI ---
async function fileToGenerativePart(file: File) {
    return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function PanelPage() {
  // --- AUTH STATE ---
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 

  // --- DATA STATES ---
  const [doorprizeParticipants, setDoorprizeParticipants] = useState<DoorprizeParticipant[]>([]);
  const [doorprizeWinners, setDoorprizeWinners] = useState<DoorprizeWinner[]>([]); 
      
  const [awardNominees, setAwardNominees] = useState<AwardNominee[]>([]);
  const [awardWinners, setAwardWinners] = useState<AwardWinnerSlot[]>([]);
      
  const [prizes, setPrizes] = useState<Prize[]>([]);
        
  // --- HISTORY / RECAP STATE ---
  const [historySessions, setHistorySessions] = useState<ArchivedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("active"); 

  // --- SCHEDULE, PASSCODE & STATUS STATES ---
  const [doorprizeSchedule, setDoorprizeSchedule] = useState("");
  const [awardSchedule, setAwardSchedule] = useState(""); 
  const [doorprizePasscode, setDoorprizePasscode] = useState("");
  const [awardPasscode, setAwardPasscode] = useState(""); 
        
  // New Status States
  const [doorprizeStatus, setDoorprizeStatus] = useState<"open" | "closed">("closed");
  const [awardStatus, setAwardStatus] = useState<"open" | "closed">("closed");

  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null); 

  // --- RESPONSIVE CHECK & AUTH LOGIC ---
  useEffect(() => {
    // Auto-close sidebar on mobile/tablet load
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    } 

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          setUserData(JSON.parse(storedUser));
          setLoading(false);
        } else {
          try {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
              const data = userDoc.data() as UserData;
              setUserData(data);
              localStorage.setItem("user", JSON.stringify({ ...data, uid: user.uid }));
            } else {
              const basicData = { email: user.email || "", role: "admin", uid: user.uid };
              setUserData(basicData);
            }
          } catch (error) {
            console.error("Error fetching user:", error);
          }
          setLoading(false);
        }
      } else {
        localStorage.removeItem("user");
        router.push("/auth/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  // --- FETCH HELPER: GET HISTORY LIST ---
  const fetchHistorySessions = useCallback(async () => {
      try {
          const q = query(collection(db, "archived_sessions"), orderBy("archivedAt", "desc"));
          const snapshot = await getDocs(q);
          const sessions: ArchivedSession[] = snapshot.docs.map(doc => {
              const data = doc.data();
              let dateLabel = "Unknown Date";
              if (data.archivedAt?.toDate) {
                  dateLabel = data.archivedAt.toDate().toLocaleString('id-ID', {
                      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  });
              }
              return {
                  id: doc.id,
                  archivedAt: data.archivedAt,
                  label: dateLabel
              };
          });
          setHistorySessions(sessions);
      } catch (error) {
          console.error("Error fetching history:", error);
      }
  }, []);

  // --- FETCH DATA FUNCTIONS ---
  const fetchSchedulesAndPasscodes = useCallback(async () => {
    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.doorprizeStart) setDoorprizeSchedule(data.doorprizeStart);
            if (data.awardStart) setAwardSchedule(data.awardStart); 
            if (data.doorprizePasscode) setDoorprizePasscode(data.doorprizePasscode);
            if (data.awardPasscode) setAwardPasscode(data.awardPasscode); 
            
            if (data.doorprizeStatus) setDoorprizeStatus(data.doorprizeStatus);
            if (data.awardStatus) setAwardStatus(data.awardStatus); 
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    }
  }, []);

  const fetchDoorprizeParticipants = useCallback(async () => {
    try {
      const q = query(collection(db, "doorprize_participants"));
      const querySnapshot = await getDocs(q);
      const data: DoorprizeParticipant[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<DoorprizeParticipant, "id">),
      }));
      setDoorprizeParticipants(data);
    } catch (error) {
      console.error("Error fetching doorprize participants:", error);
    }
  }, []);

  const fetchDoorprizeWinners = useCallback(async () => {
    try {
        if (selectedSession === "active") {
            const q = query(collection(db, "doorprize_winners")); 
            const querySnapshot = await getDocs(q);
            const data: DoorprizeWinner[] = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<DoorprizeWinner, "id">),
            }));
            setDoorprizeWinners(data);
        } else {
            const docRef = doc(db, "archived_sessions", selectedSession);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const sessionData = docSnap.data().sessionData;
                if (sessionData && sessionData.doorprize_winners) {
                    const data = sessionData.doorprize_winners.map((w: DoorprizeWinner, index: number) => ({
                        ...w,
                        id: w.id || `hist_w_${index}`
                    }));
                    setDoorprizeWinners(data);
                } else {
                    setDoorprizeWinners([]);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching winners:", error);
    }
  }, [selectedSession]);

  // --- FETCH AWARD DATA ---
  const fetchAwardData = useCallback(async () => {
    try {
        if (selectedSession === "active") {
            // 1. Fetch Nominees
            const qC = query(collection(db, "award_nominees"));
            const snapC = await getDocs(qC);
            const cData: AwardNominee[] = snapC.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<AwardNominee, "id">),
            }));
            setAwardNominees(cData);

            // 2. Fetch Winners (Slots)
            const qP = query(collection(db, "award_winners"));
            const snapP = await getDocs(qP);
            const pData: AwardWinnerSlot[] = snapP.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<AwardWinnerSlot, "id">),
            }));
            // Sort by eventLabel, then category, then rank
            setAwardWinners(pData.sort((a, b) => {
                if ((a.eventLabel || "Main") < (b.eventLabel || "Main")) return -1;
                if ((a.eventLabel || "Main") > (b.eventLabel || "Main")) return 1;
                if (a.category < b.category) return -1;
                if (a.category > b.category) return 1;
                return a.rank - b.rank;
            }));

        } else {
            // HISTORY MODE
            const docRef = doc(db, "archived_sessions", selectedSession);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const sessionData = docSnap.data().sessionData;
                
                const histWinners = sessionData.award_history_winners || sessionData.royal_winners || [];

                if (histWinners.length > 0) {
                    const syntheticNominees: AwardNominee[] = histWinners.map((w: AwardWinnerHistory, index: number) => ({
                        id: `hist_c_${index}`,
                        name: w.name,
                        company: w.company
                    }));

                    const syntheticWinners: AwardWinnerSlot[] = histWinners.map((w: AwardWinnerHistory, index: number) => ({
                        id: `hist_p_${index}`,
                        rank: w.rank,
                        candidateId: `hist_c_${index}`, 
                        category: w.category || w.title || "Uncategorized",
                        eventLabel: w.eventLabel || "Archived"
                    }));

                    setAwardNominees(syntheticNominees);
                    setAwardWinners(syntheticWinners.sort((a, b) => a.rank - b.rank));

                } else if (sessionData.award_winners || sessionData.royal_slots) {
                    const rawSlots = sessionData.award_winners || sessionData.royal_slots;
                    
                    const sData = rawSlots.map((s: Partial<AwardWinnerSlot>, idx: number) => ({
                        ...s, 
                        id: s.id || `hist_p_${idx}`,
                        rank: s.rank || 1,
                        candidateId: s.candidateId || "",
                        category: s.category || "Unknown",
                        eventLabel: s.eventLabel || "Archived"
                    })) as AwardWinnerSlot[];
                    
                    let cData: AwardNominee[] = [];
                    const rawNominees = sessionData.award_nominees || sessionData.royal_candidates;
                    if(rawNominees) {
                        cData = rawNominees.map((c: AwardNominee, idx: number) => ({
                            ...c, id: c.id || `hist_c_fallback_${idx}` 
                        }));
                    }

                    setAwardWinners(sData.sort((a, b) => a.rank - b.rank));
                    setAwardNominees(cData);
                } else {
                    setAwardWinners([]);
                    setAwardNominees([]);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching award data:", error);
    }
  }, [selectedSession]);

  const fetchPrizes = useCallback(async () => {
    try {
      const q = query(collection(db, "prizes"));
      const querySnapshot = await getDocs(q);
      const data: Prize[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Prize, "id">),
      }));
      setPrizes(data);
    } catch (error) {
      console.error("Error fetching prizes:", error);
    }
  }, []);

  // Fetch data based on active tab AND selectedSession
  useEffect(() => {
    fetchSchedulesAndPasscodes(); // Always fetch settings
    
    // Reset session to active if not in recap
    if (activeTab !== 'recap' && activeTab !== 'dashboard') {
        if(selectedSession !== 'active') setSelectedSession('active');
    }

    if (activeTab === "recap") {
        fetchHistorySessions(); 
        fetchDoorprizeWinners();
        fetchAwardData(); 
    } 
    else if (activeTab === "doorprize") {
      fetchDoorprizeParticipants();
    } else if (activeTab === "award-nominees") {
      fetchAwardData();
    } else if (activeTab === "awards") {
      fetchAwardData();
    } else if (activeTab === "prizes") {
      fetchPrizes();
    } else if (activeTab === "dashboard") {
       fetchDoorprizeParticipants();
       fetchAwardData();
       fetchPrizes();
       if(selectedSession === 'active') fetchDoorprizeWinners(); 
    }
  }, [activeTab, fetchDoorprizeWinners, fetchAwardData, selectedSession, fetchSchedulesAndPasscodes, fetchHistorySessions, fetchDoorprizeParticipants, fetchPrizes]);

  // --- HANDLER SETTINGS ---
  const handleSaveSchedule = async (type: "doorprize" | "award", value: string) => {
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, { 
            [type === "doorprize" ? "doorprizeStart" : "awardStart"]: value 
        }, { merge: true });
        
        if (type === "doorprize") setDoorprizeSchedule(value);
        else setAwardSchedule(value);
        
        alert(`Jadwal ${type === 'award' ? 'Awards' : 'Doorprize'} berhasil disimpan!`);
    } catch (error) {
        console.error("Error saving schedule:", error);
        alert("Gagal menyimpan jadwal.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSavePasscode = async (type: "doorprize" | "award", value: string) => {
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, { 
            [type === "doorprize" ? "doorprizePasscode" : "awardPasscode"]: value 
        }, { merge: true });
        
        if (type === "doorprize") setDoorprizePasscode(value);
        else setAwardPasscode(value);
        
        alert(`Passcode ${type === 'award' ? 'Awards' : 'Doorprize'} berhasil disimpan!`);
    } catch (error) {
        console.error("Error saving passcode:", error);
        alert("Gagal menyimpan passcode.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleToggleStatus = async (type: "doorprize" | "award", currentStatus: "open" | "closed") => {
    const newStatus = currentStatus === "open" ? "closed" : "open";
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, {
            [type === "doorprize" ? "doorprizeStatus" : "awardStatus"]: newStatus
        }, { merge: true });

        if (type === "doorprize") setDoorprizeStatus(newStatus);
        else setAwardStatus(newStatus);

    } catch (error) {
        console.error("Error toggling status:", error);
        alert("Gagal mengubah status.");
    } finally {
        setIsSaving(false);
    }
  };

  // --- HANDLERS FOR DOORPRIZE ---
  const handleAddDoorprizeParticipant = async (name: string) => {
    if (!name) return;
    try {
      const newRef = doc(collection(db, "doorprize_participants"));
      await setDoc(newRef, { name });
      fetchDoorprizeParticipants();
    } catch (error) {
      console.error("Error adding doorprize participant:", error);
    }
  };

  const handleDeleteDoorprizeParticipant = async (id: string) => {
    try {
      await deleteDoc(doc(db, "doorprize_participants", id));
      fetchDoorprizeParticipants();
    } catch (error) {
      console.error("Error deleting doorprize participant:", error);
    }
  };

  // NEW: Handler Bulk Delete Doorprize
  const handleBulkDeleteDoorprize = async (ids: string[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const ref = doc(db, "doorprize_participants", id);
              batch.delete(ref);
          });
          await batch.commit();
          fetchDoorprizeParticipants();
      } catch (error) {
          console.error("Error bulk delete doorprize:", error);
          alert("Gagal menghapus data terpilih.");
      } finally {
          setIsSaving(false);
      }
  };

  // --- HANDLERS FOR AWARD NOMINEES ---
  const handleAddAwardNominee = async (singleName: string) => {
    if (!singleName) return;
    try {
      const newRef = doc(collection(db, "award_nominees"));
      // Simpan input sebagai nama company (utama) dan nama customer (copy) agar fleksibel
      await setDoc(newRef, { name: singleName, company: singleName });
      fetchAwardData();
    } catch (error) {
      console.error("Error adding nominee:", error);
    }
  };

  // NEW HANDLER FOR BULK ADD FROM IMAGE SCAN
  const handleBulkAddNominees = async (names: string[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          names.forEach(name => {
              const newRef = doc(collection(db, "award_nominees"));
              batch.set(newRef, { name: name, company: name });
          });
          await batch.commit();
          fetchAwardData();
          alert(`${names.length} Data berhasil diimport!`);
      } catch (error) {
          console.error("Error bulk adding:", error);
          alert("Gagal menyimpan data bulk.");
      } finally {
          setIsSaving(false);
      }
  }

  const handleUpdateAwardNominee = async (updated: AwardNominee) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "award_nominees", id), data);
      fetchAwardData();
    } catch (error) {
      console.error("Error updating nominee:", error);
    }
  };

  const handleDeleteAwardNominee = async (id: string) => {
    try {
      await deleteDoc(doc(db, "award_nominees", id));
      fetchAwardData();
    } catch (error) {
      console.error("Error deleting nominee:", error);
    }
  };

  // NEW: Handler Bulk Delete Nominees
  const handleBulkDeleteNominees = async (ids: string[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const ref = doc(db, "award_nominees", id);
              batch.delete(ref);
          });
          await batch.commit();
          fetchAwardData();
      } catch (error) {
          console.error("Error bulk delete nominees:", error);
          alert("Gagal menghapus data terpilih.");
      } finally {
          setIsSaving(false);
      }
  };

  // --- HANDLERS FOR AWARDS ---
  const handleUpdateAwardWinner = async (updated: AwardWinnerSlot) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "award_winners", id), data);
      fetchAwardData();
    } catch (error) {
      console.error("Error updating award winner:", error);
    }
  };

  const handleInitializeAwards = async () => {
    if(!confirm("Apakah Anda yakin ingin membuat/reset default categories (Top Spender, Most Loyal, Rising Star)?")) return;
    setIsSaving(true);
    try {
        const categories = [
            "Top Spender",
            "The Most Loyal Customer",
            "Rising Star"
        ];

        for(const category of categories) {
            for(let rank = 1; rank <= 3; rank++) {
                const newRef = doc(collection(db, "award_winners"));
                await setDoc(newRef, {
                    rank: rank,
                    candidateId: "",
                    category: category,
                    eventLabel: "Main Event"
                });
            }
        }
        await fetchAwardData();
        alert("Berhasil inisialisasi default!");
    } catch (error) {
        console.error("Error initializing awards:", error);
    } finally {
        setIsSaving(false);
    }
  }

  // NEW: Add Single Award Category manually with Event Label Logic
  const handleManualAddAward = async (categoryName: string, slotCount: number, eventLabel: string) => {
     if(!categoryName || slotCount < 1) return;
     const finalLabel = eventLabel || "Main Event";
     setIsSaving(true);
     try {
         for(let rank = 1; rank <= slotCount; rank++) {
            const newRef = doc(collection(db, "award_winners"));
            await setDoc(newRef, {
                rank: rank,
                candidateId: "",
                category: categoryName,
                eventLabel: finalLabel
            });
         }
         await fetchAwardData();
         alert(`Nominasi "${categoryName}" berhasil ditambahkan ke Jadwal "${finalLabel}"!`);
     } catch (error) {
         console.error("Error adding category:", error);
         alert("Gagal menambah kategori.");
     } finally {
         setIsSaving(false);
     }
  }

  const handleSaveAwards = async () => {
    setIsSaving(true);
    try {
      for (const winner of awardWinners) {
        await handleUpdateAwardWinner(winner);
      }
      alert("Perubahan awards berhasil disimpan");
    } catch (error) {
      console.error("Error saving awards data:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- HANDLERS FOR PRIZES ---
  const handleAddPrize = async (newPrize: Omit<Prize, "id">) => {
    try {
      const newRef = doc(collection(db, "prizes"));
      await setDoc(newRef, newPrize);
      fetchPrizes();
      return newRef.id;
    } catch (error) {
      console.error("Error adding prize:", error);
      throw error;
    }
  };

  const handleUpdatePrize = async (updated: Prize) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "prizes", id), data);
      fetchPrizes();
      setEditingPrize(null);
    } catch (error) {
      console.error("Error updating prize:", error);
    }
  };

  const handleDeletePrize = async (id: string) => {
    try {
      await deleteDoc(doc(db, "prizes", id));
      fetchPrizes();
    } catch (error) {
      console.error("Error deleting prize:", error);
    }
  };

  const handleUploadImage = async (file: File, prizeId: string) => {
    setUploadingImageId(prizeId); 
    try {
      const { error } = await supabase.storage
        .from("prize_images")
        .upload(`${prizeId}/${file.name}`, file, {
            upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from("prize_images")
        .getPublicUrl(`${prizeId}/${file.name}`);

      const imageUrl = publicUrlData.publicUrl;
      await updateDoc(doc(db, "prizes", prizeId), { image_url: imageUrl });
      fetchPrizes();
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Gagal upload image, pastikan konfigurasi supabase benar.");
    } finally {
      setUploadingImageId(null); 
    }
  };

  const handleSavePrizes = async () => {
    setIsSaving(true);
    try {
      for (const prize of prizes) {
        await handleUpdatePrize(prize);
      }
      alert("Stok berhasil diupdate");
    } catch (error) {
      console.error("Error saving prizes:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- ARCHIVE AND RESET LOGIC ---
  const handleArchiveAndReset = async () => {
    if(!confirm("PERINGATAN: Aksi ini akan mengarsipkan data sesi saat ini dan me-reset sistem untuk sesi baru.\n\nNOTE: Nominee yang belum menang TIDAK akan dihapus.")) return;

    setIsSaving(true);
    try {
        const batch = writeBatch(db);

        // 1. Fetch data yang akan diarsipkan
        const dpPartSnap = await getDocs(collection(db, "doorprize_participants"));
        const awardNomSnap = await getDocs(collection(db, "award_nominees"));
        const awardWinSnap = await getDocs(collection(db, "award_winners"));
        const dpWinnersSnap = await getDocs(collection(db, "doorprize_winners")); 
        
        // --- ADDED: Fetch Award History to reset spin sessions ---
        const awardHistorySnap = await getDocs(collection(db, "award_history"));

        // --- IDENTIFIKASI PEMENANG AWARD ---
        // Kita butuh ID nominee yang menang agar bisa dihapus. Yang kalah tetap disimpan.
        const winningCandidateIds = new Set<string>();
        awardWinSnap.docs.forEach(doc => {
            const data = doc.data() as AwardWinnerSlot;
            if (data.candidateId && data.candidateId.trim() !== "") {
                winningCandidateIds.add(data.candidateId);
            }
        });
        
        // Buat data history winners yang komplit untuk arsip
        const nominees = awardNomSnap.docs.map(d => ({...d.data(), id: d.id} as AwardNominee));
        const historyWinners = awardWinSnap.docs.map(d => {
            const data = d.data() as AwardWinnerSlot;
            const nominee = nominees.find(n => n.id === data.candidateId);
            return {
                name: nominee ? nominee.name : "-",
                company: nominee ? nominee.company : "-",
                rank: data.rank,
                category: data.category,
                eventLabel: data.eventLabel || "Main Event"
            }
        });

        const archiveData = {
            archivedAt: serverTimestamp(),
            archivedBy: userData?.email,
            sessionData: {
                doorprize_participants: dpPartSnap.docs.map(d => d.data()),
                award_nominees: nominees,
                award_winners: awardWinSnap.docs.map(d => d.data()),
                award_history_winners: historyWinners,
                doorprize_winners: dpWinnersSnap.docs.map(d => d.data()),
                // Archive the award history log as well
                award_history_log: awardHistorySnap.docs.map(d => d.data())
            }
        };

        // 2. Simpan ke koleksi arsip
        const archiveRef = doc(collection(db, "archived_sessions"));
        batch.set(archiveRef, archiveData);

        // 3. Reset/Bersihkan Koleksi Aktif
        
        // Hapus Peserta Doorprize (Selalu dihapus karena per sesi)
        dpPartSnap.docs.forEach((doc) => batch.delete(doc.ref));

        // Hapus Nominees (KONDISIONAL: Hapus HANYA jika mereka MENANG)
        awardNomSnap.docs.forEach((doc) => {
            if (winningCandidateIds.has(doc.id)) {
                // Hapus pemenang dari daftar nominees aktif agar tidak muncul lagi
                batch.delete(doc.ref);
            }
            // Nominee yang kalah (tidak ada di winningCandidateIds) DIBIARKAN (tidak di-delete)
        });

        // Hapus Pemenang Doorprize
        dpWinnersSnap.docs.forEach((doc) => batch.delete(doc.ref));

        // --- ADDED: Hapus Award History (Reset Spin Session) ---
        awardHistorySnap.docs.forEach((doc) => batch.delete(doc.ref));

        // Reset Award Winners (Slots) - Kosongkan candidateId
        awardWinSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { candidateId: "" });
        });

        // Reset Status Session ke Closed
        const configRef = doc(db, "settings", "config");
        batch.update(configRef, { doorprizeStatus: "closed", awardStatus: "closed" });

        await batch.commit();

        // 4. Refresh Local Data
        fetchDoorprizeParticipants();
        fetchAwardData();
        fetchSchedulesAndPasscodes();
        
        if(activeTab === 'recap') fetchHistorySessions();

        alert("Sesi berhasil diarsipkan! Pemenang telah dihapus dari daftar nominasi, peserta lain tetap disimpan.");

    } catch (error) {
        console.error("Error archiving session:", error);
        alert("Gagal melakukan reset sesi. Cek konsol untuk detail.");
    } finally {
        setIsSaving(false);
    }
  };


  const filteredDoorprizeParticipants = doorprizeParticipants.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAwardNominees = awardNominees.filter((p) =>
    p.company.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // --- RENDER LOADING ---
  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-50">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
          <User className="w-10 h-10 text-blue-600 opacity-50" />
        </motion.div>
      </div>
    );
  }

  if (!userData) return null;

  // --- RENDER MAIN PANEL ---
  return (
    <div className="h-[100dvh] flex bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
      {/* MOBILE SIDEBAR BACKDROP */}
      <AnimatePresence>
        {isSidebarOpen && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-black/50 z-[45] backdrop-blur-sm"
            />
        )}
      </AnimatePresence>

      {/* SIDEBAR - FULLY RESPONSIVE */}
      <aside 
        className={`bg-white border-r border-slate-200 flex flex-col fixed h-full z-[50] transition-all duration-300 ease-in-out
            ${isSidebarOpen 
                ? "translate-x-0 w-[280px]" 
                : "-translate-x-full lg:translate-x-0 lg:w-20"
            }
        `}
      >
        <div className="h-20 flex items-center justify-center border-b border-slate-100 px-4 relative">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200 shrink-0">
            P
          </div>
          <span className={`ml-3 font-bold text-lg text-slate-700 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 lg:hidden"}`}>
            Panel Admin
          </span>
          
          <button 
             onClick={() => setIsSidebarOpen(false)}
             className="lg:hidden absolute right-4 text-slate-400 hover:text-slate-600 p-2"
          >
             <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          <SidebarItem 
            active={activeTab === "dashboard"} 
            onClick={() => { setActiveTab("dashboard"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            expanded={isSidebarOpen}
          />
          <SidebarItem 
            active={activeTab === "doorprize"} 
            onClick={() => { setActiveTab("doorprize"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Users size={20} />} 
            label="Doorprize Peserta" 
            expanded={isSidebarOpen}
          />
          <SidebarItem 
            active={activeTab === "award-nominees"} 
            onClick={() => { setActiveTab("award-nominees"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Users size={20} />} 
            label="Award Nominees" 
            expanded={isSidebarOpen}
          />
          <SidebarItem 
            active={activeTab === "awards"} 
            onClick={() => { setActiveTab("awards"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Medal size={20} />} 
            label="Awards" 
            expanded={isSidebarOpen}
          />
          <SidebarItem 
            active={activeTab === "prizes"} 
            onClick={() => { setActiveTab("prizes"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Gift size={20} />} 
            label="Stok Doorprize" 
            expanded={isSidebarOpen}
          />
          
          <div className="pt-4 mt-4 border-t border-slate-100">
             <SidebarItem 
                active={activeTab === "recap"} 
                onClick={() => { setActiveTab("recap"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                icon={<FileText size={20} />} 
                label="Rekap & Download" 
                expanded={isSidebarOpen}
              />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 pb-8 lg:pb-4">
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center ${isSidebarOpen ? "justify-start px-4" : "justify-center px-0"} gap-3 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium`}
            title="Logout"
          >
            <LogOut size={20} />
            <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 lg:hidden"}`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main 
        className={`flex-1 h-[100dvh] overflow-y-auto relative transition-all duration-300 ease-in-out bg-slate-50
            ${isSidebarOpen 
                ? "lg:ml-[280px] ml-0" 
                : "lg:ml-20 ml-0"
            }
        `}
      >
        <div className="p-4 md:p-6 lg:p-10 pb-20 md:pb-10"> 
        
        {/* HEADER */}
        <header className="flex justify-between items-center mb-8 relative z-30">
          <div className="flex items-center gap-3 md:gap-4">
              <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500"
              >
                <Menu size={24} />
              </button>
              <div className="overflow-hidden">
                <h1 className="text-lg md:text-2xl font-bold text-slate-800 capitalize truncate">{activeTab.replace('-', ' ')}</h1>
                <p className="text-slate-500 text-xs md:text-sm hidden sm:block truncate">Welcome back, {userData.email}</p>
              </div>
          </div>
          
          <div className="flex items-center gap-4">
            
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-400 p-0.5 cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all"
              >
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  <User size={20} className="text-blue-500" />
                </div>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden origin-top-right z-50"
                  >
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Signed in as</p>
                      <p className="text-sm font-bold text-slate-800 truncate" title={userData.email}>{userData.email}</p>
                    </div>
                    
                    <div className="p-4 space-y-3">
                        <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl">
                          <span className="text-sm text-slate-600 font-medium">Role Access</span>
                          <span className="text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded-md uppercase">{userData.role}</span>
                        </div>
                        
                        <button 
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 text-sm font-bold text-red-600 hover:bg-red-50 p-3 rounded-xl transition-colors"
                        >
                          <LogOut size={16} /> Sign Out
                        </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === "dashboard" && <DashboardView 
                doorprizeCount={doorprizeParticipants.length} 
                awardNomineeCount={awardNominees.length} 
                awardWinnerCount={awardWinners.filter(w => w.candidateId).length} 
                prizeCount={prizes.reduce((acc, p) => acc + p.stock, 0)} 
                setActiveTab={setActiveTab}
                onResetSession={handleArchiveAndReset}
                isResetting={isSaving}
            />}
            {activeTab === "doorprize" && <DoorprizeView 
              participants={filteredDoorprizeParticipants} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              onAdd={handleAddDoorprizeParticipant} 
              onDelete={handleDeleteDoorprizeParticipant} 
              onBulkDelete={handleBulkDeleteDoorprize}
              schedule={doorprizeSchedule}
              onSaveSchedule={(val) => handleSaveSchedule("doorprize", val)}
              passcode={doorprizePasscode}
              onSavePasscode={(val) => handleSavePasscode("doorprize", val)}
              status={doorprizeStatus}
              onToggleStatus={() => handleToggleStatus("doorprize", doorprizeStatus)}
              isSaving={isSaving}
            />}
            {activeTab === "award-nominees" && <AwardNomineesView 
              nominees={filteredAwardNominees} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              onAdd={handleAddAwardNominee} 
              onUpdate={handleUpdateAwardNominee} 
              onDelete={handleDeleteAwardNominee} 
              onBulkDelete={handleBulkDeleteNominees}
              onBulkAdd={handleBulkAddNominees}
            />}
            {activeTab === "awards" && <AwardsView 
              winners={awardWinners} 
              setWinners={setAwardWinners} 
              nominees={awardNominees} 
              onSave={handleSaveAwards} 
              isSaving={isSaving} 
              onInitialize={handleInitializeAwards}
              onAddManual={handleManualAddAward}
              schedule={awardSchedule}
              onSaveSchedule={(val) => handleSaveSchedule("award", val)}
              passcode={awardPasscode}
              onSavePasscode={(val) => handleSavePasscode("award", val)}
              status={awardStatus}
              onToggleStatus={() => handleToggleStatus("award", awardStatus)}
            />}
            {activeTab === "prizes" && <PrizesView 
              prizes={prizes} 
              setPrizes={setPrizes} 
              onSave={handleSavePrizes} 
              isSaving={isSaving} 
              onAdd={handleAddPrize} 
              onUpdate={handleUpdatePrize} 
              onDelete={handleDeletePrize} 
              onUploadImage={handleUploadImage} 
              uploadingImageId={uploadingImageId} 
              editingPrize={editingPrize} 
              setEditingPrize={setEditingPrize} 
            />}
            {activeTab === "recap" && <RecapView
              doorprizeWinners={doorprizeWinners}
              awardWinners={awardWinners}
              awardNominees={awardNominees}
              historySessions={historySessions}
              selectedSession={selectedSession}
              setSelectedSession={setSelectedSession}
            />}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- SUB-COMPONENTS UI ---

function SidebarItem({ active, onClick, icon, label, expanded }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, expanded: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center ${expanded ? "justify-start px-4" : "lg:justify-center lg:px-0 justify-start px-4"} gap-3 py-3 rounded-xl transition-all duration-200 group relative ${
        active 
          ? "bg-blue-600 text-white shadow-lg shadow-blue-200" 
          : "text-slate-500 hover:bg-white hover:text-blue-600"
      }`}
      title={(!expanded && typeof window !== "undefined" && window.innerWidth >= 1024) ? label : ""}
    >
      <span className={`${active ? "text-white" : "text-slate-400 group-hover:text-blue-600"} shrink-0`}>{icon}</span>
      <span className={`font-medium whitespace-nowrap overflow-hidden transition-all duration-300 
          ${expanded ? "opacity-100 w-auto" : "lg:opacity-0 lg:w-0 opacity-100 w-auto"}
        `}>{label}</span>
      
      {active && expanded && <ChevronRight size={16} className="ml-auto opacity-50 shrink-0" />}
      
      {!expanded && (
        <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            {label}
        </div>
      )}
    </button>
  );
}

function DashboardView({ 
    doorprizeCount, awardNomineeCount, awardWinnerCount, prizeCount, setActiveTab, onResetSession, isResetting 
}: { 
    doorprizeCount: number, awardNomineeCount: number, awardWinnerCount: number, prizeCount: number, setActiveTab: (tab: TabType) => void, onResetSession: () => void, isResetting: boolean
}) {
    
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

function DoorprizeView({ 
  participants, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onDelete,
  onBulkDelete,
  schedule,
  onSaveSchedule,
  passcode,
  onSavePasscode,
  status,
  onToggleStatus,
  isSaving
}: { 
  participants: DoorprizeParticipant[], 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  onAdd: (name: string) => void, 
  onDelete: (id: string) => void,
  onBulkDelete: (ids: string[]) => void,
  schedule: string,
  onSaveSchedule: (val: string) => void,
  passcode: string,
  onSavePasscode: (val: string) => void,
  status: "open" | "closed",
  onToggleStatus: () => void,
  isSaving: boolean
}) {
  const [newName, setNewName] = useState("");
  const [tempSchedule, setTempSchedule] = useState(schedule || "");
  const [tempPasscode, setTempPasscode] = useState(passcode || "");
   
  // MULTI SELECT STATE
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmitAdd = () => {
    onAdd(newName);
    setNewName("");
  };

  const generatePasscode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTempPasscode(randomCode);
  }

  // Handle Select All (for filtered items)
  const handleSelectAll = () => {
      if (selectedIds.length === participants.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(participants.map(p => p.id));
      }
  };

  // Handle Toggle One
  const handleToggleSelect = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter(i => i !== id));
      } else {
          setSelectedIds([...selectedIds, id]);
      }
  };

  const handleBulkDeleteAction = () => {
      if (confirm(`Yakin ingin menghapus ${selectedIds.length} peserta terpilih?`)) {
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };

  return (
    <div className="space-y-6">
        
        {/* GRID LAYOUT FOR CONFIGURATION */}
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
                        <h3 className="font-bold text-slate-800">Atur Jadwal Doorprize</h3>
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

        {/* LIST CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
            <div className="relative w-full md:w-auto flex items-center gap-2">
                 {/* BULK DELETE BUTTON */}
                 {selectedIds.length > 0 && (
                     <button 
                        onClick={handleBulkDeleteAction}
                        className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors animate-in fade-in zoom-in duration-200"
                     >
                         <Trash2 size={16} /> Delete ({selectedIds.length})
                     </button>
                 )}
                 
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari peserta..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-50 rounded-lg border-none focus:ring-2 focus:ring-blue-100 outline-none text-sm w-full md:w-64"
                    />
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <input 
                type="text" 
                placeholder="Nama Peserta Baru" 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full sm:w-auto flex-1 md:flex-none px-4 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
            />
            <button onClick={handleSubmitAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap">
                <Plus size={16} /> Tambah
            </button>
            </div>
        </div>
        
        {participants.length === 0 ? (
            <div className="p-10 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Users className="text-slate-300 w-8 h-8" />
                </div>
                <h3 className="text-slate-500 font-medium">Belum ada peserta doorprize</h3>
                <p className="text-slate-400 text-sm">Tambahkan peserta baru pada form di atas</p>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                    <th className="px-6 py-4 w-10">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.length === participants.length && participants.length > 0}
                            onChange={handleSelectAll}
                        />
                    </th>
                    <th className="px-6 py-4 font-bold w-12">No</th>
                    <th className="px-6 py-4 font-bold">Nama Lengkap</th>
                    <th className="px-6 py-4 font-bold text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {participants.map((p, i) => (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(p.id) ? 'bg-blue-50/50' : ''}`}>
                        <td className="px-6 py-4">
                             <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={selectedIds.includes(p.id)}
                                onChange={() => handleToggleSelect(p.id)}
                            />
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-sm whitespace-nowrap">{i + 1}</td>
                        <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{p.name}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button onClick={() => onDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={16} />
                        </button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        )}
        </div>
    </div>
  );
}

function AwardNomineesView({ 
  nominees, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onUpdate, 
  onDelete,
  onBulkDelete,
  onBulkAdd
}: { 
  nominees: AwardNominee[], 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  onAdd: (singleName: string) => void, 
  onUpdate: (updated: AwardNominee) => void, 
  onDelete: (id: string) => void,
  onBulkDelete: (ids: string[]) => void,
  onBulkAdd: (names: string[]) => Promise<void>
}) {
  const [newSingleName, setNewSingleName] = useState("");
  const [editingNominee, setEditingNominee] = useState<AwardNominee | null>(null);
   
  // MULTI SELECT STATE
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // OCR States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [scannedImage, setScannedImage] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResults, setScannedResults] = useState<string[]>([]);

  const handleSubmitAdd = () => {
    onAdd(newSingleName);
    setNewSingleName("");
  };

  const handleStartEdit = (nominee: AwardNominee) => {
    setEditingNominee(nominee);
  };

  const handleChangeEdit = (value: string) => {
    if (editingNominee) {
      setEditingNominee({ ...editingNominee, name: value, company: value });
    }
  };

  const handleSubmitEdit = () => {
    if (editingNominee) {
      onUpdate(editingNominee);
      setEditingNominee(null);
    }
  };

  // --- MULTI SELECT LOGIC ---
  const handleSelectAll = () => {
      if (selectedIds.length === nominees.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(nominees.map(p => p.id));
      }
  };

  const handleToggleSelect = (id: string) => {
      if (selectedIds.includes(id)) {
          setSelectedIds(selectedIds.filter(i => i !== id));
      } else {
          setSelectedIds([...selectedIds, id]);
      }
  };

  const handleBulkDeleteAction = () => {
      if (confirm(`Yakin ingin menghapus ${selectedIds.length} nominees terpilih?`)) {
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };

  // --- GEMINI OCR LOGIC START ---
  const handleScanImage = async () => {
      if (!scannedImage) return;
      setIsScanning(true);
      try {
          // Inisialisasi Gemini (Pastikan API Key ada di .env.local: NEXT_PUBLIC_GEMINI_API_KEY)
          const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
          const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

          const imagePart = await fileToGenerativePart(scannedImage);

          const prompt = `
            Analisis gambar ini dan ekstrak daftar nama Customer atau nama PT/Perusahaan.
            Abaikan:
            - Header tabel
            - Angka urutan (No)
            - Tanggal
            - Kata-kata kategori hadiah seperti "Top Spender", "The Most Loyal Customer", "Rising Star".

            Keluarkan hasilnya HANYA sebagai JSON Array of Strings murni.
            Contoh format output: ["PT. Sumber Makmur", "CV. Jaya Abadi", "Budi Santoso"]
            Jangan gunakan markdown formatting (seperti \`\`\`json).
          `;

          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          let text = response.text();
          
          // Bersihkan format markdown jika Gemini menambahkannya
          text = text.replace(/```json/g, "").replace(/```/g, "").trim();

          const parsedNames = JSON.parse(text);

          if (Array.isArray(parsedNames)) {
              setScannedResults(parsedNames);
          } else {
              alert("Gagal memparsing hasil AI.");
          }

      } catch (error) {
          console.error("Gemini OCR Error:", error);
          alert("Gagal memindai gambar atau API Key tidak valid.");
      } finally {
          setIsScanning(false);
      }
  };

  const handleSaveScannedNominees = async () => {
      if (scannedResults.length === 0) return;
      await onBulkAdd(scannedResults);
      setScannedResults([]);
      setScannedImage(null);
      setIsImportModalOpen(false);
  }
  // --- OCR LOGIC END ---

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="flex gap-2 w-full md:w-auto items-center">
             {/* BULK DELETE BUTTON */}
             {selectedIds.length > 0 && (
                 <button 
                    onClick={handleBulkDeleteAction}
                    className="px-3 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors animate-in fade-in zoom-in duration-200"
                 >
                     <Trash2 size={16} /> Delete ({selectedIds.length})
                 </button>
             )}

             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Cari nominee..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-50 rounded-lg border-none focus:ring-2 focus:ring-blue-100 outline-none text-sm w-full"
                />
            </div>
            {/* BUTTON IMPORT IMAGE */}
            <button 
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors"
                title="Import dari Gambar"
            >
                <ScanLine size={18} /> <span className="hidden sm:inline">Import Gambar</span>
            </button>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          {/* Modified Input: Single Field for Customer/PT */}
          <input 
            type="text" 
            placeholder="Nama Costumer (PT/Perorangan)" 
            value={newSingleName}
            onChange={(e) => setNewSingleName(e.target.value)}
            className="w-full md:w-64 px-4 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button onClick={handleSubmitAdd} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>
      
      {nominees.length === 0 ? (
        <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
               <Users className="text-slate-300 w-8 h-8" />
            </div>
            <h3 className="text-slate-500 font-medium">Belum ada award nominees</h3>
            <p className="text-slate-400 text-sm">Mulai tambahkan kandidat untuk pemilihan</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                    <th className="px-6 py-4 w-10">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.length === nominees.length && nominees.length > 0}
                            onChange={handleSelectAll}
                        />
                    </th>
                    <th className="px-6 py-4 font-bold w-12">No</th>
                    <th className="px-6 py-4 font-bold">Nama Costumer (PT)</th>
                    <th className="px-6 py-4 font-bold text-right">Aksi</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {nominees.map((c, i) => (
                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(c.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4">
                         <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedIds.includes(c.id)}
                            onChange={() => handleToggleSelect(c.id)}
                        />
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm whitespace-nowrap">{i + 1}</td>
                    {/* Display Company/Name from merged field */}
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{c.company}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2 whitespace-nowrap">
                        <button onClick={() => handleStartEdit(c)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
                        <Edit3 size={16} />
                        </button>
                        <button onClick={() => onDelete(c.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                        </button>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingNominee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Edit Nominee</h3>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Nama Costumer</label>
                    <input 
                    type="text" 
                    value={editingNominee.company} 
                    onChange={(e) => handleChangeEdit(e.target.value)} 
                    className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-blue-500" 
                    />
                </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmitEdit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Simpan</button>
              <button onClick={() => setEditingNominee(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT IMAGE MODAL */}
      <AnimatePresence>
      {isImportModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
             <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
             >
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ScanLine className="text-indigo-600" /> Import dari Gambar (AI)
                    </h3>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-5 overflow-y-auto">
                    {!scannedImage ? (
                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => { if(e.target.files?.[0]) setScannedImage(e.target.files[0]) }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <ImageIcon size={48} className="text-slate-300 mb-2"/>
                            <p className="font-medium text-slate-600">Klik untuk upload gambar tabel</p>
                            <p className="text-xs text-slate-400 mt-1">Format: JPG, PNG</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="p-2 bg-white rounded border border-slate-100">
                                    <ImageIcon size={20} className="text-indigo-500" />
                                </div>
                                <span className="text-sm font-medium text-slate-700 truncate flex-1">{scannedImage.name}</span>
                                <button onClick={() => { setScannedImage(null); setScannedResults([]); }} className="text-red-500 text-xs font-bold hover:underline">Ganti</button>
                            </div>
                            
                            {isScanning ? (
                                <div className="py-8 text-center space-y-3">
                                    <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                                    <p className="text-sm text-slate-500 font-medium">Sedang membaca teks dengan AI...</p>
                                </div>
                            ) : scannedResults.length > 0 ? (
                                <div>
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Hasil Scan ({scannedResults.length} Nama)</p>
                                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                        {scannedResults.map((res, idx) => (
                                            <div key={idx} className="p-2 text-sm text-slate-700 bg-white px-3">
                                                {res}
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 italic">*Hanya kolom Nama Customer yang diambil.</p>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <button 
                                        onClick={handleScanImage}
                                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 transition-all"
                                    >
                                        Mulai Scan OCR
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
                    {scannedResults.length > 0 && (
                        <button 
                            onClick={handleSaveScannedNominees}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors"
                        >
                            Simpan ke Database
                        </button>
                    )}
                </div>
             </motion.div>
          </div>
      )}
      </AnimatePresence>

    </div>
  );
}

function AwardsView({ 
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
}: { 
  winners: AwardWinnerSlot[], 
  setWinners: (p: AwardWinnerSlot[]) => void, 
  nominees: AwardNominee[], 
  onSave: () => void, 
  isSaving: boolean,
  onInitialize: () => void,
  onAddManual: (cat: string, slots: number, label: string) => void,
  schedule: string,
  onSaveSchedule: (val: string) => void,
  passcode: string,
  onSavePasscode: (val: string) => void,
  status: "open" | "closed",
  onToggleStatus: () => void
}) {
  const [tempSchedule, setTempSchedule] = useState(schedule || "");
  const [tempPasscode, setTempPasscode] = useState(passcode || "");
    
  // // State for adding manual category
  // const [newCategoryName, setNewCategoryName] = useState("");
  // // Default to 3 slots for Rank 1, 2, 3 as requested
  // const [newSlotCount, setNewSlotCount] = useState(3); 
  // const [newEventLabel, setNewEventLabel] = useState("");

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
                  Inisialisasi Kategori (Top 3)
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
                                                'bg-orange-400'
                                            }`}>
                                                JUARA {slot.rank}
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

function PrizesView({ 
  prizes, 
  setPrizes, 
  onSave, 
  isSaving, 
  onAdd, 
  onUpdate, 
  onDelete, 
  onUploadImage, 
  uploadingImageId, 
  editingPrize, 
  setEditingPrize 
}: { 
  prizes: Prize[], 
  setPrizes: (p: Prize[]) => void, 
  onSave: () => void, 
  isSaving: boolean, 
  onAdd: (newPrize: Omit<Prize, "id">) => Promise<string>, 
  onUpdate: (updated: Prize) => void, 
  onDelete: (id: string) => void, 
  onUploadImage: (file: File, prizeId: string) => void, 
  uploadingImageId: string | null, 
  editingPrize: Prize | null, 
  setEditingPrize: (p: Prize | null) => void 
}) {
  const [newPrize, setNewPrize] = useState<Omit<Prize, "id">>({ name: "", stock: 0 }); 
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [isUploadingNew, setIsUploadingNew] = useState(false);

  const handleChangeStock = (id: string, delta: number) => {
    setPrizes(prizes.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
  };

  const handleStartEdit = (prize: Prize) => {
    setEditingPrize(prize);
  };

  const handleChangeEdit = (field: keyof Prize, value: string | number) => {
    if (editingPrize) {
      setEditingPrize({ ...editingPrize, [field]: value });
    }
  };

  const handleSubmitEdit = () => {
    if (editingPrize) {
      onUpdate(editingPrize);
    }
  };

  const handleSubmitAdd = async () => {
    if (!newPrize.name) return; 

    setIsUploadingNew(true);
    try {
      const prizeId = await onAdd(newPrize);

      if (newImageFile) {
        onUploadImage(newImageFile, prizeId);
      }

      setNewPrize({ name: "", stock: 0 });
      setNewImageFile(null);
    } catch (error) {
      console.error("Error adding new prize:", error);
      alert("Gagal menambahkan hadiah.");
    } finally {
      setIsUploadingNew(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, prizeId: string) => {
    if (e.target.files && e.target.files[0]) {
      onUploadImage(e.target.files[0], prizeId);
    }
  };

  const handleNewImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setNewImageFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 bg-slate-50/90 backdrop-blur-sm z-20 py-4 border-b border-slate-200 gap-4">
        <div>
            <h3 className="text-xl font-bold text-slate-800">Inventori Hadiah</h3>
            <p className="text-slate-500 text-sm hidden sm:block">Kelola stok dan gambar hadiah doorprize</p>
        </div>
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          {isSaving ? "Menyimpan..." : <><Save size={18} /> Update Stok</>}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* ADD NEW CARD */}
        <div className="bg-white p-5 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col gap-3 group hover:border-blue-400 transition-colors">
            <h4 className="font-bold text-slate-700 flex items-center gap-2"><Plus className="bg-blue-100 text-blue-600 rounded-md p-0.5" size={20}/> Tambah Baru</h4>
            <div className="space-y-3 flex-1">
                <input 
                    type="text" 
                    placeholder="Nama Hadiah" 
                    value={newPrize.name} 
                    onChange={(e) => setNewPrize({ ...newPrize, name: e.target.value })} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                />
                <input 
                    type="number" 
                    placeholder="Stok Awal" 
                    value={newPrize.stock} 
                    onChange={(e) => setNewPrize({ ...newPrize, stock: parseInt(e.target.value) || 0 })} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                />
                <label className="block">
                  <span className="text-xs font-bold text-slate-400 uppercase mb-1">Gambar Hadiah</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleNewImageChange} 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                  />
                  {newImageFile && <p className="text-xs text-slate-500 mt-1 truncate">{newImageFile.name}</p>}
                </label>
            </div>
            <button 
              onClick={handleSubmitAdd} 
              disabled={isUploadingNew}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isUploadingNew ? (
                  <>
                      <Loader2 className="animate-spin" size={18} /> Menambahkan...
                  </>
              ) : "Tambah Item"}
            </button>
        </div>

        {/* Existing Prizes Cards */}
        {prizes.map((prize) => {
            const isThisUploading = uploadingImageId === prize.id;
            
            return (
           <div key={prize.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group">
              {/* Image Area */}
              <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                  
                  {/* LOADING OVERLAY SAAT UPLOAD IMAGE */}
                  {isThisUploading && (
                    <div className="absolute inset-0 z-20 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <span className="text-xs font-bold">Uploading...</span>
                    </div>
                  )}

                  {prize.image_url ? (
                      <img 
                        src={prize.image_url} 
                        alt={prize.name} 
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                  ) : (
                      <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-slate-300">
                          <ImageIcon size={32} />
                          <span className="text-xs mt-2 font-medium">No Image</span>
                      </div>
                  )}
                  
                  {/* Action Buttons Overlay */}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={() => handleStartEdit(prize)} className="p-2 bg-white text-slate-700 rounded-lg shadow-sm hover:text-blue-600"><Edit3 size={14}/></button>
                      <button onClick={() => onDelete(prize.id)} className="p-2 bg-white text-slate-700 rounded-lg shadow-sm hover:text-red-600"><Trash2 size={14}/></button>
                  </div>
                  
                  {/* Upload Overlay */}
                  <label htmlFor={`img-${prize.id}`} className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform cursor-pointer flex items-center justify-center gap-2 text-white text-xs font-bold z-10 ${isThisUploading ? 'hidden' : ''}`}>
                    <Upload size={14} /> Ganti Foto
                  </label>
                  <input id={`img-${prize.id}`} type="file" accept="image/*" onChange={(e) => handleImageChange(e, prize.id)} className="hidden" disabled={isThisUploading} />
              </div>

              {/* Content Area */}
              <div className="p-4 flex-1 flex flex-col">
                  <h4 className="font-bold text-slate-800 text-lg mb-1 leading-tight line-clamp-1" title={prize.name}>{prize.name}</h4>
                  <div className="mt-auto pt-4 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase">Stok</span>
                      <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-1 border border-slate-100">
                          <button onClick={() => handleChangeStock(prize.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-white hover:bg-slate-200 text-slate-600 shadow-sm font-bold text-lg leading-none pb-1">-</button>
                          <span className="w-8 text-center font-bold text-slate-800">{prize.stock}</span>
                          <button onClick={() => handleChangeStock(prize.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 font-bold text-lg leading-none pb-1">+</button>
                      </div>
                  </div>
              </div>
           </div>
        )})}
      </div>

      {prizes.length === 0 && (
          <div className="col-span-full py-10 flex flex-col items-center justify-center text-center opacity-50">
              <Package size={48} className="text-slate-300 mb-3" />
              <p className="font-medium text-slate-500">Belum ada stok hadiah</p>
          </div>
      )}

      {/* Edit Modal */}
      {editingPrize && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Edit Hadiah</h3>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nama Item</label>
                    <input 
                    type="text" 
                    value={editingPrize.name} 
                    onChange={(e) => handleChangeEdit("name", e.target.value)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-100 outline-none" 
                    />
                </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingPrize(null)} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors">Batal</button>
              <button onClick={handleSubmitEdit} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-200">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecapView({ 
    doorprizeWinners, 
    awardWinners,
    awardNominees,
    historySessions,
    selectedSession,
    setSelectedSession
}: { 
    doorprizeWinners: DoorprizeWinner[],
    awardWinners: AwardWinnerSlot[],
    awardNominees: AwardNominee[],
    historySessions: ArchivedSession[],
    selectedSession: string,
    setSelectedSession: (id: string) => void
}) {
    
    // Helper to get Award Winner Name
    const getAwardName = (candidateId: string) => {
        const c = awardNominees.find(rc => rc.id === candidateId);
        return c ? c.company : "Belum ditentukan";
    };

    const getAwardRawData = () => {
        return awardWinners.filter(p => p.candidateId).map(p => {
            const nominee = awardNominees.find(c => c.id === p.candidateId);
            return {
                Event: p.eventLabel || "Main Event",
                Category: p.category,
                Rank: p.rank,
                PT: nominee?.company || "-",
            };
        });
    };

    const getDoorprizeRawData = () => {
        return doorprizeWinners.map((w, i) => ({
            No: i + 1,
            Name: w.name,
            Prize: w.prizeName || "Hadiah Doorprize"
        }));
    };

    // --- EXPORT FUNCTIONS ---

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Award Winners
        const awardData = getAwardRawData();
        const wsAward = XLSX.utils.json_to_sheet(awardData);
        XLSX.utils.book_append_sheet(wb, wsAward, "Awards");

        // Sheet 2: Doorprize Winners
        const doorprizeData = getDoorprizeRawData();
        const wsDoorprize = XLSX.utils.json_to_sheet(doorprizeData);
        XLSX.utils.book_append_sheet(wb, wsDoorprize, "Doorprize Winners");

        XLSX.writeFile(wb, "Rekap_Pemenang_Acara.xlsx");
    };

    const exportToCSV = () => {
        const awardData = getAwardRawData();
        const doorprizeData = getDoorprizeRawData();

        let csvContent = "data:text/csv;charset=utf-8,";
        
        csvContent += "AWARDS\n";
        csvContent += "Event,Category,Rank,PT Name\n";
        awardData.forEach(row => {
            csvContent += `"${row.Event}","${row.Category}",${row.Rank},"${row.PT}"\n`;
        });

        csvContent += "\nDOORPRIZE WINNERS\n";
        csvContent += "No,Name,Prize\n";
        doorprizeData.forEach(row => {
            csvContent += `${row.No},"${row.Name}","${row.Prize}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "rekap_data.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        type JsPDFWithAutoTable = jsPDF & {
          lastAutoTable?: {
            finalY: number;
          };
        };
        const doc = new jsPDF() as JsPDFWithAutoTable;

        doc.setFontSize(18);
        doc.text("Laporan Rekap Pemenang Acara", 14, 22);

        doc.setFontSize(11);
        doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, 14, 30);

        // Award Table
        doc.setFontSize(14);
        doc.text("Pemenang Awards", 14, 45);

        const awardData = getAwardRawData().map(r => [
            r.Event,
            r.Category,
            `Juara ${r.Rank}`,
            r.PT
        ]);

        autoTable(doc, {
            startY: 50,
            head: [["Event/Sesi", "Category", "Rank", "Nama Costumer/PT"]],
            body: awardData,
            theme: "grid",
            headStyles: { fillColor: [59, 130, 246] }
        });

        // Doorprize Table
        const finalY = (doc.lastAutoTable?.finalY ?? 50) + 20;

        doc.text("Pemenang Doorprize", 14, finalY);

        const doorprizeData = getDoorprizeRawData().map(d => [
            d.No,
            d.Name,
            d.Prize
        ]);

        autoTable(doc, {
            startY: finalY + 5,
            head: [["No", "Nama Pemenang", "Hadiah"]],
            body: doorprizeData,
            theme: "grid",
            headStyles: { fillColor: [234, 179, 8] }
        });

        doc.save("rekap_pemenang.pdf");
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex flex-col sm:flex-row gap-6 w-full xl:w-auto">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="text-blue-600"/> Rekap & Download
                        </h3>
                        <p className="text-slate-500 text-sm">Lihat history dan unduh data pemenang.</p>
                    </div>
                    
                    {/* DROPDOWN FILTER HISTORY */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                          <div className="bg-white p-2 rounded-lg shadow-sm text-slate-500">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Pilih Tanggal Sesi</label>
                            <select 
                                value={selectedSession} 
                                onChange={(e) => setSelectedSession(e.target.value)}
                                className="bg-transparent font-bold text-slate-700 outline-none text-sm min-w-[200px]"
                            >
                                <option value="active">Sesi Aktif (Current)</option>
                                <option disabled>─── Arsip / History ───</option>
                                {historySessions.map(sess => (
                                    <option key={sess.id} value={sess.id}>
                                        {sess.label}
                                    </option>
                                ))}
                            </select>
                          </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                    <button onClick={exportToCSV} className="flex-1 xl:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                        <FileText size={16}/> CSV
                    </button>
                    <button onClick={exportToExcel} className="flex-1 xl:flex-none px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                        <FileSpreadsheet size={16}/> Excel
                    </button>
                    <button onClick={exportToPDF} className="flex-1 xl:flex-none px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors">
                        <Download size={16}/> PDF
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* TABLE AWARDS */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Medal size={18} className="text-yellow-500"/> Pemenang Awards</h4>
                        <span className="bg-white px-2 py-1 rounded text-xs font-bold text-slate-500 border border-slate-200">{awardWinners.filter(p => p.candidateId).length} Pemenang</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[500px]">
                            <thead className="bg-white text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 font-bold w-12 text-center">#</th>
                                    <th className="px-4 py-3 font-bold">Kategori & Event</th>
                                    <th className="px-4 py-3 font-bold">Pemenang</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {awardWinners.filter(p => p.candidateId).map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-center font-black text-slate-700">{p.rank}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-blue-600">{p.category || "-"}</div>
                                            <div className="text-xs text-slate-400">{p.eventLabel || "Main Event"}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700">{getAwardName(p.candidateId)}</td>
                                    </tr>
                                ))}
                                {awardWinners.filter(p => p.candidateId).length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Belum ada data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* TABLE DOORPRIZE */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Gift size={18} className="text-blue-500"/> Pemenang Doorprize</h4>
                        <span className="bg-white px-2 py-1 rounded text-xs font-bold text-slate-500 border border-slate-200">{doorprizeWinners.length} Pemenang</span>
                    </div>
                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left text-sm min-w-[500px]">
                            <thead className="bg-white text-slate-500 border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 font-bold w-12">No</th>
                                    <th className="px-4 py-3 font-bold">Nama Pemenang</th>
                                    <th className="px-4 py-3 font-bold">Hadiah</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {doorprizeWinners.map((w, i) => (
                                    <tr key={w.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-500 font-mono">{i + 1}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{w.name}</td>
                                        <td className="px-4 py-3 text-blue-600">{w.prizeName || "Doorprize"}</td>
                                    </tr>
                                ))}
                                {doorprizeWinners.length === 0 && (
                                    <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-400">Belum ada pemenang</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}