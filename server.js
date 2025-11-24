const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail'); // Ganti Nodemailer dengan SendGrid
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- KONFIGURASI SENDGRID ---
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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
const inquirySchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

const categorySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  id: { products: [String] },
  en: { products: [String] }
}, { id: false });
const Category = mongoose.model('Category', categorySchema);

// --- ROUTES ---

app.get('/', (req, res) => {
  res.send('Halo! Server Backend Pasokari Siap! (Email via SendGrid) 🚀');
});

// --- API 1: KONTAK (Logika Email Menggunakan API) ---
app.post('/api/contact', async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Data tidak lengkap!" });
    }

    // A. Simpan ke Database
    const newInquiry = new Inquiry({ name, phone, email, message });
    await newInquiry.save();

    // B. Kirim Email Notifikasi (Menggunakan SendGrid API)
    const mailOptions = {
      to: process.env.EMAIL_PENGIRIM, // Penerima (Anda)
      from: process.env.EMAIL_PENGIRIM, // Wajib menggunakan email yang diverifikasi SendGrid
      subject: `📩 Pesan Baru dari Website: ${name}`,
      html: `
        <h3>Pesan Baru dari Website Pasokari</h3>
        <p><strong>Nama:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telepon:</strong> ${phone}</p>
        <p><strong>Pesan:</strong></p>
        <blockquote style="background:#eee; padding:10px;">${message}</blockquote>
      `
    };
    
    // Kirim email di latar belakang (non-blocking)
    sgMail.send(mailOptions)
        .then(() => console.log("📧 Email notifikasi terkirim via SendGrid."))
        .catch((apiErr) => {
             console.error("⚠️ GAGAL KIRIM EMAIL API:", apiErr.response.body);
        });

    // C. Respon Sukses
    res.status(201).json({ success: true, message: "Pesan tersimpan! Email notifikasi sedang diproses." });

  } catch (error) {
    console.error("Gagal kontak:", error);
    res.status(500).json({ success: false, message: "Gagal memproses pesan." });
  }
});

// --- API 2 & 3: PRODUK & SEEDING (Tetap Sama) ---
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

app.post('/api/products/seed', async (req, res) => {
  try {
    const rawData = req.body;
    await Category.deleteMany({});
    const insertOps = Object.keys(rawData).map(key => {
      return { key: key, id: rawData[key].id, en: rawData[key].en };
    });
    await Category.insertMany(insertOps);
    console.log("✅ Data Produk Berhasil dipindahkan ke Database!");
    res.json({ success: true, message: "Database produk berhasil diisi!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal seeding." });
  }
});

// --- JALANKAN SERVER ---
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});