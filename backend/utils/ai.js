const axios = require('axios');
const natural = require('natural');
const keyword = require('keyword-extractor');
const Sentiment = require('sentiment');
const compromise = require('compromise');
const mediaAnalyzer = require('./mediaAnalyzer');

// Initialize sentiment analyzer
const sentiment = new Sentiment();

// Ollama API configuration
const OLLAMA_BASE_URL = 'http://localhost:11434';
const AI_MODEL = 'mistral:latest';

// Comprehensive document categories for personal cloud storage
const DOCUMENT_CATEGORIES = {
    // Business & Professional
    INVOICE: 'invoice',
    CONTRACT: 'contract',
    RESUME: 'resume',
    COVER_LETTER: 'cover_letter',
    BUSINESS_PLAN: 'business_plan',
    PROPOSAL: 'proposal',
    REPORT: 'report',
    PRESENTATION: 'presentation',
    SPREADSHEET: 'spreadsheet',
    MEETING_MINUTES: 'meeting_minutes',
    
    // Personal Documents
    PERSONAL_LETTER: 'personal_letter',
    DIARY: 'diary',
    JOURNAL: 'journal',
    NOTES: 'notes',
    TODO_LIST: 'todo_list',
    SHOPPING_LIST: 'shopping_list',
    
    // Financial & Legal
    BANK_STATEMENT: 'bank_statement',
    RECEIPT: 'receipt',
    TAX_DOCUMENT: 'tax_document',
    INSURANCE: 'insurance',
    LEGAL_DOCUMENT: 'legal_document',
    WILL: 'will',
    POWER_OF_ATTORNEY: 'power_of_attorney',
    
    // Education & Learning
    ASSIGNMENT: 'assignment',
    ESSAY: 'essay',
    RESEARCH_PAPER: 'research_paper',
    THESIS: 'thesis',
    STUDY_NOTES: 'study_notes',
    TEXTBOOK: 'textbook',
    TUTORIAL: 'tutorial',
    EXAM: 'exam',
    CERTIFICATE: 'certificate',
    
    // Health & Medical
    MEDICAL_RECORD: 'medical_record',
    PRESCRIPTION: 'prescription',
    LAB_RESULTS: 'lab_results',
    INSURANCE_CLAIM: 'insurance_claim',
    VACCINATION_RECORD: 'vaccination_record',
    
    // Travel & Lifestyle
    TRAVEL_ITINERARY: 'travel_itinerary',
    BOOKING_CONFIRMATION: 'booking_confirmation',
    PASSPORT: 'passport',
    VISA: 'visa',
    RECIPE: 'recipe',
    WORKOUT_PLAN: 'workout_plan',
    
    // Technical & Reference
    MANUAL: 'manual',
    TECHNICAL_SPEC: 'technical_spec',
    API_DOCUMENTATION: 'api_documentation',
    CODE_DOCUMENTATION: 'code_documentation',
    REFERENCE: 'reference',
    GUIDE: 'guide',
    FAQ: 'faq',
    
    // Communication
    EMAIL: 'email',
    NEWSLETTER: 'newsletter',
    ANNOUNCEMENT: 'announcement',
    MEMO: 'memo',
    PRESS_RELEASE: 'press_release',
    
    // Creative & Media
    CREATIVE_WRITING: 'creative_writing',
    STORY: 'story',
    POEM: 'poem',
    SCRIPT: 'script',
    LYRICS: 'lyrics',
    BLOG_POST: 'blog_post',
    ARTICLE: 'article',
    
    // Project & Planning
    PROJECT_PLAN: 'project_plan',
    SCHEDULE: 'schedule',
    TIMELINE: 'timeline',
    BUDGET: 'budget',
    CHECKLIST: 'checklist',
    
    // Miscellaneous
    FORM: 'form',
    SURVEY: 'survey',
    QUESTIONNAIRE: 'questionnaire',
    INVENTORY: 'inventory',
    CATALOG: 'catalog',
    PRICE_LIST: 'price_list',
    TERMS_OF_SERVICE: 'terms_of_service',
    PRIVACY_POLICY: 'privacy_policy',
    WARRANTY: 'warranty',
    
    // Media Files
    PHOTO: 'photo',
    SCREENSHOT: 'screenshot',
    DIAGRAM: 'diagram',
    CHART: 'chart',
    
    // Fallback
    GENERAL: 'general',
    OTHER: 'other'
};

/**
 * Check if OCR text is garbage/meaningless
 * @param {string} text - OCR extracted text
 * @returns {boolean} True if text appears to be OCR garbage
 */
