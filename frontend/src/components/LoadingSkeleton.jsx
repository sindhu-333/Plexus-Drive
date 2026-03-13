import React from 'react';

const LoadingSkeleton = ({ type = 'card', count = 6 }) => {
  const CardSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
        <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
      </div>
      <div className="space-y-3">
        <div className="w-24 h-4 bg-gray-200 rounded"></div>
        <div className="w-32 h-8 bg-gray-200 rounded"></div>
        <div className="w-20 h-3 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  const FileGridSkeleton = () => (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-4 animate-pulse">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl"></div>
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-gray-200 rounded"></div>
        <div className="flex justify-between">
          <div className="w-12 h-3 bg-gray-200 rounded"></div>
          <div className="w-16 h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );

  const ListSkeleton = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-1 w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="col-span-5 w-24 h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="col-span-2 w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="col-span-2 w-20 h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="col-span-2 w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="grid grid-cols-12 gap-4 px-6 py-4 animate-pulse">
            <div className="col-span-1 w-4 h-4 bg-gray-200 rounded"></div>
            <div className="col-span-5 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
              <div className="space-y-2">
                <div className="w-32 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
            <div className="col-span-2 w-16 h-4 bg-gray-200 rounded"></div>
            <div className="col-span-2 w-20 h-4 bg-gray-200 rounded"></div>
            <div className="col-span-2 flex gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
              <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const DashboardSkeleton = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      
      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-32 h-6 bg-gray-200 rounded"></div>
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
          </div>
          <div className="space-y-4">
            <div className="w-full h-4 bg-gray-200 rounded"></div>
            <div className="w-full h-32 bg-gray-200 rounded-xl"></div>
            <div className="flex justify-between">
              <div className="w-8 h-4 bg-gray-200 rounded"></div>
              <div className="w-16 h-4 bg-gray-200 rounded"></div>
              <div className="w-8 h-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
          <div className="flex items-center justify-between mb-4">
            <div className="w-24 h-6 bg-gray-200 rounded"></div>
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
          </div>
          <div className="w-full h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
      
      {/* Recent Activities */}
      <div className="bg-white p-6 rounded-xl shadow-lg animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-40 h-6 bg-gray-200 rounded"></div>
          <div className="w-20 h-4 bg-gray-200 rounded"></div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 p-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="w-48 h-4 bg-gray-200 rounded"></div>
                <div className="w-32 h-3 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (type === 'dashboard') return <DashboardSkeleton />;
  if (type === 'list') return <ListSkeleton />;
  if (type === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <FileGridSkeleton key={index} />
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;