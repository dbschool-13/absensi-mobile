// src/utils/uploadService.js
export const uploadToCloudinary = async (file) => {
  const cloudName = "ophefc4j"; // Ganti dengan Cloud Name Anda
  const uploadPreset = "leave_request_preset"; // Ganti dengan Upload Preset Unsigned Anda

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "lampiran_absen"); // Opsional: Bikin folder rapi di Cloudinary

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    return data.secure_url; // Mengembalikan URL pendek gambar/PDF (contoh: https://res.cloudinary.com/...)
  } catch (error) {
    console.error("Gagal upload ke Cloudinary", error);
    return null;
  }
};