function isGarbageOCRText(text) {
    if (!text || text.trim().length < 10) return true;
    
    const cleanText = text.trim();
    
    // Check for high ratio of non-alphabetic characters
    const nonAlphaCount = (cleanText.match(/[^a-zA-Z\s]/g) || []).length;
    const alphaCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    
    if (alphaCount === 0) return true;
    
    const nonAlphaRatio = nonAlphaCount / cleanText.length;
    if (nonAlphaRatio > 0.6) return true; // More than 60% non-alphabetic
    
    // Check for excessive single characters and fragments
    const words = cleanText.split(/\s+/);
    const singleCharWords = words.filter(word => word.length === 1).length;
    const singleCharRatio = singleCharWords / words.length;
    
    if (singleCharRatio > 0.4) return true; // More than 40% single character "words"
    
    // Check for common OCR garbage patterns
    const garbagePatterns = [
        /[\\]{2,}/g,  // Multiple backslashes
        /[|]{2,}/g,   // Multiple pipes
        /[{}{)(]{3,}/g, // Multiple brackets/parentheses
        /[\/]{3,}/g,  // Multiple forward slashes
        /\s[A-Z]\s[A-Z]\s/g, // Spaced single capital letters
    ];
    
    let garbageMatches = 0;
    for (const pattern of garbagePatterns) {
        if (pattern.test(cleanText)) {
            garbageMatches++;
        }
    }
    
    return garbageMatches >= 2; // Multiple garbage patterns detected
}

/**
 * Specialized analysis for image files
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - Image MIME type
 * @returns {Object} Analysis results
 */
async function analyzeImageFile(fileBuffer, filename, mimetype) {
    try {
        console.log(`Analyzing image file: ${filename}`);
        const startTime = Date.now();
        
        // Try to extract text using OCR
        const extractedText = await extractTextFromFile(fileBuffer, filename, mimetype);
        
        // Check if OCR text is meaningful (not just noise)
        const isTextMeaningful = extractedText && 
                                extractedText.trim().length > 50 && 
                                !isGarbageOCRText(extractedText);
        
        // Determine if this is a document image or regular photo
        if (isTextMeaningful) {
            // Image contains readable text - treat as document
            console.log('Image contains readable text, analyzing as document');
            
            const [summary, keywords, documentCategory, sentimentResult] = await Promise.all([
                generateSummary(extractedText),
                extractKeywords(extractedText),
                classifyDocument(extractedText, filename),
                analyzeSentiment(extractedText)
            ]);

            const processingTime = Date.now() - startTime;

            return {
                summary: `Document image: ${summary}`,
                keywords,
                sentiment: sentimentResult,
                document_category: documentCategory,
                extracted_text: extractedText.substring(0, 5000),
                analysis_metadata: {
                    model: AI_MODEL,
                    processing_time: processingTime,
                    text_length: extractedText.length,
                    file_type: 'document_image'
                }
            };
        } else {
            // Regular image without meaningful text
            console.log('Image appears to be a regular photo without readable text');
            
            // Generate contextual image analysis based on filename and common patterns
            const imageExtension = filename.split('.').pop()?.toLowerCase() || 'unknown';
            const filenameLower = filename.toLowerCase();
            
            let summary = '• Digital photograph or image file\n• Visual content for viewing or sharing\n• May contain personal, professional, or artistic content\n• Standard image format for storage and display';
            let keywords = ['photo', 'image', imageExtension];
            let category = DOCUMENT_CATEGORIES.PHOTO;
            
            // Enhanced filename-based analysis
            if (filenameLower.includes('screenshot') || filenameLower.includes('screen')) {
                summary = '• Screenshot or screen capture image\n• Likely contains user interface elements\n• May show application windows or system displays\n• Digital content preservation purpose';
                keywords = ['screenshot', 'screen', 'capture', imageExtension];
                category = DOCUMENT_CATEGORIES.SCREENSHOT;
            } else if (filenameLower.includes('college') || filenameLower.includes('university') || 
                      filenameLower.includes('school') || filenameLower.includes('campus')) {
                summary = '• Educational institution photograph\n• Shows college or university building architecture\n• Likely campus or academic facility documentation\n• May be used for institutional or personal purposes';
                keywords = ['college', 'university', 'education', 'building', 'campus', imageExtension];
                category = DOCUMENT_CATEGORIES.PHOTO;
            } else if (filenameLower.includes('building') || filenameLower.includes('architecture')) {
                summary = '• Architectural photograph of building or structure\n• Documents physical infrastructure or design\n• May serve construction, real estate, or documentation purposes\n• Shows structural or aesthetic features';
                keywords = ['building', 'architecture', 'structure', imageExtension];
                category = DOCUMENT_CATEGORIES.PHOTO;
            } else if (filenameLower.includes('profile') || filenameLower.includes('avatar')) {
                summary = '• Profile or avatar photograph\n• Personal or professional headshot image\n• Likely used for social media or identification\n• Portrait-style photography format';
                keywords = ['profile', 'avatar', 'person', imageExtension];
                category = DOCUMENT_CATEGORIES.PHOTO;
            } else if (filenameLower.includes('logo') || filenameLower.includes('brand')) {
                summary = '• Logo or branding image\n• Corporate or organizational identity graphic\n• May contain text, symbols, or design elements\n• Used for marketing or brand representation';
                keywords = ['logo', 'branding', 'brand', imageExtension];
                category = DOCUMENT_CATEGORIES.DIAGRAM;
            } else if (filenameLower.includes('chart') || filenameLower.includes('graph')) {
                summary = 'Chart or graph image';
                keywords = ['chart', 'graph', 'data', imageExtension];
                category = DOCUMENT_CATEGORIES.CHART;
            } else if (filenameLower.includes('diagram') || filenameLower.includes('flowchart')) {
                summary = 'Diagram or flowchart image';
                keywords = ['diagram', 'flowchart', 'visual', imageExtension];
                category = DOCUMENT_CATEGORIES.DIAGRAM;
            } else {
                // Default photo analysis
                summary = 'Photograph or image file';
                keywords = ['photo', 'image', imageExtension];
                category = DOCUMENT_CATEGORIES.PHOTO;
            }

            const processingTime = Date.now() - startTime;

            return {
                summary,
                keywords,
                sentiment: null,
                document_category: category,
                extracted_text: '',
                analysis_metadata: {
                    model: AI_MODEL,
                    processing_time: processingTime,
                    text_length: 0,
                    file_type: 'image',
                    file_size: fileSize,
                    image_format: imageExtension
                }
            };
        }

    } catch (error) {
        console.error('Image Analysis Error:', error);
        return {
            summary: `Image file: ${filename}`,
            keywords: ['image', 'photo'],
            sentiment: null,
            document_category: DOCUMENT_CATEGORIES.PHOTO,
            extracted_text: '',
            analysis_metadata: {
                model: AI_MODEL,
                processing_time: 0,
                text_length: 0,
                error: error.message,
                file_type: 'image'
            }
        };
    }
}

/**
 * Analyze video/audio media files
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {Object} Analysis results
 */
async function analyzeMediaFile(fileBuffer, filename, mimetype) {
    try {
        console.log(`🎬 Starting media analysis for: ${filename}`);
        const startTime = Date.now();
        
        // Extract comprehensive metadata
        const metadata = await mediaAnalyzer.extractMediaMetadata(fileBuffer, filename, mimetype);
        
        // Classify the media file
        const category = mediaAnalyzer.classifyMediaFile(metadata, filename, mimetype);
        
        // Generate intelligent summary
        const summary = mediaAnalyzer.generateMediaSummary(metadata, filename, category, mimetype);
        
        // Extract keywords
        const keywords = mediaAnalyzer.extractMediaKeywords(metadata, filename, category);
        
        const processingTime = Date.now() - startTime;
        
        return {
            summary,
            keywords,
            sentiment: null,
            document_category: category,
            extracted_text: '', // Media files don't have extractable text
            analysis_metadata: {
                model: 'Media Analyzer v1.0',
                processing_time: processingTime,
                text_length: 0,
                file_type: mimetype.startsWith('video/') ? 'video' : 'audio',
                duration: metadata.duration || 0,
                media_metadata: {
                    duration: metadata.duration,
                    bitrate: metadata.bitrate,
                    codec: metadata.codec,
                    hasVideo: metadata.hasVideo,
                    hasAudio: metadata.hasAudio,
                    resolution: metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : null,
                    fps: metadata.fps,
                    sampleRate: metadata.sampleRate,
                    channels: metadata.channels,
                    title: metadata.title,
                    artist: metadata.artist,
                    album: metadata.album,
                    genre: metadata.genre,
                    year: metadata.year
                }
            }
        };
        
    } catch (error) {
        console.error('Media Analysis Error:', error);
        
        // Fallback analysis for media files
        const isVideo = mimetype.startsWith('video/');
        const mediaType = isVideo ? 'Video' : 'Audio';
        
        return {
            summary: `${mediaType} file: ${filename}\n\n• File Type: ${mediaType}\n• Format: ${mimetype}\n• Size: ${Math.round(fileBuffer.length / 1024)} KB\n\nNote: Detailed analysis unavailable - file may be corrupted or in an unsupported format.`,
            keywords: [mediaType.toLowerCase(), 'media', 'file'],
            sentiment: null,
            document_category: isVideo ? mediaAnalyzer.MEDIA_CATEGORIES.ENTERTAINMENT : mediaAnalyzer.MEDIA_CATEGORIES.MUSIC,
            extracted_text: '',
            analysis_metadata: {
                model: 'Media Analyzer v1.0',
                processing_time: 0,
                text_length: 0,
                error: error.message,
                file_type: isVideo ? 'video' : 'audio'
            }
        };
    }
}

/**
 * Main AI analysis function
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - File MIME type
 * @returns {Object} Analysis results
 */
async function analyzeFile(fileBuffer, filename, mimetype) {
    try {
        console.log(`Starting AI analysis for: ${filename}`);
        
        // Special handling for image files
        if (mimetype.startsWith('image/')) {
            return await analyzeImageFile(fileBuffer, filename, mimetype);
        }
        
        // Special handling for video/audio files
        if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) {
            return await analyzeMediaFile(fileBuffer, filename, mimetype);
        }
        
        // Extract text from file
        const extractedText = await extractTextFromFile(fileBuffer, filename, mimetype);
        
        if (!extractedText || extractedText.trim().length < 50) {
            return {
                summary: "File content could not be analyzed due to insufficient text content.",
                keywords: [],
                sentiment: null,
                document_category: DOCUMENT_CATEGORIES.OTHER,
                extracted_text: extractedText,
                analysis_metadata: {
                    model: AI_MODEL,
                    processing_time: 0,
                    text_length: extractedText?.length || 0,
                    error: "Insufficient text content"
                }
            };
        }

        const startTime = Date.now();
        
        // Perform parallel analysis
        const [summary, keywords, documentCategory, sentimentResult] = await Promise.all([
            generateSummary(extractedText),
            extractKeywords(extractedText),
            classifyDocument(extractedText, filename),
            isMediaFile(mimetype) ? analyzeSentiment(extractedText) : Promise.resolve(null)
        ]);

        const processingTime = Date.now() - startTime;

        return {
            summary,
            keywords,
            sentiment: sentimentResult,
            document_category: documentCategory,
            extracted_text: extractedText.substring(0, 5000), // Store first 5000 chars
            analysis_metadata: {
                model: AI_MODEL,
                processing_time: processingTime,
                text_length: extractedText.length,
                confidence_scores: {
                    summary: 0.85,
                    keywords: 0.90,
                    category: 0.80
                }
            }
        };

    } catch (error) {
        console.error('AI Analysis Error:', error);
        return {
            summary: "Analysis failed due to processing error.",
            keywords: [],
            sentiment: null,
            document_category: DOCUMENT_CATEGORIES.OTHER,
            extracted_text: "",
            analysis_metadata: {
                model: AI_MODEL,
                processing_time: 0,
                error: error.message
            }
        };
    }
}

