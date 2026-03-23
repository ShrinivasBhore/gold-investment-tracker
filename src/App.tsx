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
  DollarSign,
  Plus,
  Trash2,
  AlertCircle,
  Briefcase,
  LineChart as ChartIcon,
  Activity,
  Calendar,
  Scale
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface GoldPriceData {
  date: string;
  price: number;
}

interface Investment {
  id: string;
  name: string;
  weightGrams: number;
  purchasePricePerGram: number;
  purchaseDate: string;
}

// --- Mock Data Generator ---
const generateHistoricalData = (days: number, basePrice: number): GoldPriceData[] => {
  const data: GoldPriceData[] = [];
  let currentPrice = basePrice;
  for (let i = days; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'MMM dd');
    // Random walk with slight upward bias
    const change = (Math.random() - 0.45) * 1.5;
    currentPrice = currentPrice + change;
    data.push({ date, price: Number(currentPrice.toFixed(2)) });
  }
  return data;
};

const INITIAL_PRICE_PER_GRAM = 76.50; // USD
const HISTORICAL_DATA = generateHistoricalData(30, 74.00);

// --- Components ---

export default function App() {
  const [currentPrice, setCurrentPrice] = useState(HISTORICAL_DATA[HISTORICAL_DATA.length - 1].price);
  const [priceHistory, setPriceHistory] = useState<GoldPriceData[]>(HISTORICAL_DATA);
  const [investments, setInvestments] = useState<Investment[]>(() => {
    const saved = localStorage.getItem('gold_investments');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      { id: '1', name: '10g Gold Coin (24K)', weightGrams: 10, purchasePricePerGram: 72.50, purchaseDate: '2025-11-15' },
      { id: '2', name: 'Gold Bar (1oz)', weightGrams: 31.1, purchasePricePerGram: 70.00, purchaseDate: '2025-08-01' },
    ];
  });

  // New Investment Form State
  const [newName, setNewName] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Simulate real-time price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrice((prev) => {
        const change = (Math.random() - 0.5) * 0.1; // Small fluctuations
        const newPrice = Number((prev + change).toFixed(2));
        
        // Update history if it's a new day (simplified: just update the last point for real-time feel)
        setPriceHistory(history => {
          const newHistory = [...history];
          newHistory[newHistory.length - 1] = {
            ...newHistory[newHistory.length - 1],
            price: newPrice
          };
          return newHistory;
        });

        return newPrice;
      });
    }, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Save investments to local storage
  useEffect(() => {
    localStorage.setItem('gold_investments', JSON.stringify(investments));
  }, [investments]);

  // Derived State
  const totalWeight = useMemo(() => investments.reduce((sum, inv) => sum + inv.weightGrams, 0), [investments]);
  const totalInvested = useMemo(() => investments.reduce((sum, inv) => sum + (inv.weightGrams * inv.purchasePricePerGram), 0), [investments]);
  const currentValue = useMemo(() => totalWeight * currentPrice, [totalWeight, currentPrice]);
  const totalProfitLoss = currentValue - totalInvested;
  const profitLossPercentage = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

  const priceChange24h = currentPrice - priceHistory[priceHistory.length - 2].price;
  const priceChange24hPercent = (priceChange24h / priceHistory[priceHistory.length - 2].price) * 100;

  const handleAddInvestment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newWeight || !newPrice || !newDate) return;

    const newInv: Investment = {
      id: Date.now().toString(),
      name: newName,
      weightGrams: parseFloat(newWeight),
      purchasePricePerGram: parseFloat(newPrice),
      purchaseDate: newDate,
    };

    setInvestments([...investments, newInv]);
    setNewName('');
    setNewWeight('');
    setNewPrice('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleDeleteInvestment = (id: string) => {
    setInvestments(investments.filter(inv => inv.id !== id));
  };

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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500 font-medium uppercase tracking-wider">Live Price (1g)</div>
              <div className="text-lg font-bold flex items-center justify-end gap-1">
                ${currentPrice.toFixed(2)}
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
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard 
            title="Total Portfolio Value" 
            value={`$${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`${totalWeight.toFixed(2)}g Total Holdings`}
            icon={<Briefcase className="text-blue-500" size={24} />}
          />
          <StatCard 
            title="Total Profit / Loss" 
            value={`${totalProfitLoss >= 0 ? '+' : '-'}$${Math.abs(totalProfitLoss).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            valueColor={totalProfitLoss >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            subtitle={`${totalProfitLoss >= 0 ? '+' : ''}${profitLossPercentage.toFixed(2)}% All Time`}
            icon={totalProfitLoss >= 0 ? <TrendingUp className="text-emerald-500" size={24} /> : <TrendingDown className="text-rose-500" size={24} />}
          />
          <StatCard 
            title="Average Buy Price" 
            value={`$${totalWeight > 0 ? (totalInvested / totalWeight).toFixed(2) : '0.00'}`}
            subtitle="Per Gram"
            icon={<DollarSign className="text-amber-500" size={24} />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Chart Area */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ChartIcon size={20} className="text-gray-400" />
                  Price Trend (30 Days)
                </h2>
                <div className="flex gap-2">
                  <span className="px-3 py-1 bg-gray-100 text-xs font-medium rounded-full text-gray-600">1M</span>
                  <span className="px-3 py-1 text-xs font-medium rounded-full text-gray-400 cursor-not-allowed">3M</span>
                  <span className="px-3 py-1 text-xs font-medium rounded-full text-gray-400 cursor-not-allowed">1Y</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceHistory} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
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
                      domain={['dataMin - 2', 'dataMax + 2']} 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickFormatter={(val) => `$${val}`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#1f2937', fontWeight: 600 }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
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
                    <strong>Trend Analysis:</strong> Gold prices have shown a {priceHistory[0].price < currentPrice ? 'steady increase' : 'slight decline'} over the past 30 days. The current price of ${currentPrice.toFixed(2)} is {currentPrice > (totalInvested/totalWeight) ? 'above' : 'below'} your average purchase price.
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl text-amber-800 text-sm">
                    <strong>Recommendation:</strong> {currentPrice > (totalInvested/totalWeight) * 1.05 ? 'Your portfolio is up significantly. Consider taking partial profits if you need liquidity.' : 'Prices are relatively stable. Good time to hold or accumulate if you are investing long-term.'}
                  </div>
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
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Weight (g)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Scale size={14} className="text-gray-400" />
                      </div>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={newWeight}
                        onChange={e => setNewWeight(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Price/g ($)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign size={14} className="text-gray-400" />
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
                    const currentValue = inv.weightGrams * currentPrice;
                    const investedValue = inv.weightGrams * inv.purchasePricePerGram;
                    const profit = currentValue - investedValue;
                    const profitPercent = (profit / investedValue) * 100;

                    return (
                      <div key={inv.id} className="p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors group relative bg-gray-50/50">
                        <button 
                          onClick={() => handleDeleteInvestment(inv.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove investment"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="font-medium text-gray-900 mb-1 pr-6">{inv.name}</div>
                        <div className="flex justify-between text-sm text-gray-500 mb-3">
                          <span>{inv.weightGrams}g @ ${inv.purchasePricePerGram.toFixed(2)}</span>
                          <span>{format(new Date(inv.purchaseDate), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-end justify-between pt-3 border-t border-gray-200/60">
                          <div>
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Current Value</div>
                            <div className="font-semibold text-gray-900">${currentValue.toFixed(2)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Return</div>
                            <div className={cn(
                              "font-medium flex items-center justify-end gap-1",
                              profit >= 0 ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
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

