// // context/AuthContext.tsx
// "use client";

// import { createContext, useContext, useEffect, useState } from "react";
// import { onAuthStateChanged, User, signOut } from "firebase/auth";
// import { doc, getDoc } from "firebase/firestore";
// import { auth, db } from "../lib/firebase"; // Pastikan path ini sesuai struktur folder kamu
// import { useRouter } from "next/navigation";

// interface AuthContextType {
//   user: User | null;
//   role: string | null;
//   loading: boolean;
//   logout: () => Promise<void>;
// }

// const AuthContext = createContext<AuthContextType>({
//   user: null,
//   role: null,
//   loading: true,
//   logout: async () => {},
// });

// export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
//   const [user, setUser] = useState<User | null>(null);
//   const [role, setRole] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);
//   const router = useRouter();

//   useEffect(() => {
//     const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
//       setLoading(true);
//       if (currentUser) {
//         // Jika user login, cek role di Firestore
//         try {
//           const userDoc = await getDoc(doc(db, "users", currentUser.uid));
//           if (userDoc.exists()) {
//             const userData = userDoc.data();
//             setRole(userData.role); // Simpan role (contoh: 'marketing')
//             setUser(currentUser);
//           } else {
//             // User ada di Auth tapi tidak ada di database users
//             setRole(null);
//             setUser(currentUser);
//           }
//         } catch (error) {
//           console.error("Error fetching user role:", error);
//           setRole(null);
//         }
//       } else {
//         setUser(null);
//         setRole(null);
//       }
//       setLoading(false);
//     });

//     return () => unsubscribe();
//   }, []);

//   const logout = async () => {
//     await signOut(auth);
//     router.push("/login");
//   };

//   return (
//     <AuthContext.Provider value={{ user, role, loading, logout }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);