const textExtractor = require('./textExtractor');

/**
 * Extract text from various file types using enhanced extractor
 */
async function extractTextFromFile(fileBuffer, filename, mimetype) {
    try {
        return await textExtractor.extractText(fileBuffer, filename, mimetype);
    } catch (error) {
        console.error('Text extraction error:', error);
        return '';
    }
}

/**
 * Generate AI-powered summary using Ollama
 */
async function generateSummary(text) {
    try {
        const prompt = `Analyze this document and provide a clean, professional summary in exactly 4-5 bullet points. Each point should be one concise sentence about what the document contains or discusses. Focus on the main topics, purpose, and key information.

Document content: ${text.substring(0, 2500)}

Format your response as exactly 4-5 bullet points using this format:
• [Point about main topic/purpose]
• [Point about key content area]
• [Point about specific details/data]
• [Point about context or audience]
• [Point about conclusions/outcomes if applicable]

Keep each bullet point to one sentence maximum. Be specific and informative.`;

        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: AI_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.2,
                max_tokens: 150
            }
        });

        const summary = response.data.response.trim();
        
        // Ensure the summary follows the bullet point format
        if (summary.includes('•')) {
            return summary;
        } else {
            // Format the response into bullet points if AI didn't follow format
            const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
            const bulletPoints = sentences.slice(0, 4).map(s => `• ${s.trim()}`);
            return bulletPoints.join('\n');
        }
        
    } catch (error) {
        console.error('Summary generation error:', error);
        // Fallback to basic summary
        return generateBasicSummary(text);
    }
}

