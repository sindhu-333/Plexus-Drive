/**
 * Media Analyzer - Video and Audio Analysis Module
 * Provides comprehensive analysis for video and audio files
 */

const ffprobe = require('ffprobe-static');
const { parseFile } = require('music-metadata');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = promisify(exec);

// Media file categories for intelligent classification
const MEDIA_CATEGORIES = {
    // Video Categories
    HOME_VIDEO: 'home_video',
    PRESENTATION: 'presentation', 
    TUTORIAL: 'tutorial',
    MEETING: 'meeting',
    ENTERTAINMENT: 'entertainment',
    DOCUMENTARY: 'documentary',
    ANIMATION: 'animation',
    SCREEN_RECORDING: 'screen_recording',
    
    // Audio Categories
    MUSIC: 'music',
    PODCAST: 'podcast',
    VOICE_MEMO: 'voice_memo',
    MEETING_AUDIO: 'meeting_audio',
    AUDIOBOOK: 'audiobook',
    SOUND_EFFECT: 'sound_effect',
    SPEECH: 'speech',
    AMBIENT: 'ambient'
};

/**
 * Extract comprehensive metadata from video/audio files
 */
async function extractMediaMetadata(fileBuffer, filename, mimetype) {
    try {
        console.log(`🎬 Extracting metadata for: ${filename}`);
        
        // Create temporary file for analysis
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${filename}`);
        fs.writeFileSync(tempFilePath, fileBuffer);
        
        let metadata = {};
        
        try {
            // Try music-metadata first (works well for audio and some video)
            const musicMetadata = await parseFile(tempFilePath);
            metadata = await processBasicMetadata(musicMetadata, mimetype);
        } catch (error) {
            console.log('Music-metadata failed, trying ffprobe...');
            // Fallback to ffprobe if available
            if (ffprobe.path) {
                metadata = await extractWithFFProbe(tempFilePath, mimetype);
            } else {
                metadata = await extractBasicInfo(fileBuffer, filename, mimetype);
            }
        }
        
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
        
        return metadata;
        
    } catch (error) {
        console.error('Metadata extraction error:', error);
        return await extractBasicInfo(fileBuffer, filename, mimetype);
    }
}

/**
 * Process metadata from music-metadata library
 */
async function processBasicMetadata(musicMetadata, mimetype) {
    const isVideo = mimetype.startsWith('video/');
    const isAudio = mimetype.startsWith('audio/');
    
    return {
        // Basic file info
        duration: musicMetadata.format.duration || 0,
        bitrate: musicMetadata.format.bitrate || 0,
        sampleRate: musicMetadata.format.sampleRate || 0,
        channels: musicMetadata.format.numberOfChannels || 0,
        codec: musicMetadata.format.codec || musicMetadata.format.container || 'unknown',
        
        // Embedded metadata
        title: musicMetadata.common.title || null,
        artist: musicMetadata.common.artist || musicMetadata.common.albumartist || null,
        album: musicMetadata.common.album || null,
        genre: musicMetadata.common.genre ? musicMetadata.common.genre.join(', ') : null,
        year: musicMetadata.common.year || null,
        comment: musicMetadata.common.comment ? musicMetadata.common.comment.join(' ') : null,
        
        // Technical details
        container: musicMetadata.format.container || 'unknown',
        lossless: musicMetadata.format.lossless || false,
        hasVideo: isVideo,
        hasAudio: isAudio || isVideo
    };
}

/**
 * Extract metadata using ffprobe (if available)
 */
async function extractWithFFProbe(filePath, mimetype) {
    try {
        const command = `"${ffprobe.path}" -v quiet -print_format json -show_format -show_streams "${filePath}"`;
        const { stdout } = await execAsync(command);
        const probeData = JSON.parse(stdout);
        
        const format = probeData.format || {};
        const videoStream = probeData.streams?.find(s => s.codec_type === 'video');
        const audioStream = probeData.streams?.find(s => s.codec_type === 'audio');
        
        return {
            // Duration and basic info
            duration: parseFloat(format.duration) || 0,
            bitrate: parseInt(format.bit_rate) || 0,
            size: parseInt(format.size) || 0,
            
            // Video specific
            width: videoStream?.width || null,
            height: videoStream?.height || null,
            fps: videoStream ? eval(videoStream.r_frame_rate) : null,
            videoCodec: videoStream?.codec_name || null,
            
            // Audio specific
            sampleRate: audioStream?.sample_rate || 0,
            channels: audioStream?.channels || 0,
            audioCodec: audioStream?.codec_name || null,
            
            // Embedded metadata
            title: format.tags?.title || null,
            artist: format.tags?.artist || format.tags?.album_artist || null,
            album: format.tags?.album || null,
            genre: format.tags?.genre || null,
            year: format.tags?.date ? new Date(format.tags.date).getFullYear() : null,
            comment: format.tags?.comment || null,
            
            container: format.format_name || 'unknown',
            hasVideo: !!videoStream,
            hasAudio: !!audioStream
        };
        
    } catch (error) {
        console.error('FFProbe extraction failed:', error);
        throw error;
    }
}

/**
 * Fallback basic info extraction (when other methods fail)
 */
async function extractBasicInfo(fileBuffer, filename, mimetype) {
    const isVideo = mimetype.startsWith('video/');
    const isAudio = mimetype.startsWith('audio/');
    
    // Extract basic info from filename and buffer
    const extension = path.extname(filename).toLowerCase();
    
    return {
        duration: 0, // Unknown
        bitrate: 0,
        size: fileBuffer.length,
        codec: extension.substring(1), // Remove dot from extension
        container: extension.substring(1),
        hasVideo: isVideo,
        hasAudio: isAudio || isVideo,
        
        // Try to extract from filename
        title: path.basename(filename, extension),
        artist: null,
        album: null,
        genre: null,
        year: null,
        comment: null
    };
}

/**
 * Classify media file based on metadata and filename patterns
 */
function classifyMediaFile(metadata, filename, mimetype) {
    const isVideo = mimetype.startsWith('video/');
    const isAudio = mimetype.startsWith('audio/');
    const lowerFilename = filename.toLowerCase();
    
    // Video classification
    if (isVideo) {
        if (lowerFilename.includes('meeting') || lowerFilename.includes('call')) {
            return MEDIA_CATEGORIES.MEETING;
        }
        if (lowerFilename.includes('presentation') || lowerFilename.includes('slide')) {
            return MEDIA_CATEGORIES.PRESENTATION;
        }
        if (lowerFilename.includes('tutorial') || lowerFilename.includes('lesson') || lowerFilename.includes('howto')) {
            return MEDIA_CATEGORIES.TUTORIAL;
        }
        if (lowerFilename.includes('screen') || lowerFilename.includes('capture') || lowerFilename.includes('record')) {
            return MEDIA_CATEGORIES.SCREEN_RECORDING;
        }
        if (lowerFilename.includes('home') || lowerFilename.includes('family') || lowerFilename.includes('personal')) {
            return MEDIA_CATEGORIES.HOME_VIDEO;
        }
        
        // Default video category
        return MEDIA_CATEGORIES.ENTERTAINMENT;
    }
    
    // Audio classification
    if (isAudio) {
        // Check metadata first
        if (metadata.artist && metadata.album) {
            return MEDIA_CATEGORIES.MUSIC;
        }
        
        // Filename patterns
        if (lowerFilename.includes('podcast') || lowerFilename.includes('episode')) {
            return MEDIA_CATEGORIES.PODCAST;
        }
        if (lowerFilename.includes('memo') || lowerFilename.includes('note') || lowerFilename.includes('voice')) {
            return MEDIA_CATEGORIES.VOICE_MEMO;
        }
        if (lowerFilename.includes('meeting') || lowerFilename.includes('call') || lowerFilename.includes('conference')) {
            return MEDIA_CATEGORIES.MEETING_AUDIO;
        }
        if (lowerFilename.includes('book') || lowerFilename.includes('chapter')) {
            return MEDIA_CATEGORIES.AUDIOBOOK;
        }
        if (lowerFilename.includes('speech') || lowerFilename.includes('talk')) {
            return MEDIA_CATEGORIES.SPEECH;
        }
        
        // Check duration for classification
        if (metadata.duration > 1800) { // > 30 minutes
            return metadata.artist ? MEDIA_CATEGORIES.MUSIC : MEDIA_CATEGORIES.PODCAST;
        }
        
        return MEDIA_CATEGORIES.MUSIC; // Default for audio
    }
    
    return 'unknown';
}

/**
 * Generate user-friendly summary for media files
 */
function generateMediaSummary(metadata, filename, category, mimetype) {
    const isVideo = mimetype.startsWith('video/');
    const isAudio = mimetype.startsWith('audio/');
    
    let summary = '';
    
    // Friendly header based on content type
    if (isVideo) {
        summary += `📹 Your Video File\n\n`;
    } else {
        summary += `🎵 Your Audio File\n\n`;
    }
    
    // What kind of content is this?
    summary += getContentDescription(category, metadata, filename, isVideo) + '\n\n';
    
    // Duration in friendly format
    if (metadata.duration > 0) {
        const duration = formatDuration(metadata.duration);
        if (metadata.duration < 60) {
            summary += `⏱️ Duration: ${duration} (Quick clip)\n`;
        } else if (metadata.duration < 300) {
            summary += `⏱️ Duration: ${duration} (Short video)\n`;
        } else if (metadata.duration < 1800) {
            summary += `⏱️ Duration: ${duration} (Medium length)\n`;
        } else {
            summary += `⏱️ Duration: ${duration} (Long content)\n`;
        }
    }
    
    // Media info with context
    if (metadata.title && metadata.title !== path.basename(filename, path.extname(filename))) {
        summary += `📝 Title: ${metadata.title}\n`;
    }
    
    if (metadata.artist) {
        summary += `👤 Creator: ${metadata.artist}\n`;
    }
    
    if (metadata.album) {
        summary += `📂 Collection: ${metadata.album}\n`;
    }
    
    if (metadata.genre) {
        summary += `🎭 Style: ${metadata.genre}\n`;
    }
    
    if (metadata.year) {
        summary += `📅 Year: ${metadata.year}\n`;
    }
    
    // Quality and compatibility
    summary += `\nQuality & Compatibility:\n`;
    
    // Video quality explanation
    if (isVideo && metadata.width && metadata.height) {
        const resolution = `${metadata.width}×${metadata.height}`;
        if (metadata.width >= 1920) {
            summary += `📺 Picture Quality: Full HD (${resolution}) - Great for large screens\n`;
        } else if (metadata.width >= 1280) {
            summary += `📺 Picture Quality: HD (${resolution}) - Good for most devices\n`;
        } else {
            summary += `📺 Picture Quality: Standard (${resolution}) - Best for smaller screens\n`;
        }
    }
    
    // Audio quality in user terms
    if (metadata.channels > 0) {
        const channelText = metadata.channels === 1 ? 'Mono (single channel)' : 
                           metadata.channels === 2 ? 'Stereo (left & right)' : 
                           `Surround sound (${metadata.channels} channels)`;
        summary += `🔊 Audio: ${channelText}\n`;
    }
    
    // Overall quality assessment
    if (metadata.bitrate > 0) {
        if (isVideo) {
            if (metadata.bitrate > 5000000) {
                summary += '✨ Overall Quality: Excellent - Perfect for any use\n';
            } else if (metadata.bitrate > 2000000) {
                summary += '👍 Overall Quality: Good - Suitable for most purposes\n';
            } else {
                summary += '📱 Overall Quality: Basic - Good for sharing and mobile viewing\n';
            }
        } else {
            if (metadata.bitrate > 256000) {
                summary += '🎶 Audio Quality: High fidelity - Perfect for music listening\n';
            } else if (metadata.bitrate > 128000) {
                summary += '👂 Audio Quality: Standard - Good for general listening\n';
            } else {
                summary += '📞 Audio Quality: Compressed - Ideal for voice recordings\n';
            }
        }
    }
    
    // File compatibility
    const format = getFormatInfo(metadata.codec, mimetype);
    summary += `📱 Device Compatibility: ${format}\n`;
    
    // Helpful suggestions
    summary += `\n💡 What you can do:\n`;
    summary += getSuggestions(category, metadata, isVideo);
    
    return summary;
}

/**
 * Get user-friendly content description
 */
function getContentDescription(category, metadata, filename, isVideo) {
    const descriptions = {
        // Video descriptions
        'home_video': '🏠 This looks like a personal video - maybe family moments, events, or memories you\'ve captured.',
        'meeting': '💼 This appears to be a meeting or conference recording - useful for reviewing discussions.',
        'presentation': '📊 This seems to be a presentation or slideshow - great for sharing information.',
        'tutorial': '🎓 This looks like a tutorial or educational content - perfect for learning something new.',
        'screen_recording': '🖥️ This appears to be a screen recording - useful for demos or instructions.',
        'entertainment': '🎬 This looks like entertainment content - a movie, show, or fun video.',
        
        // Audio descriptions
        'music': '🎵 This is a music track - perfect for listening and enjoying.',
        'podcast': '🎙️ This appears to be a podcast or audio show - great for learning while multitasking.',
        'voice_memo': '📝 This looks like a voice recording - perhaps notes or reminders you\'ve made.',
        'meeting_audio': '🗣️ This seems to be meeting audio - useful for reviewing conversations.',
        'audiobook': '📚 This appears to be an audiobook - perfect for listening while doing other activities.',
        'speech': '🎤 This looks like a speech or presentation - important spoken content.'
    };
    
    return descriptions[category] || (isVideo ? '📹 This is a video file ready to watch.' : '🎵 This is an audio file ready to listen to.');
}

/**
 * Get format compatibility info
 */
function getFormatInfo(codec, mimetype) {
    if (mimetype.includes('mp4') || codec === 'h264') {
        return 'Works on all modern devices (phones, computers, TVs)';
    } else if (mimetype.includes('mp3') || codec === 'mp3') {
        return 'Universal audio format - plays everywhere';
    } else if (mimetype.includes('wav')) {
        return 'High-quality audio - works on most devices';
    } else if (mimetype.includes('avi') || mimetype.includes('mov')) {
        return 'Common video format - should work on most devices';
    } else {
        return 'May need specific apps to play on some devices';
    }
}

/**
 * Get helpful suggestions based on content
 */
function getSuggestions(category, metadata, isVideo) {
    let suggestions = '';
    
    if (category === 'home_video' || category === 'entertainment') {
        suggestions += '• Share with family and friends\n';
        suggestions += '• Create collections of similar videos\n';
        if (metadata.duration > 300) suggestions += '• Consider editing for highlights\n';
    } else if (category === 'meeting' || category === 'meeting_audio') {
        suggestions += '• Share with meeting participants\n';
        suggestions += '• Add to project folders for reference\n';
        suggestions += '• Extract key points for documentation\n';
    } else if (category === 'presentation' || category === 'tutorial') {
        suggestions += '• Share with colleagues or students\n';
        suggestions += '• Use for training purposes\n';
        suggestions += '• Reference for future presentations\n';
    } else if (category === 'music') {
        suggestions += '• Add to your music collection\n';
        suggestions += '• Create playlists by genre or mood\n';
        suggestions += '• Share with friends who like this style\n';
    } else if (category === 'podcast' || category === 'audiobook') {
        suggestions += '• Listen during commutes or exercise\n';
        suggestions += '• Take notes on important points\n';
        suggestions += '• Share interesting episodes with others\n';
    } else {
        suggestions += '• Organize in relevant folders\n';
        suggestions += '• Add descriptive names for easy finding\n';
        suggestions += '• Share with people who might be interested\n';
    }
    
    return suggestions;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Extract keywords from media metadata
 */
function extractMediaKeywords(metadata, filename, category) {
    const keywords = new Set();
    
    // Add category as keyword
    keywords.add(category.replace('_', ' '));
    
    // Add metadata keywords
    if (metadata.title) {
        metadata.title.split(/\s+/).forEach(word => {
            if (word.length > 2) keywords.add(word.toLowerCase());
        });
    }
    
    if (metadata.artist) {
        keywords.add(metadata.artist.toLowerCase());
    }
    
    if (metadata.album) {
        metadata.album.split(/\s+/).forEach(word => {
            if (word.length > 2) keywords.add(word.toLowerCase());
        });
    }
    
    if (metadata.genre) {
        metadata.genre.split(',').forEach(genre => {
            keywords.add(genre.trim().toLowerCase());
        });
    }
    
    // Add filename keywords
    const baseName = path.basename(filename, path.extname(filename));
    baseName.split(/[-_\s]+/).forEach(word => {
        if (word.length > 2) keywords.add(word.toLowerCase());
    });
    
    // Add technical keywords
    if (metadata.hasVideo) keywords.add('video');
    if (metadata.hasAudio) keywords.add('audio');
    
    return Array.from(keywords).slice(0, 20); // Limit to 20 keywords
}

module.exports = {
    extractMediaMetadata,
    classifyMediaFile,
    generateMediaSummary,
    extractMediaKeywords,
    MEDIA_CATEGORIES
};