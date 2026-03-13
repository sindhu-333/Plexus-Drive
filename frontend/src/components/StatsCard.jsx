import React from 'react';

const StatsCard = ({ 
  icon: Icon, 
  title, 
  value, 
  subtitle, 
  change, 
  changeType = 'positive',
  gradient = 'from-blue-500 to-blue-600',
  onClick 
}) => {
  const changeColor = changeType === 'positive' ? 'text-green-600' : 'text-red-600';
  const changeBg = changeType === 'positive' ? 'bg-green-50' : 'bg-red-50';

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-5">
        <div className={`w-full h-full bg-gradient-to-br ${gradient} rounded-full transform translate-x-8 -translate-y-8`}></div>
      </div>
      
      <div className="relative p-6">
        {/* Icon and Title */}
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon size={24} className="text-white" />
          </div>
          
          {change && (
            <div className={`px-2 py-1 rounded-full ${changeBg} flex items-center gap-1`}>
              <span className={`text-xs font-medium ${changeColor}`}>
                {change > 0 ? '+' : ''}{change}%
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
            {title}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">
              {value}
            </span>
            {subtitle && (
              <span className="text-sm text-gray-500">
                {subtitle}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 hover:opacity-5 transition-opacity duration-300`}></div>
    </div>
  );
};

export default StatsCard;