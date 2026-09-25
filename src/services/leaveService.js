import { db } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

export const leaveService = {
  submitLeaveRequest: async (
    nip,
    schoolId,
    type,
    startDate,
    endDate,
    reason,
    attachmentUrl,
  ) => {
    try {
      const docId = Date.now().toString();
      // PERUBAHAN PATH SUB-KOLEKSI
      const docRef = doc(db, `schools/${schoolId}/leave_requests`, docId);

      const payload = {
        nip,
        school_id: schoolId,
        type,
        start_date: startDate,
        end_date: endDate,
        reason,
        attachment: attachmentUrl, // URL Cloudinary
        status: "pending",
        created_at: new Date().toISOString(),
      };

      await setDoc(docRef, payload);
      return true;
    } catch (error) {
      console.error("Error submit leave:", error);
      return false;
    }
  },

  // DITAMBAH SCHOOL ID
  getUserHistory: async (nip, schoolId) => {
    if (!schoolId) return [];
    try {
      // PERUBAHAN PATH SUB-KOLEKSI
      const q = query(
        collection(db, `schools/${schoolId}/leave_requests`),
        where("nip", "==", nip),
      );
      const snap = await getDocs(q);
      const history = [];
      snap.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      return history.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    } catch (error) {
      console.error("Error get leave history:", error);
      return [];
    }
  },

  approveLeaveRequest: async (requestData) => {
    try {
      const { id, school_id, nip, type, start_date } = requestData;
      // 1. Update status Izin di Sub-Koleksi Sekolah
      const leaveRef = doc(db, `schools/${school_id}/leave_requests`, id);
      await updateDoc(leaveRef, { status: "approved" });

      // 2. Suntik otomatis ke Sub-Koleksi Absensi Sekolah
      const attDocId = `${nip}_${start_date}`;
      const attRef = doc(db, `schools/${school_id}/attendances`, attDocId);

      await setDoc(
        attRef,
        {
          user_id: nip,
          school_id: school_id,
          date: start_date,
          status: type,
          total_hours: type === "izin_kedinasan" || type === "cuti" ? 8 : 0,
          check_in: { time: "[AUTO-INJECT]", latitude: 0, longitude: 0 },
          check_out: { time: "[AUTO-INJECT]", latitude: 0, longitude: 0 },
          is_auto_injected: true,
          server_created_at: serverTimestamp(),
        },
        { merge: true },
      );

      return true;
    } catch (error) {
      console.error("Error approve leave:", error);
      return false;
    }
  },

  // DITAMBAH SCHOOL ID
  rejectLeaveRequest: async (requestId, schoolId) => {
    try {
      const leaveRef = doc(db, `schools/${schoolId}/leave_requests`, requestId);
      await updateDoc(leaveRef, { status: "rejected" });
      return true;
    } catch (error) {
      console.error("Error reject leave:", error);
      return false;
    }
  },
};
