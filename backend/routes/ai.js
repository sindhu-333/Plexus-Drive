const express = require('express');
const router = express.Router();
const { analyzeWithOllama } = require('../utils/ai');
const authMiddleware = require('../middleware/authMiddleware');

// AI availability tracking
let aiFailureCount = 0;
let lastAICheck = Date.now();
const AI_FAILURE_THRESHOLD = 3;
const AI_RETRY_INTERVAL = 60000; // 1 minute

function shouldUseAI() {
  // If AI has failed too many times recently, skip it for a while
  if (aiFailureCount >= AI_FAILURE_THRESHOLD) {
    if (Date.now() - lastAICheck > AI_RETRY_INTERVAL) {
      // Reset after retry interval
      aiFailureCount = 0;
      return true;
    }
    return false;
  }
  return true;
}

function markAISuccess() {
  aiFailureCount = 0;
  lastAICheck = Date.now();
}

function markAIFailure() {
  aiFailureCount++;
  lastAICheck = Date.now();
}

// AI Assistant endpoint
router.post('/assistant', authMiddleware, async (req, res) => {
  const { message, context } = req.body;
  const userId = req.user.id;
  
  try {

    console.log('🤖 AI Assistant request:', { message, userId, context });

    // Create a simple, focused prompt for the AI assistant
    const assistantPrompt = `You are a helpful AI assistant for Plexus Drive file storage. 

User has ${context.filesCount || 0} files using ${formatBytes(context.totalSize || 0)} storage.
File types: ${context.fileTypes?.join(', ') || 'none'}

Question: "${message}"

Give a helpful, concise answer about their files or storage. Keep it brief and friendly.`;

    // Try to get AI response with quick timeout, fallback immediately if slow
    let response;
    let actions = [];
    
    // Check if we should skip AI (if it's been failing recently)
    if (shouldUseAI()) {
      try {
        response = await Promise.race([
          analyzeWithOllama(assistantPrompt, 'assistant'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Quick timeout')), 8000))
        ]);
        actions = extractActions(response, message, context);
        markAISuccess();
      } catch (aiError) {
        markAIFailure();
        console.log('🤖 Using fallback response');
        response = generateFallbackResponse(message, context);
        actions = extractActions('', message, context);
      }
    } else {
      // Skip AI entirely if it's been failing
      response = generateFallbackResponse(message, context);
      actions = extractActions('', message, context);
    }

    res.json({
      success: true,
      response: response || "I'm here to help! What would you like to know about your files?",
      actions: actions
    });

  } catch (error) {
    console.error('AI Assistant error:', error);
    
    // Final fallback if everything fails
    res.json({
      success: true,
      response: generateFallbackResponse(message, context),
      actions: []
    });
  }
});

// Execute AI suggested actions
router.post('/assistant/action', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    const userId = req.user.id;

    console.log('🎯 Executing AI action:', action);

    let result = { success: false, message: 'Action not recognized' };

    switch (action.type) {
      case 'search':
        result = {
          success: true,
          message: `Searching for "${action.query}"...`,
          redirect: `/dashboard?search=${encodeURIComponent(action.query)}`
        };
        break;

      case 'organize':
        result = {
          success: true,
          message: 'File organization suggestions prepared!',
          redirect: '/dashboard?tab=organize'
        };
        break;

      case 'cleanup':
        result = {
          success: true,
          message: 'Opening duplicate file manager...',
          redirect: '/dashboard?tab=duplicates'
        };
        break;

      case 'storage_info':
        result = {
          success: true,
          message: 'Displaying storage analytics...',
          redirect: '/dashboard?tab=storage'
        };
        break;

      default:
        result = {
          success: true,
          message: 'I can help you with that! Please use the main interface for file operations.'
        };
    }

    res.json(result);

  } catch (error) {
    console.error('Action execution error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute action'
    });
  }
});

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to extract actionable items from AI response
function extractActions(response, userMessage, context) {
  const actions = [];
  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = response.toLowerCase();

  // Search-related actions
  if (lowerMessage.includes('find') || lowerMessage.includes('search') || lowerMessage.includes('look for')) {
    actions.push({
      type: 'search',
      label: '🔍 Search files',
      query: extractSearchQuery(userMessage)
    });
  }

  // Organization actions
  if (lowerMessage.includes('organize') || lowerMessage.includes('sort') || lowerMessage.includes('arrange')) {
    actions.push({
      type: 'organize',
      label: '📁 Organize files',
    });
  }

  // Storage cleanup
  if (lowerMessage.includes('clean') || lowerMessage.includes('duplicate') || lowerMessage.includes('space')) {
    actions.push({
      type: 'cleanup',
      label: '🧹 Find duplicates',
    });
  }

  // Storage info
  if (lowerMessage.includes('storage') || lowerMessage.includes('space') || lowerMessage.includes('size')) {
    actions.push({
      type: 'storage_info',
      label: '📊 View storage details',
    });
  }

  return actions.slice(0, 3); // Limit to 3 actions
}

// Helper function to generate fallback responses when AI is unavailable
function generateFallbackResponse(message, context) {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('storage') || lowerMessage.includes('space')) {
    return `You're using ${formatBytes(context.totalSize || 0)} of storage with ${context.filesCount || 0} files. You have plenty of space left in your 2GB limit! 📊`;
  } 
  
  if (lowerMessage.includes('files') && lowerMessage.includes('today')) {
    return `I can help you find today's files! Try using the search feature or check your Recent Files section. 📁`;
  }
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    return `Hello! 👋 I'm here to help with your Plexus Drive files. You currently have ${context.filesCount || 0} files using ${formatBytes(context.totalSize || 0)} storage. What would you like to know?`;
  }
  
  if (lowerMessage.includes('find') || lowerMessage.includes('search')) {
    return `I can help you find files! You have ${context.filesCount || 0} files with types: ${context.fileTypes?.join(', ') || 'none'}. Try using the search bar or browse by file type. 🔍`;
  }
  
  if (lowerMessage.includes('organize') || lowerMessage.includes('sort')) {
    return `Great idea! You can organize your ${context.filesCount || 0} files by using folders or the duplicate file manager. Check the dashboard for organization tools! 📂`;
  }
  
  if (lowerMessage.includes('duplicate')) {
    return `Use the duplicate file manager to find and clean up duplicate files. This can help free up storage space! 🧹`;
  }
  
  // Default response
  return `I'm here to help with your Plexus Drive files! You have ${context.filesCount || 0} files using ${formatBytes(context.totalSize || 0)} storage. Ask me about finding files, storage usage, or organizing your data! 😊`;
}

// Helper function to extract search query from user message
function extractSearchQuery(message) {
  const findPatterns = [
    /find (.*?)(?:\s|$)/i,
    /search for (.*?)(?:\s|$)/i,
    /look for (.*?)(?:\s|$)/i,
    /where (?:is|are) (.*?)(?:\s|$)/i
  ];

  for (const pattern of findPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return message.replace(/find|search|look for|where is|where are/gi, '').trim();
}

module.exports = router;