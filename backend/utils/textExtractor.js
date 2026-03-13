const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const mammoth = require('mammoth');
const ExcelJS = require('exceljs');

/**
 * Enhanced text extraction utility for various file types
 */
class TextExtractor {
    constructor() {
        this.maxTextLength = 50000; // 50KB max extracted text
        this.maxPages = 20; // Max pages to process for large documents
    }

    /**
     * Main text extraction method
     */
    async extractText(fileBuffer, filename, mimetype) {
        try {
            console.log(`Extracting text from ${filename} (${mimetype})`);
            
            switch (true) {
                case mimetype.startsWith('text/'):
                    return this.extractFromTextFile(fileBuffer);
                
                case mimetype === 'application/pdf':
                    return await this.extractFromPDF(fileBuffer);
                
                case mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                case mimetype === 'application/msword':
                    return await this.extractFromWordDoc(fileBuffer);
                
                case mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
                case mimetype === 'application/vnd.ms-excel':
                    return await this.extractFromExcel(fileBuffer);
                
                case mimetype.startsWith('image/'):
                    return await this.extractFromImage(fileBuffer);
                
                case mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
                case mimetype === 'application/vnd.ms-powerpoint':
                    return await this.extractFromPresentation(fileBuffer, filename);
                
                case mimetype === 'application/json':
                    return this.extractFromJSON(fileBuffer);
                
                case mimetype === 'text/csv':
                    return this.extractFromCSV(fileBuffer);
                
                default:
                    return this.extractAsPlainText(fileBuffer);
            }
        } catch (error) {
            console.error(`Text extraction error for ${filename}:`, error);
            return this.extractAsPlainText(fileBuffer);
        }
    }