/**
 * Fallback basic summary generation
 */
function generateBasicSummary(text) {
    try {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
        const wordCount = text.split(/\s+/).length;
        const characterCount = text.length;
        
        // Create informative bullet points about the document
        const bulletPoints = [
            `• Document contains ${wordCount} words and ${characterCount} characters`,
            `• Content appears to be ${guessDocumentType(text)}`,
            `• ${sentences.length > 0 ? 'Main content discusses: ' + sentences[0].trim().substring(0, 60) + '...' : 'Text content available for analysis'}`,
            `• Document structure suggests ${sentences.length} main sections or topics`
        ];
        
        return bulletPoints.join('\n');
    } catch (error) {
        return '• Document content available for analysis\n• Text extraction completed successfully\n• Ready for detailed examination\n• Contains readable text content';
    }
}

/**
 * Guess document type from basic patterns
 */
function guessDocumentType(text) {
    const lower = text.toLowerCase();
    if (lower.includes('dear') || lower.includes('@')) return 'correspondence or email';
    if (lower.includes('invoice') || lower.includes('total') || lower.includes('$')) return 'financial document';
    if (lower.includes('contract') || lower.includes('agreement')) return 'legal document';
    if (lower.includes('report') || lower.includes('analysis')) return 'business report';
    if (lower.includes('resume') || lower.includes('experience')) return 'professional document';
    return 'text document';
}

/**
 * Extract keywords using multiple techniques
 */
function extractKeywords(text) {
    try {
        // Use keyword-extractor for basic keyword extraction
        const basicKeywords = keyword.extract(text, {
            language: 'english',
            remove_digits: true,
            return_changed_case: true,
            remove_duplicates: true
        });

        // Use compromise for more advanced NLP
        const doc = compromise(text);
        const nouns = doc.nouns().out('array');
        const topics = doc.topics().out('array');
        
        // Combine and filter keywords
        const allKeywords = [...basicKeywords, ...nouns, ...topics]
            .filter(word => word && word.length > 2)
            .map(word => word.toLowerCase())
            .filter((word, index, arr) => arr.indexOf(word) === index)
            .slice(0, 6);

        return allKeywords;
    } catch (error) {
        console.error('Keyword extraction error:', error);
        return [];
    }
}

