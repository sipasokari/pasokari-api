const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- MIDDLEWARE ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

// --- KONEKSI DATABASE ---
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log("✅ Berhasil terhubung ke MongoDB!"))
  .catch((err) => console.error("❌ Gagal konek ke MongoDB:", err.message));


// --- MODEL DATABASE ---
// 1. Model Kontak
const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

// 2. Model Produk
const categorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  id: { products: [String] },
  en: { products: [String] }
}, { id: false }); // Penting: matikan id virtual
const Category = mongoose.model('Category', categorySchema);


// --- KONFIGURASI EMAIL (NODEMAILER) ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// --- ROUTES ---
app.get('/', (req, res) => {
  res.send('Halo! Server Backend Pasokari Siap (Nodemailer Version) 🚀');
});

// --- API 1: KONTAK ---
app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    
    // Validasi sederhana
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Data tidak lengkap!" });
    }

    // A. Simpan ke Database (Prioritas Utama)
    const newInquiry = new Inquiry({ name, phone, email, message });
    await newInquiry.save();
    console.log(`💾 Pesan dari ${name} tersimpan di Database.`);

    // B. Kirim Email Notifikasi (Non-Blocking)
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `📩 Pesan Baru: ${name}`,
      html: `
        <h3>Pesan Baru dari Website Pasokari</h3>
        <p><strong>Nama:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telepon:</strong> ${phone}</p>
        <hr/>
        <p><strong>Pesan:</strong></p>
        <blockquote style="background:#f9f9f9; padding:15px; border-left: 4px solid #00a859;">
          ${message}
        </blockquote>
      `
    };

    transporter.sendMail(mailOptions)
      .then(() => console.log("📧 Email notifikasi berhasil terkirim!"))
      .catch((err) => console.error("⚠️ Gagal kirim email (Mungkin blokir port):", err.message));

    // C. Respon Sukses ke Frontend
    res.status(201).json({ success: true, message: "Pesan berhasil disimpan!" });

  } catch (error) {
    console.error("CRITICAL ERROR (Contact):", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
});

// --- API 2: PRODUK (GET) ---
app.get('/api/products', async (req, res) => {
  try {
    const categories = await Category.find();
    const formattedData = {};
    categories.forEach(cat => {
      formattedData[cat.key] = { id: cat.id, en: cat.en };
    });
    res.json(formattedData);
  } catch (error) {
    console.error("Gagal ambil produk:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data." });
  }
});

// --- API 3: SEEDING (POST) ---
app.post('/api/products/seed', async (req, res) => {
  try {
    const rawData = req.body;
    await Category.deleteMany({});
    const insertOps = Object.keys(rawData).map(key => ({
      key: key, id: rawData[key].id, en: rawData[key].en
    }));
    await Category.insertMany(insertOps);
    console.log("✅ Seeding Database Berhasil.");
    res.json({ success: true, message: "Database berhasil diisi!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal seeding." });
  }
});

// --- JALANKAN SERVER ---
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});