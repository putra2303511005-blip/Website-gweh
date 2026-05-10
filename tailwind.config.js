/** @type {import('tailwindcss').Config} */
export default {
  // Bagian 'content' ini SANGAT PENTING. 
  // Ini memberi tahu Tailwind untuk memindai semua file .jsx di dalam folder src
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Anda bisa menambahkan warna atau font custom di sini nanti
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}