
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';
import { Lock, Mail, User, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isMounted = useRef(true);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: Role.SALES_REP
  });

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await signIn(formData.email, formData.password);
      } else {
        result = await signUp(formData.email, formData.password, formData.name, formData.role);
      }

      if (result.error) {
        if (isMounted.current) setError(result.error.message);
      } else {
        if (!isLogin) {
          if (isMounted.current) {
             alert("Account created! Please sign in.");
             setIsLogin(true);
          }
        } else {
          // Navigation happens here. The component will unmount.
          navigate('/');
        }
      }
    } catch (err) {
      if (isMounted.current) setError('An unexpected error occurred');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-stone-900 p-8 text-center">
          <div className="w-12 h-12 bg-primary-500 rounded-lg mx-auto flex items-center justify-center text-stone-900 text-2xl font-extrabold mb-4">G</div>
          <h1 className="text-2xl font-bold text-white">GraniteFlow ERP</h1>
          <p className="text-stone-400 text-sm mt-2">Enterprise Management System</p>
        </div>

        <div className="p-8">
          <div className="flex gap-4 mb-8 bg-stone-100 p-1 rounded-lg">
            <button 
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${isLogin ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${!isLogin ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-stone-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="relative">
                   <select 
                      className="w-full pl-3 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
                      value={formData.role}
                      onChange={e => setFormData({...formData, role: e.target.value as Role})}
                   >
                     {Object.values(Role).map(role => (
                       <option key={role} value={role}>{role}</option>
                     ))}
                   </select>
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-3 text-stone-400" size={18} />
              <input 
                type="email" 
                placeholder="Email Address"
                className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3 text-stone-400" size={18} />
              <input 
                type="password" 
                placeholder="Password"
                className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={18} />}
              {isLogin ? 'Access Dashboard' : 'Register User'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
