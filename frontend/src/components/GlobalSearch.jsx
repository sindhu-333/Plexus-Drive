import React, { useState, useEffect, useRef } from 'react';
import { FiSearch, FiFilter, FiX, FiCalendar, FiHardDrive, FiTag, FiClock } from 'react-icons/fi';
import api from '../api';

const GlobalSearch = ({ isOpen, onClose, onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  
  // Filters
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    size_min: '',
    size_max: '',
    date_from: '',
    date_to: ''
  });

  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setFilters({
        type: '',
        category: '',
        size_min: '',
        size_max: '',
        date_from: '',
        date_to: ''
      });
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length > 0) {
      debounceRef.current = setTimeout(() => {
        performSearch();
      }, 300);
    } else {
      setResults([]);
      setTotalResults(0);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, filters]);

  // Get suggestions
  useEffect(() => {
    if (query.length >= 2) {
      getSuggestions();
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const performSearch = async (page = 0) => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        q: query.trim(),
        limit: '20',
        offset: (page * 20).toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      });

      const response = await api.get(`/files/search?${params}`);
      
      if (page === 0) {
        setResults(response.data.results);
      } else {
        setResults(prev => [...prev, ...response.data.results]);
      }
      
      setTotalResults(response.data.total);
      setCurrentPage(page);
      
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSuggestions = async () => {
    try {
      const response = await api.get(`/files/search/suggestions?q=${encodeURIComponent(query)}`);
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error('Suggestions error:', error);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      category: '',
      size_min: '',
      size_max: '',
      date_from: '',
      date_to: ''
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getFileIcon = (mimetype) => {
    if (mimetype.startsWith('image/')) return '🖼️';
    if (mimetype.startsWith('video/')) return '📹';
    if (mimetype.startsWith('audio/')) return '🎵';
    if (mimetype.startsWith('text/') || mimetype.includes('document')) return '📄';
    if (mimetype.includes('pdf')) return '📕';
    if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) return '📊';
    return '📁';
  };

  const highlightText = (text, query) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : 
        part
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 pt-20 z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search your files..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              
              {/* Search suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 shadow-lg z-10">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        setQuery(suggestion.text);
                        setShowSuggestions(false);
                      }}
                    >
                      {suggestion.type === 'filename' ? <FiSearch size={16} /> : <FiTag size={16} />}
                      <span className="text-sm">{suggestion.text}</span>
                      <span className="text-xs text-gray-400 ml-auto">{suggestion.type}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-lg border transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <FiFilter size={20} />
            </button>
            
            <button
              onClick={onClose}
              className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FiX size={20} className="text-gray-500" />
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Type</label>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All Types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="audio">Audio</option>
                    <option value="text">Documents</option>
                    <option value="application">Applications</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                  <input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                  <input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Size (KB)</label>
                  <input
                    type="number"
                    value={filters.size_min}
                    onChange={(e) => handleFilterChange('size_min', e.target.value)}
                    placeholder="0"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Size (KB)</label>
                  <input
                    type="number"
                    value={filters.size_max}
                    onChange={(e) => handleFilterChange('size_max', e.target.value)}
                    placeholder="No limit"
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {query && (
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {loading ? 'Searching...' : `${totalResults} results for "${query}"`}
              </p>
              {totalResults > 0 && (
                <p className="text-sm text-gray-500">
                  Showing {results.length} of {totalResults}
                </p>
              )}
            </div>
          )}

          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <div className="text-center py-12">
              <FiSearch className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 text-lg">No files found</p>
              <p className="text-gray-400 text-sm mt-2">Try adjusting your search terms or filters</p>
            </div>
          )}

          <div className="space-y-3">
            {results.map((file, index) => (
              <div
                key={`${file.id}-${index}`}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onResultClick && onResultClick(file)}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{getFileIcon(file.mimetype)}</div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {highlightText(file.filename, query)}
                    </h3>
                    
                    {file.searchSnippet && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {file.searchSnippet.highlight ? 
                          highlightText(file.searchSnippet.text, query) : 
                          file.searchSnippet.text
                        }
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FiHardDrive size={12} />
                        {formatFileSize(file.filesize)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FiCalendar size={12} />
                        {formatDate(file.created_at)}
                      </span>
                      {file.document_category && (
                        <span className="flex items-center gap-1">
                          <FiTag size={12} />
                          {file.document_category.replace(/_/g, ' ')}
                        </span>
                      )}
                      {file.relevance_score > 0 && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Match
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Load More */}
          {results.length < totalResults && (
            <div className="text-center mt-6">
              <button
                onClick={() => performSearch(currentPage + 1)}
                disabled={loading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading...' : 'Load More Results'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;