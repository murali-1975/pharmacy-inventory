import React, { useState } from 'react';
import { Pill, User, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import logo from '../assets/omniflow_logo.png';

const Login = ({ onLogin, error: propError, logoutReason }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isRegistering) {
        // We'll keep registration here for now but call the callback if it exists
        await api.register(username, email, password);
        setIsRegistering(false);
        setError('Registration successful! Please login.');
      } else {
        // THE FIX: Call onLogin with username and password, not the token!
        const success = await onLogin(username, password);
        if (!success) {
          // Error is handled by useAuth and passed via 'error' prop
          // but we can also set local error if needed. 
          // Actually, App.jsx passes authError as 'error' prop to Login.
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans selection:bg-blue-100">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] relative">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-2 rounded-2xl shadow-xl shadow-blue-100 mb-4">
            <img src={logo} alt="Omniflow Logo" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 text-center">Omniflow</h1>
          <p className="text-gray-500 font-medium mt-1">Inventory Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl shadow-gray-200/50 border border-white/20 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-150">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900">
              {isRegistering ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {isRegistering ? 'Join our pharmacy network today' : 'Please enter your details to sign in'}
            </p>
          </div>

          {(error || propError || logoutReason) && (
            <div className={`mb-6 p-4 rounded-2xl flex items-center space-x-3 text-sm animate-in zoom-in duration-300 ${
              (error || propError || '').includes('successful') 
                ? 'bg-green-50 text-green-700 border border-green-100' 
                : (logoutReason === 'session_expired' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-red-50 text-red-700 border border-red-100')
            }`}>
              {(error || propError || '').includes('successful') 
                ? <AlertCircle className="text-green-500" size={18} /> 
                : (logoutReason === 'session_expired' ? <AlertCircle className="text-amber-500" size={18} /> : <AlertCircle className="text-red-500" size={18} />)}
              <span className="font-medium">
                {error || propError || (logoutReason === 'session_expired' ? 'Your session has expired. Please login again.' : '')}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  required
                  type="text"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Email Address</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    required
                    type="email"
                    placeholder="admin@pharma.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-300"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  required
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-300"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-sm shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all duration-300 active:scale-95 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center space-x-2 mt-4"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>{isRegistering ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-8">
          &copy; 2026 Omniflow. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
