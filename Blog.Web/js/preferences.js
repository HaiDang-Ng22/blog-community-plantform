// Zynk global appearance and language bootstrap.
(function () {
    const supportedLanguages = ['vi', 'en', 'ja'];
    const savedTheme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
    const savedLanguage = supportedLanguages.includes(localStorage.getItem('zynk_lang'))
        ? localStorage.getItem('zynk_lang')
        : 'vi';

    document.documentElement.classList.toggle('dark-mode-root', savedTheme === 'dark');
    document.documentElement.lang = savedLanguage;
    document.documentElement.style.colorScheme = savedTheme;
    if (typeof window.t !== 'function') window.t = key => key;

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.classList.toggle('dark-mode-root', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
        document.body?.classList.toggle('dark-mode', isDark);
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async function ensureI18n() {
        try {
            if (!window.zynkTranslations) await loadScript('/js/lang.js?v=3.1');
            if (typeof window.applyTranslations !== 'function') await loadScript('/js/i18n.js?v=3.1');
            window.applyTranslations?.();
        } catch (error) {
            console.warn('Zynk preferences could not initialize translations.', error);
        }
    }

    const initialize = () => {
        applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');
        ensureI18n();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
        initialize();
    }

    window.addEventListener('themeChanged', event => {
        applyTheme(event.detail?.theme || localStorage.getItem('theme') || 'light');
    });

    window.addEventListener('storage', event => {
        if (event.key === 'theme') applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
        if (event.key === 'zynk_lang' && supportedLanguages.includes(event.newValue)) {
            document.documentElement.lang = event.newValue;
            window.changeLanguage?.(event.newValue, { persist: false, notify: false });
        }
    });
})();
