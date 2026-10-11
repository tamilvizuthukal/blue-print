import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML strings using DOMPurify to prevent XSS.
 * This should be used before rendering any user-provided HTML with dangerouslySetInnerHTML.
 * 
 * @param html The raw HTML string to sanitize
 * @returns The sanitized HTML string
 */
export const sanitizeHtml = (html: string | undefined | null): string => {
    if (!html) return '';
    
    return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        // Allow common editor styles and attributes
        ADD_ATTR: ['style', 'target', 'rel'],
        ADD_TAGS: ['style']
    });
};

/**
 * A more restrictive sanitizer for cases where only basic formatting is allowed.
 */
export const sanitizeBasicHtml = (html: string | undefined | null): string => {
    if (!html) return '';
    
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'span', 'p', 'div'],
        ALLOWED_ATTR: ['style', 'class']
    });
};
