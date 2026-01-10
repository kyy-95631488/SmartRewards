// app/panel/features/AwardNomineesView.tsx
"use client";

import { useState } from "react";
import { Trash2, Search, ScanLine, Plus, Users, Edit3, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AwardNominee } from "../types";

// Helper for Gemini
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

interface AwardNomineesViewProps {
  nominees: AwardNominee[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onAdd: (singleName: string) => void;
  onUpdate: (updated: AwardNominee) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkAdd: (names: string[]) => Promise<void>;
}

export default function AwardNomineesView({ 
  nominees, 
  searchQuery, 
  setSearchQuery, 
  onAdd, 
  onUpdate, 
  onDelete,
  onBulkDelete,
  onBulkAdd
}: AwardNomineesViewProps) {
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