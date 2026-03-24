/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Plus,
  Trash2,
  AlertCircle,
  Briefcase,
  LineChart as ChartIcon,
  Activity,
  Calendar,
  Scale,
  LogOut,
  Lock,
  Mail,
  Bell,
  BellRing,
  Download,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface PricePoint {
  date: string;
  price: number;
}

interface AssetPriceData {
  currentPrice: number;
  history: PricePoint[];
}

interface PricesState {
  gold: AssetPriceData;
  silver: AssetPriceData;
  crypto: AssetPriceData;
}

interface Investment {
  id: string;
  assetType: 'gold' | 'silver' | 'crypto';
  name: string;
  quantity: number;
  purchasePrice: number;
  purchaseDate: string;
}

interface Alert {
  id: string;
  assetType: 'gold' | 'silver' | 'crypto';
  targetPrice: number;
  condition: 'above' | 'below';
  isTriggered: boolean;
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// --- Components ---

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [prices, setPrices] = useState<PricesState>({
    gold: { currentPrice: 0, history: [] },
    silver: { currentPrice: 0, history: [] },
    crypto: { currentPrice: 0, history: [] }
  });
  const [selectedChartAsset, setSelectedChartAsset] = useState<'gold' | 'silver' | 'crypto'>('gold');
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [aiInsight, setAiInsight] = useState<{ insight: string, recommendation: string } | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // New Investment Form State
  const [newAssetType, setNewAssetType] = useState<'gold' | 'silver' | 'crypto'>('gold');
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // New Alert Form State
  const [newAlertAssetType, setNewAlertAssetType] = useState<'gold' | 'silver' | 'crypto'>('gold');
  const [newAlertTargetPrice, setNewAlertTargetPrice] = useState('');
  const [newAlertCondition, setNewAlertCondition] = useState<'above' | 'below'>('above');

