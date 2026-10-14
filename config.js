/*
 * Khatamul Qur'an drive configuration.
 * Edit this file in GitHub to create a new drive.
 * For shared live reservations, follow README.md to configure Supabase.
 */
window.KHATAM_CONFIG = {
  driveId: "family-drive-001",
  title: "Khatamul Qur’an",
  marhoomName: "[Name of the Marhoom]",
  subtitle: "May every letter recited be a means of mercy, light and lasting reward.",
  logoPath: "assets/muzdalifah-foundation-logo.jpg",
  hadithText: "Whoever recites a letter from the Book of Allah will receive a good deed, and a good deed is multiplied tenfold.",
  hadithSource: "Jamiʿ at-Tirmidhi 2910",
  // Firebase Realtime Database configuration.
  // Create a Firebase project, register a Web App, and paste its config below.
  firebaseConfig: {
    apiKey: "AIzaSyC9e2UYjNkcSANhyolAkWGBiPlWgc4P40I",
    authDomain: "khatamul-quraan.firebaseapp.com",
    databaseURL: "https://khatamul-quraan-default-rtdb.firebaseio.com",
    projectId: "khatamul-quraan",
    storageBucket: "khatamul-quraan.firebasestorage.app",
    messagingSenderId: "978794655938",
    appId: "1:978794655938:web:8bb4fafdd35f15f4c60b5b",
    measurementId: "G-YY8RMFB9DG"
  },
  // Keep a unique ID for every separate drive.
  slug: "family-drive"
};
