// js/i18n.js - Core i18n logic for Zynk

(function() {
    // 1. Initialize language state
    let currentLang = localStorage.getItem('zynk_lang') || 'vi';
    
    // 2. Translation function
    window.t = function(key) {
        if (!window.zynkTranslations) return key;
        const dict = window.zynkTranslations[currentLang] || window.zynkTranslations['vi'];
        return dict[key] || key;
    };

    // 3. Apply translations to elements with [data-i18n]
    window.applyTranslations = function() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = window.t(key);
            
            if (translation && translation !== key) {
                // If it's an input or textarea, set placeholder
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    if (el.hasAttribute('placeholder')) {
                        el.setAttribute('placeholder', translation);
                    } else {
                        el.value = translation;
                    }
                } else {
                    // Standard elements
                    el.textContent = translation;
                }
            }
        });

        // Special case for HTML titles
        const titleKey = document.body.getAttribute('data-i18n-title');
        if (titleKey) {
            document.title = window.t(titleKey);
        }
    };

    // 4. Change language function
    window.changeLanguage = function(langCode) {
        if (window.zynkTranslations[langCode]) {
            currentLang = langCode;
            localStorage.setItem('zynk_lang', langCode);
            document.documentElement.lang = langCode;
            window.applyTranslations();
            
            // Dispatch event for other scripts (like common.js)
            const event = new CustomEvent('languageChanged', { detail: langCode });
            window.dispatchEvent(event);
            
            console.log(`Language changed to: ${langCode}`);
            return true;
        }
        return false;
    };

    // 5. Auto-run on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.lang = currentLang;
        window.applyTranslations();
    });

    // Handle dynamic common.js nav updates - listener
    window.addEventListener('navUpdated', () => {
        window.applyTranslations();
    });

})();