  // Handle Dark Mode Toggle
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Fetch real-time price updates and investments from backend
  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        const response = await fetch('/api/prices');
        if (!response.ok) throw new Error('Failed to fetch prices');
        const data = await response.json();
        setPrices(data);
        setFetchError(null);
      } catch (error) {
        console.error('Error fetching prices:', error);
        setFetchError('Failed to connect to the server. Retrying...');
      }
    };

    const fetchInvestments = async () => {
      if (!token) return;
      try {
        const [invRes, alertsRes, notifRes] = await Promise.all([
          fetch('/api/investments', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/alerts', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/notifications', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (invRes.status === 401) {
          handleLogout();
          return;
        }

        if (invRes.ok) setInvestments(await invRes.json());
        if (alertsRes.ok) setAlerts(await alertsRes.json());
        if (notifRes.ok) setNotifications(await notifRes.json());
        setFetchError(null);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setFetchError('Failed to load portfolio data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceData();
    fetchInvestments();
    const interval = setInterval(() => {
      fetchPriceData();
      fetchInvestments(); // Also poll for new notifications/alerts
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [token]);

  // Derived State
  const totalInvested = useMemo(() => investments.reduce((sum, inv) => sum + (inv.quantity * inv.purchasePrice), 0), [investments]);
  const currentValue = useMemo(() => investments.reduce((sum, inv) => {
    const currentAssetPrice = prices[inv.assetType]?.currentPrice || 0;
    return sum + (inv.quantity * currentAssetPrice);
  }, 0), [investments, prices]);
  
  const totalProfitLoss = currentValue - totalInvested;
  const profitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const activeChartData = prices[selectedChartAsset];
  const priceChange24h = activeChartData.history.length >= 2 ? activeChartData.currentPrice - activeChartData.history[activeChartData.history.length - 2].price : 0;
  const priceChange24hPercent = activeChartData.history.length >= 2 ? (priceChange24h / activeChartData.history[activeChartData.history.length - 2].price) * 100 : 0;

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newQuantity || !newPrice || !newDate || !token) return;

    try {
      const response = await fetch('/api/investments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assetType: newAssetType,
          name: newName,
          quantity: parseFloat(newQuantity),
          purchasePrice: parseFloat(newPrice),
          purchaseDate: newDate,
        }),
      });

      if (!response.ok) throw new Error('Failed to add investment');
      
      const newInv = await response.json();
      setInvestments([newInv, ...investments]);
      
      setNewName('');
      setNewQuantity('');
      setNewPrice('');
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Error adding investment:', error);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/investments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete investment');
      
      setInvestments(investments.filter(inv => inv.id !== id));
    } catch (error) {
      console.error('Error deleting investment:', error);
    }
  };

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertTargetPrice || !token) return;

    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assetType: newAlertAssetType,
          targetPrice: parseFloat(newAlertTargetPrice),
          condition: newAlertCondition,
        }),
      });

      if (!response.ok) throw new Error('Failed to add alert');
      
      const newAlert = await response.json();
      setAlerts([newAlert, ...alerts]);
      setNewAlertTargetPrice('');
    } catch (error) {
      console.error('Error adding alert:', error);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/alerts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setAlerts(alerts.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  const generateAIInsight = async () => {
    if (!token || investments.length === 0) return;
    setIsGeneratingInsight(true);
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          portfolio: investments,
          prices: prices
        })
      });
      
      if (!response.ok) throw new Error('Failed to generate insights');
      const data = await response.json();
      setAiInsight(data);
    } catch (error) {
      console.error('Error generating AI insight:', error);
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');
      
      setToken(data.token);
      localStorage.setItem('auth_token', data.token);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('auth_token');
    setInvestments([]);
    setAlerts([]);
    setNotifications([]);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Aura Gold - Portfolio Summary', 14, 22);
    
    // Date
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(new Date(), 'PPpp')}`, 14, 30);
    
    // Summary Stats
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Analytics Overview', 14, 45);
    
    doc.setFontSize(11);
    doc.text(`Total Portfolio Value: Rs. ${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 55);
    doc.text(`Total Invested: Rs. ${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 62);
    doc.text(`Total Profit/Loss: ${totalProfitLoss >= 0 ? '+' : '-'}Rs. ${Math.abs(totalProfitLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${profitLossPercentage.toFixed(2)}%)`, 14, 69);

    // Holdings Table
    const tableData = investments.map(inv => {
      const currentAssetPrice = prices[inv.assetType]?.currentPrice || 0;
      const currentVal = inv.quantity * currentAssetPrice;
      const investedVal = inv.quantity * inv.purchasePrice;
      const profit = currentVal - investedVal;
      const profitPct = investedVal > 0 ? (profit / investedVal) * 100 : 0;
      
      return [
        inv.name,
        inv.assetType.toUpperCase(),
        `${inv.quantity} ${inv.assetType === 'crypto' ? 'BTC' : 'g'}`,
        `Rs. ${inv.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Rs. ${currentVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `${profit >= 0 ? '+' : '-'}Rs. ${Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${profitPct.toFixed(2)}%)`
      ];
    });

    autoTable(doc, {
      startY: 80,
      head: [['Asset Name', 'Type', 'Quantity', 'Purchase Price', 'Current Value', 'Return']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [251, 191, 36] }, // amber-400
    });

    // Save
    doc.save(`Aura_Gold_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 dark:border-gray-700 w-full max-w-md transition-colors duration-300"
        >
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-amber-900 shadow-sm">
              <Activity size={24} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Aura Gold</h1>
          </div>
          
          <h2 className="text-xl font-medium text-center mb-6 text-gray-900 dark:text-white">
            {authMode === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>

          {authError && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle size={16} />
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-gray-400" />
                </div>
                <input 
                  type="password" 
                  required
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-gray-900 dark:bg-gray-700 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError('');
              }}
              className="text-amber-600 dark:text-amber-500 font-medium hover:underline"
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-50/40 via-slate-50 to-slate-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 font-sans text-gray-900 dark:text-gray-100 pb-12 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/80 dark:border-gray-800 sticky top-0 z-50 shadow-sm transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-amber-900 shadow-sm">
              <Activity size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">Aura Gold Tracker</h1>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right hidden sm:block">
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">Total Value</div>
              <div className="text-lg font-bold flex items-center justify-end gap-1 text-gray-900 dark:text-white">
                ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <button 
              onClick={exportToPDF}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex items-center gap-2"
              title="Export PDF Report"
            >
              <Download size={20} />
            </button>

            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative"
                title="Notifications"
              >
                {unreadNotificationsCount > 0 ? (
                  <>
                    <BellRing size={20} className="text-amber-500" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
                  </>
                ) : (
                  <Bell size={20} />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                    {unreadNotificationsCount > 0 && (
                      <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 px-2 py-1 rounded-full">
                        {unreadNotificationsCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">No notifications yet.</div>
                    ) : (
                      <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                        {notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            className={cn("p-4 text-sm transition-colors", notif.read ? "bg-white dark:bg-gray-800 opacity-70" : "bg-amber-50/30 dark:bg-amber-900/10")}
                            onClick={() => !notif.read && handleMarkNotificationRead(notif.id)}
                          >
                            <p className="text-gray-800 dark:text-gray-200">{notif.message}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{format(new Date(notif.createdAt), 'MMM dd, h:mm a')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <motion.main 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8"
      >
        
        {fetchError && (
          <motion.div variants={itemVariants} className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 shadow-sm">
            <AlertCircle size={20} />
            <p className="font-medium text-sm">{fetchError}</p>
          </motion.div>
        )}

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard 
                title="Total Portfolio Value" 
                value={`₹${currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle={`${investments.length} Assets Tracked`}
                icon={<Briefcase className="text-blue-500" size={24} />}
              />
              <StatCard 
                title="Total Profit / Loss" 
                value={`${totalProfitLoss >= 0 ? '+' : '-'}₹${Math.abs(totalProfitLoss).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                valueColor={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                subtitle={`${totalProfitLoss >= 0 ? '+' : ''}${profitLossPercentage.toFixed(2)}% All Time`}
                icon={totalProfitLoss >= 0 ? <TrendingUp className="text-emerald-500" size={24} /> : <TrendingDown className="text-rose-500" size={24} />}
              />
              <StatCard 
                title="Total Invested" 
                value={`₹${totalInvested.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                subtitle="Principal Amount"
                icon={<IndianRupee className="text-amber-500" size={24} />}
              />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                      <ChartIcon size={20} className="text-gray-400 dark:text-gray-500" />
                      Price Trend (30 Days)
                    </h2>
                    <select 
                      value={selectedChartAsset}
                      onChange={e => setSelectedChartAsset(e.target.value as any)}
                      className="text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-md focus:ring-amber-400 focus:border-amber-400"
                    >
                      <option value="gold">Gold (per g)</option>
                      <option value="silver">Silver (per g)</option>
                      <option value="crypto">Bitcoin</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <div className="text-right mr-4">
                      <div className="text-lg font-bold flex items-center justify-end gap-1">
                        ₹{activeChartData.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <span className={cn(
                          "text-sm font-medium flex items-center",
                          priceChange24h >= 0 ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {priceChange24h >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                          {Math.abs(priceChange24hPercent).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activeChartData.history} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={isDarkMode ? 0.5 : 0.4}/>
                          <stop offset="50%" stopColor="#fbbf24" stopOpacity={isDarkMode ? 0.2 : 0.15}/>
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                        </linearGradient>
                        <filter id="shadow" height="200%">
                          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#fbbf24" floodOpacity={isDarkMode ? "0.4" : "0.2"} />
                        </filter>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#374151" : "#f0f0f0"} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#9ca3af' }} 
                        dy={10}
                      />
                      <YAxis 
                        domain={['dataMin - 200', 'dataMax + 200']} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#9ca3af' }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '12px', 
                          border: isDarkMode ? '1px solid #374151' : 'none', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                          color: isDarkMode ? '#f3f4f6' : '#1f2937'
                        }}
                        itemStyle={{ color: isDarkMode ? '#f3f4f6' : '#1f2937', fontWeight: 600 }}
                        formatter={(value: number) => [`₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#fbbf24" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                        filter="url(#shadow)"
                        activeDot={{ r: 6, fill: '#fbbf24', stroke: isDarkMode ? '#1f2937' : '#ffffff', strokeWidth: 3 }}
                        isAnimationActive={true}
                        animationDuration={1500}
                        animationEasing="ease-in-out"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            {/* Market Insights */}
            <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 p-6">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Sparkles size={20} className="text-amber-500" />
                    AI Smart Insights
                  </h2>
                  <button
                    onClick={generateAIInsight}
                    disabled={isGeneratingInsight || investments.length === 0}
                    className="text-sm bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGeneratingInsight ? (
                      <>
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      'Generate Insight'
                    )}
                  </button>
               </div>
                <div className="space-y-4">
                  {aiInsight ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-xl text-gray-800 dark:text-gray-200 text-sm leading-relaxed border border-amber-100 dark:border-amber-900/20">
                        {aiInsight.insight}
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Recommendation:</span>
                        <span className={cn(
                          "text-sm font-semibold px-2 py-0.5 rounded-md",
                          aiInsight.recommendation.toLowerCase().includes('buy') ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400" :
                          aiInsight.recommendation.toLowerCase().includes('sell') ? "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-400" :
                          "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                        )}>
                          {aiInsight.recommendation}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-gray-500 dark:text-gray-400 text-sm text-center border border-gray-100 dark:border-gray-700 border-dashed">
                      {investments.length === 0 
                        ? "Add investments to your portfolio to get personalized AI insights."
                        : "Click 'Generate Insight' to analyze your portfolio against current market trends."}
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl text-blue-800 dark:text-blue-300 text-sm mt-4 border border-blue-100 dark:border-blue-900/30">
                    <strong>{selectedChartAsset.charAt(0).toUpperCase() + selectedChartAsset.slice(1)} Trend:</strong> Prices have shown a {activeChartData.history.length > 0 && activeChartData.history[0].price < activeChartData.currentPrice ? 'steady increase' : 'slight decline'} over the past 30 days. The current price is ₹{activeChartData.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </div>
                </div>
            </motion.div>

            {/* Price Alerts */}
            <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                <Bell size={20} className="text-amber-500" />
                Price Alerts
              </h2>
              
              <form onSubmit={handleAddAlert} className="flex gap-4 mb-6">
                <select 
                  value={newAlertAssetType}
                  onChange={e => setNewAlertAssetType(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                >
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="crypto">Bitcoin</option>
                </select>
                <select 
                  value={newAlertCondition}
                  onChange={e => setNewAlertCondition(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                >
                  <option value="above">Goes Above</option>
                  <option value="below">Drops Below</option>
                </select>
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee size={14} className="text-gray-400" />
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={newAlertTargetPrice}
                    onChange={e => setNewAlertTargetPrice(e.target.value)}
                    placeholder="Target Price"
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-gray-900 dark:bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                  Set Alert
                </button>
              </form>

              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                {alerts.length === 0 ? (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">No active alerts.</motion.div>
                ) : (
                  alerts.map(alert => (
                    <motion.div 
                      key={alert.id} 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={cn("flex items-center justify-between p-3 border rounded-xl transition-all duration-300", alert.isTriggered ? "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-900/30 opacity-60" : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-amber-200 dark:hover:border-amber-700/50 hover:shadow-sm")}
                    >
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold uppercase rounded-sm">
                          {alert.assetType}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {alert.condition === 'above' ? 'Above' : 'Below'} ₹{alert.targetPrice.toLocaleString('en-IN')}
                        </span>
                        {alert.isTriggered && <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">Triggered</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))
                )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* Sidebar: Portfolio Management */}
          <div className="space-y-6">
            
            {/* Add Investment Form */}
            <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Investment</h2>
              <form onSubmit={handleAddInvestment} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Asset Type</label>
                  <select 
                    value={newAssetType}
                    onChange={e => setNewAssetType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  >
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="crypto">Bitcoin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Asset Name</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. 10g 24K Coin"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Quantity</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Scale size={14} className="text-gray-400" />
                      </div>
                      <input 
                        type="number" 
                        step="0.000001"
                        required
                        value={newQuantity}
                        onChange={e => setNewQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Price/Unit (₹)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <IndianRupee size={14} className="text-gray-400" />
                      </div>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={newPrice}
                        onChange={e => setNewPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Date</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar size={14} className="text-gray-400" />
                      </div>
                    <input 
                      type="date" 
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-gray-900 dark:bg-gray-700 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add to Portfolio
                </button>
              </form>
            </motion.div>

            {/* Holdings List */}
            <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Your Holdings</h2>
              {isLoading ? (
                <HoldingsSkeleton />
              ) : investments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                  No investments added yet.
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  <AnimatePresence mode="popLayout">
                  {investments.map(inv => {
                    const currentAssetPrice = prices[inv.assetType]?.currentPrice || 0;
                    const currentValue = inv.quantity * currentAssetPrice;
                    const investedValue = inv.quantity * inv.purchasePrice;
                    const profit = currentValue - investedValue;
                    const profitPercent = investedValue > 0 ? (profit / investedValue) * 100 : 0;

                    return (
                      <motion.div 
                        key={inv.id} 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-amber-200 dark:hover:border-amber-700/50 transition-colors group relative bg-white dark:bg-gray-800 shadow-sm hover:shadow-md"
                      >
                        <button 
                          onClick={() => handleDeleteInvestment(inv.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove investment"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="flex items-center gap-2 mb-1 pr-6">
                          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase rounded-sm">
                            {inv.assetType}
                          </span>
                          <div className="font-medium text-gray-900 dark:text-white">{inv.name}</div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
                          <span>{inv.quantity} {inv.assetType === 'crypto' ? 'BTC' : 'g'} @ ₹{inv.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span>{format(new Date(inv.purchaseDate), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-end justify-between pt-3 border-t border-gray-200/60 dark:border-gray-700/60">
                          <div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Current Value</div>
                            <div className="font-semibold text-gray-900 dark:text-white">₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">Return</div>
                            <div className={cn(
                              "font-medium flex items-center justify-end gap-1",
                              profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                            )}>
                              {profit >= 0 ? '+' : '-'}₹{Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="text-xs opacity-80">({Math.abs(profitPercent).toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </motion.main>
    </div>
  );
}

// --- Subcomponents ---

function StatCard({ title, value, subtitle, icon, valueColor = "text-gray-900 dark:text-white" }: { title: string, value: string, subtitle: string, icon: React.ReactNode, valueColor?: string }) {
  return (
    <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 border border-white/80 dark:border-gray-700 flex items-start gap-4 group">
      <div className="p-3 bg-gray-50/50 dark:bg-gray-700/50 rounded-xl group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</h3>
        <div className={cn("text-2xl font-bold mb-1 tracking-tight", valueColor)}>{value}</div>
        <p className="text-sm text-gray-400 dark:text-gray-500">{subtitle}</p>
      </div>
    </motion.div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md", className)} />;
}

function StatCardSkeleton() {
  return (
    <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 dark:border-gray-700 flex items-start gap-4">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </motion.div>
  );
}

function ChartSkeleton() {
  return (
    <motion.div variants={itemVariants} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/80 dark:border-gray-700 p-6 h-[400px] flex flex-col">
      <div className="flex justify-between mb-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="flex-1 w-full rounded-xl" />
    </motion.div>
  );
}

function HoldingsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <motion.div variants={itemVariants} key={i} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
          <div className="flex gap-2"><Skeleton className="h-4 w-12" /><Skeleton className="h-4 w-32" /></div>
          <div className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div>
          <div className="flex justify-between pt-3 border-t border-gray-200/60 dark:border-gray-700/60"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-24" /></div>
        </motion.div>
      ))}
    </div>
  );
}

