// src/auth.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCYLv7zFNQs-hlVJnA1SOifQtQdYaG_nlU",
  authDomain: "feedlot-pro.firebaseapp.com",
  databaseURL: "https://feedlot-pro-default-rtdb.firebaseio.com",
  projectId: "feedlot-pro",
  storageBucket: "feedlot-pro.firebasestorage.app",
  messagingSenderId: "521976260853",
  appId: "1:521976260853:web:f6ed7bca05fee3b58ffdbc",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);