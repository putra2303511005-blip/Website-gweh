import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx' // Memanggil kode utama
import './index.css'      // MEMANGGIL TAILWIND

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)