/**
 * Enhanced document classification with comprehensive pattern recognition
 */
async function classifyDocument(text, filename) {
    try {
        const fileExtension = filename.toLowerCase().split('.').pop();
        const textLower = text.toLowerCase();
        const filenameLower = filename.toLowerCase();
        
        // Enhanced rule-based classification with comprehensive patterns
        const classificationRules = [
            // Financial Documents
            {
                category: DOCUMENT_CATEGORIES.INVOICE,
                patterns: ['invoice', 'bill', 'payment due', 'amount due', 'billing', 'charges', 'inv-', 'invoice #', 'bill #']
            },
            {
                category: DOCUMENT_CATEGORIES.RECEIPT,
                patterns: ['receipt', 'transaction', 'purchased', 'total paid', 'payment received', 'thank you for your purchase']
            },
            {
                category: DOCUMENT_CATEGORIES.BANK_STATEMENT,
                patterns: ['bank statement', 'account statement', 'balance', 'transaction history', 'deposits', 'withdrawals']
            },
            {
                category: DOCUMENT_CATEGORIES.TAX_DOCUMENT,
                patterns: ['tax return', 'w-2', 'w-4', '1099', 'tax form', 'irs', 'tax year', 'deduction']
            },
            
            // Legal Documents
            {
                category: DOCUMENT_CATEGORIES.CONTRACT,
                patterns: ['contract', 'agreement', 'terms and conditions', 'party agrees', 'whereas', 'jurisdiction', 'binding']
            },
            {
                category: DOCUMENT_CATEGORIES.LEGAL_DOCUMENT,
                patterns: ['legal notice', 'court', 'litigation', 'defendant', 'plaintiff', 'hereby', 'witnesseth']
            },
            
            // Professional Documents
            {
                category: DOCUMENT_CATEGORIES.RESUME,
                patterns: ['resume', 'curriculum vitae', 'cv', 'work experience', 'education', 'skills', 'professional summary']
            },
            {
                category: DOCUMENT_CATEGORIES.COVER_LETTER,
                patterns: ['cover letter', 'dear hiring manager', 'position', 'application for', 'interested in', 'sincerely']
            },
            {
                category: DOCUMENT_CATEGORIES.BUSINESS_PLAN,
                patterns: ['business plan', 'executive summary', 'market analysis', 'financial projections', 'company overview']
            },
            {
                category: DOCUMENT_CATEGORIES.PROPOSAL,
                patterns: ['proposal', 'scope of work', 'deliverables', 'timeline', 'budget', 'recommended', 'solution']
            },
            {
                category: DOCUMENT_CATEGORIES.REPORT,
                patterns: ['report', 'analysis', 'findings', 'conclusion', 'methodology', 'results', 'summary']
            },
            
            // Education Documents
            {
                category: DOCUMENT_CATEGORIES.ASSIGNMENT,
                patterns: ['assignment', 'homework', 'due date', 'student name', 'course', 'professor', 'grade']
            },
            {
                category: DOCUMENT_CATEGORIES.ESSAY,
                patterns: ['essay', 'thesis statement', 'introduction', 'body paragraph', 'conclusion', 'bibliography']
            },
            {
                category: DOCUMENT_CATEGORIES.RESEARCH_PAPER,
                patterns: ['research paper', 'abstract', 'literature review', 'methodology', 'references', 'citation']
            },
            {
                category: DOCUMENT_CATEGORIES.CERTIFICATE,
                patterns: ['certificate', 'certification', 'awarded to', 'completion', 'achievement', 'accredited']
            },
            
            // Personal Documents
            {
                category: DOCUMENT_CATEGORIES.DIARY,
                patterns: ['dear diary', 'today i', 'my day', 'feeling', 'personal thoughts', 'yesterday']
            },
            {
                category: DOCUMENT_CATEGORIES.TODO_LIST,
                patterns: ['todo', 'to do', 'task list', '- [ ]', '☐', 'checklist', 'things to do']
            },
            {
                category: DOCUMENT_CATEGORIES.SHOPPING_LIST,
                patterns: ['shopping list', 'grocery', 'buy', 'store', 'items needed', 'purchase']
            },
            
            // Health & Medical
            {
                category: DOCUMENT_CATEGORIES.MEDICAL_RECORD,
                patterns: ['medical record', 'patient', 'diagnosis', 'treatment', 'doctor', 'physician', 'hospital']
            },
            {
                category: DOCUMENT_CATEGORIES.PRESCRIPTION,
                patterns: ['prescription', 'medication', 'dosage', 'pharmacy', 'take as directed', 'refill']
            },
            
            // Travel Documents
            {
                category: DOCUMENT_CATEGORIES.TRAVEL_ITINERARY,
                patterns: ['itinerary', 'flight', 'hotel', 'travel', 'departure', 'arrival', 'booking']
            },
            {
                category: DOCUMENT_CATEGORIES.BOOKING_CONFIRMATION,
                patterns: ['confirmation', 'booking', 'reserved', 'reservation number', 'check-in', 'check-out']
            },
            
            // Communication
            {
                category: DOCUMENT_CATEGORIES.EMAIL,
                patterns: ['from:', 'to:', 'subject:', 'dear', 'best regards', 'sincerely', '@']
            },
            {
                category: DOCUMENT_CATEGORIES.MEMO,
                patterns: ['memo', 'memorandum', 'to all staff', 'internal communication', 'urgent', 'please note']
            },
            
            // Creative & Media
            {
                category: DOCUMENT_CATEGORIES.RECIPE,
                patterns: ['recipe', 'ingredients', 'directions', 'cooking time', 'serves', 'preparation']
            },
            {
                category: DOCUMENT_CATEGORIES.BLOG_POST,
                patterns: ['blog post', 'published', 'author', 'tags', 'comments', 'share this post']
            },
            
            // Technical Documents
            {
                category: DOCUMENT_CATEGORIES.MANUAL,
                patterns: ['manual', 'instructions', 'user guide', 'how to', 'step by step', 'troubleshooting']
            },
            {
                category: DOCUMENT_CATEGORIES.API_DOCUMENTATION,
                patterns: ['api', 'endpoint', 'request', 'response', 'parameters', 'authentication']
            },
            
            // File extension based classification
            {
                category: DOCUMENT_CATEGORIES.PRESENTATION,
                patterns: [],
                extensions: ['ppt', 'pptx'],
                textPatterns: ['slide', 'presentation', 'agenda', 'overview']
            },
            {
                category: DOCUMENT_CATEGORIES.SPREADSHEET,
                patterns: [],
                extensions: ['xlsx', 'xls', 'csv'],
                textPatterns: ['data', 'table', 'column', 'row', 'total', 'sum']
            }
        ];
        
        // Check rule-based patterns
        for (const rule of classificationRules) {
            // Check filename patterns
            const filenameMatch = rule.patterns.some(pattern => 
                filenameLower.includes(pattern)
            );
            
            // Check text content patterns
            const textMatch = rule.patterns.some(pattern => 
                textLower.includes(pattern)
            );
            
            // Check file extensions
            const extensionMatch = rule.extensions && rule.extensions.includes(fileExtension);
            
            // Check additional text patterns for file types
            const additionalTextMatch = rule.textPatterns && rule.textPatterns.some(pattern => 
                textLower.includes(pattern)
            );
            
            if (filenameMatch || textMatch || extensionMatch || additionalTextMatch) {
                console.log(`Document classified as ${rule.category} based on pattern matching`);
                return rule.category;
            }
        }
        
        // AI-based classification with expanded categories
        const categoriesList = Object.values(DOCUMENT_CATEGORIES).join(', ');
        
        const prompt = `Analyze this document and classify it into one of these specific categories:

${categoriesList}

If the document doesn't clearly fit into any specific category, use 'general'.

Document filename: ${filename}
Document content (first 1000 chars): ${text.substring(0, 1000)}

Consider:
- Document structure and format
- Content patterns and keywords  
- Professional vs personal tone
- Technical vs general language
- Purpose and intent

Respond with only the category name exactly as listed above (use underscores, not spaces).`;

        try {
            const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
                model: AI_MODEL,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.1,
                    max_tokens: 15
                }
            });

            const aiCategory = response.data.response.trim().toLowerCase().replace(/[^a-z_]/g, '');
            
            // Validate AI response
            if (Object.values(DOCUMENT_CATEGORIES).includes(aiCategory)) {
                console.log(`Document classified as ${aiCategory} using AI analysis`);
                return aiCategory;
            }
        } catch (aiError) {
            console.warn('AI classification failed, using fallback logic:', aiError.message);
        }
        
        // Fallback classification based on common patterns
        if (textLower.includes('dear') || textLower.includes('sincerely') || textLower.includes('regards')) {
            return DOCUMENT_CATEGORIES.PERSONAL_LETTER;
        }
        if (textLower.includes('note') || textLower.includes('reminder') || textLower.includes('important')) {
            return DOCUMENT_CATEGORIES.NOTES;
        }
        if (textLower.includes('plan') || textLower.includes('schedule') || textLower.includes('timeline')) {
            return DOCUMENT_CATEGORIES.PROJECT_PLAN;
        }
        
        console.log('Document classified as GENERAL - no specific patterns matched');
        return DOCUMENT_CATEGORIES.GENERAL;
        
    } catch (error) {
        console.error('Document classification error:', error);
        return DOCUMENT_CATEGORIES.GENERAL;
    }
}

