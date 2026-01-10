"use server";

import { google } from "googleapis";

export async function getSpreadsheetData() {
  try {
    // 1. Setup Auth (Cukup sekali di awal)
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 2. AMBIL ID DARI ENV & PISAHKAN BERDASARKAN KOMA
    // Menggunakan variable baru SPREADSHEET_IDS
    const spreadsheetIdsString = process.env.SPREADSHEET_IDS || "";
    
    // Split string menjadi array dan bersihkan spasi jika ada (misal: "id1, id2")
    const spreadsheetIds = spreadsheetIdsString.split(",").map(id => id.trim()).filter(id => id !== "");

    if (spreadsheetIds.length === 0) {
      return { success: false, message: "Variable SPREADSHEET_IDS belum diset atau kosong." };
    }

    let allRawRows: any[] = [];

    // 3. LOOPING UNTUK MENGAMBIL DATA DARI SETIAP ID
    // Kita gunakan Promise.all agar pengambilan data berjalan paralel (lebih cepat)
    await Promise.all(
      spreadsheetIds.map(async (id) => {
        try {
          // A. Ambil Metadata per ID
          const metaData = await sheets.spreadsheets.get({
            spreadsheetId: id,
          });

          const sheetTitle = metaData.data.sheets?.[0]?.properties?.title;
          if (!sheetTitle) return; // Skip jika error/tidak ketemu

          // B. Ambil Values
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: id,
            range: `'${sheetTitle}'!A:C`,
          });

          const rows = response.data.values;

          // C. Kumpulkan data (Skip Header baris pertama per sheet)
          if (rows && rows.length > 1) {
            // rows.slice(1) untuk membuang header di setiap sheet
            const cleanRows = rows.slice(1);
            allRawRows.push(...cleanRows);
          }
        } catch (err) {
          console.error(`Gagal mengambil data dari ID: ${id}`, err);
          // Kita continue saja, jangan throw error agar ID lain tetap terambil
        }
      })
    );

    if (allRawRows.length === 0) {
      return { success: false, message: "Data kosong dari semua spreadsheet." };
    }

    // 4. FORMAT DATA & URUTKAN NOMOR UNDIAN SECARA GLOBAL
    // Mapping dilakukan setelah semua data terkumpul agar nomor urutnya rapi (1 sd Total)
    const formattedData = allRawRows
      .map((row) => {
        // Logika Ambil Nama (Prioritas Kolom B, lalu A)
        const nameRaw = row[1] || row[0] || "";
        return nameRaw.trim();
      })
      .filter((name) => name !== "") // Hapus nama kosong
      .map((name, index) => {
        // Generate nomor undian berdasarkan urutan total gabungan
        const lotteryNumber = (index + 1).toString().padStart(3, "0");
        return {
          name: name,
          lotteryNumber: lotteryNumber,
        };
      });

    return { success: true, data: formattedData };

  } catch (error) {
    console.error("Spreadsheet Global Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Gagal mengambil data.";
    return { success: false, message: `Gagal koneksi: ${errorMessage}` };
  }
}