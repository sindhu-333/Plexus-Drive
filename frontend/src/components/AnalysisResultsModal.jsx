import React, { useState, useEffect } from 'react';
import { FiX, FiCpu, FiTag, FiFileText, FiClock, FiAlertCircle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import api from '../api';

const AnalysisResultsModal = ({ file, isOpen, onClose }) => {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log('AnalysisResultsModal render:', { file: file?.filename, isOpen, analysisData });

  // Fetch analysis data when modal opens
  useEffect(() => {
    if (isOpen && file) {
      fetchAnalysisData();
    }
  }, [isOpen, file]);

  const fetchAnalysisData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get(`/files/analysis/${file.id}`);
      setAnalysisData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analysis data');
      console.error('Analysis fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get category display information
  const getCategoryInfo = (category) => {
    const categoryMap = {
      // Business & Professional
      invoice: { name: 'Invoice', icon: '💰', color: '#10B981' },
      contract: { name: 'Contract', icon: '📋', color: '#6366F1' },
      resume: { name: 'Resume', icon: '👤', color: '#8B5CF6' },
      cover_letter: { name: 'Cover Letter', icon: '✉️', color: '#EC4899' },
      business_plan: { name: 'Business Plan', icon: '📊', color: '#06B6D4' },
      proposal: { name: 'Proposal', icon: '🎯', color: '#F59E0B' },
      report: { name: 'Report', icon: '📈', color: '#EF4444' },
      presentation: { name: 'Presentation', icon: '📽️', color: '#84CC16' },
      spreadsheet: { name: 'Spreadsheet', icon: '📊', color: '#22C55E' },
      
      // Personal Documents
      personal_letter: { name: 'Personal Letter', icon: '💌', color: '#F472B6' },
      diary: { name: 'Diary', icon: '📔', color: '#A78BFA' },
      journal: { name: 'Journal', icon: '📖', color: '#34D399' },
      notes: { name: 'Notes', icon: '📝', color: '#FBBF24' },
      todo_list: { name: 'Todo List', icon: '✅', color: '#60A5FA' },
      recipe: { name: 'Recipe', icon: '👩‍🍳', color: '#F59E0B' },
      
      // Financial & Legal
      bank_statement: { name: 'Bank Statement', icon: '🏦', color: '#059669' },
      receipt: { name: 'Receipt', icon: '🧾', color: '#DC2626' },
      tax_document: { name: 'Tax Document', icon: '📄', color: '#7C2D12' },
      
      // Education
      assignment: { name: 'Assignment', icon: '📚', color: '#7C3AED' },
      research_paper: { name: 'Research Paper', icon: '🔬', color: '#0891B2' },
      
      // Health & Medical
      medical_record: { name: 'Medical Record', icon: '🏥', color: '#DC2626' },
      prescription: { name: 'Prescription', icon: '💊', color: '#16A34A' },
      
      // Travel
      travel_itinerary: { name: 'Travel Itinerary', icon: '✈️', color: '#06B6D4' },
      
      // Technical
      api_documentation: { name: 'API Documentation', icon: '🔗', color: '#1F2937' },
      manual: { name: 'Manual', icon: '📖', color: '#6B7280' },
      
      // Communication
      email: { name: 'Email', icon: '📧', color: '#3B82F6' },
      
      // Creative
      blog_post: { name: 'Blog Post', icon: '📝', color: '#10B981' },
      
      // Default
      other: { name: 'Other Document', icon: '📄', color: '#9CA3AF' }
    };
    
    return categoryMap[category] || categoryMap.other;
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'text-green-600 bg-green-100';
      case 'negative': return 'text-red-600 bg-red-100';
      case 'neutral': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatProcessingTime = (time) => {
    if (!time) return 'N/A';
    if (time < 1000) return `${time}ms`;
    return `${(time / 1000).toFixed(1)}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{zIndex: 999998}}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FiCpu className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Content Analysis</h2>
              <p className="text-sm text-gray-600 truncate max-w-md">{file?.filename}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <FiX size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                <p className="text-gray-600">Loading analysis results...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <FiAlertCircle className="text-red-500" size={20} />
              <div>
                <p className="text-red-700 font-medium">Error loading analysis</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
              <button 
                onClick={fetchAnalysisData}
                className="ml-auto px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {analysisData && !loading && (
            <div className="space-y-6">
              {/* Status Banner */}
              {analysisData.status === 'completed' && analysisData.results && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <FiCheckCircle className="text-green-500" size={20} />
                  <p className="text-green-700 font-medium">Analysis completed successfully</p>
                </div>
              )}

              {analysisData.status === 'processing' && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <FiLoader className="text-blue-500 animate-spin" size={20} />
                  <p className="text-blue-700 font-medium">Analysis in progress...</p>
                </div>
              )}

              {analysisData.status === 'pending' && (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <FiClock className="text-yellow-500" size={20} />
                  <p className="text-yellow-700 font-medium">Analysis queued - will be processed soon</p>
                </div>
              )}

              {analysisData.status === 'failed' && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <FiAlertCircle className="text-red-500" size={20} />
                  <p className="text-red-700 font-medium">Analysis failed - please try again</p>
                </div>
              )}

              {/* Analysis Results */}
              {analysisData.results && (
                <div className="space-y-6">
                  {/* Document Category */}
                  {analysisData.results.document_category && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FiTag className="text-gray-600" />
                        Document Category
                      </h3>
                      {(() => {
                        const categoryInfo = getCategoryInfo(analysisData.results.document_category);
                        return (
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{categoryInfo.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">{categoryInfo.name}</p>
                              <p className="text-sm text-gray-600 capitalize">
                                {analysisData.results.document_category.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Summary */}
                  {analysisData.results.summary && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FiFileText className="text-gray-600" />
                        Summary
                      </h3>
                      <div className="prose prose-sm max-w-none">
                        <div className="whitespace-pre-wrap text-gray-700">
                          {analysisData.results.summary}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {analysisData.results.keywords && analysisData.results.keywords.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FiTag className="text-gray-600" />
                        Keywords
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisData.results.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sentiment (for media files) */}
                  {analysisData.results.sentiment && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FiTag className="text-gray-600" />
                        Sentiment Analysis
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSentimentColor(analysisData.results.sentiment)}`}>
                        {analysisData.results.sentiment}
                      </span>
                    </div>
                  )}

                  {/* Analysis Metadata */}
                  {analysisData.results.analysis_metadata && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <FiClock className="text-gray-600" />
                        Analysis Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {analysisData.results.analysis_metadata.model && (
                          <div>
                            <span className="text-gray-600">AI Model:</span>
                            <p className="font-medium">{analysisData.results.analysis_metadata.model}</p>
                          </div>
                        )}
                        {analysisData.results.analysis_metadata.processing_time && (
                          <div>
                            <span className="text-gray-600">Processing Time:</span>
                            <p className="font-medium">{formatProcessingTime(analysisData.results.analysis_metadata.processing_time)}</p>
                          </div>
                        )}
                        {analysisData.results.analysis_metadata.text_length && (
                          <div>
                            <span className="text-gray-600">Text Length:</span>
                            <p className="font-medium">{analysisData.results.analysis_metadata.text_length} characters</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Analyzed:</span>
                          <p className="font-medium">{new Date(analysisData.results.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
          {analysisData?.status === 'failed' && (
            <button
              onClick={fetchAnalysisData}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Retry Analysis
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResultsModal;