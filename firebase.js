// firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyC64P52ZNseF2sCJMiE1vnm14WEXU13qXw",
  authDomain: "art-gallergy.firebaseapp.com",
  databaseURL: "https://art-gallergy-default-rtdb.firebaseio.com",
  projectId: "art-gallergy",
  storageBucket: "art-gallergy.firebasestorage.app",
  messagingSenderId: "1019031920743",
  appId: "1:1019031920743:web:5eb2bdbe002c2500c0f4c2",
  measurementId: "G-EKJLHC4YFB"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
