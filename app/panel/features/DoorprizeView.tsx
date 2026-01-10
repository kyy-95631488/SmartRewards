// app/panel/features/DoorprizeView.tsx
"use client";

import { useState } from "react";
import { 
  Unlock, Lock, Power, Clock, Key, Shuffle, Trash2, Search, Plus, Users, 
  ScanLine, X, Image as ImageIcon, Loader2, Sparkles, Hash, Edit, Check,
  Database, FileSpreadsheet, Download, CloudUpload
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { DoorprizeParticipant } from "../types";
import { getSpreadsheetData } from "@/app/actions/spreadsheetAction"; // IMPORT SERVER ACTION

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

interface DoorprizeViewProps {
  participants: DoorprizeParticipant[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onAdd: (name: string, lotteryNumber: string) => void;
  onBulkAdd: (data: {name: string, lotteryNumber: string}[]) => Promise<void>; 
  onUpdate: (id: string, name: string, lotteryNumber: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  schedule: string;
  onSaveSchedule: (val: string) => void;
  passcode: string;
  onSavePasscode: (val: string) => void;
  status: "open" | "closed";
  onToggleStatus: () => void;
  isSaving: boolean;
}

export default function DoorprizeView({ 
  participants, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onBulkAdd, 
  onUpdate, 
  onDelete,
  onBulkDelete,
  schedule,
  onSaveSchedule,
  passcode,
  onSavePasscode,
  status,
  onToggleStatus,
  isSaving
}: DoorprizeViewProps) {
  const [newName, setNewName] = useState("");
  const [newLotteryNumber, setNewLotteryNumber] = useState(""); 
  const [tempSchedule, setTempSchedule] = useState(schedule || "");
  const [tempPasscode, setTempPasscode] = useState(passcode || "");
      
  // MULTI SELECT STATE
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // EDIT STATE
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ name: "", lotteryNumber: "" });

  // --- STATE MODAL AI ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"scan" | "generate">("scan"); 
  const [scannedImage, setScannedImage] = useState<File | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResults, setAiResults] = useState<string[]>([]);
  const [generateCount, setGenerateCount] = useState<number>(10);

  // --- STATE SPREADSHEET ---
  const [spreadsheetData, setSpreadsheetData] = useState<{name: string, lotteryNumber: string}[]>([]);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);

  // Helper: Cari nomor undian tertinggi saat ini
  const getMaxLotteryNumber = () => {
    if (participants.length === 0) return 0;
    const numbers = participants
      .map(p => parseInt(p.lotteryNumber))
      .filter(n => !isNaN(n));
    return numbers.length > 0 ? Math.max(...numbers) : 0;
  };

  // --- LOGIKA ADD STANDARD ---
  const handleSubmitAdd = () => {
    if(!newName.trim()) return;
    let finalNumber = newLotteryNumber.trim();
    if (!finalNumber) {
      const nextNum = getMaxLotteryNumber() + 1;
      finalNumber = nextNum.toString().padStart(3, '0');
    }
    onAdd(newName, finalNumber);
    setNewName("");
    setNewLotteryNumber("");
  };

  const generatePasscode = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setTempPasscode(randomCode);
  }

  // --- LOGIKA MULTI SELECT ---
  const handleSelectAll = () => {
      if (selectedIds.length === participants.length) {
          setSelectedIds([]);
      } else {
          setSelectedIds(participants.map(p => p.id));
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
      if (confirm(`Yakin ingin menghapus ${selectedIds.length} peserta terpilih?`)) {
          onBulkDelete(selectedIds);
          setSelectedIds([]);
      }
  };

  // --- LOGIKA EDIT ---
  const handleStartEdit = (participant: DoorprizeParticipant) => {
    setEditingId(participant.id);
    setEditFormData({
        name: participant.name,
        lotteryNumber: participant.lotteryNumber || ""
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({ name: "", lotteryNumber: "" });
  };

  const handleSaveEdit = () => {
    if (editingId && editFormData.name.trim()) {
        onUpdate(editingId, editFormData.name, editFormData.lotteryNumber);
        setEditingId(null);
    }
  };

  // --- LOGIKA SPREADSHEET ---
  const handleFetchSpreadsheet = async () => {
    setIsLoadingSpreadsheet(true);
    setSpreadsheetData([]);
    try {
      const result = await getSpreadsheetData();
      if (result.success && result.data) {
        setSpreadsheetData(result.data);
      } else {
        alert(result.message || "Gagal mengambil data.");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setIsLoadingSpreadsheet(false);
    }
  };

  const handleSyncSpreadsheetToFirebase = async () => {
    if (spreadsheetData.length === 0) return;
    if (!confirm(`Tambahkan ${spreadsheetData.length} data dari spreadsheet ke database doorprize?`)) return;
    
    await onBulkAdd(spreadsheetData);
    setSpreadsheetData([]); // Clear preview after add
  };

  // --- LOGIKA AI GEMINI (SCAN & GENERATE) ---
  const handleScanImage = async () => {
    if (!scannedImage) return;
    setIsProcessingAI(true);
    setAiResults([]); 
    
    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const imagePart = await fileToGenerativePart(scannedImage);

      const prompt = `
        Analisis gambar ini dan ekstrak daftar nama orang lengkap untuk keperluan doorprize.
        Abaikan header tabel, nomor urut, gelar yang tidak perlu, tanggal, atau jabatan.
        Keluarkannya hasilnya HANYA sebagai JSON Array of Strings.
        Contoh: ["Budi Santoso", "Siti Aminah", "Joko Widodo"]
        Jangan gunakan format markdown.
      `;

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();

      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1) {
          text = text.substring(firstBracket, lastBracket + 1);
          const parsedNames = JSON.parse(text);
          if (Array.isArray(parsedNames)) {
              setAiResults(parsedNames);
          } else {
              alert("Format hasil AI tidak sesuai.");
          }
      } else {
          throw new Error("Tidak menemukan array JSON");
      }
    } catch (error) {
      console.error("Gemini Scan Error:", error);
      alert("Gagal memindai gambar.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleGenerateRandom = async () => {
    if (generateCount <= 0) return;
    setIsProcessingAI(true);
    setAiResults([]);

    try {
      const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      const prompt = `
        Buatkan daftar ${generateCount} nama orang Indonesia secara acak.
        Output: HANYA nama saja, satu per baris.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      const names = text.split('\n').map(name => name.replace(/^[\d\.\-\*]+\s+/, "").trim()).filter(n => n);

      if (names.length > 0) setAiResults(names);
    } catch (error) {
      console.error("Ai Generate Error:", error);
      alert("Gagal generate.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSaveAiResults = async () => {
    if (aiResults.length === 0) return;
    let currentMax = getMaxLotteryNumber();
    const dataToSave = aiResults.map((name) => {
        currentMax++;
        return {
            name: name,
            lotteryNumber: currentMax.toString().padStart(3, '0')
        };
    });

    await onBulkAdd(dataToSave);
    setAiResults([]);
    setScannedImage(null);
    setIsImportModalOpen(false);
  }

  return (
    <div className="space-y-8">
        
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
                        <button onClick={generatePasscode} className="p-2 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors shrink-0">
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

        {/* --- CARD 1: DATABASE LIST (FIREBASE) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                        <Database size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800">Data Peserta Terdaftar</h2>
                        <p className="text-xs text-slate-500">Data yang tersimpan di Firebase</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {/* BULK DELETE */}
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
                            placeholder="Cari peserta..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm w-full"
                        />
                    </div>
                    <button 
                        onClick={() => { setIsImportModalOpen(true); setImportMode("scan"); setAiResults([]); }}
                        className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors whitespace-nowrap"
                        title="AI Tools"
                    >
                        <ScanLine size={18} />
                    </button>
                </div>
            </div>

            {/* Input Manual Section */}
            <div className="p-4 border-b border-slate-100 bg-white">
                 <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
                    <input 
                        type="text" 
                        placeholder="Nama Peserta Baru" 
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitAdd()}
                        className="w-full flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="relative w-full sm:w-28">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Auto" 
                            title="Kosongkan untuk auto-generate nomor urut"
                            value={newLotteryNumber}
                            onChange={(e) => setNewLotteryNumber(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmitAdd()}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-100 font-mono"
                        />
                    </div>
                    <button onClick={handleSubmitAdd} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors whitespace-nowrap">
                        <Plus size={16} /> Tambah
                    </button>
                </div>
            </div>
            
            {/* Table Firebase */}
            {participants.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Users className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-slate-500 font-medium">Belum ada peserta doorprize</h3>
                    <p className="text-slate-400 text-sm">Tambahkan peserta baru atau gunakan import di bawah.</p>
                </div>
            ) : (
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                        <th className="px-6 py-4 w-10 border-b border-slate-200">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={selectedIds.length === participants.length && participants.length > 0}
                                onChange={handleSelectAll}
                            />
                        </th>
                        <th className="px-6 py-4 font-bold w-12 border-b border-slate-200">No</th>
                        <th className="px-6 py-4 font-bold w-32 border-b border-slate-200">No. Undian</th>
                        <th className="px-6 py-4 font-bold border-b border-slate-200">Nama Lengkap</th>
                        <th className="px-6 py-4 font-bold text-right border-b border-slate-200">Aksi</th>
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
                            
                            {editingId === p.id ? (
                                <>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="text"
                                            value={editFormData.lotteryNumber}
                                            onChange={(e) => setEditFormData({...editFormData, lotteryNumber: e.target.value})}
                                            className="w-full max-w-[80px] px-2 py-1 border border-blue-300 rounded text-sm font-mono focus:outline-blue-500"
                                            autoFocus
                                        />
                                    </td>
                                    <td className="px-6 py-4">
                                        <input 
                                            type="text"
                                            value={editFormData.name}
                                            onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                            className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-blue-500"
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={handleSaveEdit} className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Simpan"><Check size={16} /></button>
                                            <button onClick={handleCancelEdit} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200" title="Batal"><X size={16} /></button>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-6 py-4">
                                        <span className={`inline-block px-2 py-1 rounded font-mono text-xs font-bold border ${p.lotteryNumber ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            {p.lotteryNumber || "-"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-700 whitespace-nowrap">{p.name}</td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => handleStartEdit(p)} className="p-2 text-slate-400 hover:text-amber-500 transition-colors"><Edit size={16} /></button>
                                            <button onClick={() => onDelete(p.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* --- CARD 2: SPREADSHEET IMPORT --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="p-4 md:p-6 bg-emerald-50/50 border-b border-emerald-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800">Import dari Spreadsheet</h2>
                        <p className="text-xs text-slate-500">Ambil data nama dan generate nomor undian otomatis</p>
                    </div>
                </div>
                <div className="flex gap-2">
                     <button 
                        onClick={handleFetchSpreadsheet}
                        disabled={isLoadingSpreadsheet}
                        className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isLoadingSpreadsheet ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {isLoadingSpreadsheet ? "Mengambil Data..." : "Ambil Data Google Sheet"}
                    </button>
                </div>
            </div>
            
            <div className="p-6">
                {spreadsheetData.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <p className="text-slate-500 font-medium">Belum ada data yang diambil.</p>
                        <p className="text-sm text-slate-400 mt-1">Klik tombol &quot;Ambil Data Google Sheet&quot; di atas.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-sm font-bold text-slate-600">Preview Data ({spreadsheetData.length} baris)</p>
                            <button onClick={() => setSpreadsheetData([])} className="text-xs text-red-500 hover:underline">Reset Preview</button>
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 font-bold border-b w-16">No</th>
                                        <th className="px-4 py-3 font-bold border-b w-32">No. Undian</th>
                                        <th className="px-4 py-3 font-bold border-b">Nama Lengkap</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {spreadsheetData.map((d, i) => (
                                        <tr key={i} className="bg-white">
                                            <td className="px-4 py-2 text-xs text-slate-400 font-mono">{i+1}</td>
                                            <td className="px-4 py-2">
                                                <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono text-xs font-bold">
                                                    {d.lotteryNumber}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-slate-700 font-medium">{d.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center">
                            <div>
                                <p className="text-sm font-bold text-emerald-800">Siap Sinkronisasi</p>
                                <p className="text-xs text-emerald-600">Data ini akan dimasukkan ke database Firebase (Card atas).</p>
                            </div>
                            <button 
                                onClick={handleSyncSpreadsheetToFirebase}
                                disabled={isSaving}
                                className="px-6 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors shadow-lg shadow-emerald-200 disabled:opacity-50"
                            >
                                <CloudUpload size={18} />
                                Masukkan ke Database
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>

      {/* --- MODAL IMPORT / GENERATE AI (EXISTING) --- */}
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
                        <ScanLine className="text-indigo-600" /> AI Tools
                    </h3>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                {/* TABS SELECTOR */}
                <div className="flex p-2 gap-2 bg-slate-50 border-b border-slate-100">
                    <button 
                        onClick={() => { setImportMode("scan"); setAiResults([]); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                            importMode === 'scan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'
                        }`}
                    >
                        <ImageIcon size={16} /> Scan Gambar
                    </button>
                    <button 
                        onClick={() => { setImportMode("generate"); setAiResults([]); }}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${
                            importMode === 'generate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-white/50'
                        }`}
                    >
                        <Sparkles size={16} /> Generate Random
                    </button>
                </div>

                <div className="p-5 overflow-y-auto">
                    
                    {/* --- MODE SCAN GAMBAR --- */}
                    {importMode === "scan" && (
                        <>
                            {!scannedImage ? (
                                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => { if(e.target.files?.[0]) setScannedImage(e.target.files[0]) }}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                    <ImageIcon size={48} className="text-slate-300 mb-2"/>
                                    <p className="font-medium text-slate-600">Upload gambar daftar peserta</p>
                                    <p className="text-xs text-slate-400 mt-1">Format: JPG, PNG</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="p-2 bg-white rounded border border-slate-100">
                                            <ImageIcon size={20} className="text-indigo-500" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 truncate flex-1">{scannedImage.name}</span>
                                        <button onClick={() => { setScannedImage(null); setAiResults([]); }} className="text-red-500 text-xs font-bold hover:underline">Ganti</button>
                                    </div>
                                    {aiResults.length === 0 && !isProcessingAI && (
                                        <div className="text-center">
                                            <button 
                                                onClick={handleScanImage}
                                                className="w-full px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                            >
                                                <ScanLine size={18} /> Mulai Scan OCR
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* --- MODE GENERATE RANDOM --- */}
                    {importMode === "generate" && aiResults.length === 0 && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Jumlah Nama Dummy</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="100"
                                    value={generateCount}
                                    onChange={(e) => setGenerateCount(Number(e.target.value))}
                                    className="w-full p-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                                <p className="text-xs text-slate-400 mt-1">Masukkan jumlah nama random yang ingin dibuat (Max 100).</p>
                            </div>
                            {!isProcessingAI && (
                                <button 
                                    onClick={handleGenerateRandom}
                                    className="w-full px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={18} /> Generate by Ai
                                </button>
                            )}
                        </div>
                    )}

                    {/* --- LOADING INDICATOR --- */}
                    {isProcessingAI && (
                        <div className="py-8 text-center space-y-3">
                            <Loader2 className="animate-spin mx-auto text-indigo-600" size={32} />
                            <p className="text-sm text-slate-500 font-medium">
                                {importMode === 'scan' ? "Sedang membaca teks dengan AI..." : "Sedang mengarang nama..."}
                            </p>
                        </div>
                    )}

                    {/* --- RESULT LIST PREVIEW AI --- */}
                    {aiResults.length > 0 && !isProcessingAI && (
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-xs font-bold text-slate-500 uppercase">Preview ({aiResults.length} Nama)</p>
                                <button onClick={() => setAiResults([])} className="text-xs text-slate-400 hover:text-slate-600">Reset</button>
                            </div>
                            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                {aiResults.map((res, idx) => (
                                    <div key={idx} className="p-2 text-sm text-slate-700 bg-white px-3 flex items-center gap-2">
                                        <span className="text-slate-300 font-mono text-xs w-4">{idx+1}</span>
                                        {res}
                                    </div>
                                ))}
                            </div>
                             <div className="mt-2 p-3 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-100">
                                <strong>Info:</strong> Nomor undian akan digenerate otomatis melanjutkan nomor terakhir.
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors">Batal</button>
                    {aiResults.length > 0 && (
                        <button 
                            onClick={handleSaveAiResults}
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