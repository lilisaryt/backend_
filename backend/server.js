const express = require("express");
const cors = require("cors");
const pool = require("./database");

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend berjalan!");
});

app.get("/api/health", async (req, res) => {
  await pool.query("SELECT 1 FROM siswa LIMIT 1");
  res.json({ status: "ok", database: "connected" });
});

app.get("/api/siswa", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT `kode siswa` AS kode_siswa, `tanggal siswa` AS tanggal_siswa, `nama siswa` AS nama_siswa, `jurusan siswa` AS jurusan_siswa, `alamat siswa` AS alamat_siswa FROM siswa ORDER BY `kode siswa` DESC"
  );
  res.json(rows);
});

app.get("/api/siswa/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "ID siswa tidak valid." });
  }

  const [rows] = await pool.execute(
    "SELECT `kode siswa` AS kode_siswa, `tanggal siswa` AS tanggal_siswa, `nama siswa` AS nama_siswa, `jurusan siswa` AS jurusan_siswa, `alamat siswa` AS alamat_siswa FROM siswa WHERE `kode siswa` = ?",
    [id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ message: "Siswa tidak ditemukan." });
  }

  res.json(rows[0]);
});

function getSiswaValues(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const required = ["tanggal_siswa", "nama_siswa"];
  if (required.some((field) => typeof body[field] !== "string" || !body[field].trim())) {
    return null;
  }

  const optional = ["jurusan_siswa", "alamat_siswa"];
  if (optional.some((field) => body[field] != null && typeof body[field] !== "string")) {
    return null;
  }

  return [
    body.tanggal_siswa.trim(),
    body.nama_siswa.trim(),
    body.jurusan_siswa ? body.jurusan_siswa.trim() || null : null,
    body.alamat_siswa ? body.alamat_siswa.trim() || null : null,
  ];
}

app.post("/api/siswa", async (req, res) => {
  const values = getSiswaValues(req.body);
  if (!values) {
    return res.status(400).json({
      message: "tanggal_siswa dan nama_siswa wajib diisi; jurusan_siswa dan alamat_siswa harus berupa teks.",
    });
  }

  const [result] = await pool.execute(
    "INSERT INTO siswa (`tanggal siswa`, `nama siswa`, `jurusan siswa`, `alamat siswa`) VALUES (?, ?, ?, ?)",
    values
  );
  res.status(201).json({
    kode_siswa: result.insertId,
    message: "Data siswa berhasil ditambahkan.",
  });
});

app.put("/api/siswa/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "ID siswa tidak valid." });
  }

  const values = getSiswaValues(req.body);
  if (!values) {
    return res.status(400).json({
      message: "tanggal_siswa dan nama_siswa wajib diisi; jurusan_siswa dan alamat_siswa harus berupa teks.",
    });
  }

  const [existing] = await pool.execute(
    "SELECT `kode siswa` FROM siswa WHERE `kode siswa` = ?",
    [id]
  );
  if (existing.length === 0) {
    return res.status(404).json({ message: "Siswa tidak ditemukan." });
  }

  await pool.execute(
    "UPDATE siswa SET `tanggal siswa` = ?, `nama siswa` = ?, `jurusan siswa` = ?, `alamat siswa` = ? WHERE `kode siswa` = ?",
    [...values, id]
  );
  res.json({ kode_siswa: id, message: "Data siswa berhasil diperbarui." });
});

app.delete("/api/siswa/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ message: "ID siswa tidak valid." });
  }

  const [result] = await pool.execute("DELETE FROM siswa WHERE `kode siswa` = ?", [id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: "Siswa tidak ditemukan." });
  }

  res.json({ message: "Data siswa berhasil dihapus." });
});

app.use((req, res) => {
  res.status(404).json({ message: "Endpoint tidak ditemukan." });
});

app.use((err, req, res, next) => {
  console.error("Request gagal:", err);
  if (res.headersSent) {
    return next(err);
  }

  const status = Number(err.status || err.statusCode);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ message: "Request tidak valid." });
  }
  res.status(500).json({ message: "Terjadi kesalahan pada server." });
});

async function startServer() {
  await pool.query("SELECT 1 FROM siswa LIMIT 1");
  app.listen(port, () => {
    console.log(`Backend berjalan di http://localhost:${port}`);
    console.log("MySQL terhubung ke database siswa.");
  });
}

startServer().catch((err) => {
  console.error("Backend gagal dimulai; periksa MySQL dan backend/.env:", err.message);
  pool.end().catch((closeErr) => {
    console.error("Gagal menutup koneksi MySQL:", closeErr.message);
  });
  process.exitCode = 1;
});
