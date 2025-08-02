'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const Navbar = () => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  const navItems = ['Product', 'Features', 'Marketplace', 'Users'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserRole(data.role || 'user');
        } else {
          setUserRole('user');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <header className="bg-transparent backdrop-blur-sm shadow-md sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xl text-gray-900">AndreApp</span>
        </div>

        {/* Desktop Menu */}
        <nav className="hidden lg:flex space-x-8">
          
        </nav>

        {/* User Profile or Login */}
        <div className="hidden lg:flex items-center space-x-4">
          {user ? (
            <>
              <img
                src={user.photoURL + '?sz=100'} // tambahkan ukuran eksplisit
                referrerPolicy="no-referrer"
                alt="User profile"
                className="w-9 h-9 rounded-full"
              />
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-sm text-gray-800 hover:text-red-600 cursor-pointer transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-gray-900">
              Login <span>&rarr;</span>
            </Link>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 p-2"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="lg:hidden bg-white px-4 pb-4 shadow-md">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item}
                href="#"
                className="block text-gray-700 py-2 hover:text-indigo-600"
              >
                {item}
              </Link>
            ))}
            {user ? (
              <div className="mt-4 border-t pt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={user.photoURL || '/default-avatar.png'}
                    alt="User"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <span className="text-sm text-gray-700">{userRole}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:underline"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link href="/login" className="block text-sm font-medium text-gray-900">
                Login →
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
