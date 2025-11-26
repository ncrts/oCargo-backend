/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Language Converter & Detector
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🌍 Purpose: Detect and set language preference from multiple sources
 * 📝 Function: getLanguage(req)
 * 
 * How It Works:
 * 1. Checks request headers for 'language' or 'accept-language'
 * 2. Checks request body for 'language' field
 * 3. Checks request query parameters for 'language'
 * 4. Falls back to default language 'fr_fr' if nothing found
 * 
 * Supported Languages:
 * - en_us: English (United States)
 * - fr_fr: French (France) - DEFAULT
 * 
 * Priority Order:
 * 1. Headers (X-Language or Accept-Language)
 * 2. Request Body (language field)
 * 3. Query Parameters (?language=en_us)
 * 4. Default: fr_fr
 * 
 * Usage:
 * ✅ res.locals.language = getLanguage(req);
 * ✅ const lang = getLanguage(req);
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/**
 * 🌐 Get Language from Request
 * 
 * Searches for language preference in the following order:
 * 1. request.headers['language'] or request.headers['x-language']
 * 2. request.headers['accept-language']
 * 3. request.body.language
 * 4. request.query.language
 * 5. Default: 'fr_fr'
 * 
 * @param {Object} req - Express request object
 * @returns {String} - Language code (en_us, fr_fr, etc.)
 * 
 * @example
 * // In middleware or route handler
 * const language = getLanguage(req);
 * res.locals.language = language;
 * 
 * @example
 * // Usage in response
 * getMessage("QUIZ_CREATED_SUCCESS", res.locals.language)
 */
const getLanguage = (req) => {
    const DEFAULT_LANGUAGE = 'fr_fr';
    const SUPPORTED_LANGUAGES = ['en_us', 'fr_fr'];

    // ===== STEP 1: Check Headers =====
    // Check for explicit language header
    if (req.headers && req.headers.language) {
        const headerLang = req.headers.language.toLowerCase();
        if (SUPPORTED_LANGUAGES.includes(headerLang)) {
            return headerLang;
        }
    }

    // Check for X-Language header (common convention)
    if (req.headers && req.headers['x-language']) {
        const xLanguage = req.headers['x-language'].toLowerCase();
        if (SUPPORTED_LANGUAGES.includes(xLanguage)) {
            return xLanguage;
        }
    }

    // Check for Accept-Language header (standard HTTP header)
    if (req.headers && req.headers['accept-language']) {
        const acceptLanguage = req.headers['accept-language'].toLowerCase();
        // Parse Accept-Language header (e.g., "en-US,en;q=0.9,fr;q=0.8")
        const languages = acceptLanguage.split(',').map(lang => {
            return lang.split(';')[0].trim().replace('-', '_');
        });
        
        // Find first supported language
        for (const lang of languages) {
            if (SUPPORTED_LANGUAGES.includes(lang)) {
                return lang;
            }
        }
    }

    // ===== STEP 2: Check Request Body =====
    if (req.body && req.body.language) {
        const bodyLang = req.body.language.toLowerCase();
        if (SUPPORTED_LANGUAGES.includes(bodyLang)) {
            return bodyLang;
        }
    }

    // ===== STEP 3: Check Query Parameters =====
    if (req.query && req.query.language) {
        const queryLang = req.query.language.toLowerCase();
        if (SUPPORTED_LANGUAGES.includes(queryLang)) {
            return queryLang;
        }
    }

    // ===== STEP 4: Return Default Language =====
    return DEFAULT_LANGUAGE;
};

/**
 * 🔧 Language Detection Middleware
 * 
 * Express middleware to automatically detect and set language in res.locals.language
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * 
 * @example
 * // In express app setup
 * app.use(languageDetectionMiddleware);
 * 
 * // Then in routes, language is available via res.locals.language
 * const message = getMessage("SUCCESS", res.locals.language);
 */
const languageDetectionMiddleware = (req, res, next) => {
    try {
        res.locals.language = getLanguage(req);
        next();
    } catch (error) {
        // If error occurs, set default language and continue
        res.locals.language = 'fr_fr';
        next();
    }
};

/**
 * 🔄 Validate Language Code
 * 
 * Checks if provided language code is supported
 * 
 * @param {String} language - Language code to validate
 * @returns {Boolean} - true if supported, false otherwise
 * 
 * @example
 * if (isValidLanguage('en_us')) {
 *   // Use the language
 * }
 */
const isValidLanguage = (language) => {
    const SUPPORTED_LANGUAGES = ['en_us', 'fr_fr'];
    return SUPPORTED_LANGUAGES.includes(language?.toLowerCase());
};

/**
 * 📋 Get Supported Languages List
 * 
 * Returns array of all supported language codes
 * 
 * @returns {Array} - Array of supported language codes
 * 
 * @example
 * const languages = getSupportedLanguages();
 * // Returns: ['en_us', 'fr_fr']
 */
const getSupportedLanguages = () => {
    return ['en_us', 'fr_fr'];
};

/**
 * 🎯 Normalize Language Code
 * 
 * Converts language codes to standard format (lowercase with underscore)
 * 
 * @param {String} language - Language code (can be en-US, EN_US, en_us, etc.)
 * @returns {String} - Normalized language code or default if invalid
 * 
 * @example
 * normalizeLanguage('EN-US')   // Returns: 'en_us'
 * normalizeLanguage('fr-fr')   // Returns: 'fr_fr'
 * normalizeLanguage('invalid') // Returns: 'fr_fr'
 */
const normalizeLanguage = (language) => {
    const DEFAULT_LANGUAGE = 'fr_fr';
    const SUPPORTED_LANGUAGES = ['en_us', 'fr_fr'];

    if (!language || typeof language !== 'string') {
        return DEFAULT_LANGUAGE;
    }

    // Convert to lowercase and replace hyphens with underscores
    const normalized = language.toLowerCase().replace('-', '_');

    if (SUPPORTED_LANGUAGES.includes(normalized)) {
        return normalized;
    }

    return DEFAULT_LANGUAGE;
};

/**
 * 🗣️ Get Language Display Name
 * 
 * Returns human-readable language name
 * 
 * @param {String} languageCode - Language code (en_us, fr_fr, etc.)
 * @returns {String} - Display name of language
 * 
 * @example
 * getLanguageName('en_us')  // Returns: 'English (US)'
 * getLanguageName('fr_fr')  // Returns: 'French (France)'
 */
const getLanguageName = (languageCode) => {
    const languageNames = {
        'en_us': 'English (US)',
        'fr_fr': 'French (France)'
    };

    return languageNames[languageCode?.toLowerCase()] || 'Unknown';
};

module.exports = {
    getLanguage,
    languageDetectionMiddleware,
    isValidLanguage,
    getSupportedLanguages,
    normalizeLanguage,
    getLanguageName
};
