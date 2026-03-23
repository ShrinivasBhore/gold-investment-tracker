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
  BellRing
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function App() {
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
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

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

  // Fetch real-time price updates and investments from backend
  useEffect(() => {
    const fetchPriceData = async () => {
      try {
        const response = await fetch('/api/prices');
        if (!response.ok) throw new Error('Failed to fetch prices');
        const data = await response.json();
        setPrices(data);
      } catch (error) {
        console.error('Error fetching prices:', error);
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
      } catch (error) {
        console.error('Error fetching user data:', error);
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

  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  if (!token) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center text-amber-900">
              <Activity size={24} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Aura Gold</h1>
          </div>
          
          <h2 className="text-xl font-medium text-center mb-6">
            {authMode === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>

          {authError && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} />
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={16} className="text-gray-400" />
                </div>
                <input 
                  type="password" 
                  required
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button 
              type="submit"
              className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
                setAuthError('');
              }}
              className="text-amber-600 font-medium hover:underline"
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans text-gray-900 pb-12">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-amber-900">
              <Activity size={20} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Aura Gold Tracker</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Total Value</div>
              <div className="text-lg font-bold flex items-center justify-end gap-1">
                ₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors relative"
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
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                    {unreadNotificationsCount > 0 && (
                      <span className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                        {unreadNotificationsCount} new
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">No notifications yet.</div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map(notif => (
                          <div 
                            key={notif.id} 
                            className={cn("p-4 text-sm transition-colors", notif.read ? "bg-white opacity-70" : "bg-amber-50/30")}
                            onClick={() => !notif.read && handleMarkNotificationRead(notif.id)}
                          >
                            <p className="text-gray-800">{notif.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{format(new Date(notif.createdAt), 'MMM dd, h:mm a')}</p>
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
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <ChartIcon size={20} className="text-gray-400" />
                    Price Trend (30 Days)
                  </h2>
                  <select 
                    value={selectedChartAsset}
                    onChange={e => setSelectedChartAsset(e.target.value as any)}
                    className="text-sm border-gray-200 rounded-md focus:ring-amber-400 focus:border-amber-400"
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
                        <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
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
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                      formatter={(value: number) => [`₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Price']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#fbbf24" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Market Insights */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
               <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <AlertCircle size={20} className="text-blue-500" />
                  Market Insights
                </h2>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-xl text-blue-800 text-sm">
                    <strong>{selectedChartAsset.charAt(0).toUpperCase() + selectedChartAsset.slice(1)} Trend:</strong> Prices have shown a {activeChartData.history.length > 0 && activeChartData.history[0].price < activeChartData.currentPrice ? 'steady increase' : 'slight decline'} over the past 30 days. The current price is ₹{activeChartData.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </div>
                </div>
            </div>

            {/* Price Alerts */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bell size={20} className="text-amber-500" />
                Price Alerts
              </h2>
              
              <form onSubmit={handleAddAlert} className="flex gap-4 mb-6">
                <select 
                  value={newAlertAssetType}
                  onChange={e => setNewAlertAssetType(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                >
                  <option value="gold">Gold</option>
                  <option value="silver">Silver</option>
                  <option value="crypto">Bitcoin</option>
                </select>
                <select 
                  value={newAlertCondition}
                  onChange={e => setNewAlertCondition(e.target.value as any)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
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
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                  Set Alert
                </button>
              </form>

              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">No active alerts.</div>
                ) : (
                  alerts.map(alert => (
                    <div key={alert.id} className={cn("flex items-center justify-between p-3 border rounded-xl", alert.isTriggered ? "bg-gray-50 border-gray-200 opacity-60" : "border-gray-100")}>
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-sm">
                          {alert.assetType}
                        </span>
                        <span className="text-sm font-medium text-gray-700">
                          {alert.condition === 'above' ? 'Above' : 'Below'} ₹{alert.targetPrice.toLocaleString('en-IN')}
                        </span>
                        {alert.isTriggered && <span className="text-xs text-rose-500 font-medium">Triggered</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="text-gray-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Portfolio Management */}
          <div className="space-y-6">
            
            {/* Add Investment Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Add Investment</h2>
              <form onSubmit={handleAddInvestment} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Asset Type</label>
                  <select 
                    value={newAssetType}
                    onChange={e => setNewAssetType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  >
                    <option value="gold">Gold</option>
                    <option value="silver">Silver</option>
                    <option value="crypto">Bitcoin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Asset Name</label>
                  <input 
                    type="text" 
                    required
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. 10g 24K Coin"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Quantity</label>
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
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Price/Unit (₹)</label>
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
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar size={14} className="text-gray-400" />
                      </div>
                    <input 
                      type="date" 
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add to Portfolio
                </button>
              </form>
            </div>

            {/* Holdings List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4">Your Holdings</h2>
              {investments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No investments added yet.
                </div>
              ) : (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {investments.map(inv => {
                    const currentAssetPrice = prices[inv.assetType]?.currentPrice || 0;
                    const currentValue = inv.quantity * currentAssetPrice;
                    const investedValue = inv.quantity * inv.purchasePrice;
                    const profit = currentValue - investedValue;
                    const profitPercent = investedValue > 0 ? (profit / investedValue) * 100 : 0;

                    return (
                      <div key={inv.id} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group relative bg-gray-50/50">
                        <button 
                          onClick={() => handleDeleteInvestment(inv.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove investment"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="flex items-center gap-2 mb-1 pr-6">
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-sm">
                            {inv.assetType}
                          </span>
                          <div className="font-medium text-gray-900">{inv.name}</div>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500 mb-3">
                          <span>{inv.quantity} {inv.assetType === 'crypto' ? 'BTC' : 'g'} @ ₹{inv.purchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span>{format(new Date(inv.purchaseDate), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-end justify-between pt-3 border-t border-gray-200/60">
                          <div>
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Current Value</div>
                            <div className="font-semibold text-gray-900">₹{currentValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Return</div>
                            <div className={cn(
                              "font-medium flex items-center justify-end gap-1",
                              profit >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {profit >= 0 ? '+' : '-'}₹{Math.abs(profit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="text-xs opacity-80">({Math.abs(profitPercent).toFixed(1)}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

// --- Subcomponents ---

function StatCard({ title, value, subtitle, icon, valueColor = "text-gray-900" }: { title: string, value: string, subtitle: string, icon: React.ReactNode, valueColor?: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className="p-3 bg-gray-50 rounded-xl">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-500 mb-1">{title}</h3>
        <div className={cn("text-2xl font-bold mb-1", valueColor)}>{value}</div>
        <p className="text-sm text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}

