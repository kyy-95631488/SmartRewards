"use client";

import { FileText, Calendar, FileSpreadsheet, Download, Medal, Gift } from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DoorprizeWinner, AwardWinnerSlot, AwardNominee, ArchivedSession } from "../types";

interface RecapViewProps {
    doorprizeWinners: DoorprizeWinner[];
    awardWinners: AwardWinnerSlot[];
    awardNominees: AwardNominee[];
    historySessions: ArchivedSession[];
    selectedSession: string;
    setSelectedSession: (id: string) => void;
}

export default function RecapView({ 
    doorprizeWinners,
    awardWinners,
    awardNominees,
    historySessions,
    selectedSession,
    setSelectedSession
}: RecapViewProps) {
    
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
                // Update rank display logic to show ALL ranks clearly
                Rank: `Juara ${p.rank}`,
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
            r.Rank, // Sudah diformat di getAwardRawData
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
                                        <td className="px-4 py-3 text-slate-700">
                                            <div className="font-medium">{getAwardName(p.candidateId)}</div>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white inline-block mt-1 ${
                                                p.rank === 1 ? 'bg-yellow-500' : 
                                                p.rank === 2 ? 'bg-slate-400' : 
                                                p.rank === 3 ? 'bg-orange-400' : 'bg-indigo-500'
                                            }`}>
                                                {/* Consistent Label for Recap Table */}
                                                {`JUARA ${p.rank}`}
                                            </span>
                                        </td>
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