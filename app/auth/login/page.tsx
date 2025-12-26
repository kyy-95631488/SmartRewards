// app/auth/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, ChevronRight, AlertCircle, Loader2, Eye, EyeOff, Check } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { onAuthStateChanged } from "firebase/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // State UI
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Security States (Anti Brute Force)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const router = useRouter();

  // Load remembered Email ONLY
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    const isRemembered = localStorage.getItem("isRemembered") === "true";
    
    if (rememberedEmail) {
      setEmail(rememberedEmail);
    }
    if (isRemembered) {
      setRememberMe(true);
    }
  }, []);

  // Handle Lockout Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLocked && lockTimer > 0) {
      interval = setInterval(() => {
        setLockTimer((prev) => prev - 1);
      }, 1000);
    } else if (lockTimer === 0) {
      setIsLocked(false);
      setFailedAttempts(0);
    }
    return () => clearInterval(interval);
  }, [isLocked, lockTimer]);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Silent check - jangan log apapun jika gagal di background
        try {
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === "marketing") {
              router.push("/panel");
            }
          }
        } catch {
          // Silent catch: Jangan log error ke console
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Input Validation & Sanitization
  const validateInput = (emailInput: string, passwordInput: string) => {
    const cleanEmail = emailInput.trim();
    
    if (!cleanEmail || !passwordInput) {
      setError("Mohon isi semua kolom.");
      return null;
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(cleanEmail)) {
      setError("Format email tidak valid.");
      return null;
    }

    if (passwordInput.length < 6) {
      setError("Password terlalu pendek.");
      return null;
    }

    return cleanEmail;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) return;

    setError("");
    const cleanEmail = validateInput(email, password);
    if (!cleanEmail) return;

    setLoading(true);

    try {
        await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
        );

        const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
        );

        const user = userCredential.user;
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        const saveDataAndRedirect = (role: string) => {
        sessionStorage.setItem("userRole", role);
        router.push("/panel");
        };

        if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.role === "marketing") {
            setFailedAttempts(0);

            if (rememberMe) {
            localStorage.setItem("rememberedEmail", cleanEmail);
            localStorage.setItem("isRemembered", "true");
            } else {
            localStorage.removeItem("rememberedEmail");
            localStorage.removeItem("isRemembered");
            }

            saveDataAndRedirect(userData.role);
        } else {
            setError("Akses Ditolak. Khusus Staff Marketing.");
            await auth.signOut();
        }
        } else {
        await setDoc(userRef, {
            email: user.email,
            role: "marketing",
        });

        if (rememberMe) {
            localStorage.setItem("rememberedEmail", cleanEmail);
            localStorage.setItem("isRemembered", "true");
        } else {
            localStorage.removeItem("rememberedEmail");
            localStorage.removeItem("isRemembered");
        }

        saveDataAndRedirect("marketing");
        }
    } catch (err: unknown) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (newAttempts >= 5) {
        setIsLocked(true);
        setLockTimer(30);
        setError("Terlalu banyak percobaan gagal. Silakan tunggu 30 detik.");
        return;
        }

        // ✅ Type narrowing yang benar
        if (err instanceof FirebaseError) {
        switch (err.code) {
            case "auth/invalid-credential":
            case "auth/user-not-found":
            case "auth/wrong-password":
            setError("Email atau password salah.");
            break;

            case "auth/too-many-requests":
            setError("Akses dibatasi sementara. Coba lagi nanti.");
            break;

            case "auth/network-request-failed":
            setError("Koneksi jaringan bermasalah.");
            break;

            default:
            setError("Terjadi kesalahan sistem.");
        }
        } else {
        setError("Terjadi kesalahan tidak dikenal.");
        }
    } finally {
        setLoading(false);
    }
    };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50 font-sans">
      
      {/* Background Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div animate={{ x: [-20, 20, -20], y: [-20, 20, -20] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-200/50 rounded-full blur-[100px]" />
        <motion.div animate={{ x: [20, -20, 20], y: [20, -20, 20] }} transition={{ duration: 10, repeat: Infinity }} className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-200/50 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="w-full max-w-md p-8 relative z-10"
      >
        <div className="bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200 rotate-3">
              <Lock className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">Admin Portal</h1>
            <p className="text-slate-500 text-sm mt-1">Silakan login untuk mengakses Gathering App</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} 
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 border border-red-100 overflow-hidden"
                >
                  <AlertCircle size={16} className="shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  disabled={isLocked}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-100"
                  placeholder="marketing@smartlab.id"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  disabled={isLocked}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-12 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:bg-slate-100"
                  placeholder="••••••••"
                />
                
                {/* Modern Show/Hide Button */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all focus:outline-none"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Modern Remember Me Toggle */}
            <div className="flex items-center justify-between pt-2">
              <div 
                className="flex items-center gap-3 cursor-pointer group"
                onClick={() => !isLocked && setRememberMe(!rememberMe)}
              >
                {/* Custom Checkbox Design */}
                <div className={`w-5 h-5 rounded-[6px] border flex items-center justify-center transition-all duration-200 ${
                  rememberMe 
                    ? "bg-blue-600 border-blue-600 shadow-md shadow-blue-200" 
                    : "bg-white border-slate-300 group-hover:border-blue-400"
                }`}>
                  <motion.div
                    initial={false}
                    animate={{ scale: rememberMe ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </motion.div>
                </div>
                
                <span className={`text-sm transition-colors select-none ${rememberMe ? "text-slate-700 font-medium" : "text-slate-500 group-hover:text-slate-700"}`}>
                  Ingat Saya
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || isLocked}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : isLocked ? (
                `Tunggu ${lockTimer}s`
              ) : (
                <>LOGIN MASUK <ChevronRight size={18} /></>
              )}
            </button>
          </form>
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-8">
          © 2025 SmartRewards System. Protected Area.
        </p>
      </motion.div>
    </div>
  );
}