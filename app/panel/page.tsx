// app/panel/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { auth, db } from "../lib/firebase"; 
import { doc, getDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, query, writeBatch, serverTimestamp, orderBy } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { User, LogOut, Menu } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { supabase } from "../lib/supabase"; 

// --- IMPORTS FOR FEATURES ---
import { 
  UserData, DoorprizeParticipant, DoorprizeWinner, AwardNominee, AwardWinnerSlot, 
  Prize, ArchivedSession, AwardWinnerHistory, TabType 
} from "./types";
import Sidebar from "../components/Sidebar";
import DashboardView from "./features/DashboardView";
import DoorprizeView from "./features/DoorprizeView";
import AwardNomineesView from "./features/AwardNomineesView";
import AwardsView from "./features/AwardsView";
import PrizesView from "./features/PrizesView";
import RecapView from "./features/RecapView";

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
      // PERBAIKAN: Hapus orderBy("lotteryNumber", "asc") agar data yang null tetap terambil
      const q = query(collection(db, "doorprize_participants"));
      const querySnapshot = await getDocs(q);
      const data: DoorprizeParticipant[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<DoorprizeParticipant, "id">),
      }));

      // PERBAIKAN: Sorting manual via Javascript
      // Jika lotteryNumber tidak ada, anggap 0 (muncul paling atas) atau Infinity (paling bawah)
      data.sort((a, b) => {
          const numA = a.lotteryNumber ? parseInt(a.lotteryNumber) : 0; 
          const numB = b.lotteryNumber ? parseInt(b.lotteryNumber) : 0;
          return numA - numB;
      });

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
            const qC = query(collection(db, "award_nominees"));
            const snapC = await getDocs(qC);
            const cData: AwardNominee[] = snapC.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<AwardNominee, "id">),
            }));
            setAwardNominees(cData);

            const qP = query(collection(db, "award_winners"));
            const snapP = await getDocs(qP);
            const pData: AwardWinnerSlot[] = snapP.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as Omit<AwardWinnerSlot, "id">),
            }));
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
    fetchSchedulesAndPasscodes(); 
    
    if (activeTab !== 'recap' && activeTab !== 'dashboard') {
        if(selectedSession !== 'active') setSelectedSession('active');
    }

    if (activeTab === "recap") {
        fetchHistorySessions(); 
        fetchDoorprizeWinners();
        if(selectedSession === 'active') fetchDoorprizeParticipants();
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
  const handleAddDoorprizeParticipant = async (name: string, lotteryNumber: string) => {
    if (!name) return;
    try {
      const newRef = doc(collection(db, "doorprize_participants"));
      await setDoc(newRef, { name, lotteryNumber });
      fetchDoorprizeParticipants();
    } catch (error) {
      console.error("Error adding doorprize participant:", error);
    }
  };

  const handleBulkAddDoorprize = async (data: {name: string, lotteryNumber: string}[]) => {
    setIsSaving(true);
    try {
        const batch = writeBatch(db);
        data.forEach(item => {
            const newRef = doc(collection(db, "doorprize_participants"));
            batch.set(newRef, { name: item.name, lotteryNumber: item.lotteryNumber });
        });
        await batch.commit();
        fetchDoorprizeParticipants();
        alert(`${data.length} Peserta doorprize berhasil diimport!`);
    } catch (error) {
        console.error("Error bulk adding doorprize:", error);
        alert("Gagal menyimpan data bulk.");
    } finally {
        setIsSaving(false);
    }
  };

  // NEW: Handler Update (Edit) Doorprize
  const handleUpdateDoorprizeParticipant = async (id: string, name: string, lotteryNumber: string) => {
    try {
        const ref = doc(db, "doorprize_participants", id);
        await updateDoc(ref, { name, lotteryNumber });
        fetchDoorprizeParticipants();
    } catch (error) {
        console.error("Error updating doorprize participant:", error);
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
      await setDoc(newRef, { name: singleName, company: singleName });
      fetchAwardData();
    } catch (error) {
      console.error("Error adding nominee:", error);
    }
  };

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
    if(!confirm("Apakah Anda yakin ingin membuat/reset default categories (Top Spender, Most Loyal, Rising Star) dengan 6 slot?")) return;
    setIsSaving(true);
    try {
        const categories = [
            "Top Spender",
            "The Most Loyal Customer",
            "Rising Star"
        ];

        for(const category of categories) {
            for(let rank = 1; rank <= 6; rank++) {
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
        alert("Berhasil inisialisasi default 6 slot per kategori!");
    } catch (error) {
        console.error("Error initializing awards:", error);
    } finally {
        setIsSaving(false);
    }
  }

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

        const dpPartSnap = await getDocs(collection(db, "doorprize_participants"));
        const awardNomSnap = await getDocs(collection(db, "award_nominees"));
        const awardWinSnap = await getDocs(collection(db, "award_winners"));
        const dpWinnersSnap = await getDocs(collection(db, "doorprize_winners")); 
        
        const awardHistorySnap = await getDocs(collection(db, "award_history"));

        const winningCandidateIds = new Set<string>();
        awardWinSnap.docs.forEach(doc => {
            const data = doc.data() as AwardWinnerSlot;
            if (data.candidateId && data.candidateId.trim() !== "") {
                winningCandidateIds.add(data.candidateId);
            }
        });
        
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
                award_history_log: awardHistorySnap.docs.map(d => d.data())
            }
        };

        const archiveRef = doc(collection(db, "archived_sessions"));
        batch.set(archiveRef, archiveData);

        dpPartSnap.docs.forEach((doc) => batch.delete(doc.ref));

        awardNomSnap.docs.forEach((doc) => {
            if (winningCandidateIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        dpWinnersSnap.docs.forEach((doc) => batch.delete(doc.ref));
        awardHistorySnap.docs.forEach((doc) => batch.delete(doc.ref));

        awardWinSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { candidateId: "" });
        });

        const configRef = doc(db, "settings", "config");
        batch.update(configRef, { doorprizeStatus: "closed", awardStatus: "closed" });

        await batch.commit();

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

  // PERBAIKAN: Safe check untuk filter
  const filteredDoorprizeParticipants = doorprizeParticipants.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.lotteryNumber || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAwardNominees = awardNominees.filter((p) =>
    p.company.toLowerCase().includes(searchQuery.toLowerCase()) || p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <div className="h-[100dvh] flex bg-slate-50 font-sans text-slate-800 overflow-hidden relative">
      
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

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen}
        handleLogout={handleLogout}
      />

      <main 
        className={`flex-1 h-[100dvh] overflow-y-auto relative transition-all duration-300 ease-in-out bg-slate-50
            ${isSidebarOpen 
                ? "lg:ml-[280px] ml-0" 
                : "lg:ml-20 ml-0"
            }
        `}
      >
        <div className="p-4 md:p-6 lg:p-10 pb-20 md:pb-10"> 
        
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
              onBulkAdd={handleBulkAddDoorprize}
              onUpdate={handleUpdateDoorprizeParticipant} 
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
              doorprizeParticipants={doorprizeParticipants}
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