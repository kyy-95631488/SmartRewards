// app/panel/features/PrizesView.tsx
/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Save, Plus, Loader2, Image as ImageIcon, Edit3, Trash2, Upload, Package, Crown, Banknote } from "lucide-react";
import { Prize } from "../types";

interface PrizesViewProps {
  prizes: Prize[];
  setPrizes: (p: Prize[]) => void;
  onSave: () => void;
  isSaving: boolean;
  onAdd: (newPrize: Omit<Prize, "id">) => Promise<string>;
  onUpdate: (updated: Prize) => void;
  onDelete: (id: string) => void;
  onUploadImage: (file: File, prizeId: string) => void;
  uploadingImageId: string | null;
  editingPrize: Prize | null;
  setEditingPrize: (p: Prize | null) => void;
}

export default function PrizesView({ 
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
}: PrizesViewProps) {
  // UPDATE STATE: Default value untuk price dan grand prize
  const [newPrize, setNewPrize] = useState<Omit<Prize, "id">>({ name: "", stock: 0, price: 0, isGrandPrize: false }); 
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [isUploadingNew, setIsUploadingNew] = useState(false);

  // Helper untuk format Rupiah
  const formatRupiah = (value: number | undefined) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const handleChangeStock = (id: string, delta: number) => {
    setPrizes(prizes.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p));
  };

  const handleStartEdit = (prize: Prize) => {
    setEditingPrize(prize);
  };

  // FIX: Mengganti 'any' menjadi tipe yang spesifik (string, number, atau boolean)
  const handleChangeEdit = (field: keyof Prize, value: string | number | boolean) => {
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

      // Reset form
      setNewPrize({ name: "", stock: 0, price: 0, isGrandPrize: false });
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
            <p className="text-slate-500 text-sm hidden sm:block">Kelola stok, harga, dan gambar hadiah doorprize</p>
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
                <div className="flex gap-2">
                    <input 
                        type="number" 
                        placeholder="Stok" 
                        value={newPrize.stock} 
                        onChange={(e) => setNewPrize({ ...newPrize, stock: parseInt(e.target.value) || 0 })} 
                        className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                    />
                    <input 
                        type="number" 
                        placeholder="Harga (Rp)" 
                        value={newPrize.price || ""} 
                        onChange={(e) => setNewPrize({ ...newPrize, price: parseInt(e.target.value) || 0 })} 
                        className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 outline-none" 
                    />
                </div>
                
                {/* CHECKBOX GRAND PRIZE */}
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors">
                    <input 
                        type="checkbox"
                        checked={newPrize.isGrandPrize || false}
                        onChange={(e) => setNewPrize({...newPrize, isGrandPrize: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                        Jadikan Hadiah Utama <Crown size={14} className="text-amber-500 fill-amber-500"/>
                    </span>
                </label>

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
           <div key={prize.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group ${prize.isGrandPrize ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-100'}`}>
              {/* Image Area */}
              <div className="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden">
                  
                  {/* GRAND PRIZE BADGE */}
                  {prize.isGrandPrize && (
                      <div className="absolute top-0 left-0 z-20 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg shadow-sm flex items-center gap-1">
                          <Crown size={12} className="fill-white"/> UTAMA
                      </div>
                  )}

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
                  
                  {/* SHOW HIDDEN PRICE INFO SMALL */}
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mb-2">
                     <Banknote size={10} className="text-emerald-600"/> 
                     <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                        {formatRupiah(prize.price)}
                     </span>
                  </div>

                  <div className="mt-auto pt-2 flex items-center justify-between">
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
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Harga (Rp)</label>
                    <input 
                    type="number" 
                    value={editingPrize.price || 0} 
                    onChange={(e) => handleChangeEdit("price", parseInt(e.target.value) || 0)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-100 outline-none" 
                    />
                    <p className="text-[10px] text-slate-400 mt-1 text-right">
                        Format: {formatRupiah(editingPrize.price)}
                    </p>
                </div>
                
                {/* CHECKBOX GRAND PRIZE EDIT */}
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors">
                    <input 
                        type="checkbox"
                        checked={editingPrize.isGrandPrize || false}
                        onChange={(e) => handleChangeEdit("isGrandPrize", e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 font-bold flex items-center gap-1">
                        Set Sebagai Hadiah Utama <Crown size={16} className={editingPrize.isGrandPrize ? "text-amber-500 fill-amber-500" : "text-slate-400"}/>
                    </span>
                </label>
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