    /**
     * Extract text from plain text files
     */
    extractFromTextFile(fileBuffer) {
        try {
            const text = fileBuffer.toString('utf-8');
            return this.truncateText(text);
        } catch (error) {
            console.error('Text file extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from PDF files
     */
    async extractFromPDF(fileBuffer) {
        try {
            const data = await pdfParse(fileBuffer, {
                max: this.maxPages
            });
            
            return this.truncateText(data.text);
        } catch (error) {
            console.error('PDF extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from Word documents
     */
    async extractFromWordDoc(fileBuffer) {
        try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            return this.truncateText(result.value);
        } catch (error) {
            console.error('Word document extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from Excel files
     */
    async extractFromExcel(fileBuffer) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(fileBuffer);
            
            let extractedText = '';
            let cellCount = 0;
            const maxCells = 1000; // Limit cells to process
            
            workbook.eachSheet((worksheet) => {
                worksheet.eachRow((row) => {
                    if (cellCount >= maxCells) return false;
                    
                    row.eachCell((cell) => {
                        if (cellCount >= maxCells) return false;
                        
                        if (cell.value && typeof cell.value === 'string') {
                            extractedText += cell.value + ' ';
                        } else if (cell.value && typeof cell.value === 'number') {
                            extractedText += cell.value.toString() + ' ';
                        }
                        cellCount++;
                    });
                });
            });
            
            return this.truncateText(extractedText);
        } catch (error) {
            console.error('Excel extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from images using OCR with quality filtering
     */
    async extractFromImage(fileBuffer) {
        try {
            console.log('Starting OCR text extraction...');
            
            const { data: { text, confidence } } = await Tesseract.recognize(fileBuffer, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            });
            
            // Filter out low-quality OCR results
            const cleanedText = this.cleanOCRText(text, confidence);
            
            if (cleanedText.length < 20) {
                console.log('OCR result too short or low quality, treating as image without text');
                return ''; // Return empty string for images without meaningful text
            }
            
            return this.truncateText(cleanedText);
        } catch (error) {
            console.error('OCR extraction error:', error);
            return '';
        }
    }

    /**
     * Clean and filter OCR text results
     */
    cleanOCRText(text, confidence) {
        if (!text || typeof text !== 'string') return '';
        
        // Remove excessive whitespace and line breaks
        let cleaned = text.replace(/\s+/g, ' ').trim();
        
        // Filter out lines with too many special characters (likely OCR noise)
        const lines = cleaned.split('\n');
        const filteredLines = lines.filter(line => {
            const specialCharRatio = (line.match(/[^a-zA-Z0-9\s.,!?()]/g) || []).length / line.length;
            const wordCount = line.trim().split(/\s+/).length;
            
            // Keep lines that have:
            // - Low special character ratio (< 30%)
            // - At least 2 words
            // - Not just random characters
            return specialCharRatio < 0.3 && wordCount >= 2 && line.length > 5;
        });
        
        const result = filteredLines.join('\n').trim();
        
        // If less than 70% of original text remains, it's likely garbled
        if (result.length < text.length * 0.3) {
            console.log('OCR result appears to be mostly noise, filtering out');
            return '';
        }
        
        return result;
    }

    /**
     * Extract text from PowerPoint presentations
     */
    async extractFromPresentation(fileBuffer, filename) {
        try {
            // For now, return a placeholder
            // You could implement PPTX text extraction using libraries like officegen
            return `Presentation file: ${filename}. PowerPoint text extraction requires additional implementation.`;
        } catch (error) {
            console.error('Presentation extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from JSON files
     */
    extractFromJSON(fileBuffer) {
        try {
            const jsonData = JSON.parse(fileBuffer.toString('utf-8'));
            const text = JSON.stringify(jsonData, null, 2);
            return this.truncateText(text);
        } catch (error) {
            console.error('JSON extraction error:', error);
            return '';
        }
    }

    /**
     * Extract text from CSV files
     */
    extractFromCSV(fileBuffer) {
        try {
            const csvText = fileBuffer.toString('utf-8');
            // Convert CSV to readable format
            const lines = csvText.split('\n').slice(0, 50); // First 50 rows
            const readable = lines.map(line => line.replace(/,/g, ' | ')).join('\n');
            return this.truncateText(readable);
        } catch (error) {
            console.error('CSV extraction error:', error);
            return '';
        }
    }

    /**
     * Fallback: attempt to extract as plain text
     */
    extractAsPlainText(fileBuffer) {
        try {
            const text = fileBuffer.toString('utf-8')
                .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable chars
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
            
            return this.truncateText(text);
        } catch (error) {
            console.error('Plain text extraction error:', error);
            return '';
        }
    }

    /**
     * Truncate text to maximum length
     */
    truncateText(text) {
        if (!text) return '';
        
        if (text.length <= this.maxTextLength) {
            return text;
        }
        
        // Truncate at word boundary
        const truncated = text.substring(0, this.maxTextLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }

    /**
     * Get file type information
     */
    getFileTypeInfo(mimetype, filename) {
        const extension = path.extname(filename).toLowerCase();
        
        return {
            extension,
            mimetype,
            category: this.categorizeFileType(mimetype),
            supportsTextExtraction: this.supportsTextExtraction(mimetype)
        };
    }

    /**
     * Check if file type supports text extraction
     */
    supportsTextExtraction(mimetype) {
        const supportedTypes = [
            'text/',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.',
            'application/vnd.ms-excel',
            'application/vnd.ms-powerpoint',
            'application/json',
            'image/'
        ];

        return supportedTypes.some(type => mimetype.startsWith(type));
    }

    /**
     * Categorize file type
     */
    categorizeFileType(mimetype) {
        switch (true) {
            case mimetype.startsWith('text/'):
                return 'text';
            case mimetype.startsWith('image/'):
                return 'image';
            case mimetype.startsWith('audio/'):
                return 'audio';
            case mimetype.startsWith('video/'):
                return 'video';
            case mimetype.includes('pdf'):
                return 'pdf';
            case mimetype.includes('word') || mimetype.includes('document'):
                return 'document';
            case mimetype.includes('sheet') || mimetype.includes('excel'):
                return 'spreadsheet';
            case mimetype.includes('presentation') || mimetype.includes('powerpoint'):
                return 'presentation';
            default:
                return 'other';
        }
    }
}

module.exports = new TextExtractor();