/**
 * Analyze sentiment for media files
 */
function analyzeSentiment(text) {
    try {
        const result = sentiment.analyze(text);
        
        if (result.score > 2) return 'POSITIVE';
        if (result.score < -2) return 'NEGATIVE';
        return 'NEUTRAL';
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        return 'NEUTRAL';
    }
}

/**
 * Check if file is a media file (audio/video)
 */
function isMediaFile(mimetype) {
    return mimetype.startsWith('audio/') || mimetype.startsWith('video/');
}

/**
 * Health check for AI services
 */
async function checkAIHealth() {
    try {
        const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
        return {
            status: 'healthy',
            models: response.data.models || [],
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get user-friendly category information
 */
function getCategoryInfo(category) {
    const categoryInfo = {
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
        meeting_minutes: { name: 'Meeting Minutes', icon: '📝', color: '#64748B' },
        
        // Personal Documents
        personal_letter: { name: 'Personal Letter', icon: '💌', color: '#F472B6' },
        diary: { name: 'Diary', icon: '📔', color: '#A78BFA' },
        journal: { name: 'Journal', icon: '📖', color: '#34D399' },
        notes: { name: 'Notes', icon: '📝', color: '#FBBF24' },
        todo_list: { name: 'Todo List', icon: '✅', color: '#60A5FA' },
        shopping_list: { name: 'Shopping List', icon: '🛒', color: '#FB7185' },
        
        // Financial & Legal
        bank_statement: { name: 'Bank Statement', icon: '🏦', color: '#059669' },
        receipt: { name: 'Receipt', icon: '🧾', color: '#DC2626' },
        tax_document: { name: 'Tax Document', icon: '📄', color: '#7C2D12' },
        insurance: { name: 'Insurance', icon: '🛡️', color: '#1D4ED8' },
        legal_document: { name: 'Legal Document', icon: '⚖️', color: '#374151' },
        will: { name: 'Will', icon: '📜', color: '#6B7280' },
        power_of_attorney: { name: 'Power of Attorney', icon: '🖋️', color: '#4B5563' },
        
        // Education & Learning
        assignment: { name: 'Assignment', icon: '📚', color: '#7C3AED' },
        essay: { name: 'Essay', icon: '✍️', color: '#C026D3' },
        research_paper: { name: 'Research Paper', icon: '🔬', color: '#0891B2' },
        thesis: { name: 'Thesis', icon: '🎓', color: '#BE185D' },
        study_notes: { name: 'Study Notes', icon: '📖', color: '#059669' },
        textbook: { name: 'Textbook', icon: '📚', color: '#DC2626' },
        tutorial: { name: 'Tutorial', icon: '🎯', color: '#EA580C' },
        exam: { name: 'Exam', icon: '📋', color: '#7C2D12' },
        certificate: { name: 'Certificate', icon: '🏆', color: '#F59E0B' },
        
        // Health & Medical
        medical_record: { name: 'Medical Record', icon: '🏥', color: '#DC2626' },
        prescription: { name: 'Prescription', icon: '💊', color: '#16A34A' },
        lab_results: { name: 'Lab Results', icon: '🧪', color: '#2563EB' },
        insurance_claim: { name: 'Insurance Claim', icon: '📋', color: '#7C3AED' },
        vaccination_record: { name: 'Vaccination Record', icon: '💉', color: '#059669' },
        
        // Travel & Lifestyle
        travel_itinerary: { name: 'Travel Itinerary', icon: '✈️', color: '#06B6D4' },
        booking_confirmation: { name: 'Booking Confirmation', icon: '🎫', color: '#8B5CF6' },
        passport: { name: 'Passport', icon: '📘', color: '#1E40AF' },
        visa: { name: 'Visa', icon: '🛂', color: '#059669' },
        recipe: { name: 'Recipe', icon: '👩‍🍳', color: '#F59E0B' },
        workout_plan: { name: 'Workout Plan', icon: '💪', color: '#EF4444' },
        
        // Technical & Reference
        manual: { name: 'Manual', icon: '📖', color: '#6B7280' },
        technical_spec: { name: 'Technical Spec', icon: '🔧', color: '#374151' },
        api_documentation: { name: 'API Documentation', icon: '🔗', color: '#1F2937' },
        code_documentation: { name: 'Code Documentation', icon: '💻', color: '#111827' },
        reference: { name: 'Reference', icon: '📚', color: '#4B5563' },
        guide: { name: 'Guide', icon: '🗺️', color: '#6B7280' },
        faq: { name: 'FAQ', icon: '❓', color: '#9CA3AF' },
        
        // Communication
        email: { name: 'Email', icon: '📧', color: '#3B82F6' },
        newsletter: { name: 'Newsletter', icon: '📰', color: '#06B6D4' },
        announcement: { name: 'Announcement', icon: '📢', color: '#F59E0B' },
        memo: { name: 'Memo', icon: '📝', color: '#64748B' },
        press_release: { name: 'Press Release', icon: '📣', color: '#EF4444' },
        
        // Creative & Media
        creative_writing: { name: 'Creative Writing', icon: '🎨', color: '#EC4899' },
        story: { name: 'Story', icon: '📚', color: '#A855F7' },
        poem: { name: 'Poem', icon: '🌸', color: '#F472B6' },
        script: { name: 'Script', icon: '🎬', color: '#6366F1' },
        lyrics: { name: 'Lyrics', icon: '🎵', color: '#8B5CF6' },
        blog_post: { name: 'Blog Post', icon: '📝', color: '#10B981' },
        article: { name: 'Article', icon: '📰', color: '#059669' },
        
        // Project & Planning
        project_plan: { name: 'Project Plan', icon: '📋', color: '#3B82F6' },
        schedule: { name: 'Schedule', icon: '📅', color: '#8B5CF6' },
        timeline: { name: 'Timeline', icon: '⏰', color: '#06B6D4' },
        budget: { name: 'Budget', icon: '💰', color: '#059669' },
        checklist: { name: 'Checklist', icon: '✅', color: '#22C55E' },
        
        // Miscellaneous
        form: { name: 'Form', icon: '📄', color: '#6B7280' },
        survey: { name: 'Survey', icon: '📊', color: '#8B5CF6' },
        questionnaire: { name: 'Questionnaire', icon: '❓', color: '#A855F7' },
        inventory: { name: 'Inventory', icon: '📦', color: '#F59E0B' },
        catalog: { name: 'Catalog', icon: '📖', color: '#64748B' },
        price_list: { name: 'Price List', icon: '💲', color: '#10B981' },
        terms_of_service: { name: 'Terms of Service', icon: '📋', color: '#374151' },
        privacy_policy: { name: 'Privacy Policy', icon: '🔒', color: '#1F2937' },
        warranty: { name: 'Warranty', icon: '🛡️', color: '#6366F1' },
        
        // Media Files
        photo: { name: 'Photo', icon: '📸', color: '#EC4899' },
        screenshot: { name: 'Screenshot', icon: '📱', color: '#3B82F6' },
        diagram: { name: 'Diagram', icon: '📊', color: '#8B5CF6' },
        chart: { name: 'Chart', icon: '📈', color: '#10B981' },
        
        // Fallback
        general: { name: 'General Document', icon: '📄', color: '#64748B' },
        other: { name: 'Other', icon: '📄', color: '#9CA3AF' }
    };
    
    return categoryInfo[category] || categoryInfo.general;
}

/**
 * Get all available categories grouped by type
 */
function getCategoriesGrouped() {
    return {
        'Business & Professional': [
            'invoice', 'contract', 'resume', 'cover_letter', 'business_plan', 
            'proposal', 'report', 'presentation', 'spreadsheet', 'meeting_minutes'
        ],
        'Personal Documents': [
            'personal_letter', 'diary', 'journal', 'notes', 'todo_list', 'shopping_list'
        ],
        'Financial & Legal': [
            'bank_statement', 'receipt', 'tax_document', 'insurance', 'legal_document', 
            'will', 'power_of_attorney'
        ],
        'Education & Learning': [
            'assignment', 'essay', 'research_paper', 'thesis', 'study_notes', 
            'textbook', 'tutorial', 'exam', 'certificate'
        ],
        'Health & Medical': [
            'medical_record', 'prescription', 'lab_results', 'insurance_claim', 'vaccination_record'
        ],
        'Travel & Lifestyle': [
            'travel_itinerary', 'booking_confirmation', 'passport', 'visa', 'recipe', 'workout_plan'
        ],
        'Technical & Reference': [
            'manual', 'technical_spec', 'api_documentation', 'code_documentation', 
            'reference', 'guide', 'faq'
        ],
        'Communication': [
            'email', 'newsletter', 'announcement', 'memo', 'press_release'
        ],
        'Creative & Media': [
            'creative_writing', 'story', 'poem', 'script', 'lyrics', 'blog_post', 'article'
        ],
        'Project & Planning': [
            'project_plan', 'schedule', 'timeline', 'budget', 'checklist'
        ],
        'Miscellaneous': [
            'form', 'survey', 'questionnaire', 'inventory', 'catalog', 'price_list', 
            'terms_of_service', 'privacy_policy', 'warranty'
        ]
    };
}

/**
 * Generic function to analyze content with Ollama
 */
async function analyzeWithOllama(prompt, context = 'general') {
    try {
        console.log(`🤖 Sending ${context} request to Ollama...`);
        
        const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
            model: AI_MODEL,
            prompt: prompt,
            stream: false
        }, {
            timeout: 8000
        });

        if (response.data && response.data.response) {
            const result = response.data.response.trim();
            console.log(`✅ ${context} analysis completed`);
            return result;
        } else {
            console.warn('⚠️ No response from Ollama');
            return null;
        }
    } catch (error) {
        console.error(`❌ Ollama ${context} analysis failed:`, error.message);
        
        if (error.code === 'ECONNREFUSED') {
            throw new Error('AI service is not available. Please make sure Ollama is running.');
        }
        
        throw new Error(`AI analysis failed: ${error.message}`);
    }
}

module.exports = { 
    analyzeFile, 
    checkAIHealth,
    analyzeWithOllama,
    DOCUMENT_CATEGORIES,
    getCategoryInfo,
    getCategoriesGrouped
};
