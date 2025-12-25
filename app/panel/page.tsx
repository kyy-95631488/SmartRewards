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
  AlertCircle, Image as ImageIcon, Sparkles, Menu, ArrowRight, Loader2,
  Clock, X, Key, Shuffle, Lock, Unlock, Power, Archive,
  FileText, Download, FileSpreadsheet, Calendar
} from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { supabase } from "../lib/supabase"; 

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

// Interface untuk pemenang doorprize (biasanya hasil dari spin)
interface DoorprizeWinner {
    id: string;
    name: string;
    wonAt?: unknown;
    prizeName?: string;
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

interface RoyalWinner {
    id?: string;
    name: string;
    company: string;
    rank: number;
    title: string;
}

export default function PanelPage() {
  // --- AUTH STATE ---
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<"dashboard" | "doorprize" | "royal-candidates" | "royal" | "prizes" | "recap">("dashboard");
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 

  // --- DATA STATES ---
  const [doorprizeParticipants, setDoorprizeParticipants] = useState<DoorprizeParticipant[]>([]);
  const [doorprizeWinners, setDoorprizeWinners] = useState<DoorprizeWinner[]>([]); 
  const [royalCandidates, setRoyalCandidates] = useState<RoyalCandidate[]>([]);
  const [royalParticipants, setRoyalParticipants] = useState<RoyalParticipant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
    
  // --- HISTORY / RECAP STATE ---
  const [historySessions, setHistorySessions] = useState<ArchivedSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("active"); // 'active' or doc ID

  // --- SCHEDULE, PASSCODE & STATUS STATES ---
  const [doorprizeSchedule, setDoorprizeSchedule] = useState("");
  const [royalSchedule, setRoyalSchedule] = useState("");
  const [doorprizePasscode, setDoorprizePasscode] = useState("");
  const [royalPasscode, setRoyalPasscode] = useState("");
     
  // New Status States
  const [doorprizeStatus, setDoorprizeStatus] = useState<"open" | "closed">("closed");
  const [royalStatus, setRoyalStatus] = useState<"open" | "closed">("closed");

  const [searchQuery, setSearchQuery] = useState("");
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null); 

  // --- RESPONSIVE CHECK & AUTH LOGIC ---
  useEffect(() => {
    // Auto-close sidebar on mobile initial load
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
  // Gunakan useCallback untuk menghindari re-render loop
  const fetchHistorySessions = useCallback(async () => {
      try {
          const q = query(collection(db, "archived_sessions"), orderBy("archivedAt", "desc"));
          const snapshot = await getDocs(q);
          const sessions: ArchivedSession[] = snapshot.docs.map(doc => {
              const data = doc.data();
              // Format Timestamp
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
  // Gunakan useCallback untuk menghindari re-render loop
  const fetchSchedulesAndPasscodes = useCallback(async () => {
    try {
        const docRef = doc(db, "settings", "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.doorprizeStart) setDoorprizeSchedule(data.doorprizeStart);
            if (data.royalStart) setRoyalSchedule(data.royalStart);
            if (data.doorprizePasscode) setDoorprizePasscode(data.doorprizePasscode);
            if (data.royalPasscode) setRoyalPasscode(data.royalPasscode);
            
            // Fetch Status
            if (data.doorprizeStatus) setDoorprizeStatus(data.doorprizeStatus);
            if (data.royalStatus) setRoyalStatus(data.royalStatus);
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    }
  }, []);

  // Gunakan useCallback untuk menghindari re-render loop
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

  // FETCH Doorprize Winners (Active or Selected History)
  // Gunakan useCallback untuk menghindari re-render loop
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

  // --- FETCH ROYAL DATA (SMART FETCH FOR HISTORY) ---
  // Gunakan useCallback untuk menghindari re-render loop
  const fetchRoyalData = useCallback(async () => {
    try {
        if (selectedSession === "active") {
            // 1. Fetch Candidates Aktif
            const qC = query(collection(db, "royal_candidates"));
            const snapC = await getDocs(qC);
            const cData: RoyalCandidate[] = snapC.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<RoyalCandidate, "id">),
            }));
            setRoyalCandidates(cData);

            // 2. Fetch Participants Aktif
            const qP = query(collection(db, "royal_participants"));
            const snapP = await getDocs(qP);
            const pData: RoyalParticipant[] = snapP.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<RoyalParticipant, "id">),
            }));
            setRoyalParticipants(pData.sort((a, b) => a.rank - b.rank));

        } else {
            // HISTORY MODE
            const docRef = doc(db, "archived_sessions", selectedSession);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const sessionData = docSnap.data().sessionData;
                
                // PRIORITAS 1: Gunakan royal_winners jika ada
                if (sessionData && sessionData.royal_winners && sessionData.royal_winners.length > 0) {
                    
                    const winners = sessionData.royal_winners;
                    
                    const syntheticCandidates: RoyalCandidate[] = winners.map((w: RoyalWinner, index: number) => ({
                        id: `hist_c_${index}`,
                        name: w.name,
                        company: w.company
                    }));

                    const syntheticParticipants: RoyalParticipant[] = winners.map((w: RoyalWinner, index: number) => ({
                        id: `hist_p_${index}`,
                        rank: w.rank,
                        candidateId: `hist_c_${index}`, 
                        title: w.title
                    }));

                    setRoyalCandidates(syntheticCandidates);
                    setRoyalParticipants(syntheticParticipants.sort((a, b) => a.rank - b.rank));

                } else if (sessionData && sessionData.royal_slots) {
                    // PRIORITAS 2: Legacy fallback
                    const sData = sessionData.royal_slots.map((s: RoyalParticipant, idx: number) => ({
                        ...s, id: s.id || `hist_p_${idx}`
                    }));
                    
                    let cData: RoyalCandidate[] = [];
                    if(sessionData.royal_candidates) {
                        cData = sessionData.royal_candidates.map((c: RoyalCandidate, idx: number) => ({
                            ...c, id: c.id || `hist_c_fallback_${idx}` 
                        }));
                    }

                    setRoyalParticipants(sData.sort((a: RoyalParticipant, b: RoyalParticipant) => a.rank - b.rank));
                    setRoyalCandidates(cData);
                } else {
                    setRoyalParticipants([]);
                    setRoyalCandidates([]);
                }
            }
        }
    } catch (error) {
        console.error("Error fetching royal data:", error);
    }
  }, [selectedSession]);

  // Gunakan useCallback untuk menghindari re-render loop
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
    
    // Reset session to active if not in recap to avoid editing confusion
    if (activeTab !== 'recap' && activeTab !== 'dashboard') {
        if(selectedSession !== 'active') setSelectedSession('active');
    }

    if (activeTab === "recap") {
        fetchHistorySessions(); // Load list of available dates
        fetchDoorprizeWinners();
        fetchRoyalData(); // Menggabungkan Participants & Candidates
    } 
    else if (activeTab === "doorprize") {
      fetchDoorprizeParticipants();
    } else if (activeTab === "royal-candidates") {
      fetchRoyalData();
    } else if (activeTab === "royal") {
      fetchRoyalData();
    } else if (activeTab === "prizes") {
      fetchPrizes();
    } else if (activeTab === "dashboard") {
       fetchDoorprizeParticipants();
       fetchRoyalData();
       fetchPrizes();
       if(selectedSession === 'active') fetchDoorprizeWinners(); 
    }
  }, [activeTab, fetchDoorprizeWinners, fetchRoyalData, selectedSession, fetchSchedulesAndPasscodes, fetchHistorySessions, fetchDoorprizeParticipants, fetchPrizes]);

  // --- HANDLER SETTINGS (Schedule, Passcode, Status) ---
  const handleSaveSchedule = async (type: "doorprize" | "royal", value: string) => {
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, { 
            [type === "doorprize" ? "doorprizeStart" : "royalStart"]: value 
        }, { merge: true });
        
        if (type === "doorprize") setDoorprizeSchedule(value);
        else setRoyalSchedule(value);
        
        alert(`Jadwal ${type} berhasil disimpan!`);
    } catch (error) {
        console.error("Error saving schedule:", error);
        alert("Gagal menyimpan jadwal.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleSavePasscode = async (type: "doorprize" | "royal", value: string) => {
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, { 
            [type === "doorprize" ? "doorprizePasscode" : "royalPasscode"]: value 
        }, { merge: true });
        
        if (type === "doorprize") setDoorprizePasscode(value);
        else setRoyalPasscode(value);
        
        alert(`Passcode ${type} berhasil disimpan!`);
    } catch (error) {
        console.error("Error saving passcode:", error);
        alert("Gagal menyimpan passcode.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleToggleStatus = async (type: "doorprize" | "royal", currentStatus: "open" | "closed") => {
    const newStatus = currentStatus === "open" ? "closed" : "open";
    setIsSaving(true);
    try {
        const docRef = doc(db, "settings", "config");
        await setDoc(docRef, {
            [type === "doorprize" ? "doorprizeStatus" : "royalStatus"]: newStatus
        }, { merge: true });

        if (type === "doorprize") setDoorprizeStatus(newStatus);
        else setRoyalStatus(newStatus);

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

  // --- HANDLERS FOR ROYAL CANDIDATES ---
  const handleAddRoyalCandidate = async (name: string, company: string) => {
    if (!name || !company) return;
    try {
      const newRef = doc(collection(db, "royal_candidates"));
      await setDoc(newRef, { name, company });
      fetchRoyalData();
    } catch (error) {
      console.error("Error adding royal candidate:", error);
    }
  };

  const handleUpdateRoyalCandidate = async (updated: RoyalCandidate) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "royal_candidates", id), data);
      fetchRoyalData();
    } catch (error) {
      console.error("Error updating royal candidate:", error);
    }
  };

  const handleDeleteRoyalCandidate = async (id: string) => {
    try {
      await deleteDoc(doc(db, "royal_candidates", id));
      fetchRoyalData();
    } catch (error) {
      console.error("Error deleting royal candidate:", error);
    }
  };

  // --- HANDLERS FOR ROYAL PARTICIPANTS ---
  const handleUpdateRoyalParticipant = async (updated: RoyalParticipant) => {
    try {
      const { id, ...data } = updated;
      await updateDoc(doc(db, "royal_participants", id), data);
      fetchRoyalData();
    } catch (error) {
      console.error("Error updating royal participant:", error);
    }
  };

  const handleInitializeRoyal = async () => {
    if(!confirm("Apakah Anda yakin ingin membuat/reset 6 slot kosong untuk pemenang?")) return;
    setIsSaving(true);
    try {
        // Create 6 slots
        for(let i=1; i<=6; i++) {
            const newRef = doc(collection(db, "royal_participants"));
            await setDoc(newRef, {
                rank: i,
                candidateId: "",
                title: ""
            });
        }
        await fetchRoyalData();
        alert("Berhasil membuat 6 slot pemenang!");
    } catch (error) {
        console.error("Error initializing royal:", error);
        alert("Gagal inisialisasi data.");
    } finally {
        setIsSaving(false);
    }
  }

  const handleSaveRoyal = async () => {
    setIsSaving(true);
    try {
      for (const participant of royalParticipants) {
        await handleUpdateRoyalParticipant(participant);
      }
      alert("Perubahan berhasil disimpan");
    } catch (error) {
      console.error("Error saving royal data:", error);
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
    if(!confirm("PERINGATAN: Aksi ini akan mengarsipkan (memisahkan) data sesi saat ini dan me-reset sistem untuk sesi baru. Data lama tidak dihapus permanen, tapi akan dipindah ke arsip. Lanjutkan?")) return;

    setIsSaving(true);
    try {
        const batch = writeBatch(db);

        // 1. Fetch data yang akan diarsipkan
        // (Doorprize Participants, Royal Candidates, Royal Slots, Winners)
        const dpPartSnap = await getDocs(collection(db, "doorprize_participants"));
        const royalCandSnap = await getDocs(collection(db, "royal_candidates"));
        const royalSlotSnap = await getDocs(collection(db, "royal_participants"));
        const dpWinnersSnap = await getDocs(collection(db, "doorprize_winners")); 
        const royalWinnersSnap = await getDocs(collection(db, "royal_winners"));

        const archiveData = {
            archivedAt: serverTimestamp(),
            archivedBy: userData?.email,
            sessionData: {
                doorprize_participants: dpPartSnap.docs.map(d => d.data()),
                // FIXED: Simpan ID kandidat agar relasi tidak putus di arsip masa depan
                royal_candidates: royalCandSnap.docs.map(d => ({ ...d.data(), id: d.id })),
                royal_slots: royalSlotSnap.docs.map(d => d.data()),
                doorprize_winners: dpWinnersSnap.docs.map(d => d.data()),
                royal_winners: royalWinnersSnap.docs.map(d => d.data())
            }
        };

        // 2. Simpan ke koleksi arsip
        const archiveRef = doc(collection(db, "archived_sessions"));
        batch.set(archiveRef, archiveData);

        // 3. Reset/Bersihkan Koleksi Aktif
        
        // Hapus Peserta Doorprize
        dpPartSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Hapus Kandidat Royal
        royalCandSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Hapus Pemenang Doorprize
        dpWinnersSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Hapus Pemenang Royal (History)
        royalWinnersSnap.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Reset Royal Participants (Slots) - Jangan dihapus dokumennya, tapi kosongkan isinya
        royalSlotSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { candidateId: "", title: "" });
        });

        // Reset Status Session ke Closed (Opsional, demi keamanan)
        const configRef = doc(db, "settings", "config");
        batch.update(configRef, { doorprizeStatus: "closed", royalStatus: "closed" });

        await batch.commit();

        // 4. Refresh Local Data
        fetchDoorprizeParticipants();
        fetchRoyalData();
        fetchSchedulesAndPasscodes();
        
        // Refresh history list if in recap
        if(activeTab === 'recap') fetchHistorySessions();

        alert("Sesi berhasil diarsipkan dan di-reset!");

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

  const filteredRoyalCandidates = royalCandidates.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.company.toLowerCase().includes(searchQuery.toLowerCase())
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

      {/* SIDEBAR - RESPONSIVE */}
      <aside 
        className={`bg-white border-r border-slate-200 flex flex-col fixed h-full z-[50] transition-transform duration-300 ease-in-out
            ${isSidebarOpen 
                ? "translate-x-0 w-[80%] max-w-[280px]" // Responsive width on mobile
                : "-translate-x-full lg:translate-x-0 lg:w-20" // Closed: Hide on mobile, Mini on desktop
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
          
          {/* Close button on mobile only */}
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
            active={activeTab === "royal-candidates"} 
            onClick={() => { setActiveTab("royal-candidates"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Users size={20} />} 
            label="Royal Candidates" 
            expanded={isSidebarOpen}
          />
          <SidebarItem 
            active={activeTab === "royal"} 
            onClick={() => { setActiveTab("royal"); if(typeof window !== 'undefined' && window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            icon={<Trophy size={20} />} 
            label="Royal Top 6" 
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
                royalCandidateCount={royalCandidates.length} 
                royalCount={royalParticipants.length} 
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
              schedule={doorprizeSchedule}
              onSaveSchedule={(val) => handleSaveSchedule("doorprize", val)}
              passcode={doorprizePasscode}
              onSavePasscode={(val) => handleSavePasscode("doorprize", val)}
              status={doorprizeStatus}
              onToggleStatus={() => handleToggleStatus("doorprize", doorprizeStatus)}
              isSaving={isSaving}
            />}
            {activeTab === "royal-candidates" && <RoyalCandidatesView 
              candidates={filteredRoyalCandidates} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery} 
              onAdd={handleAddRoyalCandidate} 
              onUpdate={handleUpdateRoyalCandidate} 
              onDelete={handleDeleteRoyalCandidate} 
            />}
            {activeTab === "royal" && <RoyalView 
              participants={royalParticipants} 
              setParticipants={setRoyalParticipants} 
              candidates={royalCandidates} 
              onSave={handleSaveRoyal} 
              isSaving={isSaving} 
              onInitialize={handleInitializeRoyal}
              schedule={royalSchedule}
              onSaveSchedule={(val) => handleSaveSchedule("royal", val)}
              passcode={royalPasscode}
              onSavePasscode={(val) => handleSavePasscode("royal", val)}
              status={royalStatus}
              onToggleStatus={() => handleToggleStatus("royal", royalStatus)}
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
              royalParticipants={royalParticipants}
              royalCandidates={royalCandidates}
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
    doorprizeCount, royalCandidateCount, royalCount, prizeCount, setActiveTab, onResetSession, isResetting 
}: { 
    doorprizeCount: number, royalCandidateCount: number, royalCount: number, prizeCount: number, setActiveTab: (tab: "dashboard" | "doorprize" | "royal-candidates" | "royal" | "prizes" | "recap") => void, onResetSession: () => void, isResetting: boolean
}) {
  
  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 md:p-12 text-white shadow-xl shadow-blue-200">
        <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl md:text-4xl font-black mb-4">Dashboard Overview</h2>
            <p className="text-blue-100 text-sm md:text-lg mb-8 leading-relaxed">
                Kelola semua data acara dari satu tempat. Pantau statistik peserta, kandidat royal, dan inventori hadiah secara realtime.
            </p>
            <div className="flex gap-3">
                <button onClick={() => setActiveTab('doorprize')} className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-sm text-sm md:text-base">
                    Kelola Peserta <ArrowRight size={18}/>
                </button>
                <button onClick={() => setActiveTab('recap')} className="bg-white/20 text-white border border-white/30 px-6 py-3 rounded-xl font-bold hover:bg-white/30 transition-colors flex items-center gap-2 shadow-sm text-sm md:text-base">
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
            icon={<Sparkles size={24} />} 
            color="bg-yellow-50 text-yellow-600" 
            label="Royal Candidates" 
            value={royalCandidateCount}
            desc="Kandidat Terdaftar"
        />
        <StatCard 
            icon={<Trophy size={24} />} 
            color="bg-purple-50 text-purple-600" 
            label="Royal Winners" 
            value={royalCount}
            desc="Top 6 Rank"
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
                <p>• Gunakan menu <span className="font-bold text-slate-700">Royal Top 6</span> untuk mengatur ranking pemenang setelah voting selesai.</p>
                <p>• Gambar pada stok hadiah akan otomatis menyesuaikan ukuran kartu (auto-fill).</p>
                <p>• Gunakan generator passcode untuk keamanan halaman spin.</p>
                <p>• <strong>Fitur Baru:</strong> Gunakan tombol status Open/Closed untuk mengontrol akses peserta.</p>
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

function RecapView({ 
    doorprizeWinners, 
    royalParticipants,
    royalCandidates,
    historySessions,
    selectedSession,
    setSelectedSession
}: { 
    doorprizeWinners: DoorprizeWinner[],
    royalParticipants: RoyalParticipant[],
    royalCandidates: RoyalCandidate[],
    historySessions: ArchivedSession[],
    selectedSession: string,
    setSelectedSession: (id: string) => void
}) {
    
    // Helper to get Royal Winner Name
    const getRoyalName = (candidateId: string) => {
        const c = royalCandidates.find(rc => rc.id === candidateId);
        return c ? `${c.name} (${c.company})` : "Belum ditentukan";
    };

    const getRoyalRawData = () => {
        return royalParticipants.filter(p => p.candidateId).map(p => {
            const candidate = royalCandidates.find(c => c.id === p.candidateId);
            return {
                Rank: p.rank,
                Title: p.title,
                Name: candidate?.name || "-",
                Company: candidate?.company || "-"
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
        
        // Sheet 1: Royal Winners
        const royalData = getRoyalRawData();
        const wsRoyal = XLSX.utils.json_to_sheet(royalData);
        XLSX.utils.book_append_sheet(wb, wsRoyal, "Royal Top 6");

        // Sheet 2: Doorprize Winners
        const doorprizeData = getDoorprizeRawData();
        const wsDoorprize = XLSX.utils.json_to_sheet(doorprizeData);
        XLSX.utils.book_append_sheet(wb, wsDoorprize, "Doorprize Winners");

        XLSX.writeFile(wb, "Rekap_Pemenang_Acara.xlsx");
    };

    const exportToCSV = () => {
        // Simple CSV export for currently active view (combining logic slightly for simplicity)
        const royalData = getRoyalRawData();
        const doorprizeData = getDoorprizeRawData();

        let csvContent = "data:text/csv;charset=utf-8,";
        
        csvContent += "ROYAL TOP 6\n";
        csvContent += "Rank,Title,Name,Company\n";
        royalData.forEach(row => {
            csvContent += `${row.Rank},"${row.Title}","${row.Name}","${row.Company}"\n`;
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

        // Royal Table
        doc.setFontSize(14);
        doc.text("Royal Top 6", 14, 45);

        const royalData = getRoyalRawData().map(r => [
            r.Rank,
            r.Title,
            r.Name,
            r.Company
        ]);

        autoTable(doc, {
            startY: 50,
            head: [["Rank", "Title", "Name", "Company"]],
            body: royalData,
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
                {/* TABLE ROYAL */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2"><Trophy size={18} className="text-yellow-500"/> Royal Top 6</h4>
                        <span className="bg-white px-2 py-1 rounded text-xs font-bold text-slate-500 border border-slate-200">{royalParticipants.filter(p => p.candidateId).length} Pemenang</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white text-slate-500 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 font-bold w-12 text-center">Rank</th>
                                    <th className="px-4 py-3 font-bold">Nama & PT</th>
                                    <th className="px-4 py-3 font-bold">Title</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {royalParticipants.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-center font-black text-slate-700">#{p.rank}</td>
                                        <td className="px-4 py-3 text-slate-700">{getRoyalName(p.candidateId)}</td>
                                        <td className="px-4 py-3 text-slate-500 italic">{p.title || "-"}</td>
                                    </tr>
                                ))}
                                {royalParticipants.length === 0 && (
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
                        <table className="w-full text-left text-sm">
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

function DoorprizeView({ 
  participants, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onDelete,
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

  const handleSubmitAdd = () => {
    onAdd(newName);
    setNewName("");
  };

  const generatePasscode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTempPasscode(randomCode);
  }

  return (
    <div className="space-y-6">
        
        {/* GRID LAYOUT FOR CONFIGURATION - FIXED FOR MACBOOK AIR (xl instead of lg) */}
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

            {/* SCHEDULE CARD - UPDATED LAYOUT (Stacking Input/Button) */}
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
                {/* Fixed: Force flex-col to stack items vertically on ALL screens for this card */}
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

            {/* PASSCODE CARD - UPDATED LAYOUT */}
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
            <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Cari peserta..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 rounded-lg border-none focus:ring-2 focus:ring-blue-100 outline-none text-sm w-full md:w-64"
            />
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
                    <th className="px-6 py-4 font-bold w-12">No</th>
                    <th className="px-6 py-4 font-bold">Nama Lengkap</th>
                    <th className="px-6 py-4 font-bold text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {participants.map((p, i) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
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

function RoyalCandidatesView({ 
  candidates, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onUpdate, 
  onDelete 
}: { 
  candidates: RoyalCandidate[], 
  searchQuery: string, 
  setSearchQuery: (q: string) => void, 
  onAdd: (name: string, company: string) => void, 
  onUpdate: (updated: RoyalCandidate) => void, 
  onDelete: (id: string) => void 
}) {
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [editingCandidate, setEditingCandidate] = useState<RoyalCandidate | null>(null);

  const handleSubmitAdd = () => {
    onAdd(newName, newCompany);
    setNewName("");
    setNewCompany("");
  };

  const handleStartEdit = (candidate: RoyalCandidate) => {
    setEditingCandidate(candidate);
  };

  const handleChangeEdit = (field: keyof RoyalCandidate, value: string) => {
    if (editingCandidate) {
      setEditingCandidate({ ...editingCandidate, [field]: value });
    }
  };

  const handleSubmitEdit = () => {
    if (editingCandidate) {
      onUpdate(editingCandidate);
      setEditingCandidate(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari kandidat..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-slate-50 rounded-lg border-none focus:ring-2 focus:ring-blue-100 outline-none text-sm w-full md:w-64"
          />
        </div>
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Nama Kandidat Baru" 
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
          />
          <input 
            type="text" 
            placeholder="PT Asal" 
            value={newCompany}
            onChange={(e) => setNewCompany(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-slate-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button onClick={handleSubmitAdd} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors whitespace-nowrap">
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>
      
      {candidates.length === 0 ? (
        <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
               <Users className="text-slate-300 w-8 h-8" />
            </div>
            <h3 className="text-slate-500 font-medium">Belum ada kandidat royal</h3>
            <p className="text-slate-400 text-sm">Mulai tambahkan kandidat untuk pemilihan</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                    <th className="px-6 py-4 font-bold w-12">No</th>
                    <th className="px-6 py-4 font-bold">Nama Lengkap</th>
                    <th className="px-6 py-4 font-bold">PT Asal</th>
                    <th className="px-6 py-4 font-bold text-right">Aksi</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {candidates.map((c, i) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 font-mono text-sm whitespace-nowrap">{i + 1}</td>
                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{c.name}</td>
                    <td className="px-6 py-4 text-slate-700 whitespace-nowrap">{c.company}</td>
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
      {editingCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Edit Kandidat</h3>
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Nama</label>
                    <input 
                    type="text" 
                    value={editingCandidate.name} 
                    onChange={(e) => handleChangeEdit("name", e.target.value)} 
                    className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-blue-500" 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Perusahaan</label>
                    <input 
                    type="text" 
                    value={editingCandidate.company} 
                    onChange={(e) => handleChangeEdit("company", e.target.value)} 
                    className="w-full p-2 bg-slate-50 border rounded-lg focus:outline-blue-500" 
                    />
                </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmitEdit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold">Simpan</button>
              <button onClick={() => setEditingCandidate(null)} className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoyalView({ 
  participants, 
  setParticipants, 
  candidates, 
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
  participants: RoyalParticipant[], 
  setParticipants: (p: RoyalParticipant[]) => void, 
  candidates: RoyalCandidate[], 
  onSave: () => void, 
  isSaving: boolean,
  onInitialize: () => void,
  schedule: string,
  onSaveSchedule: (val: string) => void,
  passcode: string,
  onSavePasscode: (val: string) => void,
  status: "open" | "closed",
  onToggleStatus: () => void
}) {
  const [tempSchedule, setTempSchedule] = useState(schedule || "");
  const [tempPasscode, setTempPasscode] = useState(passcode || "");

  const handleChange = (id: string, field: keyof RoyalParticipant, value: string | number) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    return candidate ? candidate.name : "";
  };

  const generatePasscode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTempPasscode(randomCode);
  }

  if (participants.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl border border-dashed border-slate-300 text-center p-6">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Trophy className="text-slate-300 w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Belum ada data Royal Top 6</h2>
              <p className="text-slate-500 text-center max-w-md mb-6">
                  Meskipun kandidat sudah ada, Anda perlu membuat 6 slot pemenang terlebih dahulu agar bisa memilih siapa juaranya.
              </p>
              <button 
                onClick={onInitialize}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                  {isSaving ? <Loader2 className="animate-spin"/> : <RefreshCw size={18} />}
                  Inisialisasi / Reset Top 6
              </button>
          </div>
      )
  }

  return (
    <div className="space-y-6">
       
       {/* GRID LAYOUT FOR CONFIGURATION - FIXED FOR MACBOOK AIR (xl instead of lg) */}
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

            {/* SCHEDULE CARD - UPDATED LAYOUT */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Atur Jadwal Royal Top 6</h3>
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

            {/* PASSCODE CARD - UPDATED LAYOUT */}
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
            <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600 hidden sm:block"><Trophy size={20} /></div>
            <p className="text-sm text-yellow-800 font-medium">Pilih kandidat untuk top 6 dan atur detailnya.</p>
        </div>
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          {isSaving ? "Menyimpan..." : <><Save size={18} /> Simpan Perubahan</>}
        </button>
      </div>

      <div className="grid gap-4">
        {participants.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="w-12 h-12 bg-slate-800 text-white rounded-full flex items-center justify-center font-black text-xl shrink-0 shadow-md">
              #{item.rank}
            </div>
            
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Pilih Kandidat</label>
                <select 
                  value={item.candidateId || ""} 
                  onChange={(e) => handleChange(item.id, "candidateId", e.target.value)} 
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-blue-500"
                >
                  <option value="">Pilih...</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.company}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Nama Pemenang</label>
                <input 
                  type="text" 
                  value={getCandidateName(item.candidateId)} 
                  disabled 
                  className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700" 
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Title / Julukan</label>
                <input 
                  type="text" 
                  value={item.title} 
                  onChange={(e) => handleChange(item.id, "title", e.target.value)} 
                  placeholder="Contoh: The Innovator"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-blue-500" 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* ADD NEW CARD (Styled as a button/action card) */}
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
            {/* BUTTON DENGAN STATUS LOADING */}
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

      {/* Empty State for Prizes */}
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